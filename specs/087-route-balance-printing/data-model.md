# Data Model: Route Balance and Printable Student List

**Feature**: 087-route-balance-printing  
**Date**: 2026-06-09

## Overview

No new database tables or schema changes are required for this feature. All data is sourced from existing tables. This document describes the **computed / enriched data shapes** returned by the backend and consumed by the frontend.

## Existing Tables Used

| Table | Purpose | Key Fields Used |
|-------|---------|-----------------|
| `transport_routes` | Route metadata | `id`, `tenant_id`, `route_name`, `monthly_fee`, `status` |
| `transport_stops` | Stop configuration | `id`, `route_id`, `name`, `order_position`, `pickup_time` |
| `transport_route_periods` | Vehicle/driver assignment | `id`, `route_id`, `vehicle_id`, `driver_id`, `status` |
| `transport_vehicles` | Vehicle info | `id`, `name`, `reg_number`, `type`, `capacity` |
| `transport_drivers` | Driver info | `id`, `name`, `phone` |
| `transport_student_allocations` | Student-route assignments | `id`, `student_id`, `route_id`, `stop_id`, `direction`, `status` |
| `students` | Student identity | `id`, `tenant_id`, `first_name`, `last_name`, `class_id`, `status` |
| `classes` | Class names | `id`, `name` |
| `charges` | Fee/transport charges | `id`, `tenant_id`, `student_id`, `amount`, `charge_type`, `deleted_at`, `voided_at` |
| `payments` | Payments received | `id`, `tenant_id`, `student_id`, `amount`, `category`, `fee_campaign_id`, `voided_at` |
| `ledger_adjustments` | Balance adjustments | `id`, `tenant_id`, `student_id`, `amount`, `adjustment_type`, `status` |

## Enriched API Response Shapes

### TransportRoute (enriched)

The existing `TransportRoute` response shape is extended with a `balanceSummary` object.

```typescript
interface TransportRoute {
  id: string;
  tenantId: string;
  routeName: string;
  monthlyFee: number;
  status: 'active' | 'inactive';
  stops: TransportStop[];
  stopCount: number;
  vehicle: { id: string; name: string; regNumber: string | null; type: string; capacity: number } | null;
  driver: { id: string; name: string; phone: string | null } | null;
  periodId: string | null;
  students: TransportAllocationStudent[];
  activeCount?: number;
  balanceSummary?: RouteBalanceSummary;  // NEW
}
```

### TransportAllocationStudent (enriched)

The existing `TransportAllocationStudent` is extended with a `balance` field.

```typescript
interface TransportAllocationStudent {
  allocationId: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  stopId: string | null;
  stopName: string | null;
  direction: 'both' | 'inbound' | 'outbound';
  status: 'Active' | 'inactive';
  balance: number | null;  // NEW — totalBalance from LedgerService
}
```

### RouteBalanceSummary (new computed entity)

```typescript
interface RouteBalanceSummary {
  totalStudents: number;              // count of active allocations
  studentsWithBalance: number;        // count where balance > 0
  totalOutstandingBalance: number;  // sum of all positive balances
}
```

## Computation Rules

1. **Per-student balance**: For each active student on the route, call `LedgerService::getBalancesForStudentIds()` with the array of student IDs. Map the returned `balance` field to each student's `balance` property.
2. **studentsWithBalance**: Count of students where `balance > 0`.
3. **totalOutstandingBalance**: Sum of `balance` for all students where `balance > 0`.
4. **Graceful degradation**: If the LedgerService query fails, all balances are `null` and the summary shows zeros. The route detail page still renders successfully.

## Validation Constraints

- `tenant_id` MUST be sourced from JWT payload in all queries (Principle I).
- Only `status = 'active'` students are included (existing `getRoute()` behavior preserved).
- `balance` is computed at query time; no stored/cached balance column is introduced (Principle V).
