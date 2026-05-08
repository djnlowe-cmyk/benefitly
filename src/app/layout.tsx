import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Benefitly — Your Coverage Dashboard',
  description: 'The personal coverage layer for modern life. See everything you are covered for, in one place.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="antialiased">{children}</body>
    </html>
  );
}
