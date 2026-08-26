import { describe, expect, it, vi } from "vitest";

const registerAppResource = vi.fn();

vi.mock("@modelcontextprotocol/ext-apps/server", () => ({
  RESOURCE_MIME_TYPE: "text/html;profile=mcp-app",
  registerAppResource
}));

describe("registerReadingResource", () => {
  it("serves the latest widget through current and cached resource URIs", async () => {
    const { LEGACY_READING_NEST_URIS, registerReadingResource } =
      await import("./register-resource.js");
    const { READING_NEST_URI } = await import("./register-tools.js");

    registerReadingResource(
      {} as never,
      "<html>latest widget</html>",
      "https://reading-nest.example.workers.dev"
    );

    expect(READING_NEST_URI).toBe("ui://ss-reading-nest/app-v38.html");
    expect(LEGACY_READING_NEST_URIS).toEqual([
      "ui://ss-reading-nest/app-v37.html",
      "ui://ss-reading-nest/app-v36.html",
      "ui://ss-reading-nest/app-v35.html",
      "ui://ss-reading-nest/app-v34.html",
      "ui://ss-reading-nest/app-v33.html",
      "ui://ss-reading-nest/app-v32.html",
      "ui://ss-reading-nest/app-v31.html",
      "ui://ss-reading-nest/app-v30.html",
      "ui://ss-reading-nest/app-v29.html",
      "ui://ss-reading-nest/app-v28.html",
      "ui://ss-reading-nest/app-v27.html",
      "ui://ss-reading-nest/app-v26.html",
      "ui://ss-reading-nest/app-v25.html",
      "ui://ss-reading-nest/app-v24.html",
      "ui://ss-reading-nest/app-v23.html",
      "ui://ss-reading-nest/app-v22.html",
      "ui://ss-reading-nest/app-v21.html",
      "ui://ss-reading-nest/app-v20.html",
      "ui://ss-reading-nest/app-v19.html"
    ]);
    expect(registerAppResource).toHaveBeenCalledTimes(20);

    for (const expectedUri of [READING_NEST_URI, ...LEGACY_READING_NEST_URIS]) {
      const call = registerAppResource.mock.calls.find((item) => item[2] === expectedUri);
      expect(call).toBeDefined();
      const [, , uri, descriptor, loader] = call!;

      expect(uri).toBe(expectedUri);
      expect(descriptor._meta.ui.csp.connectDomains).toContain(
        "https://reading-nest.example.workers.dev"
      );
      expect(descriptor._meta["openai/widgetCSP"].connect_domains).toContain(
        "https://reading-nest.example.workers.dev"
      );

      const loaded = await loader();
      expect(loaded.contents[0]).toMatchObject({
        uri: expectedUri,
        mimeType: "text/html;profile=mcp-app",
        text: "<html>latest widget</html>"
      });
      expect(loaded.contents[0]._meta.ui.csp.connectDomains).toContain(
        "https://reading-nest.example.workers.dev"
      );
    }
  });
});
