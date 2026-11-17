/**
 * Landing page (l-01-landing-1440, design/02), ported from apps/web-astro/src/pages/index.astro
 * with the same class names and the same copy deck, so the two member frontends render alike.
 *
 * Auth state: the Astro page reads the session on the server. This build is a static export, so
 * the session-dependent header, menu, footer links and closing CTA live in LandingCta's client
 * islands and start signed-out, matching FR-LAND-003 after their one /auth/me probe resolves.
 *
 * Hero image: design/assets/landing-illustration.png, intrinsic 576x433. Next runs at basePath
 * /b, so the asset URL is hard-coded; next/link hrefs stay basePath-free.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { copy, routes } from '@taskapp/contracts';
import { ImageIcon, ListChecks, Menu, StickyNote } from '@/components/icons';
import {
  LandingCta,
  LandingFooterLinks,
  LandingHeaderActions,
  LandingMenuLinks,
} from '@/components/LandingCta';
import { LandingExtended } from '@/components/LandingExtended';
import './landing.css';

export const metadata: Metadata = {
  title: copy.brand.name,
  description: copy.brand.valueLine,
};

/** The three C-08 instances the deck draws (design/02 l-01); dates and bodies are marketing fixtures. */
const previewTasks = [
  {
    title: 'Prepare sprint review',
    status: 'in_progress',
    priority: 'high',
    date: '12 Nov 2026',
    body: 'Confirm the agenda, the due dates and who owns each task.',
  },
  {
    title: 'Draft Q4 roadmap',
    status: 'todo',
    priority: 'low',
    date: '20 Nov 2026',
    body: 'Collect the top three bets from each squad and note which ones need a decision.',
  },
  {
    title: 'Book team offsite',
    status: 'completed',
    priority: 'medium',
    date: '28 Nov 2026',
    body: 'Compare three venues and hold the date before the deposit window closes.',
  },
] as const;

export default function LandingPage() {
  return (
    <>
      <a className="skip-link" href="#main">
        {copy.nav.skipToContent}
      </a>

      <header className="m-header">
        <div className="m-header__inner">
          <Link className="wordmark" href={routes.landing}>
            <ListChecks size={20} strokeWidth={1.6} />
            {copy.brand.name}
          </Link>

          <nav className="m-header__actions m-header__links" aria-label={copy.brand.name}>
            <LandingHeaderActions />
          </nav>

          <details className="m-menu">
            <summary className="icon-btn">
              <Menu size={20} strokeWidth={1.6} />
              <span className="visually-hidden m-menu__open">{copy.nav.openMenu}</span>
              <span className="visually-hidden m-menu__close">{copy.nav.closeMenu}</span>
            </summary>
            <div className="m-menu__panel">
              <LandingMenuLinks />
            </div>
          </details>
        </div>
      </header>

      <main id="main" className="m-main">
        <section className="hero">
          <div>
            <h1 className="hero__title">{copy.brand.valueLine}</h1>
            <p className="hero__lead">{copy.landing.intro}</p>
          </div>

          <figure className="hero__figure">
            <img
              src="/b/landing-illustration.png"
              alt={copy.landing.previewAlt}
              width={576}
              height={433}
            />
          </figure>
        </section>

        <section className="section section--features" aria-label={copy.landing.previewAlt}>
          <div className="features">
            <div className="feature">
              {/* @lucide/astro renders the 40 px feature glyphs at lucide's default 2 px stroke. */}
              <ListChecks size={40} strokeWidth={2} className="feature__icon" />
              <h2 className="feature__title">{copy.landing.featureTasksTitle}</h2>
              <p className="feature__body">{copy.task.empty.body}</p>
            </div>
            <div className="feature">
              <StickyNote size={40} strokeWidth={2} className="feature__icon" />
              <h2 className="feature__title">{copy.landing.featureNotesTitle}</h2>
              <p className="feature__body">{copy.note.empty.body}</p>
            </div>
            <div className="feature">
              <ImageIcon size={40} strokeWidth={2} className="feature__icon" />
              <h2 className="feature__title">{copy.landing.featureImagesTitle}</h2>
              <p className="feature__body">{copy.task.attachments.noneHint}</p>
            </div>
          </div>

          <div className="preview">
            <div className="preview__grid">
              {previewTasks.map((task) => (
                <div className="preview-card" key={task.title}>
                  <div className="preview-card__title">{task.title}</div>
                  <div className="preview-card__badges">
                    <span className="badge" data-kind="status" data-value={task.status}>
                      {copy.task.status[task.status]}
                    </span>
                    <span className="badge" data-kind="priority" data-value={task.priority}>
                      {copy.task.priority[task.priority]}
                    </span>
                  </div>
                  <div className="preview-card__date">{task.date}</div>
                  <p className="preview-card__body">{task.body}</p>
                  <div className="preview-card__thumbs" aria-hidden="true">
                    {[0, 1, 2].map((slot) => (
                      <span className="preview-card__thumb" key={slot}>
                        <ImageIcon size={20} strokeWidth={1.6} />
                      </span>
                    ))}
                    <span className="preview-card__more">+2</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="preview__actions">
            <LandingCta />
          </div>
        </section>

        <LandingExtended tasks={previewTasks} />
      </main>

      <footer className="m-footer">
        <div className="m-footer__inner">
          <div>
            <Link className="wordmark" href={routes.landing}>
              <ListChecks size={20} strokeWidth={1.6} />
              {copy.brand.name}
            </Link>
            <p className="muted footer-blurb">{copy.landing.footerBlurb}</p>
          </div>
          <nav className="m-footer__links">
            <LandingFooterLinks />
          </nav>
        </div>
      </footer>
    </>
  );
}
