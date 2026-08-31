import { describe, expect, it } from "vitest";
import { LEGACY_READING_NEST_URIS } from "./register-resource.js";
import { READING_NEST_URI, TOOL_CONFIGS } from "./register-tools.js";

describe("reading nest resource version", () => {
  it("uses a fresh v43 URI while retaining earlier resources", () => {
    expect(READING_NEST_URI).toBe("ui://ss-reading-nest/app-v43.html");
    expect(LEGACY_READING_NEST_URIS).toContain("ui://ss-reading-nest/app-v42.html");
    expect(LEGACY_READING_NEST_URIS).toContain("ui://ss-reading-nest/app-v41.html");
    expect(LEGACY_READING_NEST_URIS).toContain("ui://ss-reading-nest/app-v40.html");
    expect(LEGACY_READING_NEST_URIS).toContain("ui://ss-reading-nest/app-v39-hotfix5.html");
    expect(LEGACY_READING_NEST_URIS).toContain("ui://ss-reading-nest/app-v39-hotfix4.html");
    expect(LEGACY_READING_NEST_URIS).toContain("ui://ss-reading-nest/app-v39-hotfix3.html");
    expect(LEGACY_READING_NEST_URIS).toContain("ui://ss-reading-nest/app-v39-hotfix2.html");
    expect(LEGACY_READING_NEST_URIS).toContain("ui://ss-reading-nest/app-v39-hotfix1.html");
    expect(LEGACY_READING_NEST_URIS).toContain("ui://ss-reading-nest/app-v39.html");
    expect(LEGACY_READING_NEST_URIS).not.toContain(READING_NEST_URI);
  });

  it("points every primary v43 resource hint at the fresh URI", () => {
    const meta = TOOL_CONFIGS.open_reading_nest_v43._meta;
    expect(meta.ui.resourceUri).toBe(READING_NEST_URI);
    expect(meta["ui/resourceUri"]).toBe(READING_NEST_URI);
    expect(meta["openai/outputTemplate"]).toBe(READING_NEST_URI);
  });
});
