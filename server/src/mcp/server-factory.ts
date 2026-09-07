import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReadingRepository } from "../repositories/reading-repository.js";
import { ReadingService } from "../services/reading-service.js";
import type { CloudSourceService } from "../services/cloud-source-service.js";
import {
  CompanionAutoplayService,
  type CompanionTextGenerator
} from "../services/companion-autoplay-service.js";
import { registerReadingResource } from "./register-resource.js";
import { registerReadingTools } from "./register-tools.js";

export function createMcpServerFromRepository(
  repository: ReadingRepository,
  widgetHtml: string,
  cloudSourceService?: CloudSourceService,
  options: {
    sourceEndpointBase?: string;
    workerOrigin?: string;
    companionTextGenerator?: CompanionTextGenerator;
  } = {}
) {
  const server = new McpServer({
    name: "S×S 小窝共读",
    version: "0.2.1"
  });
  const service = new ReadingService(repository);
  const companionAutoplayService =
    cloudSourceService && options.companionTextGenerator
      ? new CompanionAutoplayService(
          service,
          cloudSourceService,
          options.companionTextGenerator
        )
      : undefined;
  registerReadingResource(server, widgetHtml, options.workerOrigin);
  registerReadingTools(server, service, cloudSourceService, {
    ...options,
    companionAutoplayService
  });
  return server;
}
