import { describe, expect, it } from "vitest";
import { createMcpProbeResponse, normalizeMcpRequest } from "./request-compat.js";

describe("MCP request compatibility", () => {
  it("accepts native-client HEAD probes without entering the MCP transport", async () => {
    const response = createMcpProbeResponse(
      new Request("https://example.test/mcp/private", { method: "HEAD" })
    );
    expect(response?.status).toBe(200);
    expect(response?.headers.get("allow")).toContain("HEAD");
    expect(await response?.text()).toBe("");
  });

  it("adds both MCP response media types to narrow POST requests", async () => {
    const request = normalizeMcpRequest(
      new Request("https://example.test/mcp/private", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json"
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" })
      })
    );
    expect(request.headers.get("accept")).toBe(MCP_ACCEPT_FOR_TEST);
    expect(await request.json()).toMatchObject({ method: "initialize" });
  });

  it("leaves conforming requests unchanged", () => {
    const request = new Request("https://example.test/mcp/private", {
      method: "POST",
      headers: { accept: MCP_ACCEPT_FOR_TEST }
    });
    expect(normalizeMcpRequest(request)).toBe(request);
  });
});

const MCP_ACCEPT_FOR_TEST = "application/json, text/event-stream";
