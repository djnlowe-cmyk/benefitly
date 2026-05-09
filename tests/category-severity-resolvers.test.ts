import { describe, expect, it } from 'vitest';
import { CATEGORIES, resolveCategory } from '@/data/categories';
import { SEVERITY_STYLES, resolveSeverity } from '@/data/severity';

describe('resolveCategory', () => {
  it('returns the canonical meta for every known category', () => {
    for (const [key, meta] of Object.entries(CATEGORIES)) {
      expect(resolveCategory(key)).toBe(meta);
    }
  });

  it('returns a neutral fallback for an off-enum value', () => {
    // Reproduces the ALI-85 crash trigger: parser writes `category: 'car'`.
    expect(resolveCategory('car')).toEqual({
      label: 'car',
      color: '#6b7280',
      bg: '#f3f4f6',
      icon: '?',
    });
  });

  it('does not throw on empty string', () => {
    expect(() => resolveCategory('')).not.toThrow();
    expect(resolveCategory('').icon).toBe('?');
  });
});

describe('resolveSeverity', () => {
  it('returns the canonical style for every known severity', () => {
    for (const [key, style] of Object.entries(SEVERITY_STYLES)) {
      expect(resolveSeverity(key)).toBe(style);
    }
  });

  it('returns a neutral fallback for an off-enum severity', () => {
    expect(resolveSeverity('catastrophic')).toEqual({
      label: 'catastrophic',
      color: '#6b7280',
      bg: '#f3f4f6',
      icon: '?',
    });
  });
});
