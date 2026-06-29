# Data Model: Fix Dashboard KPIs & Layout

**Branch**: `070-fix-dashboard-kpis` | **Date**: 2026-05-11

## No Schema Changes Required

This feature involves no new tables, no new migrations, and no column additions. All data required for the corrected KPIs already exists in the schema. The changes are entirely in query logic within `DashboardAggregationService.php`.

---

## Existing Tables Read by This Feature

### `students`
| Column | Type | Role in this feature |
|--------|------|----------------------|
| `id` | VARCHAR(36) | PK |
| `tenant_id` | VARCHAR(36) | Tenant isolation |
| `status` | VARCHAR(20) | Filter: `'active'` for all student KPIs |
| `bursary_status` | VARCHAR(50) | On Bursary KPI — non-null and `!= 'none'` |
| `gender` | VARCHAR(20) | Enrollment by Class gender breakdown |
| `class_id` | VARCHAR(36) | Enrollment by Class join |

### `charges`
| Column | Type | Role in this feature |
|--------|------|----------------------|
| `tenant_id` | VARCHAR(36) | Tenant isolation |
| `student_id` | VARCHAR(36) | Join to students |
| `term_id` | VARCHAR(36) | **Collection Rate** — filter by current term |
| `charge_type` | VARCHAR(50) | Eligible charge types filter (LedgerService constant) |
| `amount` | DECIMAL(10,2) | Sum for collection rate numerator/denominator |
| `deleted_at` | TIMESTAMP | Exclude soft-deleted rows |
| `voided_at` | TIMESTAMP | Exclude voided rows |

### `payments`
| Column | Type | Role in this feature |
|--------|------|----------------------|
| `tenant_id` | VARCHAR(36) | Tenant isolation |
| `student_id` | VARCHAR(36) | Join to students |
| `date` | DATE | **Term Revenue & Collection Rate** — filter by `termStart ≤ date ≤ termEnd` |
| `category` | VARCHAR(100) | Eligible payment categories filter (LedgerService constant) |
| `amount` | DECIMAL(10,2) | Sum for term revenue and collection rate |
| `fee_campaign_id` | VARCHAR(36) | Exclude campaign payments (`IS NULL` filter) |

### `classes`
| Column | Type | Role in this feature |
|--------|------|----------------------|
| `tenant_id` | VARCHAR(36) | Tenant isolation |
| `id` | VARCHAR(36) | PK |
| `name` | VARCHAR(100) | Enrollment by Class label |
| `archived_at` | TIMESTAMP | Filter non-archived classes |
| `capacity` | INT | Over-Capacity Classes comparison |

### `staff`
| Column | Type | Role in this feature |
|--------|------|----------------------|
| `tenant_id` | VARCHAR(36) | Tenant isolation |
| `is_teaching` | TINYINT(1) | Teaching Staff / Non-Teaching Staff split |
| `employment_status` | VARCHAR(20) | **All Active Staff** — filter `'active'`; **Total Staff** — no filter |

### `staff_attendance`
| Column | Type | Role in this feature |
|--------|------|----------------------|
| `tenant_id` | VARCHAR(36) | Tenant isolation |
| `staff_id` | VARCHAR(36) | Join |
| `date` | DATE | Filter today |
| `status` | VARCHAR(20) | Count `present`, `late`, `half_day` as "present today" |

### `leave_requests`
| Column | Type | Role in this feature |
|--------|------|----------------------|
| `tenant_id` | VARCHAR(36) | Tenant isolation |
| `staff_id` | VARCHAR(36) | Join to staff |
| `start_date` | DATE | Staff On Leave Today: `start_date <= today` |
| `end_date` | DATE | Staff On Leave Today: `end_date >= today` |
| `status` | VARCHAR(20) | Filter `'approved'` only |

### `transport_routes` / `transport_student_allocations`
No changes to transport KPIs — these queries are already correct.

### `tenants`
| Column | Type | Role in this feature |
|--------|------|----------------------|
| `id` | VARCHAR(36) | PK |
| `academic_calendar` | JSON | `terms[]` array — source of `currentTerm.id`, `currentTerm.start`, `currentTerm.end` |

---

## KPI Formula Reference

### Financial Summary

```
total_outstanding = SUM(MAX(0, eligible_charges - eligible_payments - credits + debits))
                   WHERE students.status = 'active'
                   [all terms, all time]

collection_rate   = SUM(eligible payments WHERE date IN [termStart, termEnd] AND fee_campaign_id IS NULL)
                  ÷ SUM(eligible charges WHERE term_id = currentTerm.id AND not voided/deleted)
                  × 100
                   [returns 0 when no active term or no charges]

paid_in_full      = COUNT(active students WHERE current-term balance <= 0)
                   [already correct in financialStatusCounts()]

term_revenue      = SUM(payments.amount WHERE date IN [termStart, termEnd]
                        AND category IN eligible categories AND fee_campaign_id IS NULL)
                   [currently missing eligible category filter — to be added]
```

### Enrolment & Academics

```
total_students      = COUNT(students WHERE status = 'active')
total_classes       = COUNT(classes WHERE archived_at IS NULL)
avg_class_size      = total_students ÷ total_classes  [0 when no classes]
on_bursary          = COUNT(students WHERE status='active' AND bursary_status IS NOT NULL AND bursary_status != 'none')
```

### Students & Alerts

```
low_attendance      = COUNT(students WHERE attendance_rate < 75% WITHIN [termStart, termEnd])
                       [currently missing term date filter — to be added]
outstanding_balances = COUNT(active students WHERE any-time balance > 0)  [already correct]
over_capacity_classes = COUNT(classes WHERE capacity IS NOT NULL AND enrolled > capacity)  [already correct]
```

### Staff Overview

```
total_staff           = COUNT(staff WHERE tenant_id = ?)       [remove employment_status filter]
teaching_staff        = COUNT(staff WHERE is_teaching=1 AND employment_status='active')  [no change]
non_teaching_staff    = COUNT(staff WHERE is_teaching=0)       [new method — all statuses]
all_active_staff      = COUNT(staff WHERE employment_status='active')  [new metric key]
staff_on_leave_today  = COUNT DISTINCT staff_id FROM leave_requests WHERE approved AND covers today  [no change]
today_attendance_rate = staffPresentToday ÷ (all_active_staff - staff_on_leave_today) × 100
                        [N/A when denominator = 0]
```

---

## `snapshotMetricKeys` Changes

### Keys to REMOVE from snapshot list
- `high_overdue_balances` — KPI card removed per spec FR-012
- `teaching_staff_with_classes` — KPI card removed per spec FR-021

### Keys to ADD to snapshot list
- `all_active_staff` — new metric for All Active Staff KPI (FR-018)

### Keys to UPDATE computation (key name unchanged)
- `payment_collection_rate` — add term scope + eligible filters
- `total_revenue_this_term` — add eligible payment category filter
- `low_attendance_students` — add term date range filter
- `total_staff` — remove `employment_status='active'` filter
- `non_teaching_staff_count` — new independent method, not derived
- `staff_attendance_rate` — exclude on-leave staff from denominator

---

## Frontend `DashboardStats` Type Changes

No new fields need to be added to `DashboardStats` in `dashboard.ts`. All required stats fields already exist. The changes are:
- `allActiveStaff` is already present as an optional field — backend will now populate it correctly.
- `teachingStaffWithClasses` remains in the type for backward compatibility but will no longer be shown in the UI.
- `highOverdueBalances` remains in the type but will no longer be rendered.
