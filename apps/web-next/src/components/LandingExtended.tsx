import { copy } from '@taskapp/contracts';
import { ImageIcon, ListChecks, StickyNote } from '@/components/icons';
import { LandingCta } from '@/components/LandingCta';
import { LandingFaq } from '@/components/LandingFaq';
import { LandingTaskShowcase, type LandingPreviewTask } from '@/components/LandingTaskShowcase';

const featureCards = [
  { key: 'tasks', Icon: ListChecks, title: copy.landingExtended.features.tasks.title, body: copy.landingExtended.features.tasks.body },
  { key: 'notes', Icon: StickyNote, title: copy.landingExtended.features.notes.title, body: copy.landingExtended.features.notes.body },
  { key: 'images', Icon: ImageIcon, title: copy.landingExtended.features.images.title, body: copy.landingExtended.features.images.body },
] as const;

function MiniFeaturePreview({ kind }: { kind: 'tasks' | 'notes' | 'images' }) {
  if (kind === 'tasks') {
    return (
      <div className="xl-feature-preview xl-feature-preview--tasks" aria-hidden="true">
        <span /><span /><span />
      </div>
    );
  }
  if (kind === 'notes') {
    return (
      <div className="xl-feature-preview xl-feature-preview--notes" aria-hidden="true">
        <span /><span /><span />
      </div>
    );
  }
  return (
    <div className="xl-feature-preview xl-feature-preview--images" aria-hidden="true">
      {[0, 1, 2].map((number) => (
        <span key={number}><ImageIcon size={20} strokeWidth={1.6} /></span>
      ))}
    </div>
  );
}

export function LandingExtended({ tasks }: { tasks: readonly LandingPreviewTask[] }) {
  const extended = copy.landingExtended;
  return (
    <div className="xl-landing">
      {/* l-04: a second, detailed feature presentation after the original fold. */}
      <section className="xl-section" id="features" aria-labelledby="xl-features-title">
        <nav className="xl-jump" aria-label={extended.jumpLabel}>
          <a href="#features">{extended.jump.features}</a>
          <a href="#how-it-works">{extended.jump.how}</a>
          <a href="#faq">{extended.jump.faq}</a>
          <a href="#register">{extended.jump.register}</a>
          <a href="#login">{extended.jump.login}</a>
        </nav>
        <div className="xl-heading">
          <h2 id="xl-features-title">{extended.features.title}</h2>
          <p>{extended.features.intro}</p>
        </div>
        <div className="xl-feature-grid">
          {featureCards.map(({ key, Icon, title, body }) => (
            <article className="xl-feature-card" key={key}>
              <div className="xl-feature-icon" aria-hidden="true"><Icon size={20} strokeWidth={1.8} /></div>
              <h3>{title}</h3>
              <p>{body}</p>
              <MiniFeaturePreview kind={key} />
            </article>
          ))}
        </div>
      </section>

      {/* l-05: sequence lines, numbers, and explanations. */}
      <section className="xl-section" id="how-it-works" aria-labelledby="xl-how-title">
        <div className="xl-heading">
          <h2 id="xl-how-title">{extended.how.title}</h2>
          <p>{extended.how.intro}</p>
        </div>
        <ol className="xl-steps">
          {extended.how.steps.map((step, index) => (
            <li className="xl-step" key={step.title}>
              <span className="xl-step-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* l-06: demonstrative cards with real, working search and filter controls. */}
      <section className="xl-section" aria-labelledby="xl-task-title">
        <div className="xl-heading">
          <h2 id="xl-task-title">{extended.taskShowcase.title}</h2>
          <p>{extended.taskShowcase.intro}</p>
        </div>
        <LandingTaskShowcase tasks={tasks} />
      </section>

      {/* l-07: static marketing samples, not authenticated user records. */}
      <section className="xl-section" aria-labelledby="xl-notes-title">
        <div className="xl-heading">
          <h2 id="xl-notes-title">{extended.noteShowcase.title}</h2>
          <p>{extended.noteShowcase.intro}</p>
        </div>
        <div className="xl-note-grid">
          <article className="xl-note-card xl-note-card--pinned">
            <span className="badge" data-kind="pin">{copy.note.pinned}</span>
            <h3>{extended.noteShowcase.pinnedTitle}</h3>
            <p>{extended.noteShowcase.pinnedBody}</p>
            <div className="xl-note-gallery" aria-hidden="true">
              {[0, 1, 2].map((slot) => (
                <span key={slot}><ImageIcon size={24} strokeWidth={1.6} /></span>
              ))}
            </div>
          </article>
          <article className="xl-note-card">
            <h3>{extended.noteShowcase.otherTitle}</h3>
            <p>{extended.noteShowcase.otherBody}</p>
          </article>
        </div>
      </section>

      {/* l-08: only one answer is expanded at once; first answer is open on initial render. */}
      <section className="xl-section xl-section--faq" id="faq" aria-labelledby="xl-faq-title">
        <div className="xl-heading">
          <h2 id="xl-faq-title">{extended.faq.title}</h2>
          <p>{extended.faq.intro}</p>
        </div>
        <LandingFaq />
      </section>

      {/* l-09: final CTA. The existing footer below <main> stays the only footer. */}
      <section className="xl-section xl-section--final" aria-labelledby="xl-final-title">
        <div className="xl-final-panel">
          <h2 id="xl-final-title">{extended.finalCta.title}</h2>
          <p>{extended.finalCta.body}</p>
          <div id="register" className="xl-final-actions">
            <span id="login" className="xl-anchor-target" aria-hidden="true" />
            <LandingCta />
          </div>
        </div>
      </section>
    </div>
  );
}
