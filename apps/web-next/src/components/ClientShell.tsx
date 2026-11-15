'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, copy, type SessionProbe, type ItemResponse, type User } from '@taskapp/contracts';
import { ApiError, requestJson, SESSION_EXPIRED_EVENT } from '@/lib/api';
import { ShellSkeleton } from '@/components/ShellSkeleton';
import { DashboardPanel } from '@/components/DashboardPanel';
import { TaskPanel } from '@/components/TaskPanel';
import { NotePanel } from '@/components/NotePanel';
import { AccountPanel } from '@/components/AccountPanel';

type View = 'dashboard' | 'tasks' | 'notes' | 'account';
function isView(value: string | null): value is View {
  return value === 'dashboard' || value === 'tasks' || value === 'notes' || value === 'account';
}
const navItems: { view: View; title: string; icon: string }[] = [
  { view: 'dashboard', title: copy.nav.dashboard, icon: '▦' },
  { view: 'tasks', title: copy.nav.tasks, icon: '☑' },
  { view: 'notes', title: copy.nav.notes, icon: '▤' },
  { view: 'account', title: copy.nav.account, icon: '◯' },
];

type SessionState =
  | { attempt: number; status: 'ready'; user: User }
  | { attempt: number; status: 'error'; message: string };

export function ClientShell() {
  const params = useSearchParams();
  const router = useRouter();
  const viewParam = params.get('view');
  const view = isView(viewParam) ? viewParam : 'dashboard';
  const id = params.get('id');
  const mode = params.get('mode');

  const [session, setSession] = useState<SessionState | null>(null);
  const [logoutError, setLogoutError] = useState('');
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const redirectToLogin = useCallback(() => {
    const next = `${window.location.pathname}${window.location.search}`;
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [router]);

  // Seluruh request privat melalui requestJson otomatis memicu event ketika sesi menjadi 401.
  useEffect(() => {
    const onExpired = () => redirectToLogin();
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [redirectToLogin]);

  useEffect(() => {
    let active = true;
    requestJson<ItemResponse<SessionProbe>>(api.auth.me)
      .then((result) => {
        if (!active) return;
        setSession({ attempt, status: 'ready', user: result.data.user });
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

  // Pergantian attempt langsung menghasilkan state loading saat render.
  // Tidak perlu setState sinkron dalam useEffect.
  const currentSession = session?.attempt === attempt ? session : null;
  if (!currentSession) return <ShellSkeleton />;
  if (currentSession.status === 'error') {
    return (
      <main className="center-page">
        <section className="panel">
          <h1>{copy.state.error.title}</h1>
          <p className="error" role="alert">{currentSession.message}</p>
          <button className="button secondary" onClick={() => setAttempt((previous) => previous + 1)}>
            {copy.action.retry}
          </button>
        </section>
      </main>
    );
  }
  const user = currentSession.user;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">◧ {copy.brand.name}</div>
        <nav aria-label={copy.brand.name} className="nav-list">
          {navItems.map((item) => (
            <button
              type="button"
              key={item.view}
              className={`nav-item ${view === item.view ? 'active' : ''}`}
              aria-current={view === item.view ? 'page' : undefined}
              onClick={() => router.push(`/app/?view=${item.view}`)}
            >
              <span aria-hidden="true">{item.icon}</span>{item.title}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="avatar">{user.displayName?.slice(0, 1).toUpperCase() || 'U'}</span>
          <div><strong>{user.displayName}</strong><small>{user.email}</small></div>
        </div>
      </aside>
      <div className="workspace">
        <header className="workspace-header">
          <strong>{navItems.find((item) => item.view === view)?.title}</strong>
        </header>
        <main className="content">
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
        </main>
      </div>
    </div>
  );
}
