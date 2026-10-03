import { env } from "cloudflare:workers";
import { requireChatGPTUser } from "../chatgpt-auth";
import { Store } from "../../server/store";
import Analytics from "./view";
export const dynamic = "force-dynamic";
export default async function Admin() {
  const user = await requireChatGPTUser("/admin");
  const store = new Store(env, {
    id: user.userId,
    email: user.email,
    name: user.displayName,
  });
  if (!(await store.isAdmin()))
    return (
      <main className="guide-page">
        <a href="/">ReturnRadar</a>
        <h1>Owner access required</h1>
        <p>
          This dashboard is available only to the configured ReturnRadar owner.
        </p>
      </main>
    );
  return <Analytics />;
}
