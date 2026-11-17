/**
 * C-12 dropzone (FR-ATT-001, D-8). The visible "Add images" button opens the file picker; choosing a
 * file submits the one-file form, so the row is written as soon as the file is chosen. Without JS the
 * label and the submit button still upload the chosen file: the enhancement never hides the fallback.
 */
for (const form of document.querySelectorAll<HTMLFormElement>('form[data-dropzone]')) {
  const input = form.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) continue;

  form.querySelector<HTMLButtonElement>('[data-file-open]')?.addEventListener('click', (event) => {
    // A chosen file submits on change; keep the plain submit path for the no-JS fallback.
    if (input.files?.length) return;
    event.preventDefault();
    input.click();
  });

  input.addEventListener('change', () => {
    if (input.files?.length) form.requestSubmit();
  });
}
