export default function Guide() {
  return (
    <main className="guide-page">
      <a href="/">ReturnRadar</a>
      <h1>Keep track. Know your next step.</h1>
      <h2>Use ReturnRadar on the web</h2>
      <ol>
        <li>
          Open this website on your phone or computer and choose{" "}
          <strong>Sign in with ChatGPT</strong>. Use the same account on each
          device.
        </li>
        <li>
          Choose <strong>Add purchase</strong>. Upload a text-based PDF or enter
          the details manually. Receipt text is read in your browser, then the
          PDF is stored privately with the hosted service.
        </li>
        <li>
          Review each suggestion. Confirm the product, merchant, amount and
          dates that match your receipt.
        </li>
        <li>
          Enter the applicable return or warranty terms. Verify whether the
          window starts from purchase, delivery, another stated date, or an
          explicit cutoff.
        </li>
        <li>
          Use the overview and deadline calendar to see what is due. Missing
          information stays unknown until you supply it.
        </li>
        <li>
          Open a purchase and choose <strong>Prepare a request</strong>. Edit,
          copy or download the draft, then send it through the merchant’s usual
          channel.
        </li>
      </ol>
      <h2>Use it in ChatGPT</h2>
      <p>
        ReturnRadar exposes the same private purchases through its hosted MCP
        tools. Its personal plugin is provisioned by the hosting platform. The
        owner can find it in{" "}
        <strong>Plugins → Personal → Created by you</strong> and choose Install
        or Connect. Sign in using the same ChatGPT account as the website.
      </p>
      <p>Once connected, try:</p>
      <ul>
        <li>
          “Show my purchases with a confirmed return deadline in the next seven
          days.”
        </li>
        <li>“What is the warranty status of my headphones?”</li>
        <li>“Draft a return request for this purchase. Do not send it.”</li>
      </ul>
      <p>
        The website is available independently. A public directory listing is a
        separate submission and review process; this site does not imply
        directory approval. Plugin sharing and installation availability depend
        on your account and the platform’s controls.
      </p>
      <h2>Reminders and your data</h2>
      <p>
        In-app reminders are checked on your next visit and every minute while
        the workspace is open. Your computer can be off between visits. There
        are no email or push notifications in this beta. Unknown policies never
        produce confirmed reminders.
      </p>
      <p>
        Settings contains timezone preferences, CSV/JSON export, a backup with
        your receipts, and deletion of your cloud data. Backups are archives;
        automatic restore is not included.
      </p>
      <h2>For the owner</h2>
      <p>
        After signing in with the configured owner account, choose{" "}
        <strong>Usage dashboard</strong> in the sidebar. It shows registered and
        active users, real purchases tracked, receipt uploads, request drafts
        and MCP calls. Counts include the owner; they are measured activity, not
        forecasts or anonymous visitor estimates.
      </p>
      <h2>Beta limits</h2>
      <p>
        Each account supports 250 purchases, up to 20 PDFs and 20 MB total
        receipt storage. Each PDF must be no larger than 10 MB or 50 pages.
        Scanned images and password-protected PDFs are not supported. Service
        availability and platform quotas can change; keep an export of important
        records.
      </p>
      <p>
        <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> ·{" "}
        <a href="https://github.com/TSS99/returnradar/issues">
          Report a problem
        </a>{" "}
        (do not post receipts or personal information in public issues).
      </p>
    </main>
  );
}
