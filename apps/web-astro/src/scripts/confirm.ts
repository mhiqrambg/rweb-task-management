/**
 * C-14 confirm dialog behaviour. A destructive control is marked `data-confirm-open`; activating it
 * opens the dialog and focuses Cancel. Nothing is submitted until the person confirms, so Escape or
 * Cancel costs zero requests (FR-UI-007).
 *
 * The browser supplies the focus trap, Escape and the focus return. Bundled with `app.ts`, so the
 * whole body stays inside a function to keep the two files out of each other's scope.
 */

{
  const dialog = document.querySelector<HTMLDialogElement>('dialog[data-confirm]');

  if (dialog) {
    let opener: HTMLElement | null = null;

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const trigger = target.closest<HTMLElement>('[data-confirm-open]');
      if (!trigger) return;

      event.preventDefault();
      opener = trigger;

      // A trigger may carry its own sentence and record id, so one dialog serves a whole set
      // (C-10 `removing`: every thumbnail on a detail screen removes itself).
      const title = trigger.dataset.confirmTitle;
      const titleNode = dialog.querySelector<HTMLElement>('[data-confirm-title]');
      if (title && titleNode) titleNode.textContent = title;

      const body = trigger.dataset.confirmBody;
      const bodyNode = dialog.querySelector<HTMLElement>('[data-confirm-body]');
      if (body && bodyNode) bodyNode.textContent = body;

      const recordId = trigger.dataset.confirmId;
      if (recordId) {
        const field = dialog.querySelector<HTMLInputElement>('[data-confirm-form] input[name="id"]');
        if (field) field.value = recordId;
      }

      dialog.showModal();
      dialog.querySelector<HTMLElement>('[data-confirm-cancel]')?.focus();
    });

    dialog.querySelector('[data-confirm-cancel]')?.addEventListener('click', () => {
      dialog.close();
    });

    // The dialog's own form stays empty; the confirm button submits the form named by the opener,
    // so one dialog serves every destructive control on the page (FR-UI-007).
    dialog.querySelector<HTMLButtonElement>('button[type="submit"]')?.addEventListener('click', (event) => {
      const selector = opener?.dataset.confirmForm;
      if (!selector) return;
      event.preventDefault();
      const owner = document.querySelector<HTMLFormElement>(selector);
      if (!owner) return;
      const recordId = opener?.dataset.confirmId;
      const field = owner.querySelector<HTMLInputElement>('input[name="id"]');
      if (recordId && field) field.value = recordId;
      owner.submit();
    });

    dialog.addEventListener('close', () => opener?.focus());
  }
}