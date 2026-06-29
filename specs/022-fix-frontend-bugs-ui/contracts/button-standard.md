# UI Contract: Button Standard

**Feature**: `022-fix-frontend-bugs-ui`  
**Scope**: All pages and modals

## Rules

| Context | `variant` | `size` | Icon |
|---------|-----------|--------|------|
| Primary list-page action ("Add …") | *(default)* | *(default)* | `<Plus className="h-4 w-4 mr-2" />` |
| Secondary / cancel in modal | `"outline"` | *(default)* | None |
| Destructive confirm | `"destructive"` | *(default)* | `<Trash2 className="h-4 w-4 mr-2" />` |
| Table row icon action | `"ghost"` | `"icon"` | Icon only, no text |
| Small inline action inside a form | `"outline"` | `"sm"` | Optional leading icon |
| Loading / submitting state | Same variant | Same size | Replaced by spinner text: `"Saving…"` |

## Anti-patterns (forbidden)

- `className="h-8 px-3"` on buttons — use `size="sm"` instead.
- `className="h-14 px-8"` on kiosk buttons — use `size="lg"` instead.
- `style={{ ... }}` on buttons — no inline styles.
- Using `variant="outline"` for primary page actions.
- Using `variant="default"` for cancel buttons.

## Canonical Example

```tsx
{/* Primary action — top right of a list page */}
<Button onClick={onAddStudent}>
  <Plus className="h-4 w-4 mr-2" />
  Add Student
</Button>

{/* Modal footer */}
<DialogFooter>
  <Button variant="outline" onClick={onClose}>Cancel</Button>
  <Button type="submit" disabled={isSubmitting}>
    {isSubmitting ? 'Saving…' : 'Save Changes'}
  </Button>
</DialogFooter>

{/* Table row icon action */}
<Button variant="ghost" size="icon" onClick={() => onEdit(row)}>
  <Pencil className="h-4 w-4" />
</Button>
```
