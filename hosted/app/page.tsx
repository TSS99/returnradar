import { getChatGPTUser, chatGPTSignInPath } from "./chatgpt-auth";
import Workspace from "./workspace";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await getChatGPTUser();
  if (user) return <Workspace />;
  return (
    <main className="welcome-shell">
      <div className="welcome-card">
        <img src="/favicon.svg" width="56" height="56" alt="" />
        <span className="eyebrow">RETURNRADAR</span>
        <h1>
          Your receipts.
          <br />
          Your next deadline.
        </h1>
        <p>
          Keep purchases, return windows and warranties together. Sign in to
          open your private workspace from any device.
        </p>
        <a className="button" href={chatGPTSignInPath("/")} target="_top">
          Sign in with ChatGPT
        </a>
        <p className="small muted">
          No installation or API key needed. A ChatGPT account is required.
        </p>
        <ol className="welcome-steps">
          <li>
            <strong>Add a purchase</strong>
            <span>Upload a text PDF or enter the details.</span>
          </li>
          <li>
            <strong>Check the terms</strong>
            <span>Confirm the applicable return and warranty policy.</span>
          </li>
          <li>
            <strong>See what’s due</strong>
            <span>Keep receipts handy and prepare a request when needed.</span>
          </li>
        </ol>
        <div className="welcome-links">
          <a href="/guide">How to use it</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="https://github.com/TSS99/returnradar">Open source</a>
        </div>
      </div>
    </main>
  );
}
