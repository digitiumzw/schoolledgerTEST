# Quickstart: Fee Campaign

**Feature**: 059-fee-campaign  
**Date**: 2026-05-04

## Prerequisites

- PHP 8.1+ with Composer
- Node.js 18+ with Bun (or npm)
- MySQL running with an existing SchoolLedger database
- Backend `.env` configured with database credentials and `JWT_SECRET_KEY`
- Frontend `.env` with `VITE_API_BASE_URL` pointing to the backend

## Backend Setup

```bash
# From repo root
cd backend

# Install dependencies (if not already done)
composer install

# Run migrations (creates fee_campaigns, campaign_students tables + payments FK)
php spark migrate

# Start the backend dev server
php spark serve --port 8080
```

## Frontend Setup

```bash
# From repo root
cd frontend

# Install dependencies
bun install

# Start the frontend dev server
bun run dev
```

## Verify

1. **Login** as an admin user
2. Navigate to **Fee Campaigns** in the sidebar
3. **Create a campaign**: Click "New Campaign", target a class, set an amount
4. Verify students are auto-assigned in the campaign detail view
5. **Record a payment**: Click a student row, record a partial or full payment
6. Confirm the payment appears in both the campaign view and the general Payments page
7. Confirm the student's standard ledger balance is **unchanged** by the campaign payment

## Run Tests

```bash
cd backend

# Run all integration tests
php spark test --group integration

# Run only Fee Campaign tests
php spark test --filter FeeCampaignTest
```

## Key Files

| Layer | File | Purpose |
|-------|------|---------|
| Migration | `app/Database/Migrations/2026-05-04-100001_Create_fee_campaigns_table.php` | `fee_campaigns` table |
| Migration | `app/Database/Migrations/2026-05-04-100002_Create_campaign_students_table.php` | `campaign_students` table |
| Migration | `app/Database/Migrations/2026-05-04-100003_Add_fee_campaign_id_to_payments.php` | Additive FK on `payments` |
| Model | `app/Models/FeeCampaignModel.php` | Campaign ORM |
| Model | `app/Models/CampaignStudentModel.php` | Campaign student record ORM |
| Service | `app/Services/FeeCampaignService.php` | Business logic (create, assign, record payment) |
| Controller | `app/Controllers/Api/FeeCampaignController.php` | REST API endpoints |
| Routes | `app/Config/Routes.php` | `/api/fee-campaigns` route block |
| Test | `tests/Integration/FeeCampaignTest.php` | Integration tests |
| Frontend | `src/pages/FeeCampaigns.tsx` | Campaign list page |
| Frontend | `src/pages/FeeCampaignDetail.tsx` | Campaign detail + student list |
| Frontend | `src/components/modals/CreateCampaignModal.tsx` | Create campaign form |
| Frontend | `src/components/modals/CampaignPaymentModal.tsx` | Record campaign payment |
| Frontend | `src/components/student-profile/StudentCampaignsCard.tsx` | Student profile card |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/fee-campaigns` | List campaigns |
| POST | `/api/fee-campaigns` | Create campaign + auto-assign |
| GET | `/api/fee-campaigns/:id` | Campaign detail with summary |
| PUT | `/api/fee-campaigns/:id` | Update campaign metadata |
| POST | `/api/fee-campaigns/:id/close` | Close/archive campaign |
| GET | `/api/fee-campaigns/:id/students` | List campaign students |
| POST | `/api/fee-campaigns/:id/students` | Add student manually |
| DELETE | `/api/fee-campaigns/:id/students/:studentId` | Remove student |
| POST | `/api/fee-campaigns/:id/record-payment` | Record campaign payment |
| GET | `/api/students/:id/campaigns` | Student's campaign memberships |
