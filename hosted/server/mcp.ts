import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { Store, type Bindings } from "./store";
import { identity, failure, boundedBody, json } from "./http";
import {
  purchaseSchema,
  requestSchema,
  ServiceError,
  statuses,
} from "./domain";
export async function handleMcp(request: Request, env: Bindings) {
  const server = new McpServer(
    { name: "ReturnRadar", version: "0.2.0" },
    {
      instructions:
        "Use only the signed-in user’s actual purchases. Unknown policy details stay unknown. Confirmed dates are user-verified calculations, not merchant approval. Never send a request or expose another user’s records. Updates replace fields; read details first.",
    },
  );
  // Each request gets its own server and immutable user context. Never share a principal between requests.
  const execute = async (operation: (store: Store) => Promise<unknown>) => {
    try {
      const store = new Store(env, identity(request));
      await store.register("mcp");
      const data = await operation(store);
      const result = { success: true, data };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
        structuredContent: result,
      };
    } catch (error) {
      if (error instanceof ServiceError && error.status === 401) throw error;
      const message =
        error instanceof ServiceError
          ? error.message
          : error instanceof z.ZodError
            ? error.issues.map((i) => i.message).join("; ")
            : "The operation failed. No action is confirmed.";
      return {
        isError: true,
        content: [{ type: "text" as const, text: message }],
        structuredContent: { success: false, error: { message } },
      };
    }
  };
  const read = {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  };
  const write = {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
  };
  server.registerTool(
    "add_purchase",
    {
      title: "Add a purchase",
      description:
        "Save a reviewed purchase for the signed-in user. Do not invent dates or policies.",
      inputSchema: { purchase: purchaseSchema },
      annotations: write,
    },
    ({ purchase }) => execute((s) => s.save(purchase)),
  );
  server.registerTool(
    "get_my_purchases",
    {
      title: "Find my purchases",
      description: "Search the signed-in user’s purchases with pagination.",
      inputSchema: {
        search: z.string().max(300).default(""),
        merchant: z.string().max(200).default(""),
        category: z.string().max(80).default(""),
        status: z.enum([...statuses, ""]).default(""),
        date_from: z.string().optional(),
        date_to: z.string().optional(),
        page: z.number().int().min(1).default(1),
        page_size: z.number().int().min(1).max(100).default(20),
      },
      annotations: read,
    },
    (args) => execute((s) => s.list(args)),
  );
  server.registerTool(
    "get_purchase_details",
    {
      title: "Purchase details",
      description:
        "Read a purchase, evidence, policy terms and deadline verification. Returns not found for other users’ records.",
      inputSchema: { purchase_id: z.string().uuid() },
      annotations: read,
    },
    ({ purchase_id }) => execute((s) => s.get(purchase_id)),
  );
  server.registerTool(
    "get_upcoming_deadlines",
    {
      title: "Upcoming confirmed deadlines",
      description:
        "Get actionable confirmed dates within N days in each purchase’s timezone.",
      inputSchema: { days: z.number().int().min(0).max(3650).default(7) },
      annotations: read,
    },
    ({ days }) => execute((s) => s.upcoming(days)),
  );
  server.registerTool(
    "update_purchase",
    {
      title: "Update purchase details",
      description:
        "Replace reviewed fields. Retrieve details first and pass input fields only; preserve existing values and document IDs.",
      inputSchema: { purchase_id: z.string().uuid(), purchase: purchaseSchema },
      annotations: { ...write, destructiveHint: true },
    },
    ({ purchase_id, purchase }) =>
      execute((s) => s.save(purchase, purchase_id)),
  );
  server.registerTool(
    "update_purchase_status",
    {
      title: "Update purchase status",
      description:
        "Record a user-reported status. This does not confirm a merchant action or refund.",
      inputSchema: { purchase_id: z.string().uuid(), status: z.enum(statuses) },
      annotations: write,
    },
    ({ purchase_id, status }) => execute((s) => s.status(purchase_id, status)),
  );
  server.registerTool(
    "generate_return_request",
    {
      title: "Prepare a request draft",
      description:
        "Draft a return, refund, warranty or replacement message from confirmed fields. Does not send it.",
      inputSchema: { purchase_id: z.string().uuid(), ...requestSchema.shape },
      annotations: read,
    },
    ({ purchase_id, ...data }) => execute((s) => s.draft(purchase_id, data)),
  );
  server.registerTool(
    "get_warranty_status",
    {
      title: "Check warranty status",
      description:
        "Read verified warranty dates and terms. Unknown start dates remain unknown.",
      inputSchema: { purchase_id: z.string().uuid() },
      annotations: read,
    },
    ({ purchase_id }) =>
      execute(async (s) => {
        const p = await s.get(purchase_id);
        return {
          purchase_id,
          status: p.warranty_status,
          policies: p.policies.filter((x) => x.policy_type === "warranty"),
          deadlines: p.deadlines.filter((x) => x.deadline_type === "warranty"),
        };
      }),
  );
  try {
    // Auth-free initialization and discovery contain no personal data; every tool call requires identity.
    const origin = request.headers.get("origin");
    if (
      origin &&
      ![
        new URL(request.url).origin,
        "https://chatgpt.com",
        "https://chat.openai.com",
      ].includes(origin)
    )
      throw new ServiceError("Origin is not allowed", 403);
    const bytes = new TextDecoder().decode(await boundedBody(request, 160000));
    let parsed: { method?: string } | null = null;
    try {
      parsed = JSON.parse(bytes);
    } catch {
      return json(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        },
        400,
      );
    }
    if (parsed?.method === "tools/call") identity(request);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
      maxRequestBodySize: 160000,
    });
    await server.connect(transport);
    const response = await transport.handleRequest(request, {
      parsedBody: parsed,
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return failure(error);
  } finally {
    await server.close();
  }
}
