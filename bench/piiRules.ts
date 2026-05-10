// Pure PII detection rules. Imported by both bench/anonymise.ts (CLI)
// and the tests — kept side-effect-free so importing it does not run the
// CLI's main().

export interface DenyList {
  values: string[];
  notes?: string;
}

export interface Finding {
  rule: string;
  match: string;
  severity: 'error' | 'warn';
}

export const UK_POSTCODE_RE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi;
export const UK_PHONE_RE = /\b(?:\+44\s?|0)(?:\d\s?){9,10}\b/g;
export const EMAIL_RE = /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g;
// UK National Insurance number: 2 letters, 6 digits, 1 letter (with optional spaces).
export const NI_RE = /\b[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/g;
export const SORT_CODE_RE = /\b\d{2}-\d{2}-\d{2}\b/g;
export const LONG_DIGIT_RE = /\b\d{12,}\b/g;

export interface VerifyOptions {
  text: string;
  deny?: DenyList | null;
}

export function findPii({ text, deny }: VerifyOptions): Finding[] {
  const findings: Finding[] = [];
  const collect = (rule: string, re: RegExp, severity: Finding['severity'] = 'error') => {
    const seen = new Set<string>();
    for (const m of text.matchAll(re)) {
      const value = m[0];
      if (seen.has(value)) continue;
      seen.add(value);
      findings.push({ rule, match: value, severity });
    }
  };
  collect('uk-postcode', UK_POSTCODE_RE);
  collect('uk-phone', UK_PHONE_RE, 'warn'); // claim phones are legitimate — author reviews
  collect('email', EMAIL_RE);
  collect('ni-number', NI_RE);
  collect('sort-code', SORT_CODE_RE);
  collect('long-digit-string', LONG_DIGIT_RE, 'warn');

  if (deny) {
    for (const value of deny.values) {
      if (text.includes(value)) {
        findings.push({ rule: 'deny-list', match: value, severity: 'error' });
      }
    }
  }
  return findings;
}
