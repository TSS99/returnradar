export default function Privacy() {
  return (
    <main className="guide-page">
      <a href="/">ReturnRadar</a>
      <h1>Privacy</h1>
      <p>
        Last updated: 3 October 2026. ReturnRadar is an open-source purchase
        tracker operated by the owner of the TSS99/returnradar repository.
      </p>
      <h2>What is stored</h2>
      <p>
        The hosted service stores your purchase details, policy text and
        evidence, receipt PDFs, preferences and in-app notifications. It uses a
        site-specific account identifier supplied by ChatGPT sign-in to keep
        accounts separate. Your verified email and optional name are used during
        the request to display your account; the configured owner’s verified
        email can bind owner access. Ordinary user email addresses and names are
        not stored in the application database.
      </p>
      <h2>Where processing happens</h2>
      <p>
        Receipt text is extracted in your browser. The PDF and extracted text
        are sent over HTTPS to the hosted ReturnRadar service. Files use private
        object storage and records use a managed database through OpenAI Sites
        and its infrastructure providers. This is cloud storage, not end-to-end
        encryption. The operator and infrastructure providers may have
        operational access; the app restricts ordinary user access to the
        signed-in owner of each record.
      </p>
      <p>
        ReturnRadar does not use a paid AI model to extract your receipt. When
        you connect its MCP tools to ChatGPT or another compatible client, the
        requested purchase information is returned to that client and is subject
        to that client’s data practices.
      </p>
      <h2>Usage measurement</h2>
      <p>
        The owner dashboard displays aggregate registered and active user
        counts, purchases added, PDF uploads, drafts prepared and MCP calls. The
        app stores daily action counts linked to a site-specific account ID,
        with a 90-day retention window pruned on account activity. It also
        stores first and most recent authenticated activity times. It does not
        use advertising trackers, fingerprinting, or anonymous visitor cookies.
        Activity includes open workspaces refreshing. Receipts, purchase names
        and amounts are not included in analytics events.
      </p>
      <h2>Your control</h2>
      <p>
        Export your records or download a receipt-inclusive backup in Settings.
        “Delete all my cloud data” removes your application records, receipt
        objects, settings and associated usage history from active app storage.
        Opening the workspace again creates a new empty application record for
        the same signed-in identity. This does not delete your ChatGPT account.
        Provider backups and operational logs are governed by provider
        retention; immediate forensic erasure is not promised.
      </p>
      <h2>Support</h2>
      <p>
        Report software issues through{" "}
        <a href="https://github.com/TSS99/returnradar/issues">GitHub</a>. Never
        attach real receipts or sensitive information to public issues. Use the
        repository’s private vulnerability reporting for security issues. There
        are no ads, automatic merchant messages, or sales of purchase data in
        this beta.
      </p>
    </main>
  );
}
