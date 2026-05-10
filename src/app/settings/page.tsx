import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import SettingsPrivacy from './SettingsPrivacy';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login?callbackUrl=/settings');
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
        <p className="text-sm text-gray-500 mb-8">
          Manage your account, privacy, and data.
        </p>
        <SettingsPrivacy />
      </div>
    </main>
  );
}
