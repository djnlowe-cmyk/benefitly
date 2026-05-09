import { CategoryMeta, CoverageCategory, StatusStyle, CoverageStatus } from '@/types/coverage';

export const CATEGORIES: Record<CoverageCategory, CategoryMeta> = {
  health:     { label: 'Private Medical / NHS gap', color: '#0d9488', bg: '#f0fdfa', icon: '+' },
  dental:     { label: 'Dental',                    color: '#0891b2', bg: '#ecfeff', icon: '⊞' },
  vision:     { label: 'Optical',                   color: '#6366f1', bg: '#eef2ff', icon: '◉' },
  life:       { label: 'Life',                      color: '#be185d', bg: '#fdf2f8', icon: '♥' },
  disability: { label: 'Income Protection',         color: '#9333ea', bg: '#faf5ff', icon: '◆' },
  auto:       { label: 'Motor',                     color: '#d97706', bg: '#fffbeb', icon: '⊕' },
  home:       { label: 'Home',                      color: '#2563eb', bg: '#eff6ff', icon: '⌂' },
  travel:     { label: 'Travel',                    color: '#7c3aed', bg: '#f5f3ff', icon: '✈' },
  pet:        { label: 'Pet',                       color: '#ea580c', bg: '#fff7ed', icon: '★' },
  warranty:   { label: 'Warranty',                  color: '#059669', bg: '#ecfdf5', icon: '✓' },
  creditcard: { label: 'Card Benefits / Section 75', color: '#dc2626', bg: '#fef2f2', icon: '£' },
  business:   { label: 'Business',                  color: '#4f46e5', bg: '#eef2ff', icon: '■' },
};

export const STATUS_STYLES: Record<CoverageStatus, StatusStyle> = {
  active:   { color: '#059669', bg: '#ecfdf5', label: 'Active' },
  expiring: { color: '#d97706', bg: '#fffbeb', label: 'Expiring Soon' },
  expired:  { color: '#dc2626', bg: '#fef2f2', label: 'Expired' },
  pending:  { color: '#6b7280', bg: '#f3f4f6', label: 'Claim Pending' },
};

// Defensive lookup: Coverage.category is typed `CoverageCategory` but is
// stored as a free string in Prisma and accepted by Zod as any non-empty
// string, so the AI parser can produce off-enum values (e.g. "car") that
// would crash the React tree if dereferenced via CATEGORIES[key].label.
// Use this helper at every render site that reads a coverage's category.
export function resolveCategory(key: string): CategoryMeta {
  return (
    (CATEGORIES as Record<string, CategoryMeta | undefined>)[key] ?? {
      label: key,
      color: '#6b7280',
      bg: '#f3f4f6',
      icon: '?',
    }
  );
}
