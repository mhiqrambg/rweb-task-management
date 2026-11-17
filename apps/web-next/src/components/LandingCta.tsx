'use client';

/**
 * The landing's session-dependent chrome: header actions, the mobile menu panel, the footer links
 * and the closing CTA. FR-LAND-003: a signed-out visitor gets Log in + Get started, a signed-in
 * visitor gets Account and Go to dashboard.
 *
 * The Astro landing reads the session cookie on the server. A static export cannot, so the state
 * starts signed-out (also the failure case) and swaps once the single /auth/me probe resolves.
 * Every island shares one probe per page load, so the header and the CTA never disagree.
 */
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { api, copy, routes, type ItemResponse, type SessionProbe } from '@taskapp/contracts';
import { requestJson } from '@/lib/api';

type Session = SessionProbe | null;

// Next has no /account page; the account and dashboard screens live in the app shell at
// /app/?view=…, which is where the Astro account link and the Go to dashboard CTA point.
const ACCOUNT_HREF = `${routes.dashboard}/?view=account`;
const DASHBOARD_HREF = `${routes.dashboard}/?view=dashboard`;

let sessionProbe: Promise<Session> | null = null;

function readSession(): Promise<Session> {
  sessionProbe ??= requestJson<ItemResponse<SessionProbe>>(api.auth.me)
    .then((response) => response.data)
    .catch(() => null);
  return sessionProbe;
}

function useSession(): Session {
  const [session, setSession] = useState<Session>(null);

  useEffect(() => {
    let mounted = true;
    void readSession().then((value) => {
      if (mounted) setSession(value);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return session;
}

type Variant = 'primary' | 'secondary' | 'ghost';

/** C-01's link form: the visual contract is `class="btn"` plus `data-variant`. */
function ActionLink({ href, variant, children }: { href: string; variant: Variant; children: ReactNode }) {
  return (
    <Link href={href} className="btn" {...{ 'data-variant': variant }}>
      {children}
    </Link>
  );
}

export function LandingHeaderActions() {
  const session = useSession();

  if (!session) {
    return (
      <>
        <ActionLink href={routes.login} variant="ghost">
          {copy.cta.logIn}
        </ActionLink>
        <ActionLink href={routes.register} variant="primary">
          {copy.cta.getStarted}
        </ActionLink>
      </>
    );
  }

  return (
    <>
      <span className="muted header-identity">
        {copy.auth.signedInAs} {session.user.displayName}
      </span>
      <ActionLink href={ACCOUNT_HREF} variant="secondary">
        {copy.nav.account}
      </ActionLink>
    </>
  );
}

export function LandingMenuLinks() {
  const session = useSession();

  return session ? (
    <Link className="m-menu__link" href={ACCOUNT_HREF}>
      {copy.nav.account}
    </Link>
  ) : (
    <>
      <Link className="m-menu__link" href={routes.login}>
        {copy.cta.logIn}
      </Link>
      <Link className="m-menu__link" href={routes.register}>
        {copy.cta.getStarted}
      </Link>
    </>
  );
}

export function LandingFooterLinks() {
  const session = useSession();
  if (session) return null;

  return (
    <>
      <Link href={routes.login}>{copy.cta.logIn}</Link>
      <Link href={routes.register}>{copy.cta.getStarted}</Link>
    </>
  );
}

export function LandingCta() {
  const session = useSession();

  if (session) {
    return (
      <ActionLink href={DASHBOARD_HREF} variant="primary">
        {copy.cta.goToDashboard}
      </ActionLink>
    );
  }

  return (
    <>
      <ActionLink href={routes.register} variant="primary">
        {copy.cta.getStarted}
      </ActionLink>
      <ActionLink href={routes.login} variant="secondary">
        {copy.cta.logIn}
      </ActionLink>
    </>
  );
}

/** A real link from the task showcase. Reuses the shared one-probe session state. */
export function LandingNewTaskLink() {
  const session = useSession();
  const href = session ? `${routes.dashboard}/?view=tasks` : routes.register;
  return (
    <ActionLink href={href} variant="primary">
      {copy.task.new}
    </ActionLink>
  );
}
