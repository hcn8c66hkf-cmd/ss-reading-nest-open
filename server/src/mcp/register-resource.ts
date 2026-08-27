import {
  registerAppResource,
  RESOURCE_MIME_TYPE
} from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { READING_NEST_URI } from "./register-tools.js";

export const LEGACY_READING_NEST_URIS = [
  "ui://ss-reading-nest/app-v39-hotfix1.html",
  "ui://ss-reading-nest/app-v39.html",
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
] as const;

export const READING_NEST_MIME_TYPE = RESOURCE_MIME_TYPE;

export function registerReadingResource(server: McpServer, widgetHtml: string, workerOrigin?: string) {
  const connectDomains = [workerOrigin ?? "http://localhost:8787"];
  const resourceCsp = {
    connectDomains,
    resourceDomains: []
  };
  const openaiWidgetCsp = {
    connect_domains: connectDomains,
    resource_domains: []
  };
  const descriptor = {
    description: "移动端优先的小说与漫画共读小窝",
    _meta: {
      ui: {
        csp: resourceCsp,
        prefersBorder: true
      },
      "openai/widgetCSP": openaiWidgetCsp,
      "openai/widgetDescription":
        "一个温暖的移动端共读小窝，用于阅读用户自己粘贴的小说文本或导入的漫画图片。"
    }
  };
  const resourceUris = [READING_NEST_URI, ...LEGACY_READING_NEST_URIS];

  for (const [index, resourceUri] of resourceUris.entries()) {
    registerAppResource(
      server,
      index === 0 ? "S×S 小窝共读" : `S×S 小窝共读兼容资源 ${resourceUri}`,
      resourceUri,
      descriptor,
      async () => {
        return {
          contents: [
            {
              uri: resourceUri,
              mimeType: READING_NEST_MIME_TYPE,
              text: widgetHtml,
              _meta: {
                ui: {
                  csp: resourceCsp,
                  prefersBorder: true
                },
                "openai/widgetCSP": openaiWidgetCsp,
                "openai/widgetDescription":
                  "一个温暖的移动端共读小窝，用于阅读用户自己粘贴的小说文本或导入的漫画图片。",
                "openai/widgetPrefersBorder": true
              }
            }
          ]
        };
      }
    );
  }
}
