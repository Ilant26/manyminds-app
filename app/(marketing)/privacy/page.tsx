export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-white">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="mb-2 text-3xl font-bold text-neutral-900">Privacy Policy</h1>
        <p className="mb-8 text-sm text-neutral-400">Last updated: March 18, 2026</p>

        <div className="space-y-8 text-neutral-600">
        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">1. Who we are</h2>
          <p>
            ManyMinds is operated by KLIKANGO (SAS), 16 Avenue Sainte-Marie, 94160 Saint-Mandé,
            France. For privacy questions, contact{' '}
            <a href="mailto:legal@manyminds.io" className="text-violet-600 hover:underline">
              legal@manyminds.io
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">2. Data we process</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Account data (email, authentication identifiers)</li>
            <li>Usage data (feature usage, basic logs, security events)</li>
            <li>Content you submit (questions and related inputs) to provide the service</li>
            <li>Billing metadata (via Stripe) for subscriptions and invoices</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">3. Why we process data</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Provide and secure the service</li>
            <li>Process subscriptions and customer support</li>
            <li>Prevent abuse and enforce usage limits</li>
            <li>Improve product quality and reliability</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">4. AI providers</h2>
          <p>
            To generate answers, ManyMinds may send your prompts to third-party AI providers. These
            providers process data as independent controllers or processors depending on their
            terms. We recommend that you avoid submitting sensitive personal data.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">5. Cookies</h2>
          <p>
            We use essential cookies required for authentication and security. If you accept, we
            may use optional analytics cookies to understand product usage. You can manage your
            cookie preference via the cookie banner.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">6. Retention</h2>
          <p>
            We retain personal data for as long as needed to provide the service, comply with legal
            obligations, and resolve disputes. You may request deletion as described below.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">7. Your rights (EU/UK)</h2>
          <p>
            Depending on your location, you may have rights to access, correct, delete, restrict,
            or object to processing of your personal data, and to data portability. To exercise
            these rights, contact{' '}
            <a href="mailto:legal@manyminds.io" className="text-violet-600 hover:underline">
              legal@manyminds.io
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">8. Contact</h2>
          <p>
            <a href="mailto:contact@manyminds.io" className="text-violet-600 hover:underline">
              contact@manyminds.io
            </a>
            <br />
            <a href="mailto:legal@manyminds.io" className="text-violet-600 hover:underline">
              legal@manyminds.io
            </a>
          </p>
        </section>
        </div>
      </div>
    </div>
  );
}

