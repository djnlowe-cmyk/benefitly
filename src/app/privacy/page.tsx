import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy notice — Benefitly',
};

export default function PrivacyPage() {
  return (
    <main className="bg-white">
      <article className="max-w-2xl mx-auto px-4 py-12 text-gray-800">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">Privacy notice</h1>
        <p className="text-sm text-gray-500 italic mb-8">Last updated: 8 May 2026.</p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-2">Who we are</h2>
        <p className="text-sm leading-6 mb-3">
          Benefitly is the data controller for the personal data described below. Benefitly is a personal coverage aggregator: you give us your insurance policies, warranties, card benefits, and employer perks, and we tell you what you&rsquo;re covered for.
        </p>
        <p className="text-sm leading-6 mb-3">
          If you have any questions about this notice or how we handle your data, email us at <strong>privacy@benefitly.co.uk</strong>.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-2">What we store</h2>
        <p className="text-sm leading-6 mb-3">When you use Benefitly, we hold:</p>
        <ul className="list-disc pl-6 space-y-2 text-sm leading-6 mb-3">
          <li><strong>Account details</strong> &mdash; your email address, your name (if you give it), the password you set (stored as a one-way hash, not in plain text), and your country and currency preferences.</li>
          <li><strong>Documents you upload</strong> &mdash; policy schedules, warranty certificates, benefits booklets, and any other coverage documents you choose to add. We keep the original file you uploaded.</li>
          <li><strong>Coverage records extracted from those documents</strong> &mdash; the provider, policy number, dates, premiums, excesses, limits, exclusions, claim contact details, and a short summary, plus how confident our AI was in the extraction. You can correct any of this.</li>
          <li><strong>Alerts</strong> &mdash; reminders we generate for you, such as a policy about to renew or a warranty about to expire.</li>
          <li><strong>Family members you add</strong> &mdash; first name and the relationship to you (for example, &ldquo;partner&rdquo; or &ldquo;child&rdquo;). We do not ask for their contact details.</li>
          <li><strong>Assets you track</strong> &mdash; the name, category, purchase date, and value of items you&rsquo;ve linked to your coverage.</li>
          <li><strong>Transactions you import or add</strong> &mdash; date, merchant, amount, the card used, and which benefits applied.</li>
          <li><strong>Claims you start in Benefitly</strong> &mdash; the incident, the provider you&rsquo;re claiming from, the steps you&rsquo;ve taken, and any deadline.</li>
        </ul>
        <p className="text-sm leading-6 mb-3">We do not currently use cookies for tracking, advertising, or analytics.</p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-2">Why we store it</h2>
        <p className="text-sm leading-6 mb-3">
          We store this data so we can provide the Benefitly service to you: ingesting your coverage, answering questions about what you&rsquo;re covered for, reminding you before things lapse, and helping you make claims.
        </p>
        <p className="text-sm leading-6 mb-3">
          The legal basis under UK GDPR is <strong>contract performance</strong> (Article 6(1)(b)) &mdash; we need this data to deliver the service you&rsquo;ve signed up for. If you don&rsquo;t provide it, we can&rsquo;t give you a useful answer about your coverage.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-2">Who else processes your data</h2>
        <p className="text-sm leading-6 mb-3">
          We use a small number of third-party processors to run the service. They act on our instructions and only handle your data for the purposes listed:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-sm leading-6 mb-3">
          <li><strong>Anthropic</strong> (Claude API) &mdash; when you upload a document, we send its contents to Anthropic to extract structured coverage information. Anthropic does not use your data to train its models. See Anthropic&rsquo;s commercial terms for details.</li>
          <li><strong>Vercel</strong> &mdash; our hosting provider. Vercel runs the Benefitly application and database, and stores the document files you upload (via Vercel Blob storage). Data is processed in Vercel&rsquo;s regions in line with their data-processing terms.</li>
        </ul>
        <p className="text-sm leading-6 mb-3">
          We will update this notice before adding any new processor that handles your personal data.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-2">Where your data is held</h2>
        <p className="text-sm leading-6 mb-3">
          Your data is stored on infrastructure operated by our hosting provider. Some processing &mdash; in particular document parsing by Anthropic &mdash; may take place outside the UK. Where it does, we rely on the UK&rsquo;s adequacy decisions or standard contractual clauses to protect transfers.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-2">How long we keep it</h2>
        <p className="text-sm leading-6 mb-3">
          We keep your data for as long as your Benefitly account exists. If you delete your account, we delete your account record, your uploaded documents, and the coverage, alerts, family members, assets, transactions, and claims linked to it within <strong>30 days</strong>. We may keep minimal records (for example, billing or fraud-prevention logs) for longer where the law requires it.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-2">Your rights</h2>
        <p className="text-sm leading-6 mb-3">Under UK GDPR you have the right to:</p>
        <ul className="list-disc pl-6 space-y-2 text-sm leading-6 mb-3">
          <li><strong>Access</strong> the personal data we hold about you.</li>
          <li><strong>Correct</strong> anything that&rsquo;s wrong &mdash; most fields are editable inside Benefitly, and you can email us for the rest.</li>
          <li><strong>Erase</strong> your data. The fastest way is the <strong>Delete account</strong> action in your Benefitly settings, which removes your account and the data linked to it.</li>
          <li><strong>Object</strong> to or <strong>restrict</strong> how we process your data.</li>
          <li><strong>Lodge a complaint</strong> with the Information Commissioner&rsquo;s Office (ICO) at <a className="text-blue-600 hover:underline" href="https://ico.org.uk">ico.org.uk</a> if you think we&rsquo;ve handled your data wrongly. We&rsquo;d appreciate the chance to put it right first &mdash; please email us at <strong>privacy@benefitly.co.uk</strong>.</li>
        </ul>

        <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-2">How to contact us</h2>
        <p className="text-sm leading-6 mb-3">
          For anything to do with your privacy or this notice, email <strong>privacy@benefitly.co.uk</strong> and we&rsquo;ll respond within 30 days.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-2">When this notice changes</h2>
        <p className="text-sm leading-6 mb-3">
          If we change how we handle your data, we&rsquo;ll update this page and change the &ldquo;last updated&rdquo; date at the top. For material changes &mdash; for example, adding a new processor or a new purpose for using your data &mdash; we&rsquo;ll also email you before the change takes effect.
        </p>
      </article>
    </main>
  );
}
