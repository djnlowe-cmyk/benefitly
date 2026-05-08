import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import CountryPicker from './CountryPicker';
import DeleteAccountButton from './DeleteAccountButton';

export default async function SettingsPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, country: true, currency: true },
  });
  if (!user) {
    redirect('/login');
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
        <p className="text-sm text-gray-500 mb-8">
          Choose your country to localise currency, dates, insurer terminology, and AI document parsing.
        </p>

        <section className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Account</h2>
          <p className="text-sm text-gray-500 mb-4">{user.name || 'Unnamed user'} · {user.email}</p>
          <CountryPicker initialCountry={user.country} initialCurrency={user.currency} />
        </section>

        <p className="text-xs text-gray-500 mb-10">
          More countries are coming soon. Today, only United Kingdom (GBP) is fully supported. The schema and formatters already handle other locales — we just need the regional content libraries before flipping the switch.
        </p>

        <section className="bg-white border border-red-200 rounded-lg p-6">
          <h2 className="text-base font-semibold text-red-700 mb-1">Delete account</h2>
          <p className="text-sm text-gray-600 mb-4">
            Permanently delete your account and every record we hold for you — coverage, alerts, family members,
            documents, transactions, assets and claims. This cannot be undone.
          </p>
          <DeleteAccountButton email={user.email} />
        </section>
      </div>
    </main>
  );
}
