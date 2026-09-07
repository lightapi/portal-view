import { beforeEach, describe, expect, it, vi } from "vitest";
import fetchClient from "../utils/fetchClient";
import { taskRegistry } from "./taskRegistry";
import {
  registerAiAgentStepProgress,
  resolveRegisterAiAgentContext,
} from "./useTaskProgress";

vi.mock("../utils/fetchClient", () => ({ default: vi.fn() }));

const mockedFetchClient = vi.mocked(fetchClient);
const task = taskRegistry.find((candidate) => candidate.id === "register-ai-agent")!;

function actionFromUrl(url: string) {
  const parsed = new URL(url, "http://portal.test");
  const value = parsed.searchParams.get("cmd");
  return value ? JSON.parse(value).action : "";
}

describe("Register AI agent task progress", () => {
  beforeEach(() => mockedFetchClient.mockReset());

  it("does not treat a bare instance id as a completed runtime deployment", () => {
    const progress = registerAiAgentStepProgress(task, {
      apiVersionId: "agent-version-a",
      agentDefId: "agent-version-a",
      agentProfileExists: true,
      instanceId: "runtime-a",
    });

    expect(progress.find((step) => step.stepId === "runtime")).toMatchObject({
      status: "ready",
    });
  });

  it("accepts an explicit definition-only decision", () => {
    const progress = registerAiAgentStepProgress(task, {
      apiVersionId: "agent-version-a",
      agentDefId: "agent-version-a",
      agentProfileExists: true,
      deploymentMode: "definition-only",
    });

    expect(progress.find((step) => step.stepId === "runtime")).toMatchObject({
      status: "complete",
      message: "The Agent was saved as a definition without a runtime deployment.",
    });
  });

  it("resolves runtime completion from a legacy agt Instance API association", async () => {
    mockedFetchClient.mockImplementation(async (url: string) => {
      if (!url) return {};
      switch (actionFromUrl(url)) {
        case "getApi":
          return { services: [{ apiId: "agent-api" }] };
        case "getApiVersion":
          return { apiVersions: [{ apiVersionId: "agent-version-a", apiType: "agt", serviceId: "agent-service" }] };
        case "getAgentDefinition":
          return { agentDefinitions: [{ agentDefId: "agent-version-a", apiVersionId: "agent-version-a" }] };
        case "queryRolePermission":
          return { rolePermissions: [] };
        case "getInstanceApi":
          return {
            instanceApis: [{
              apiVersionId: "agent-version-a",
              apiType: "agt",
              instanceApiId: "instance-api-a",
              instanceId: "runtime-a",
              productId: "agt",
              serviceId: "agent-service",
            }],
          };
        default:
          throw new Error(`Unexpected request: ${url}`);
      }
    });

    const context = await resolveRegisterAiAgentContext("host-a", {
      apiId: "agent-api",
      apiVersionId: "agent-version-a",
    });

    expect(context).toMatchObject({
      instanceApiId: "instance-api-a",
      instanceId: "runtime-a",
      runtimeInstanceId: "runtime-a",
      deploymentMode: "native",
      productId: "agt",
      serviceId: "agent-service",
    });
    expect(registerAiAgentStepProgress(task, context).find((step) => step.stepId === "runtime"))
      .toMatchObject({ status: "complete" });
  });

  it("resolves runtime completion from a canonical agent Instance API association", async () => {
    mockedFetchClient.mockImplementation(async (url: string) => {
      if (!url) return {};
      switch (actionFromUrl(url)) {
        case "getApi":
          return { services: [{ apiId: "agent-api" }] };
        case "getApiVersion":
          return { apiVersions: [{ apiVersionId: "agent-version-a", apiType: "agent", serviceId: "agent-service" }] };
        case "getAgentDefinition":
          return { agentDefinitions: [{ agentDefId: "agent-version-a", apiVersionId: "agent-version-a" }] };
        case "queryRolePermission":
          return { rolePermissions: [] };
        case "getInstanceApi":
          return {
            instanceApis: [{
              apiVersionId: "agent-version-a",
              apiType: "agent",
              instanceApiId: "instance-api-a",
              instanceId: "runtime-a",
              productId: "agt",
              serviceId: "agent-service",
            }],
          };
        default:
          throw new Error(`Unexpected request: ${url}`);
      }
    });

    const context = await resolveRegisterAiAgentContext("host-a", {
      apiId: "agent-api",
      apiVersionId: "agent-version-a",
    });

    expect(context).toMatchObject({
      instanceApiId: "instance-api-a",
      instanceId: "runtime-a",
      runtimeInstanceId: "runtime-a",
      deploymentMode: "native",
      productId: "agt",
      serviceId: "agent-service",
    });
    expect(registerAiAgentStepProgress(task, context).find((step) => step.stepId === "runtime"))
      .toMatchObject({ status: "complete" });
  });
});
