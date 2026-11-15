/**
 * UI enhancement only (R-A5): nothing here fetches data or re-renders server HTML.
 *
 * - focus the first invalid field after a failed non-JS submit
 * - guard against a double submit and show the button's busy state
 * - dismiss a toast after 4 s and drop the `?toast=` key so a refresh does not repeat it
 * - keep a character counter in step with its field
 */

const firstInvalid = document.querySelector<HTMLElement>('[aria-invalid="true"]');
firstInvalid?.focus();

for (const form of document.querySelectorAll<HTMLFormElement>('form')) {
  form.addEventListener('submit', () => {
    for (const button of form.querySelectorAll<HTMLButtonElement>('button[data-submit]')) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    }
  });
}

window.addEventListener('pageshow', () => {
  for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-submit]')) {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
});

const toast = document.querySelector<HTMLElement>('[data-toast]');
if (toast) {
  const dismiss = () => {
    toast.remove();
    const url = new URL(window.location.href);
    if (url.searchParams.has('toast')) {
      url.searchParams.delete('toast');
      window.history.replaceState(null, '', url);
    }
  };

  toast.querySelector('[data-dismiss]')?.addEventListener('click', dismiss);
  window.setTimeout(dismiss, 4000);
}

for (const counter of document.querySelectorAll<HTMLElement>('[data-count-for]')) {
  const field = document.getElementById(counter.dataset.countFor ?? '');
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) continue;
  if (field.maxLength < 0) continue;

  const update = () => {
    counter.textContent = `${field.value.length}/${field.maxLength}`;
  };
  field.addEventListener('input', update);
}

// A <details> menu opens and closes by keyboard on its own; these two conveniences match what
// people expect from a menu without turning the header into a client-rendered island.
for (const menu of document.querySelectorAll<HTMLDetailsElement>('details.m-menu')) {
  const summary = menu.querySelector('summary');

  document.addEventListener('click', (event) => {
    if (!menu.open) return;
    if (event.target instanceof Node && menu.contains(event.target)) return;
    menu.open = false;
  });

  menu.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !menu.open) return;
    menu.open = false;
    summary?.focus();
  });
}
