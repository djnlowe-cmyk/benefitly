import AppShell from '@/components/layout/AppShell';

interface SearchPageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const raw = params.q;
  const q = Array.isArray(raw) ? raw[0] : raw;
  return <AppShell initialView="search" initialQuery={q ?? undefined} />;
}
