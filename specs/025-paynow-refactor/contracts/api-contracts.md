# API Contracts: Paynow Integration Refactor

**Feature**: 025-paynow-refactor
**Date**: 2026-04-10

---

## Endpoints Modified by This Feature

### POST `/api/subscription/initiate`

**Auth**: JWT required (`admin`, `super_admin`)

**Request** (unchanged):
```json
{
  "planId": "standard",
  "billingCycle": "monthly"
}
```

**Response — success** (unchanged shape):
```json
{
  "success": true,
  "data": {
    "subscriptionId": "uuid",
    "transactionId": "uuid",
    "redirectUrl": "https://www.paynow.co.zw/Payment/...",
    "ourReference": "SUB-<tenantId>-<ts>"
  },
  "message": "Payment initiated"
}
```

**Response — gateway error** (unchanged shape):
```json
{
  "success": false,
  "message": "Payment gateway error. Please try again.",
  "errors": { "gateway": "error message from Paynow" }
}
```

**Internal change**: `PaynowService::initiate()` loses the `$currency` parameter. The controller call changes from:
```php
$paynow->initiate($ourRef, $amountCents, $currency, $email)
```
to:
```php
$paynow->initiate($ourRef, $amountCents, $email)
```

---

### POST `/api/subscription/webhook`

**Auth**: None (public endpoint, verified by Paynow hash)

**Inbound payload from Paynow** (standard Paynow callback fields):
```
reference=SUB-xxx-yyy
paynowreference=PAYNOW-12345
amount=50.00
status=Paid
hash=UPPER_HEX_SHA512
```

**Response**: Plain text `Received` with HTTP 200; HTTP 400 for invalid hash.

**Internal change — Bug B-1 fix**: `verifyHash` call changes from:
```php
$paynow->verifyHash($post, $receivedHash)
```
to:
```php
$paynow->verifyHash($post)
```

**Internal change — Bug B-2 fix**: Paid transaction update now includes:
```php
'paynow_reference' => $post['paynowreference'] ?? null,
```

---

### GET `/api/subscription/poll/{transactionId}`

**Auth**: JWT required

**Response** (unchanged shape):
```json
{
  "success": true,
  "data": {
    "paid": true,
    "paynowStatus": "paid",
    "subscriptionStatus": "active"
  }
}
```

No changes to this endpoint's logic or contract.

---

## `PaynowService` Method Signatures (after refactor)

### Before
```php
public function initiate(
    string $reference,
    int    $amountCents,
    string $currency,     // ← removed (unused)
    string $email
): array

public function verifyHash(
    array  $post,
    string $receivedHash  // ← removed (unused, misleading)
): bool
```

### After
```php
public function initiate(
    string $reference,
    int    $amountCents,
    string $email
): array

public function verifyHash(
    array $post
): bool
```

### Unchanged
```php
public function pollTransaction(string $pollUrl): array
public function isSandboxMode(): bool
```

---

## Hash Verification Algorithm (documented)

The Paynow hash is: `strtoupper(hash('sha512', concat(all_field_values_except_hash) + lowercase_integration_key))`

Verification logic (post-refactor):

```php
public function verifyHash(array $post): bool
{
    if (empty($post['hash'])) {
        return false;
    }
    return Hash::verify($post, strtolower($this->integrationKey));
}
```

`Hash::verify` internally calls `Hash::make` and compares against `$post['hash']`. Both sides produce uppercase hex — the comparison is valid.
