import { copy, formatDate } from '@taskapp/contracts';

export type AccountProfile = {
  displayName?: string | null;
  email: string;
  createdAt?: string | null;
};

type AccountPanelProps = {
  profile: AccountProfile;
  onLogout: () => void | Promise<void>;
  logoutBusy?: boolean;
  logoutError?: string;
};

/** Read-only profile, same markup and copy as apps/web-astro/src/pages/account.astro. */
export function AccountPanel({
  profile,
  onLogout,
  logoutBusy = false,
  logoutError = '',
}: AccountPanelProps) {
  return (
    <section className="section account-panel" aria-labelledby="account-heading">
      <h1 id="account-heading" className="page-head__title">{copy.account.title}</h1>

      <div className="panel">
        <div className="account-row">
          <span className="account-row__label">{copy.account.email}</span>
          <span>{profile.email}</span>
        </div>
        <div className="account-row">
          <span className="account-row__label">{copy.account.displayName}</span>
          <span>{profile.displayName?.trim() || copy.account.displayName}</span>
        </div>
        <div className="account-row">
          <span className="account-row__label">{copy.account.createdAt}</span>
          <span>{profile.createdAt ? formatDate(profile.createdAt) : '—'}</span>
        </div>

        <hr className="divider" />

        <p className="muted">{copy.account.readOnly}</p>

        {logoutError ? <p role="alert" className="error">{logoutError}</p> : null}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!logoutBusy) void onLogout();
          }}
        >
          <button
            type="submit"
            className="btn"
            data-variant="secondary"
            disabled={logoutBusy}
            aria-busy={logoutBusy || undefined}
          >
            {logoutBusy ? <span className="btn__spinner" aria-hidden="true" /> : null}
            {copy.auth.logout}
          </button>
        </form>
      </div>
    </section>
  );
}
