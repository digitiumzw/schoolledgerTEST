# Research: Paynow Integration Refactor

**Feature**: 025-paynow-refactor
**Date**: 2026-04-10

---

## 1. Official Paynow PHP SDK — Integration Flow

### Decision
Use the `paynow/php-sdk` package already installed in `backend/vendor/`. Do not implement raw HTTP calls.

### Rationale
The SDK is already present and performs hash generation/verification internally. Raw calls would re-implement logic already validated by the library.

### Key flow (from official docs + SDK source)

```
1. new Paynow($integrationId, $integrationKey, $returnUrl, $resultUrl)
2. $payment = $paynow->createPayment($reference, $email)
3. $payment->add($description, $amountDecimal)
4. $response = $paynow->send($payment)
5. if $response->success(): redirect to $response->redirectUrl(), store $response->pollUrl()
6. Paynow POSTs callback to resultUrl with: reference, paynowreference, status, amount, hash
7. Verify hash, update transaction; if paid → activate subscription
8. User returns to returnUrl; frontend polls /api/subscription/poll/{txId}
9. $status = $paynow->pollTransaction($pollUrl); if $status->paid() → activate
```

### SDK constructor argument order
`Paynow($id, $key, $returnUrl, $resultUrl)` — current service matches this order. ✅

### Key fields in Paynow webhook POST
| Field | Description |
|-------|-------------|
| `reference` | Our merchant reference (used to look up transaction) |
| `paynowreference` | Paynow's internal reference (must be stored) |
| `amount` | Amount paid |
| `status` | `Paid`, `Failed`, `Cancelled` |
| `hash` | SHA-512 of all field values + integration key (uppercase) |

---

## 2. Hash Verification — How it Works

### Decision
`Hash::verify($post, strtolower($integrationKey))` is the correct call — the integration key MUST be lowercased before being passed directly to `Hash::make`/`Hash::verify`, because the `Paynow` constructor lowercases the key in its own state but `Hash` static methods do not lowercase internally.

### Rationale
Reading `vendor/paynow/php-sdk/src/Util/Hash.php`:
```php
public static function make(array $values, $integration_key)
{
    $string = "";
    foreach($values as $key=>$value) {
        if( strtoupper($key) != "HASH" ){
            $string .= $value;
        }
    }
    $string .= $integration_key;   // ← key appended as-is, no lowercasing
    $hash = hash("sha512", $string);
    return strtoupper($hash);      // ← output is uppercase
}
```

The `Paynow` constructor does `$this->integrationKey = strtolower($key)`, so when the SDK calls `Hash::make` internally, the stored key is already lowercase. But `PaynowService::verifyHash` calls `Hash::verify` directly with the raw key from env — so it must explicitly lowercase. The current `strtolower($this->integrationKey)` call is correct.

### Alternatives considered
- Not lowercasing: would silently produce hash mismatches on any key with uppercase letters.
- Using `$paynow->processStatusUpdate()`: valid alternative that delegates hash verification to the SDK object, but requires a Paynow instance to be created in the webhook handler, and the SDK reads from `$_POST` directly which doesn't mix well with CI4's request object.

---

## 3. Bug Inventory (all confirmed from source reading)

### Bug B-1: `verifyHash` — unused `$receivedHash` parameter
**File**: `backend/app/Services/PaynowService.php:97`
**Problem**: The method signature is `verifyHash(array $post, string $receivedHash)`. The `$receivedHash` argument is used only in `empty($receivedHash)` for an early-return guard. The actual comparison happens inside `Hash::verify($post, ...)` which reads `$post['hash']` — making `$receivedHash` and `$post['hash']` redundant sources of truth that could diverge.
**Fix**: Remove the `$receivedHash` parameter. Guard using `empty($post['hash'])` instead.

### Bug B-2: `paynow_reference` never stored from webhook
**File**: `backend/app/Controllers/Api/SubscriptionController.php:317–319`
**Problem**: When a `paid` webhook fires, `$post['paynowreference']` (Paynow's own reference) is never written to `subscription_payment_transactions.paynow_reference`. The field exists in the DB schema (migration `2026-04-10-120000`) and the model's `$allowedFields`, but the webhook handler omits it. This breaks reconciliation via `findByPaynowReference()`.
**Fix**: Add `'paynow_reference' => $post['paynowreference'] ?? null` to the paid-status update block in `webhook()`.

### Bug B-3: `$currency` parameter is a ghost argument
**File**: `backend/app/Services/PaynowService.php:31`
**Problem**: `initiate(string $reference, int $amountCents, string $currency, string $email)` accepts `$currency` but the Paynow PHP SDK provides no per-request currency field. The parameter is never referenced inside the method body. The caller (`SubscriptionController::initiate`) passes `$currency` uselessly.
**Fix**: Remove `$currency` from the `initiate()` signature and update the call site in the controller.

### Bug B-4: `paynow_hash_verified` flag semantics
**File**: `backend/app/Controllers/Api/SubscriptionController.php:310–315`
**Problem**: `paynow_hash_verified = 1` is set in the "always-runs-after-verification" block which is correct in isolation. However, `webhook_payload` and `paynow_status_raw` are also stored here — before the status branching. If Paynow sends a status the system doesn't recognise (not `paid`, `failed`, or `cancelled`), the payload is stored and the hash flag is set, but the transaction status never transitions. This is a minor correctness issue: the raw payload is stored for all hash-valid callbacks regardless of status, which is actually useful for debugging. No structural change needed beyond documenting this as intentional.

### Bug B-5: `errors()` call on non-success response
**File**: `backend/app/Services/PaynowService.php:51`
**Problem**: `$response->errors()` is called when `!$response->success()`. The `CanFail` trait's `errors()` method returns `implode(' ', $this->errors)` by default. If `InitResponse::load()` threw an `InvalidIntegrationException` (for `error = 'invalid id'`), the exception propagates before `errors()` can be called, so the outer `catch (\Throwable $e)` block handles it. For non-fatal errors, `$this->errors` is populated. This is correct behaviour — no code change needed, but confirming this is safe.

---

## 4. No Schema Changes Required

All required fields (`paynow_reference`, `paynow_poll_url`, `paynow_hash_verified`, `webhook_payload`) already exist in `subscription_payment_transactions` from the existing migration. No new migration needed.

---

## 5. No Frontend Changes Required

The frontend calls `/api/subscription/initiate` and `/api/subscription/poll/{txId}`. The API response shapes are not changing. No frontend modifications are required.

---

## 6. Constitution Compliance

| Principle | Impact | Status |
|-----------|--------|--------|
| I. Multi-Tenant Isolation | Webhook is public (no JWT); but `findByOurReference` is tenant-unaware — it only looks up by `our_reference` (unique). Adding `paynow_reference` doesn't change tenant isolation. | ✅ No concern |
| II. API-First Separation | Changes are backend-only; no presentation logic added. | ✅ Pass |
| III. JWT Auth | Webhook endpoint is intentionally public (matches existing pattern). All other modified endpoints remain JWT-protected. | ✅ Pass |
| IV. Immutable Migrations | No schema changes needed; no new migration required. | ✅ Pass |
| V. Ledger Integrity | No ledger queries touched. | ✅ Pass |
