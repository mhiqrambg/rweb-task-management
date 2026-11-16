/**
 * Lucide icons (ISC, https://lucide.dev), path data copied from @lucide/astro so the Next landing
 * matches the Astro build without adding a dependency.
 *
 * The attribute set and the `lucide lucide-<name>` classes repeat what @lucide/astro renders, so
 * the two frontends emit the same SVG. Default stroke is 1.6; the 40 px feature glyphs keep
 * lucide's 2 px stroke, as the Astro landing does.
 */
import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number };

function Icon({
  name,
  size = 24,
  strokeWidth = 1.6,
  className,
  children,
  ...rest
}: IconProps & { name: string; children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={['lucide', `lucide-${name}`, className].filter(Boolean).join(' ')}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function ListChecks(props: IconProps) {
  return (
    <Icon name="list-checks" {...props}>
      <path d="M13 5h8" />
      <path d="M13 12h8" />
      <path d="M13 19h8" />
      <path d="m3 17 2 2 4-4" />
      <path d="m3 7 2 2 4-4" />
    </Icon>
  );
}

export function StickyNote(props: IconProps) {
  return (
    <Icon name="sticky-note" {...props}>
      <path d="M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z" />
      <path d="M15 3v5a1 1 0 0 0 1 1h5" />
    </Icon>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <Icon name="image" {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </Icon>
  );
}

export function Menu(props: IconProps) {
  return (
    <Icon name="menu" {...props}>
      <path d="M4 5h16" />
      <path d="M4 12h16" />
      <path d="M4 19h16" />
    </Icon>
  );
}

export function LayoutDashboard(props: IconProps) {
  return (
    <Icon name="layout-dashboard" {...props}>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </Icon>
  );
}

export function CircleUser(props: IconProps) {
  return (
    <Icon name="circle-user" {...props}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="10" r="3" />
      <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
    </Icon>
  );
}

export function LogOut(props: IconProps) {
  return (
    <Icon name="log-out" {...props}>
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    </Icon>
  );
}

export function X(props: IconProps) {
  return (
    <Icon name="x" {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Icon>
  );
}

export function Pin(props: IconProps) {
  return (
    <Icon name="pin" {...props}>
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </Icon>
  );
}
