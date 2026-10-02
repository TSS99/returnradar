import asyncio
import os
import sys

from mcp import Client, StdioServerParameters

from backend.app.core.config import ROOT


def test_mcp_tools_structured_validation_shared_services(factory, monkeypatch, purchase_data):
    from mcp_server import server

    monkeypatch.setattr(server, "SessionLocal", factory)

    async def exercise():
        async with Client(server.mcp) as client:
            tools = await client.list_tools()
            assert len(tools.tools) == 8
            created = await client.call_tool("add_purchase", {"purchase": purchase_data})
            p = created.structured_content["data"]
            assert created.structured_content["success"]
            result = await client.call_tool("get_purchase_details", {"purchase_id": p["id"]})
            assert result.structured_content["data"]["purchase_amount"] == "120.10"
            result = await client.call_tool("get_my_purchases", {"search": "kettle"})
            assert result.structured_content["data"]["total"] == 1
            result = await client.call_tool("get_purchase_details", {"purchase_id": "missing"})
            assert result.structured_content["success"] is False
            bad = await client.call_tool(
                "add_purchase", {"purchase": {"product_name": "", "timezone": "bad"}}
            )
            assert bad.is_error
            bad = await client.call_tool("get_upcoming_deadlines", {"days": -1})
            assert bad.is_error
            result = await client.call_tool(
                "generate_return_request", {"purchase_id": p["id"], "kind": "warranty"}
            )
            assert result.structured_content["data"]["sent"] is False
            result = await client.call_tool(
                "update_purchase_status", {"purchase_id": p["id"], "status": "returned"}
            )
            assert result.structured_content["data"]["purchase_status"] == "returned"
            result = await client.call_tool("get_warranty_status", {"purchase_id": p["id"]})
            assert result.structured_content["data"]["status"] == "unknown"

    asyncio.run(exercise())


def test_real_stdio_mcp_start_and_call(tmp_path):
    async def exercise():
        parameters = StdioServerParameters(
            command=sys.executable,
            args=["-m", "mcp_server.server"],
            cwd=str(ROOT),
            env={**os.environ, "RETURNRADAR_DATA_DIR": str(tmp_path)},
        )
        async with Client(parameters) as client:
            result = await client.call_tool("get_my_purchases", {})
            assert result.structured_content["success"]
            assert result.structured_content["data"]["total"] == 0

    asyncio.run(exercise())
