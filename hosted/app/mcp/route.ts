import { env } from "cloudflare:workers";
import { handleMcp } from "../../server/mcp";
export const dynamic = "force-dynamic";
export const POST = (request: Request) => handleMcp(request, env);
export const GET = () =>
  new Response("Use POST for stateless MCP", {
    status: 405,
    headers: { Allow: "POST" },
  });
export const DELETE = GET;
