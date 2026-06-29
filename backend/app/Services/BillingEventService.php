<?php

namespace App\Services;

use App\Models\BillingEventModel;

class BillingEventService
{
    private BillingEventModel $eventModel;

    public function __construct()
    {
        $this->eventModel = new BillingEventModel();
    }

    public function record(string $tenantId, string $eventType, array $context = []): void
    {
        $now = date('Y-m-d H:i:s');

        $this->eventModel->insert([
            'id'              => $this->generateUuid(),
            'tenant_id'       => $tenantId,
            'event_type'      => $eventType,
            'plan_name'       => $context['plan_name']       ?? null,
            'billing_cycle'   => $context['billing_cycle']   ?? null,
            'amount_cents'    => isset($context['amount_cents']) ? (int) $context['amount_cents'] : null,
            'currency'        => $context['currency']        ?? null,
            'subscription_id' => $context['subscription_id'] ?? null,
            'transaction_id'  => $context['transaction_id']  ?? null,
            'occurred_at'     => $now,
        ]);
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
