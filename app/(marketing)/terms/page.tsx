export default function TermsPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-white">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="mb-2 text-3xl font-bold text-neutral-900">Terms of Service</h1>
        <p className="mb-8 text-sm text-neutral-400">Last updated: March 18, 2026</p>
        <div className="space-y-8 text-neutral-600">
        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">1. Acceptance</h2>
          <p>
            By accessing or using ManyMinds (manyminds.io), operated by KLIKANGO (SAS), you agree to
            these Terms of Service. If you do not agree, do not use the service.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">2. Description of Service</h2>
          <p>
            ManyMinds is an AI aggregation platform that submits user questions to multiple AI models
            simultaneously and generates a synthesized response. The service is provided &quot;as is&quot; and
            results are informational only.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">3. Accounts</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>You must be at least 16 years old to create an account</li>
            <li>You are responsible for maintaining the security of your account</li>
            <li>You must provide accurate and complete information</li>
            <li>One account per person — sharing accounts is prohibited</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">4. Acceptable Use</h2>
          <p className="mb-2">You agree not to use ManyMinds to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Generate illegal, harmful, abusive, or discriminatory content</li>
            <li>Attempt to reverse engineer, scrape, or extract data from the platform</li>
            <li>Circumvent usage limits or quotas through technical means</li>
            <li>Resell or redistribute the service without written authorization</li>
            <li>Use the service for any unlawful purpose</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">5. Credits and Usage</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Credits are allocated monthly based on your plan</li>
            <li>Unused credits do not roll over to the next month</li>
            <li>Top-up credits purchased are non-expiring and non-refundable</li>
            <li>We reserve the right to adjust credit costs with 30 days notice</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">
            6. AI Responses and Disclaimer
          </h2>
          <p>
            ManyMinds aggregates responses from third-party AI providers. We do not guarantee the
            accuracy, completeness, or reliability of any AI-generated content. Responses are
            provided for informational purposes only and should not be relied upon as professional
            advice (legal, medical, financial, or otherwise). KLIKANGO assumes no liability for
            decisions made based on AI-generated content.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">
            7. Intellectual Property
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>The ManyMinds platform, brand, and interface are owned by KLIKANGO</li>
            <li>You retain ownership of the questions you submit</li>
            <li>
              By using the service, you grant KLIKANGO a license to process your inputs to provide
              the service
            </li>
            <li>Anonymized, aggregated data may be used to improve the service</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">
            8. Suspension and Termination
          </h2>
          <p>
            We reserve the right to suspend or terminate your account immediately if you violate
            these Terms. You may delete your account at any time from your settings. Upon
            termination, your data will be deleted within 30 days.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">
            9. Limitation of Liability
          </h2>
          <p>
            To the maximum extent permitted by law, KLIKANGO shall not be liable for any indirect,
            incidental, special, or consequential damages arising from your use of ManyMinds. Our
            total liability shall not exceed the amount paid by you in the 3 months preceding the
            claim.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">10. Changes to Terms</h2>
          <p>
            We will notify you by email at least 30 days before making material changes to these
            Terms. Continued use after changes take effect constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">11. Governing Law</h2>
          <p>
            These Terms are governed by French law. Any dispute shall be subject to the exclusive
            jurisdiction of the courts of Paris, France.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">12. Contact</h2>
          <p>
            KLIKANGO — ManyMinds
            <br />
            16 Avenue Sainte-Marie, 94160 Saint-Mandé, France
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

