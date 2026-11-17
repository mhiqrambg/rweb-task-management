/**
 * C-13 modal (design/02 §5). The server renders `<dialog>` without `open`, so a reload never shows a
 * half-open modal; this opens it as a real modal, which is also what centres it and traps focus.
 *
 * No data access: this script only opens and closes a node (R-A5).
 */

{
  const dialog = document.querySelector<HTMLDialogElement>('dialog.dialog[data-modal]:not(dialog.dialog--confirm)');
  if (dialog && !dialog.open) {
    dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }
}
