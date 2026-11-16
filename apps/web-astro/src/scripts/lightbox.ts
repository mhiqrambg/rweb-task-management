/**
 * C-11 lightbox behaviour. The markup lives in `Lightbox.astro`; this moves between the slides it
 * declares, keeps the counter and caption in step, and returns focus to the invoking thumbnail.
 *
 * The browser supplies the focus trap, the Escape key and the focus return — the three behaviours
 * FR-ATT-005 names — so this only handles navigation (FR-ATT-006) and the close controls.
 *
 * Bundled with `app.ts` on every page, so everything stays inside a function to keep the two files
 * out of each other's scope. `@taskapp/contracts/copy` is import-free, so the counter template
 * arrives without pulling the schemas into the browser bundle.
 */

import { fill } from '@taskapp/contracts/copy';

{
  const dialog = document.querySelector<HTMLDialogElement>('dialog.lightbox[data-lightbox]');

  if (dialog) {
    const image = dialog.querySelector<HTMLImageElement>('[data-lightbox-image]');
    const counter = dialog.querySelector<HTMLElement>('[data-lightbox-counter]');
    const caption = dialog.querySelector<HTMLElement>('[data-lightbox-caption]');
    const previous = dialog.querySelector<HTMLButtonElement>('[data-lightbox-prev]');
    const next = dialog.querySelector<HTMLButtonElement>('[data-lightbox-next]');
    const close = dialog.querySelector<HTMLButtonElement>('[data-lightbox-close]');

    interface Slide {
      full: string;
      alt: string;
      caption: string;
    }

    let slides: Slide[] = [];
    let index = 0;
    let opener: HTMLElement | null = null;

    const counterTemplate = dialog.dataset.counterTemplate ?? 'of';

    const render = () => {
      const slide = slides[index];
      if (!slide || !image) return;
      image.src = slide.full;
      image.alt = slide.alt;
      if (counter) {
        counter.textContent = fill(counterTemplate, { index: index + 1, count: slides.length });
      }
      if (caption) caption.textContent = slide.caption;
      if (previous) previous.disabled = index === 0;
      if (next) next.disabled = index === slides.length - 1;
    };

    const move = (delta: number) => {
      const target = index + delta;
      if (target < 0 || target >= slides.length) return;
      index = target;
      render();
    };

    /** Reads the gallery from the thumbnails already in the page — no extra request (FR-ATT-005). */
    const collect = (): Slide[] =>
      Array.from(document.querySelectorAll<HTMLButtonElement>('[data-lightbox-open]')).map((button) => {
        const thumb = button.querySelector('img');
        const figure = button.closest('figure');
        return {
          full: thumb?.dataset.full ?? thumb?.src ?? '',
          alt: thumb?.alt ?? '',
          caption: figure?.querySelector('figcaption')?.textContent?.trim() ?? '',
        };
      });

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const trigger = target.closest<HTMLButtonElement>('[data-lightbox-open]');
      if (trigger) {
        event.preventDefault();
        slides = collect();
        const thumbSrc = trigger.querySelector('img')?.src;
        const found = slides.findIndex((slide) => slide.full === thumbSrc);
        index = found < 0 ? 0 : found;
        opener = trigger;
        render();
        dialog.showModal();
      }
    });

    close?.addEventListener('click', () => dialog.close());
    previous?.addEventListener('click', () => move(-1));
    next?.addEventListener('click', () => move(1));

    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') move(-1);
      if (event.key === 'ArrowRight') move(1);
    });

    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      const inside =
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom;
      if (!inside) dialog.close();
    });

    // The browser restores focus on close; this makes the return target explicit.
    dialog.addEventListener('close', () => opener?.focus());
  }
}