# ReturnRadar local plugin

This portable Agent Plugins package bundles a safe purchase-management skill
and stdio MCP configuration. The Codex compatibility manifest/config is also
included. It is not published in the public directory and has no hosted endpoint.

Install the ReturnRadar Python package from the source repository first. The
client's process environment must find `returnradar-mcp` on PATH, with access
to the same private data directory as the dashboard. For desktop clients,
generate an absolute configuration with `python -m scripts.local_mcp_config`.
Do not include machine paths or private data in a redistributed plugin ZIP.

Build from the repository root using `python -m scripts.package_plugin`.
See [source documentation](https://github.com/TSS99/returnradar/blob/main/docs/mcp-setup.md)
for setup, tool schemas, smoke testing and future hosted distribution limits.

Format references: [OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins),
[MCP server concepts](https://developers.openai.com/plugins/concepts/mcp-server).
