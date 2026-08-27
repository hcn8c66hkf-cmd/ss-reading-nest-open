const MCP_ACCEPT = "application/json, text/event-stream";

export function createMcpProbeResponse(request: Request): Response | undefined {
  if (request.method !== "HEAD") return undefined;
  return new Response(null, {
    status: 200,
    headers: {
      allow: "GET, POST, DELETE, OPTIONS, HEAD",
      "cache-control": "no-store"
    }
  });
}

export function normalizeMcpRequest(request: Request): Request {
  if (request.method !== "POST") return request;
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("application/json") && accept.includes("text/event-stream")) {
    return request;
  }
  const headers = new Headers(request.headers);
  headers.set("accept", MCP_ACCEPT);
  return new Request(request, { headers });
}

