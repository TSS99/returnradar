"""Start the real stdio server and list purchases. Does not modify local records."""

import asyncio
import sys

from mcp import Client, StdioServerParameters

from backend.app.core.config import ROOT


async def main():
    parameters = StdioServerParameters(
        command=sys.executable, args=["-m", "mcp_server.server"], cwd=str(ROOT)
    )
    async with Client(parameters) as client:
        tools = await client.list_tools()
        print(f"Connected: {len(tools.tools)} tools")
        result = await client.call_tool("get_my_purchases", {"page_size": 1})
        if result.is_error or not result.structured_content.get("success"):
            raise RuntimeError("MCP smoke test failed")
        print(f"Purchase count: {result.structured_content['data']['total']}")


if __name__ == "__main__":
    asyncio.run(main())
