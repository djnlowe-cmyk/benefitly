// PII verifier for the benchmark corpus.
//
// We do **not** rewrite PDFs — that requires either a heavyweight PDF
// library or rasterisation, both of which are easy to get subtly wrong
// (visible text removed, embedded text retained → leak). Instead the
// founder anonymises the source PDF themselves (Acrobat redaction or
// equivalent) and this tool **verifies** the result by:
//
//   1. Extracting raw text from the PDF (via `pdftotext` from poppler).
//   2. Running a battery of regex/lexical checks for UK PII patterns.
//   3. Cross-checking against an optional per-doc deny-list of known
//      values (founder name, address, policy number) that must NOT
//      appear in the anonymised output.
//   4. Exiting non-zero if anything is flagged.
//
// CI reuses this in the corpus-intake job. Refusing to add a doc until
// the verifier passes is the v1 privacy guard — see README §"Privacy".
//
// Usage:
//   tsx bench/anonymise.ts <pdf-path> [--deny-list <path-to-json>]

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { findPii, type DenyList } from './piiRules';

async function pdfToText(path: string): Promise<string> {
  return await new Promise<string>((resolveText, reject) => {
    const proc = spawn('pdftotext', ['-layout', path, '-'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    proc.stdout.on('data', (c) => out.push(c));
    proc.stderr.on('data', (c) => err.push(c));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`pdftotext exited ${code}: ${Buffer.concat(err).toString()}`));
        return;
      }
      resolveText(Buffer.concat(out).toString('utf-8'));
    });
  });
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const pdfPath = args.find((a) => !a.startsWith('--'));
  if (!pdfPath) {
    console.error('usage: tsx bench/anonymise.ts <pdf-path> [--deny-list path]');
    return 2;
  }
  const denyArgIdx = args.indexOf('--deny-list');
  let deny: DenyList | null = null;
  if (denyArgIdx >= 0 && args[denyArgIdx + 1]) {
    deny = JSON.parse(await readFile(resolve(args[denyArgIdx + 1]), 'utf-8')) as DenyList;
  }

  const text = await pdfToText(resolve(pdfPath));
  const findings = findPii({ text, deny });

  if (findings.length === 0) {
    console.log(`[anonymise] OK — no PII patterns detected in ${pdfPath}`);
    return 0;
  }

  const errors = findings.filter((f) => f.severity === 'error');
  const warns = findings.filter((f) => f.severity === 'warn');

  console.log(`[anonymise] ${pdfPath}`);
  for (const f of errors) {
    console.error(`  x ${f.rule}: ${f.match}`);
  }
  for (const f of warns) {
    console.warn(`  ! ${f.rule}: ${f.match} (review — may be legitimate, e.g. claim phone)`);
  }
  if (errors.length > 0) {
    console.error(
      `[anonymise] ${errors.length} blocking finding(s) — redact and re-run before adding to corpus.`
    );
    return 1;
  }
  console.warn(`[anonymise] ${warns.length} warning(s) — review and add to deny-list if necessary.`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error('[anonymise] crashed:', err);
    process.exit(2);
  }
);
