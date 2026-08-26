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
  const renderTool = tools.tools.find((tool) => tool.name === "open_reading_nest_v37");
  if (!renderTool) {
    throw new Error("MCP server did not publish open_reading_nest_v37");
  }
  for (const name of ["create_annotation_v23", "reply_to_annotation_v23", "list_annotations_v23"]) {
    if (!tools.tools.some((tool) => tool.name === name)) {
      throw new Error(`MCP server did not publish ${name}`);
    }
  }
  const resourceUri =
    renderTool._meta?.["openai/outputTemplate"] ??
    renderTool._meta?.["ui/resourceUri"] ??
    renderTool._meta?.ui?.resourceUri;
  if (resourceUri !== "ui://ss-reading-nest/app-v37.html") {
    throw new Error(`Render tool published an invalid UI resource URI: ${String(resourceUri)}`);
  }

  const resources = await client.listResources();
  if (!resources.resources.some((resource) => resource.uri === resourceUri)) {
    throw new Error(`MCP server did not list the UI resource: ${resourceUri}`);
  }
  const loaded = await client.readResource({ uri: resourceUri });
  const html = loaded.contents.find((content) => content.uri === resourceUri);
  if (!html || typeof html.text !== "string" || !html.text.includes("<!doctype html>")) {
    throw new Error("MCP server did not return the built widget HTML");
  }
  if (html.mimeType !== "text/html;profile=mcp-app") {
    throw new Error(`MCP server returned an unsupported widget MIME type: ${html.mimeType}`);
  }
  console.log(`MCP handshake succeeded with ${tools.tools.length} tools.`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(token ? message.replaceAll(token, "<redacted>") : message);
} finally {
  await client.close().catch(() => {});
}
