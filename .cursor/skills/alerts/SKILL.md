# Alerts & Confirmations Skill

Use this skill whenever you need to show the user a notification (toast) or ask for confirmation in this finance app.

## Stack

| Purpose | Tool |
|---|---|
| Toast notifications | [`sonner`](https://sonner.emilkowal.ski/) — `import { toast } from "sonner"` |
| Confirm dialogs | `useConfirm()` from `@/components/providers/ConfirmProvider` |

Both are already wired into the app root (`layout.tsx`). Do **not** use `window.alert()`, `window.confirm()`, or the shadcn `Alert` component for user feedback.

---

## Toast notifications

```tsx
import { toast } from "sonner";

// Success
toast.success("Transaction saved!");

// Error
toast.error("Something went wrong.");

// Info
toast.info("Import complete — 12 rows added.");

// Warning
toast.warning("Budget limit reached.");

// Loading (returns an id to dismiss/update)
const id = toast.loading("Saving…");
toast.dismiss(id);                         // dismiss
toast.success("Done!", { id });            // update to success
toast.error("Failed.", { id });            // update to error

// Promise shorthand — auto loading → success/error
toast.promise(saveFn(), {
  loading: "Saving…",
  success: "Saved!",
  error: "Failed to save.",
});
```

The `<Toaster>` is mounted in `layout.tsx` with `richColors` and `position="top-center"`. No extra setup is needed in individual pages.

---

## Confirm dialogs

Replace every `window.confirm()` with the async `useConfirm()` hook. The hook returns a Promise that resolves to `true` (confirmed) or `false` (cancelled/dismissed).

```tsx
import { useConfirm } from "@/components/providers/ConfirmProvider";

export default function MyPage() {
  const confirm = useConfirm();

  const handleDelete = async (name: string) => {
    const ok = await confirm({
      title: `Delete "${name}"?`,
      message: "This action cannot be undone.",  // shown as description
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "destructive",  // makes the confirm button red; default: "default"
    });
    if (!ok) return;
    // … proceed with deletion
  };
}
```

### Shorthand (string only)

```tsx
const ok = await confirm("Are you sure?");
// Uses defaults: title="Confirm", confirmLabel="Confirm", cancelLabel="Cancel", variant="destructive"
```

### ConfirmOptions reference

| Prop | Type | Default | Notes |
|---|---|---|---|
| `title` | `string` | `"Confirm"` | Dialog heading |
| `message` | `string` | — | **Required.** Body text / description |
| `confirmLabel` | `string` | `"Confirm"` | Text on the action button |
| `cancelLabel` | `string` | `"Cancel"` | Text on the cancel button |
| `variant` | `"default" \| "destructive"` | `"destructive"` | Button colour |

---

## Rules

1. **Never** call `alert()` or `confirm()` — they are browser-native blocking dialogs that feel broken on mobile/PWA.
2. **Never** add a second `<Toaster>` — only one exists, in `layout.tsx`.
3. **Never** add a second `<ConfirmProvider>` — only one exists, in `layout.tsx`.
4. Use `toast.error()` for validation errors that would previously have been `alert()`.
5. Use `toast.success()` after any mutation (save, delete, import) so the user gets feedback.
6. For destructive actions (delete, reset) always use `useConfirm()` — never proceed silently.
