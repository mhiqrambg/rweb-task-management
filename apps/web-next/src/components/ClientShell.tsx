'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, copy, type SessionProbe, type ItemResponse, type User } from '@taskapp/contracts';
import { ApiError, requestJson, SESSION_EXPIRED_EVENT } from '@/lib/api';
import { ShellSkeleton } from '@/components/ShellSkeleton';
import { DashboardPanel } from '@/components/DashboardPanel';
import { TaskPanel } from '@/components/TaskPanel';
import { NotePanel } from '@/components/NotePanel';
import { AccountPanel } from '@/components/AccountPanel';
import { CircleUser, LayoutDashboard, ListChecks, LogOut, Menu, StickyNote, X } from '@/components/icons';

type View = 'dashboard' | 'tasks' | 'notes' | 'account';
function isView(value: string | null): value is View {
  return value === 'dashboard' || value === 'tasks' || value === 'notes' || value === 'account';
}

/** §4 of the copy deck: the four destinations, in the frame order s-01 shows. */
const navItems = [
  { view: 'dashboard', title: copy.nav.dashboard, Icon: LayoutDashboard },
  { view: 'tasks', title: copy.nav.tasks, Icon: ListChecks },
  { view: 'notes', title: copy.nav.notes, Icon: StickyNote },
  { view: 'account', title: copy.nav.account, Icon: CircleUser },
] as const satisfies ReadonlyArray<{ view: View; title: string; Icon: typeof Menu }>;

/** ADR-04: the static export carries one app page; the view is a query parameter, not a route. */
const VIEW_PATH: Record<View, string> = {
  dashboard: '/app/?view=dashboard',
  tasks: '/app/?view=tasks',
  notes: '/app/?view=notes',
  account: '/app/?view=account',
};

type SessionState =
  | { attempt: number; status: 'ready'; user: User }
  | { attempt: number; status: 'error'; message: string };

export function ClientShell() {
  const params = useSearchParams();
  const router = useRouter();
  const viewParam = params.get('view');
  const view: View = isView(viewParam) ? viewParam : 'dashboard';
  const id = params.get('id');
  const mode = params.get('mode');

  const [session, setSession] = useState<SessionState | null>(null);
  const [logoutError, setLogoutError] = useState('');
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const drawer = useRef<HTMLDialogElement>(null);

  const redirectToLogin = useCallback(() => {
    const next = `${window.location.pathname}${window.location.search}`;
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [router]);

  // Every private request goes through requestJson, which fires this event on a 401.
  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, redirectToLogin);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, redirectToLogin);
  }, [redirectToLogin]);

  useEffect(() => {
    let active = true;
    requestJson<ItemResponse<SessionProbe>>(api.auth.me)
      .then((response) => {
        if (!active) return;
        const user = response.data.user;
        if (!user) {
          redirectToLogin();
          return;
        }
        setSession({ attempt, status: 'ready', user });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof ApiError && cause.status === 401) {
          redirectToLogin();
          return;
        }
        setSession({
          attempt,
          status: 'error',
          message: cause instanceof Error ? cause.message : copy.state.error.body,
        });
      });
    return () => { active = false; };
  }, [attempt, redirectToLogin]);

  async function logout() {
    if (logoutBusy) return;
    setLogoutError('');
    setLogoutBusy(true);
    try {
      await requestJson(api.auth.logout, { method: 'POST' });
      router.replace('/login');
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        router.replace('/login');
        return;
      }
      setLogoutError(cause instanceof Error ? cause.message : copy.toast.errorSave);
    } finally {
      setLogoutBusy(false);
    }
  }

  // A new attempt renders as loading immediately; no state is set synchronously inside the effect.
  const currentSession = session?.attempt === attempt ? session : null;
  if (!currentSession) return <ShellSkeleton />;
  if (currentSession.status === 'error') {
    return (
      <main className="center-page">
        <section className="panel">
          <h1>{copy.state.error.title}</h1>
          <p className="error" role="alert">{currentSession.message}</p>
          <button className="btn" data-variant="secondary" type="button" onClick={() => setAttempt((previous) => previous + 1)}>
            {copy.action.retry}
          </button>
        </section>
      </main>
    );
  }
  const user = currentSession.user;

  const nav = (onNavigate?: () => void) => (
    <nav className="nav-list" aria-label={copy.brand.name}>
      {navItems.map(({ view: itemView, title, Icon }) => (
        <Link
          key={itemView}
          className="nav-item"
          href={VIEW_PATH[itemView]}
          aria-current={view === itemView ? 'page' : undefined}
          onClick={onNavigate}
        >
          <Icon className="icon" />
          {title}
        </Link>
      ))}
    </nav>
  );

  const logoutControl = (idSuffix: string) => (
    <div className="stack-sm">
      {logoutError ? <p className="error" role="alert" id={`logout-error-${idSuffix}`}>{logoutError}</p> : null}
      <button
        className="btn"
        data-variant="ghost"
        type="button"
        onClick={() => void logout()}
        disabled={logoutBusy}
        aria-busy={logoutBusy || undefined}
        aria-describedby={logoutError ? `logout-error-${idSuffix}` : undefined}
      >
        <LogOut className="icon" />
        {copy.auth.logout}
      </button>
    </div>
  );

  return (
    <div className="shell">
      <a className="skip-link" href="#main">{copy.nav.skipToContent}</a>
      <header className="shell__header">
        <Link className="shell__brand" href={VIEW_PATH.dashboard}>
          <ListChecks className="icon" />
          {copy.brand.name}
        </Link>
        <span className="muted header-identity">
          {copy.auth.signedInAs} {user.displayName}
        </span>
        <button
          className="icon-btn shell__menu"
          data-variant="secondary"
          type="button"
          aria-label={copy.nav.openMenu}
          onClick={() => drawer.current?.showModal()}
        >
          <Menu />
        </button>
      </header>

      <div className="shell__body">
        <aside className="shell__sidebar">
          {nav()}
          <div className="shell__foot">{logoutControl('sidebar')}</div>
        </aside>

        <main className="shell__main" id="main">
          <div className="shell__container">
            {view === 'dashboard' && <DashboardPanel />}
            {view === 'tasks' && <TaskPanel id={id} mode={mode} />}
            {view === 'notes' && <NotePanel id={id} />}
            {view === 'account' && (
              <AccountPanel
                profile={user}
                onLogout={logout}
                logoutBusy={logoutBusy}
                logoutError={logoutError}
              />
            )}
          </div>
        </main>
      </div>

      <dialog className="drawer" ref={drawer} aria-label={copy.nav.openMenu}>
        <div className="drawer__head">
          <span className="shell__brand">
            <ListChecks className="icon" />
            {copy.brand.name}
          </span>
          <button
            className="icon-btn"
            data-variant="secondary"
            type="button"
            aria-label={copy.nav.closeMenu}
            onClick={() => drawer.current?.close()}
          >
            <X />
          </button>
        </div>
        {nav(() => drawer.current?.close())}
        <div className="shell__foot">{logoutControl('drawer')}</div>
      </dialog>
    </div>
  );
}
