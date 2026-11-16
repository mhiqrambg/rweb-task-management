'use client';

import { useState } from 'react';
import { AccountPanel } from '@/components/AccountPanel';
import '../app.css';

const demoProfile = {
  displayName: 'Demo User',
  email: 'demo@example.com',
};

export default function AccountPreviewPage() {
  const [showError, setShowError] = useState(false);
  const [loggedOut, setLoggedOut] = useState(false);
  return (
    <main style={{ maxWidth: 940, margin: '0 auto', padding: '32px 18px' }}>
      <p className="eyebrow">UI PREVIEW • SAMPLE DATA • NO BACKEND</p>
      <p className="muted">
        This page only checks the Account look. Logout here is a local simulation;
        the real app logs out through the ElysiaJS API.
      </p>
      <div className="actions" style={{ marginBottom: 20 }}>
        <button type="button" className="button secondary" onClick={() => { setLoggedOut(false); setShowError(false); }}>Reset preview</button>
        <button type="button" className="button secondary" onClick={() => { setShowError(true); setLoggedOut(false); }}>Simulate logout error</button>
      </div>
      {loggedOut ? (
      <section className="panel" role="status">
        <h1>Simulated logout succeeded</h1>
        <p className="muted">No real session was changed. Click Reset preview to go back.</p>
      </section>
      ) : (
        <AccountPanel
          profile={demoProfile}
          logoutError={showError ? 'Example: connection dropped. Please try again.' : ''}
          onLogout={() => { setLoggedOut(true); setShowError(false); }}
        />
      )}
    </main>
  );
}
