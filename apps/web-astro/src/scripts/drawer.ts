/**
 * The mobile navigation drawer (C-22 drawer state). The sidebar is `display: none` below 768 px, so
 * the header button opens a native `<dialog>`: the browser supplies the focus trap, the Escape key
 * and the backdrop, which are the three things DESIGN.md §11 demands of a dialog.
 *
 * No data access: this script only opens and closes a node (R-A5). It is bundled alongside
 * `app.ts`, so everything stays inside a function to keep the two files out of each other's scope.
 */

{
  const opener = document.querySelector<HTMLButtonElement>('[data-drawer-open]');
  const drawer = document.querySelector<HTMLDialogElement>('dialog.drawer');
  const closer = document.querySelector<HTMLButtonElement>('[data-drawer-close]');

  if (opener && drawer) {
    opener.addEventListener('click', () => {
      drawer.showModal();
    });

    closer?.addEventListener('click', () => {
      drawer.close();
    });

    // A click on the backdrop itself closes; a click inside the panel does not.
    drawer.addEventListener('click', (event) => {
      if (event.target !== drawer) return;
      const bounds = drawer.getBoundingClientRect();
      const inside =
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom;
      if (!inside) drawer.close();
    });
  }
}