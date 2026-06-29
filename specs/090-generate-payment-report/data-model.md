# Data Model: Generate Payment Financial Report

**Date**: 2026-06-15  
**Feature**: Generate Payment Financial Report (090-generate-payment-report)

## Overview

This feature does **not** introduce any new database tables or schema changes. All report data is derived from existing tables. The data model below documents the existing entities involved in report generation and their relationships.

## Entities

### Tenant

Represents the school/organization. The report header displays the tenant name.

| Field | Type | Description |
|-------|------|-------------|
| id | VARCHAR(36) PK | Tenant identifier (e.g., `tenant_920862d907c83ec3`) |
| name | VARCHAR(255) | School/organization name (displayed on report header) |
| academic_calendar | JSON | Contains `terms[]` array with `id`, `name`, `start`, `end` |
| settings | JSON | Miscellaneous settings including currency, contact info |

**Relationships**: One tenant has many students, payments, charges, and ledger adjustments.

### Student

Represents an enrolled student. Used for name resolution and class enrollment in the report.

| Field | Type | Description |
|-------|------|-------------|
| id | VARCHAR(36) PK | Student identifier |
| tenant_id | VARCHAR(36) FK | Tenant isolation |
| first_name | VARCHAR(100) | Student first name |
| last_name | VARCHAR(100) | Student last name |
| class_id | VARCHAR(36) FK | Current class enrollment |
| admission_number | VARCHAR(50) | Unique admission number |
| status | ENUM | `active`, `inactive`, `suspended`, `graduated`, `transferred` |

**Relationships**: Belongs to one tenant. Has many payments and charges.

### Class

Represents a school class/grade. Used for class filter and student class display.

| Field | Type | Description |
|-------|------|-------------|
| id | VARCHAR(36) PK | Class identifier |
| tenant_id | VARCHAR(36) FK | Tenant isolation |
| name | VARCHAR(100) | Class name (e.g., "Grade 10A") |
| status | ENUM | `active`, `archived` |

### Payment

Represents a payment received from a student or guardian. Core transaction data for the report.

| Field | Type | Description |
|-------|------|-------------|
| id | VARCHAR(36) PK | Payment identifier |
| tenant_id | VARCHAR(36) FK | Tenant isolation |
| student_id | VARCHAR(36) FK | Paying student |
| amount | DECIMAL(12,2) | Payment amount |
| date | DATE | Payment date |
| method | VARCHAR(50) | Payment method (Cash, EcoCash, Bank Transfer, etc.) |
| category | VARCHAR(100) | Payment category (Fees, Transport Fee, etc.) |
| description | TEXT | Payment notes |
| receipt_number | VARCHAR(25) | Generated receipt number |
| is_general_payment | TINYINT(1) | 1 = non-ledger (excluded from balance calculations) |
| voided_at | DATETIME NULL | If set, payment is voided |
| fee_campaign_id | VARCHAR(36) NULL | Campaign association |
| payment_group_id | VARCHAR(36) NULL | Multi-category grouping |
| snapshot | JSON | Point-in-time student/class data |

**Filtering for report**: `tenant_id = ? AND date BETWEEN ? AND ? AND voided_at IS NULL AND is_general_payment = 0` (for ledger totals). General payments may be optionally included in a separate section.

### Charge

Represents a fee levied against a student's account. Used for "Total Expected Fees" and "Charges Summary".

| Field | Type | Description |
|-------|------|-------------|
| id | VARCHAR(36) PK | Charge identifier |
| tenant_id | VARCHAR(36) FK | Tenant isolation |
| student_id | VARCHAR(36) FK | Charged student |
| amount | DECIMAL(12,2) | Charge amount |
| category | VARCHAR(100) | Charge category (Tuition, Transport, Levies, etc.) |
| charge_type | ENUM | `fee_structure`, `transport`, `other` |
| term_id | VARCHAR(36) NULL | Associated academic term |
| date_generated | DATE | Charge creation date |
| voided_at | DATETIME NULL | If set, charge is voided |
| deleted_at | DATETIME NULL | Soft delete |

**Filtering for report**: `tenant_id = ? AND charge_type IN ('fee_structure', 'transport') AND voided_at IS NULL AND deleted_at IS NULL AND fee_campaign_id IS NULL` (per LedgerService eligible filters).

### LedgerAdjustment

Represents a manual debit or credit adjustment. Used for "Discounts, Waivers, and Adjustments".

| Field | Type | Description |
|-------|------|-------------|
| id | VARCHAR(36) PK | Adjustment identifier |
| tenant_id | VARCHAR(36) FK | Tenant isolation |
| student_id | VARCHAR(36) FK | Affected student |
| amount | DECIMAL(12,2) | Adjustment amount |
| type | ENUM | `debit` (adds to balance) or `credit` (reduces balance) |
| reason | TEXT | Adjustment reason |
| status | ENUM | `pending`, `approved`, `rejected` |
| created_at | DATETIME | Adjustment date |

**Filtering for report**: `tenant_id = ? AND status = 'approved' AND created_at BETWEEN ? AND ?`.

## Report Data Flow

```
User selects period + filters
         |
         v
FinancialReportService::generate()
    |
    |-- 1. Resolve period dates (from termId or month/year)
    |-- 2. Fetch school name/logo from Tenant
    |-- 3. Fetch charges within period
    |       |-- Filter: tenant_id, charge_type IN (eligible), voided_at IS NULL
    |       |-- Group by category for Charges Summary
    |-- 4. Fetch payments within period
    |       |-- Filter: tenant_id, date range, voided_at IS NULL
    |       |-- Optional: classId, method, category filters
    |       |-- Group by method for Method Breakdown
    |-- 5. Fetch approved ledger adjustments within period
    |-- 6. Compute aggregates:
    |       totalExpectedFees = SUM(charges.amount)
    |       totalPaymentsReceived = SUM(payments.amount)
    |       totalAdjustments = SUM(adjustments.amount)
    |       outstandingBalance = totalExpectedFees - totalPaymentsReceived +/- adjustments
    |       collectionRate = totalPaymentsReceived / totalExpectedFees
    |-- 7. Assemble view data array
    |-- 8. Render Dompdf template
    |-- 9. Return PDF bytes (in-memory)
```

## No Schema Changes

This feature requires **zero database migrations**. All data is read from existing tables with existing indexes. If performance testing reveals slow queries at scale, a follow-up migration may add composite indexes on `(tenant_id, date, voided_at)` for payments or `(tenant_id, term_id, charge_type)` for charges.
