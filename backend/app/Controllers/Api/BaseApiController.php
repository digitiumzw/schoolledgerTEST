<?php

namespace App\Controllers\Api;

use CodeIgniter\RESTful\ResourceController;
use CodeIgniter\HTTP\ResponseInterface;

class BaseApiController extends ResourceController
{
    protected $format = 'json';

    // Valid user roles
    protected const VALID_ROLES = ['super_admin', 'admin', 'bursar', 'hr'];

    public function initController(
        \CodeIgniter\HTTP\RequestInterface $request,
        \CodeIgniter\HTTP\ResponseInterface $response,
        \Psr\Log\LoggerInterface $logger
    ) {
        parent::initController($request, $response, $logger);
        $this->setCorsHeaders($response);
    }

    // ──────────────────────────────────────────────────────────────
    // Response helpers
    // ──────────────────────────────────────────────────────────────

    protected function success($data = null, string $message = 'Success', int $status = 200, $meta = null): ResponseInterface
    {
        $body = ['status' => true, 'message' => $message, 'data' => $data];
        if ($meta !== null) {
            $body['meta'] = $meta;
        }
        return $this->setCorsHeaders($this->respond($body, $status));
    }

    protected function error(string $message = 'Error', int $status = 400, $errors = null): ResponseInterface
    {
        $body = ['status' => false, 'message' => $message];
        if ($errors !== null) {
            $body['errors'] = $errors;
        }
        return $this->setCorsHeaders($this->respond($body, $status));
    }

    protected function created($data = null, string $message = 'Created successfully'): ResponseInterface
    {
        return $this->success($data, $message, 201);
    }

    protected function notFound(string $message = 'Resource not found'): ResponseInterface
    {
        return $this->error($message, 404);
    }

    protected function forbidden(string $message = 'Access denied'): ResponseInterface
    {
        return $this->error($message, 403);
    }

    protected function serverError(string $message = 'Internal server error'): ResponseInterface
    {
        return $this->error($message, 500);
    }

    // ──────────────────────────────────────────────────────────────
    // Authentication helpers
    // ──────────────────────────────────────────────────────────────

    /**
     * Returns the decoded JWT user object or null.
     */
    protected function getCurrentUser(): ?object
    {
        return $this->request->user ?? null;
    }

    /**
     * Returns the authenticated tenant ID.
     * Throws a 401 response and terminates if no user is present.
     */
    protected function getTenantId(): string
    {
        $user = $this->getCurrentUser();
        if ($user === null || empty($user->tenantId)) {
            // Abort with 401 — this should never normally be reached because
            // the JWTAuthFilter already guards all /api/* routes.
            $this->error('Authentication required', 401)->send();
            exit;
        }
        return $user->tenantId;
    }

    /**
     * Returns true when the authenticated user has one of the given roles.
     */
    protected function userHasRole(string ...$roles): bool
    {
        $user = $this->getCurrentUser();
        return $user !== null && in_array($user->role, $roles, true);
    }

    /**
     * Require one of the given roles; returns an error response (or null on pass).
     */
    protected function requireRole(string ...$roles): ?ResponseInterface
    {
        if (!$this->userHasRole(...$roles)) {
            return $this->forbidden('You do not have permission to perform this action');
        }
        return null;
    }

    // ──────────────────────────────────────────────────────────────
    // Input helpers
    // ──────────────────────────────────────────────────────────────

    /**
     * Returns the decoded JSON body, or falls back to POST fields.
     * Always returns an array (never null).
     */
    protected function getRequestBody(): array
    {
        return $this->request->getJSON(true) ?? $this->request->getPost() ?? [];
    }

    /**
     * Validate that each key in $required is present and non-empty in $data.
     * Returns an array of missing-field error strings, or empty array on pass.
     */
    protected function validateRequired(array $data, array $required): array
    {
        $errors = [];
        foreach ($required as $field) {
            if (!isset($data[$field]) || $data[$field] === '' || $data[$field] === null) {
                $errors[] = ucfirst($field) . ' is required';
            }
        }
        return $errors;
    }

    /**
     * Quick check: returns an error response when required fields are missing,
     * or null when all fields are present.
     */
    protected function requireFields(array $data, array $required): ?ResponseInterface
    {
        $errors = $this->validateRequired($data, $required);
        if (!empty($errors)) {
            return $this->error($errors[0], 400, $errors);
        }
        return null;
    }

    /**
     * Sanitise a string value — strips leading/trailing whitespace.
     */
    protected function sanitiseString(?string $value): string
    {
        return trim((string) ($value ?? ''));
    }

    // ──────────────────────────────────────────────────────────────
    // ID generation
    // ──────────────────────────────────────────────────────────────

    /**
     * Generate a unique prefixed ID.
     * Format: {prefix}{unix_timestamp}_{8 hex chars}
     */
    protected function generateId(string $prefix = ''): string
    {
        return $prefix . time() . '_' . bin2hex(random_bytes(4));
    }

    /**
     * Generate a human-readable receipt number.
     *
     * Feature: 057-payment-billing-ux (research.md §D4)
     *
     * Format: YYYY.MM.DD.HHmmss.X  where X is a random uppercase letter (A–Z).
     * The random letter is appended so that two payments recorded in the same
     * second (unlikely but possible) do not produce duplicate receipt numbers.
     * The unique index on (tenant_id, receipt_number) will catch any remaining
     * collision; callers should handle that gracefully.
     *
     * Example: 2026.05.04.143722.K
     */
    protected function generateReceiptNumber(): string
    {
        $datePart   = date('Y.m.d.His');
        $randomChar = chr(random_int(65, 90)); // A–Z
        return "{$datePart}.{$randomChar}";
    }

    // ──────────────────────────────────────────────────────────────
    // Pagination helper
    // ──────────────────────────────────────────────────────────────

    /**
     * Build a standard pagination meta block from raw query params.
     */
    protected function buildPaginationMeta(int $total, int $page, int $limit): array
    {
        $totalPages = $limit > 0 ? (int) ceil($total / $limit) : 0;
        return [
            'page'       => $page,
            'limit'      => $limit,
            'total'      => $total,
            'totalPages' => $totalPages,
            'last_page'  => $totalPages,
        ];
    }

    /**
     * Extract and validate page/limit query params.
     * Returns [$page, $limit, $offset].
     */
    protected function getPaginationParams(int $defaultLimit = 50, int $maxLimit = 200): array
    {
        $page  = max(1, (int) ($this->request->getGet('page') ?? 1));
        $limit = min($maxLimit, max(1, (int) ($this->request->getGet('limit') ?? $defaultLimit)));
        return [$page, $limit, ($page - 1) * $limit];
    }

    protected function normalisePaginationParams(int $defaultLimit = 50, int $maxLimit = 200): array
    {
        $pageRaw = $this->request->getGet('page');
        $limitRaw = $this->request->getGet('limit');

        if ($pageRaw !== null && (!ctype_digit((string) $pageRaw) || (int) $pageRaw < 1)) {
            return ['error' => 'Invalid page value. Must be a positive integer.'];
        }

        if ($limitRaw !== null && (!ctype_digit((string) $limitRaw) || (int) $limitRaw < 1 || (int) $limitRaw > $maxLimit)) {
            return ['error' => "Invalid limit value. Must be between 1 and {$maxLimit}."];
        }

        $page = (int) ($pageRaw ?? 1);
        $limit = (int) ($limitRaw ?? $defaultLimit);

        return [
            'page' => $page,
            'limit' => $limit,
            'offset' => ($page - 1) * $limit,
        ];
    }

    protected function normaliseSortParams(array $allowedSortFields, string $defaultSortBy = 'date', string $defaultSortOrder = 'desc'): array
    {
        $sortBy = (string) ($this->request->getGet('sortBy') ?? $defaultSortBy);
        if (!in_array($sortBy, $allowedSortFields, true)) {
            return ['error' => 'Invalid sortBy value.'];
        }

        $sortOrder = strtolower((string) ($this->request->getGet('sortOrder') ?? $defaultSortOrder));
        if (!in_array($sortOrder, ['asc', 'desc'], true)) {
            return ['error' => 'Invalid sortOrder value. Must be asc or desc.'];
        }

        return [
            'sortBy' => $sortBy,
            'sortOrder' => $sortOrder,
        ];
    }

    protected function isValidDateString(string $value): bool
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return false;
        }

        [$year, $month, $day] = array_map('intval', explode('-', $value));
        return checkdate($month, $day, $year);
    }

    protected function normaliseDateRange(?string $startDate, ?string $endDate, string $startName = 'startDate', string $endName = 'endDate'): array
    {
        if ($startDate !== null && $startDate !== '' && !$this->isValidDateString($startDate)) {
            return ['error' => "Invalid {$startName} value. Use YYYY-MM-DD."];
        }

        if ($endDate !== null && $endDate !== '' && !$this->isValidDateString($endDate)) {
            return ['error' => "Invalid {$endName} value. Use YYYY-MM-DD."];
        }

        if ($startDate && $endDate && $startDate > $endDate) {
            return ['error' => "{$endName} must be after or equal to {$startName}."];
        }

        return [
            $startName => $startDate ?: null,
            $endName => $endDate ?: null,
        ];
    }

    // ──────────────────────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────────────────────

    protected function setCorsHeaders($response)
    {
        return $response
            ->setHeader('Access-Control-Allow-Origin', '*')
            ->setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
            ->setHeader('Access-Control-Allow-Headers', 'X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Request-Method, Authorization')
            ->setHeader('Access-Control-Allow-Credentials', 'true');
    }
}
