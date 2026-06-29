# API Contract: Payment Categories

**Feature**: `057-payment-billing-ux`  
**Scope**: Changes to `GET /api/settings/payment-categories`, `POST`, `PUT`, `DELETE` to enforce system category protection

---

## System Categories

Three categories are hard-coded and non-editable. They are injected by the backend into every `getPaymentCategories` response and are identified by a `system: true` flag.

| Name | ID | Behaviour |
|---|---|---|
| `Fees` | `__fees` | Bookkeeping tag for fee-structure payments |
| `Transport` | `__transport` | Bookkeeping tag for transport payments |
| `Transport + Fees` | `__transport_fees` | Bookkeeping tag for combined payments |

---

## GET /api/settings/payment-categories

### Changes from current

System categories are **prepended** to the list before returning. They are never persisted in `tenants.settings.payment_categories` — they are injected at read time.

### Response `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id":            "__fees",
      "tenantId":      "ten_xyz",
      "name":          "Fees",
      "defaultAmount": null,
      "active":        true,
      "system":        true
    },
    {
      "id":            "__transport",
      "tenantId":      "ten_xyz",
      "name":          "Transport",
      "defaultAmount": null,
      "active":        true,
      "system":        true
    },
    {
      "id":            "__transport_fees",
      "tenantId":      "ten_xyz",
      "name":          "Transport + Fees",
      "defaultAmount": null,
      "active":        true,
      "system":        true
    },
    {
      "id":            "cat1746300123_abc",
      "tenantId":      "ten_xyz",
      "name":          "Bursary",
      "defaultAmount": 50.00,
      "active":        true,
      "system":        false
    }
  ]
}
```

**New field**: `system` (boolean) — `true` for the three hard-coded categories, `false` for all user-defined categories. Legacy responses that omit this field are treated as `system: false` by the frontend.

---

## POST /api/settings/payment-categories — Create Category

### Changes from current

Rejects creation if the submitted `name` matches any system category name (case-insensitive).

### New error

```json
{
  "success": false,
  "error":   "Cannot create a category with a reserved system name"
}
```

| Status | Condition |
|---|---|
| 409 | Name already exists (existing behaviour) |
| 409 | Name matches a system category name (`Fees`, `Transport`, `Transport + Fees`) |

---

## PUT /api/settings/payment-categories/:id — Update Category

### Changes from current

- Rejects update if the **target category's current name** matches a system category name.
- Rejects update if the **new name** matches a system category name.
- System category IDs (`__fees`, `__transport`, `__transport_fees`) are never stored in the DB, so a `PUT` with those IDs will 404 naturally (no match in stored categories).

### New error

```json
{
  "success": false,
  "error":   "System categories cannot be modified"
}
```

| Status | Condition |
|---|---|
| 404 | Category not found (existing) |
| 403 | Attempting to modify a category whose name is a system name |

---

## DELETE /api/settings/payment-categories/:id — Delete Category

### Changes from current

Rejects deletion if the category's `name` matches any system category name.

### New error

```json
{
  "success": false,
  "error":   "System categories cannot be deleted"
}
```

| Status | Condition |
|---|---|
| 404 | Category not found (existing) |
| 403 | Attempting to delete a system category |

---

## Frontend behaviour

The frontend uses the `system` flag to:
1. Render a distinct visual treatment (e.g. lock badge, muted delete button) for system categories.
2. Disable the edit and delete actions for system category rows in `PaymentCategoriesTab`.
3. In `RecordPaymentModal`, show system categories at the top of the dropdown, visually distinguished.
4. Remove the hard-coded `TRANSPORT_CATEGORIES` constant from `RecordPaymentModal.tsx` — the backend now supplies all three system categories via `getPaymentCategories`.
