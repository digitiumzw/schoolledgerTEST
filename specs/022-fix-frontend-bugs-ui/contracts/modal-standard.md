# UI Contract: Modal Standard

**Feature**: `022-fix-frontend-bugs-ui`  
**Scope**: All 57+ modal dialogs

## Width Rules

| Modal type | `DialogContent` className | Examples |
|------------|--------------------------|---------|
| Simple confirmation / single-field | `max-w-md` | Delete confirmation, status change |
| Standard single-section form | `max-w-lg` | RecordPaymentModal, RouteFormModal |
| Multi-section / multi-tab form | `max-w-2xl` | StudentFormModal, StaffFormModal |
| Data display with table | `max-w-4xl` | PaymentHistoryModal |

**Forbidden**: `w-[Xvw]` expressions (e.g., `w-[95vw]`). Use named `max-w-*` classes only. shadcn/ui's `DialogContent` already handles mobile responsiveness.

## Structure Rules

Every modal MUST follow this element order:

```tsx
<Dialog open={open} onOpenChange={onClose}>
  <DialogContent className="max-w-lg">     {/* width per table above */}
    <DialogHeader>
      <DialogTitle>[Action] [Subject]</DialogTitle>
      <DialogDescription>[One sentence describing what this modal does]</DialogDescription>
    </DialogHeader>

    {/* Form or content body */}
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* fields */}

      <DialogFooter>
        <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

## Spacing Rules

- Form field groups: `className="space-y-4"` (consistent across all modals)
- Section dividers within a modal: `<Separator className="my-4" />`
- No `space-y-3`, `space-y-6` — only `space-y-4` for field groups

## Footer Rules

- Cancel button: always `variant="outline"`, always left-most in the footer
- Submit button: always `variant="default"` (primary), always right-most
- Destructive submit: `variant="destructive"`
- Loading text: replace button label with `"Saving…"` and set `disabled={isSubmitting}`
- No custom `flex` or `justify-between` in modal footers — `<DialogFooter>` handles alignment
