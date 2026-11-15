import type { Metadata } from 'next';
import { copy } from '@taskapp/contracts';
import '@taskapp/design-tokens/tokens.css';
import './globals.css';
export const metadata: Metadata = {
  title: copy.brand.name,
  description: copy.brand.valueLine,
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
