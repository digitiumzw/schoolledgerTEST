# UI Contract: Error State Standard

**Feature**: `022-fix-frontend-bugs-ui`  
**Scope**: All pages and modals with data fetches

## Purpose

Defines the required error state UI that MUST appear whenever a data fetch or form submission fails. Eliminates blank screens and infinite spinners.

## Required Behavior

1. When a fetch fails, set an `errorMessage` string with a human-readable description.
2. Clear the loading state immediately.
3. Render the error state in place of the content area.
4. Provide a Retry button that re-executes the fetch.

## Reference Implementation

```tsx
// In a page component:
const [data, setData] = useState(null);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [retryCount, setRetryCount] = useState(0);

useEffect(() => {
  setIsLoading(true);
  setError(null);
  api.getStudentProfile(id)
    .then(setData)
    .catch(() => setError('Could not load student profile. Check your connection.'))
    .finally(() => setIsLoading(false));
}, [id, retryCount]);

// JSX:
if (isLoading) return <PageSkeleton />;
if (error) return (
  <Alert variant="destructive" className="m-6">
    <AlertTitle>Something went wrong</AlertTitle>
    <AlertDescription className="flex items-center justify-between">
      {error}
      <Button variant="outline" size="sm" onClick={() => setRetryCount(c => c + 1)}>
        Retry
      </Button>
    </AlertDescription>
  </Alert>
);
return <PageContent data={data} />;
```

## Multi-Source Fetch Pattern (Payments page)

When using `Promise.all` or `Promise.allSettled`, identify which sources failed:

```tsx
const results = await Promise.allSettled([
  api.getPayments(),
  api.getStudents(),
  api.getPaymentCategories(),
]);

const failures = results
  .map((r, i) => r.status === 'rejected' ? sourceNames[i] : null)
  .filter(Boolean);

if (failures.length > 0) {
  setError(`Could not load: ${failures.join(', ')}`);
}
```

## Scope

Applies to: `Dashboard.tsx`, `StudentProfile.tsx`, `Payments.tsx`, `Transport.tsx`, `Students.tsx`, and any other page with a `useEffect` data fetch.
