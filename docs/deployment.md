# Deployment boundary and template

Version 0.1 is complete for local single-user use. A public authenticated,
multi-user deployment is **not included or safe with this configuration**.
Do not publish the loopback API, raw SQLite folder, stdio process, or uploads.
No hosting/domain/service has been purchased or provisioned.

## Future deployment design

1. Add verified identity/OAuth and owner IDs to purchases, documents, policies,
   deadlines, reminders and settings using a versioned migration.
2. Require authenticated principal context in services. Scope every query,
   download/export/deletion and MCP operation to that principal. Add negative
   cross-tenant tests. A frontend login alone is insufficient.
3. Wrap the official SDK's streamable-HTTP transport in token verification and
   protected-resource metadata per MCP/OAuth requirements. Validate audience,
   origin and redirect allowlists. Do not expose current unauthenticated tools.
4. Deploy behind TLS with trusted proxy controls, rate limits, hardened parsing
   isolation, safe uploads, encrypted storage and scoped document access.
5. Add operational persistence/backups, worker reliability, monitoring without
   invoice contents, incident procedures, retention and privacy/legal review.
6. Set a real HTTPS MCP URL and test it with the intended client, then complete
   OpenAI submission/review requirements. Do not call it publicly distributed
   until the platform accepts it.

## Production plugin template

After those controls exist, replace the local `mcp.json` entry with an actual
authenticated endpoint. This is an **unresolved template**, not a working server:

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  "mcpServers": {
    "returnradar": {
      "type": "streamable-http",
      "url": "REPLACE_WITH_YOUR_AUTHENTICATED_HTTPS_MCP_URL"
    }
  }
}
```

Supply real support/privacy URLs, assets, demonstrations and review material
required by the current submission process. Do not place tokens or developer
credentials in manifests. All remotely hosted functionality remains optional;
the independent local product should continue to work at zero additional cost.

Reference: [OpenAI MCP authentication](https://developers.openai.com/plugins/build/auth),
[plugin submission](https://developers.openai.com/plugins/deploy/submission).
