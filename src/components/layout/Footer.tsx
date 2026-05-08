import Link from 'next/link';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="w-full text-center text-xs text-gray-500 py-4 px-4">
      <div>
        Benefitly · <Link href="/privacy" className="hover:underline text-gray-600">Privacy</Link>
      </div>
      <div className="mt-1">© {year} Benefitly. All rights reserved.</div>
    </footer>
  );
}
