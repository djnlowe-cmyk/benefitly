export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Privacy Notice — Benefitly</h1>
        <p className="text-sm text-gray-500 mb-8">DRAFT, pending legal review.</p>

        <section className="bg-white border border-gray-200 rounded-lg p-6 mb-6 space-y-6 text-sm text-gray-700 leading-relaxed">
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-2">What we store</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Account: name, email, hashed password, country/currency.</li>
              <li>
                Documents you upload: the file itself, plus structured fields our AI extracts (provider, policy
                number, dates, premium, exclusions).
              </li>
              <li>Coverage data, alerts, family members, transactions, assets, claims you create.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-2">How we use it</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To show you your coverage, generate alerts, and answer your search queries.</li>
              <li>
                We send your uploaded document to Anthropic&apos;s Claude API for parsing. We do not use your data
                to train any model.
              </li>
              <li>
                We do not sell your data and do not share it with third parties beyond the document-parsing flow
                above.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-2">How long we keep it</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Until you delete it. You can delete your account from Settings; this removes all of your data
                within 30 days.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Your rights (UK GDPR)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Access, correction, erasure, portability, objection. Email{' '}
                <a className="text-blue-600 hover:underline" href="mailto:privacy@benefitly.example">
                  privacy@benefitly.example
                </a>{' '}
                to exercise any of these.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Contact</h2>
            <p>
              <a className="text-blue-600 hover:underline" href="mailto:privacy@benefitly.example">
                privacy@benefitly.example
              </a>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
