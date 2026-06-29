<?php

namespace App\Services;

use App\Models\SubscriptionInvoiceModel;
use Dompdf\Dompdf;
use Dompdf\Options;

class InvoiceService
{
    private SubscriptionInvoiceModel $invoiceModel;

    public function __construct()
    {
        $this->invoiceModel = new SubscriptionInvoiceModel();
    }

    public function createInvoice(array $subscription, array $transaction, string $tenantName): array
    {
        $existing = $this->invoiceModel->findByTransactionId($transaction['id']);
        if ($existing) {
            return $existing;
        }

        $invoiceNumber = $this->generateInvoiceNumber($subscription['tenant_id']);
        $now           = date('Y-m-d H:i:s');

        $planModel = new \App\Models\SubscriptionPlanModel();
        $plan      = $planModel->getPlanById($subscription['plan_id']);
        $planName  = $plan ? $plan['name'] : $subscription['plan_id'];

        $invoiceId = $this->generateUuid();

        $record = [
            'id'              => $invoiceId,
            'tenant_id'       => $subscription['tenant_id'],
            'subscription_id' => $subscription['id'],
            'transaction_id'  => $transaction['id'],
            'invoice_number'  => $invoiceNumber,
            'school_name'     => $tenantName,
            'plan_name'       => $planName,
            'billing_cycle'   => $subscription['billing_cycle'],
            'amount_cents'    => (int) $transaction['amount_cents'],
            'currency'        => $transaction['currency'],
            'issued_at'       => $now,
        ];

        $this->invoiceModel->insert($record);

        return $this->invoiceModel->find($invoiceId);
    }

    public function generatePdf(array $invoice): string
    {
        $logoPath = FCPATH . '1765028860800.jpg';
        $logoDataUri = '';
        if (is_file($logoPath)) {
            $logoDataUri = 'data:image/jpeg;base64,' . base64_encode(file_get_contents($logoPath));
        }

        $html = view('invoices/invoice_template', [
            'invoice'      => $invoice,
            'logoDataUri'  => $logoDataUri,
        ], ['saveData' => false]);

        $options = new Options();
        $options->set('isHtml5ParserEnabled', true);
        $options->set('isRemoteEnabled', false);

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        return $dompdf->output();
    }

    private function generateInvoiceNumber(string $tenantId): string
    {
        // Strip the common 'tenant_' prefix so each tenant gets a distinct short code.
        // e.g. 'tenant_920862d907c83ec3' → '920862'
        $uniquePart    = preg_replace('/^tenant_/i', '', $tenantId);
        $shortTenantId = strtoupper(substr(str_replace('-', '', $uniquePart), 0, 6));
        $yearMonth     = date('Ym');
        $prefix        = 'INV-' . $shortTenantId . '-' . $yearMonth . '-';

        // Count globally (not per-tenant) because invoice_number has a global UNIQUE KEY.
        $count = $this->invoiceModel
            ->like('invoice_number', $prefix, 'after')
            ->countAllResults();

        $seq = str_pad((string) ($count + 1), 3, '0', STR_PAD_LEFT);

        return $prefix . $seq;
    }

    private function generateUuid(): string
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }
}
