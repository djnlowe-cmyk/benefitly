import type { Metadata } from 'next';
import './globals.css';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Benefitly — Your Coverage Dashboard',
  description: 'The personal coverage layer for modern life. See everything you are covered for, in one place.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="antialiased flex flex-col min-h-screen">
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
