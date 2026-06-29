<?php

namespace App\Libraries;

use App\Models\SystemErrorLogModel;
use CodeIgniter\Debug\ExceptionHandler as DefaultExceptionHandler;
use CodeIgniter\Debug\ExceptionHandlerInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Exceptions as ExceptionsConfig;
use Throwable;

/**
 * ExceptionHandler — centralized uncaught-exception handler.
 *
 * Responsibilities:
 *  - Generate a unique Correlation ID (ERR-YYYYMMDD-XXXXXX).
 *  - Persist the full exception detail to system_error_logs.
 *  - Delegate the actual error rendering to CodeIgniter's default handler,
 *    preserving its standard error formatting for CLI, HTTP, and AJAX requests.
 *
 * Registered in Config/Exceptions.php::handler() for statusCode >= 500.
 */
class ExceptionHandler implements ExceptionHandlerInterface
{
    public function handle(
        Throwable $exception,
        RequestInterface $request,
        ResponseInterface $response,
        int $statusCode,
        int $exitCode
    ): void {
        $correlationId = 'ERR-' . strtoupper(date('Ymd')) . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));

        [$tenantId, $userId] = $this->extractJwtContext($request);

        $traceArray = array_map(static function (array $frame): array {
            return [
                'file'     => $frame['file'] ?? '[internal]',
                'line'     => $frame['line'] ?? 0,
                'function' => ($frame['class'] ?? '') . ($frame['type'] ?? '') . ($frame['function'] ?? ''),
            ];
        }, $exception->getTrace());

        try {
            $logModel = new SystemErrorLogModel();
            $logModel->logException([
                'id'               => 'sel_' . uniqid('', true),
                'correlation_id'   => $correlationId,
                'tenant_id'        => $tenantId,
                'user_id'          => $userId,
                'exception_class'  => get_class($exception),
                'message'          => $exception->getMessage(),
                'stack_trace'      => json_encode($traceArray, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'request_uri'      => (string) $request->getUri()->getPath(),
                'request_method'   => strtoupper((string) $request->getMethod()),
                'ip_address'       => $request->getIPAddress(),
                'created_at'       => date('Y-m-d H:i:s'),
            ]);
        } catch (Throwable $logError) {
            log_message('error', '[ExceptionHandler] Failed to persist error log: ' . $logError->getMessage());
        }

        log_message('critical', '[' . $correlationId . '] ' . get_class($exception) . ': ' . $exception->getMessage());

        $defaultHandler = new DefaultExceptionHandler(config(ExceptionsConfig::class));
        $defaultHandler->handle($exception, $request, $response, $statusCode, $exitCode);
    }

    private function extractJwtContext(RequestInterface $request): array
    {
        try {
            $authHeader = $request->getHeaderLine('Authorization');
            if (empty($authHeader) || strpos($authHeader, 'Bearer ') !== 0) {
                return [null, null];
            }

            $token  = substr($authHeader, 7);
            $parts  = explode('.', $token);
            if (count($parts) !== 3) {
                return [null, null];
            }

            $padded  = str_pad(strtr($parts[1], '-_', '+/'), (int) ceil(strlen($parts[1]) / 4) * 4, '=');
            $payload = json_decode(base64_decode($padded), true);

            return [
                $payload['data']['tenantId'] ?? ($payload['tenant_id'] ?? null),
                $payload['data']['id']       ?? ($payload['sub']       ?? null),
            ];
        } catch (Throwable $e) {
            return [null, null];
        }
    }
}
