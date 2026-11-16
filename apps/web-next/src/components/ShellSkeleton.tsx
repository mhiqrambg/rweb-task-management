import { copy } from '@taskapp/contracts';
import { ListChecks } from '@/components/icons';

/**
 * C-22 in its bootstrapping state (Next only): the shell is painted immediately, the identity and
 * the page content arrive with the session probe. Skeleton boxes keep the final geometry, so the
 * swap does not move the layout (design/02 st-01).
 */
export function ShellSkeleton() {
  return (
    <div className="shell">
      <header className="shell__header">
        <span className="shell__brand">
          <ListChecks className="icon" />
          {copy.brand.name}
        </span>
        <span className="skeleton shell__menu" style={{ width: 32, height: 32 }} aria-hidden="true" />
      </header>
      <div className="shell__body">
        <aside className="shell__sidebar" aria-hidden="true">
          <div className="nav-list">
            {[0, 1, 2, 3].map((item) => (
              <span className="skeleton" style={{ height: 'var(--control-h-touch)' }} key={item} />
            ))}
          </div>
        </aside>
        <main className="shell__main">
          <div className="shell__container">
            <p className="visually-hidden" role="status" aria-live="polite">{copy.state.loading}</p>
            <div className="skeleton skeleton--text" style={{ width: '35%', height: 32 }} aria-hidden="true" />
            <div className="grid-3" aria-hidden="true">
              {[0, 1, 2].map((item) => <div className="skeleton skeleton--card" key={item} />)}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
