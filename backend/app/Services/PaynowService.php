<?php

namespace App\Services;

use Paynow\Payments\Paynow;
use Paynow\Util\Hash;

class PaynowService
{
    private string $integrationId;
    private string $integrationKey;
    private string $resultUrl;
    private string $returnUrl;

    public function __construct()
    {
        $this->integrationId  = env('PAYNOW_INTEGRATION_ID', '');
        $this->integrationKey = env('PAYNOW_INTEGRATION_KEY', '');
        $this->resultUrl      = env('PAYNOW_RESULT_URL', '');
        $this->returnUrl      = env('PAYNOW_RETURN_URL', '');
    }

    /**
     * Initiate a Paynow web payment via the official SDK.
     *
     * $txId is embedded directly in the return URL so that when Paynow redirects
     * the user back after payment, the frontend receives the transaction ID it needs
     * to call the poll endpoint. In sandbox mode the redirect URL IS the return URL,
     * so the same mechanism applies.
     *
     * When credentials are missing or hold placeholder values, returns a simulated
     * sandbox response so the full UI flow can be tested locally without real
     * Paynow credentials.
     *
     * @param  string $reference    Unique merchant reference for this transaction
     * @param  int    $amountCents  Amount in cents (e.g. 5000 = $50.00)
     * @param  string $txId         Internal transaction UUID to embed in the return URL
     * @return array{success: bool, redirectUrl: string, paynowReference: string, pollUrl: string, error: string}
     */
    public function initiate(string $reference, int $amountCents, string $txId = ''): array
    {
        if ($this->isSandboxMode()) {
            return $this->sandboxResponse($reference, $txId);
        }

        // SDK expects a float, not a formatted string.
        $amount    = $amountCents / 100;

        // Build a return URL that always carries payment=complete and the txId so
        // the frontend knows which transaction to poll when the user lands back.
        $returnUrl = $this->buildReturnUrl($txId);

        try {
            $paynow  = new Paynow(
                $this->integrationId,
                $this->integrationKey,
                $returnUrl,
                $this->resultUrl
            );

            // authemail is optional for web payments. Passing the user's email causes
            // Paynow test-mode integrations to reject the request unless it exactly
            // matches the merchant's registered email. Leave it empty so the restriction
            // does not apply and the payer is not required to have a Paynow account.
            $payment = $paynow->createPayment($reference, '');
            $payment->add("SchoolLedger Subscription - {$reference}", $amount);

            $response = $paynow->send($payment);
        } catch (\Throwable $e) {
            return [
                'success'         => false,
                'redirectUrl'     => '',
                'paynowReference' => '',
                'pollUrl'         => '',
                'error'           => 'Could not reach Paynow: ' . $e->getMessage(),
            ];
        }

        if (!$response->success()) {
            $errors   = $response->errors();
            $errorMsg = is_array($errors) ? implode(', ', $errors) : (string) $errors;
            return [
                'success'         => false,
                'redirectUrl'     => '',
                'paynowReference' => '',
                'pollUrl'         => '',
                'error'           => $errorMsg,
            ];
        }

        $data = $response->data();

        return [
            'success'         => true,
            'redirectUrl'     => $response->redirectUrl() ?: '',
            'paynowReference' => $data['paynowreference'] ?? '',
            'pollUrl'         => $response->pollUrl()     ?: '',
            'error'           => '',
        ];
    }

    /**
     * Poll Paynow for the current status of a transaction.
     *
     * Uses the SDK's pollTransaction($pollUrl) per the official docs.
     * In sandbox mode returns a synthetic paid response without an HTTP call.
     * An empty $pollUrl in production returns a non-paid error result rather
     * than attempting an invalid request.
     *
     * Status strings returned by the SDK use title-case (e.g. "Paid", "Cancelled",
     * "Failed"). Callers should use strtolower() for comparisons.
     *
     * @return array{paid: bool, status: string, reference: string, error?: string}
     */
    public function pollTransaction(string $pollUrl): array
    {
        if ($this->isSandboxMode()) {
            return ['paid' => true, 'status' => 'Paid', 'reference' => 'sandbox'];
        }

        if ($pollUrl === '') {
            return [
                'paid'      => false,
                'status'    => 'no-poll-url',
                'reference' => '',
                'error'     => 'No poll URL is available for this transaction.',
            ];
        }

        try {
            $paynow = new Paynow(
                $this->integrationId,
                $this->integrationKey,
                $this->returnUrl,
                $this->resultUrl
            );

            $status = $paynow->pollTransaction($pollUrl);
        } catch (\Throwable $e) {
            return ['paid' => false, 'status' => 'error', 'reference' => '', 'error' => $e->getMessage()];
        }

        $data = $status->data();

        return [
            'paid'      => $status->paid(),
            'status'    => $status->status(),
            'reference' => $data['paynowreference'] ?? '',
        ];
    }

    /**
     * Verify the Paynow webhook hash using the SDK's Hash utility.
     *
     * @param  array $post  Raw POST fields from the Paynow callback
     * @return bool  True if the hash is valid, false otherwise
     */
    public function verifyHash(array $post): bool
    {
        if (empty($post['hash'])) {
            return false;
        }

        return Hash::verify($post, strtolower($this->integrationKey));
    }

    /**
     * Returns true when credentials are missing or still hold placeholder values.
     * In this mode, real Paynow calls are skipped and a sandbox response is used.
     */
    public function isSandboxMode(): bool
    {
        $placeholders = ['', 'your_paynow_integration_id', 'your_paynow_integration_key'];
        return in_array($this->integrationId,  $placeholders, true)
            || in_array($this->integrationKey, $placeholders, true);
    }

    /**
     * Builds the URL that Paynow (or the sandbox response) redirects the user back
     * to after payment. Always includes payment=complete so the frontend knows to
     * trigger the poll, and embeds txId so the correct transaction is polled.
     *
     * This URL is passed as the $returnUrl in the Paynow SDK constructor, meaning
     * Paynow will redirect the user here after they complete or cancel payment on
     * the Paynow website.
     */
    private function buildReturnUrl(string $txId = ''): string
    {
        // Start from the configured base URL, stripping any trailing delimiters.
        $base = rtrim($this->returnUrl ?: 'http://localhost:8080/billing', '?& ');

        // Strip any existing payment=complete fragment to avoid duplication when
        // the env variable already contains it.
        $base = (string) preg_replace('/([?&])payment=complete(&|$)/', '$1', $base);
        $base = rtrim($base, '?&');

        $sep = str_contains($base, '?') ? '&' : '?';
        $url = $base . $sep . 'payment=complete';

        if ($txId !== '') {
            $url .= '&txId=' . urlencode($txId);
        }

        return $url;
    }

    /**
     * Returns a simulated Paynow success response for local/sandbox testing.
     * The redirect URL acts as both the payment page and the return URL, pointing
     * directly back to billing with all necessary query parameters already set.
     */
    private function sandboxResponse(string $reference, string $txId = ''): array
    {
        // buildReturnUrl already includes payment=complete and txId.
        $redirectUrl = $this->buildReturnUrl($txId);
        $sep         = str_contains($redirectUrl, '?') ? '&' : '?';

        return [
            'success'         => true,
            'redirectUrl'     => $redirectUrl . $sep . 'sandbox=1&ref=' . urlencode($reference),
            'paynowReference' => 'SANDBOX-' . strtoupper(substr(md5($reference), 0, 10)),
            'pollUrl'         => '',
            'error'           => '',
        ];
    }
}
