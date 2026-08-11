import { describe, expect, it, vi } from "vitest";

const registerAppResource = vi.fn();

vi.mock("@modelcontextprotocol/ext-apps/server", () => ({
  RESOURCE_MIME_TYPE: "text/html+skybridge",
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

    expect(READING_NEST_URI).toBe("ui://ss-reading-nest/app-v23.html");
    expect(LEGACY_READING_NEST_URIS).toEqual([
      "ui://ss-reading-nest/app-v22.html",
      "ui://ss-reading-nest/app-v21.html",
      "ui://ss-reading-nest/app-v20.html",
      "ui://ss-reading-nest/app-v19.html"
    ]);
    expect(registerAppResource).toHaveBeenCalledTimes(5);

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
        mimeType: "text/html+skybridge",
        text: "<html>latest widget</html>"
      });
      expect(loaded.contents[0]._meta.ui.csp.connectDomains).toContain(
        "https://reading-nest.example.workers.dev"
      );
    }
  });
});
