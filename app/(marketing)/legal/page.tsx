export default function LegalNoticePage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-white">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="mb-2 text-3xl font-bold text-neutral-900">Legal Notice</h1>
        <p className="mb-8 text-sm text-neutral-400">Last updated: March 18, 2026</p>

        <div className="space-y-8 text-neutral-600">
        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">1. Publisher</h2>
          <p>
            ManyMinds is published by KLIKANGO (SAS)
            <br />
            16 Avenue Sainte-Marie, 94160 Saint-Mandé, France
            <br />
            SIREN: 948 465 331 — VAT: FR42948465331
            <br />
            <a href="mailto:contact@manyminds.io" className="text-violet-600 hover:underline">
              contact@manyminds.io
            </a>
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">2. Hosting</h2>
          <p>
            The service is hosted by third-party infrastructure providers. Details may be provided
            upon request at{' '}
            <a href="mailto:legal@manyminds.io" className="text-violet-600 hover:underline">
              legal@manyminds.io
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">3. Contact</h2>
          <p>
            General: {' '}
            <a href="mailto:contact@manyminds.io" className="text-violet-600 hover:underline">
              contact@manyminds.io
            </a>
            <br />
            Legal: {' '}
            <a href="mailto:legal@manyminds.io" className="text-violet-600 hover:underline">
              legal@manyminds.io
            </a>
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">4. Intellectual Property</h2>
          <p>
            The ManyMinds name, brand, website, and software are protected by intellectual property
            laws. Any reproduction or use without prior written authorization is prohibited.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">5. Liability</h2>
          <p>
            The service is provided on an “as is” basis. KLIKANGO does not guarantee that the
            service will be uninterrupted or error-free. AI-generated outputs are informational and
            may be inaccurate.
          </p>
        </section>
        </div>
      </div>
    </div>
  );
}

