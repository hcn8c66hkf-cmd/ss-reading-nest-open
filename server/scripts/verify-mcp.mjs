import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const endpoint = process.env.MCP_ENDPOINT;
const token = process.env.MCP_PATH_TOKEN ?? "";

if (!endpoint) {
  throw new Error("MCP_ENDPOINT is required");
}

const client = new Client({
  name: "ss-reading-nest-deployment-check",
  version: "1.0.0"
});

try {
  await client.connect(new StreamableHTTPClientTransport(new URL(endpoint)));
  const tools = await client.listTools();
  if (tools.tools.length === 0) {
    throw new Error("MCP server returned no tools");
  }
  console.log(`MCP handshake succeeded with ${tools.tools.length} tools.`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(token ? message.replaceAll(token, "<redacted>") : message);
} finally {
  await client.close().catch(() => {});
}
