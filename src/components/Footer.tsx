import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white py-4 px-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-gray-500">
        <span>&copy; Benefitly</span>
        <Link href="/privacy" className="hover:text-gray-900 hover:underline">
          Privacy
        </Link>
      </div>
    </footer>
  );
}
