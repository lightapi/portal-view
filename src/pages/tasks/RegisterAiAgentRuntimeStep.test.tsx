import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import RegisterAiAgentRuntimeStep from "./RegisterAiAgentRuntimeStep";

const mocks = vi.hoisted(() => ({
  fetchClient: vi.fn(),
}));

vi.mock("../../contexts/UserContext", () => ({
  useUserState: () => ({ host: "host-a" }),
}));
vi.mock("../../utils/fetchClient", () => ({ default: mocks.fetchClient }));

function RouteResult() {
  const location = useLocation();
  return (
    <output data-testid="route-result">
      {location.pathname}{location.search}{JSON.stringify(location.state ?? {})}
    </output>
  );
}

const entry = "/app/tasks/register-ai-agent/runtime?task=register-ai-agent&taskStep=runtime"
  + "&returnTo=%2Fapp%2Ftasks%2Fregister-ai-agent&hostId=host-a&apiVersionId=agent-version-a"
  + "&agentDefId=agent-version-a&serviceId=com.networknt.agent.account-1.0.0";

function commandFromUrl(url: string) {
  const parsed = new URL(url, "http://portal.test");
  const value = parsed.searchParams.get("cmd");
  return value ? JSON.parse(value) : null;
}

function renderStep() {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/app/tasks/register-ai-agent/runtime" element={<RegisterAiAgentRuntimeStep />} />
        <Route path="/app/tasks/register-ai-agent" element={<RouteResult />} />
        <Route path="/app/form/createInstance" element={<RouteResult />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Register AI agent runtime step", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    mocks.fetchClient.mockReset();
  });

  it("allows the Agent to be saved as a definition without claiming a runtime link", async () => {
    const user = userEvent.setup();
    renderStep();

    await user.click(screen.getByRole("radio", { name: "Save as Agent definition only" }));
    await user.click(screen.getByRole("button", { name: "Save Agent definition" }));

    const result = await screen.findByTestId("route-result");
    expect(result).toHaveTextContent("/app/tasks/register-ai-agent");
    expect(result).toHaveTextContent("deploymentMode=definition-only");
    expect(JSON.parse(window.sessionStorage.getItem("portal-view.taskContext.register-ai-agent") || "{}"))
      .toMatchObject({
        apiVersionId: "agent-version-a",
        deploymentMode: "definition-only",
      });
    expect(mocks.fetchClient).not.toHaveBeenCalled();
  });

  it("filters compatible agt runtimes and creates the verified Instance API link", async () => {
    mocks.fetchClient.mockImplementation(async (url: string, options?: { body?: any }) => {
      if (url === "/portal/command") {
        expect(options?.body).toMatchObject({
          service: "instance",
          action: "createInstanceApi",
          data: {
            hostId: "host-a",
            instanceId: "runtime-account",
            apiVersionId: "agent-version-a",
          },
        });
        return { instanceApiId: "instance-api-a" };
      }
      const command = commandFromUrl(url);
      if (command?.action === "getInstance") {
        return {
          instances: [
            {
              instanceId: "runtime-account",
              instanceName: "Account Agent Runtime",
              productId: "agt",
              productVersionId: "agt-version",
              serviceId: "com.networknt.agent.account-1.0.0",
              environment: "dev",
              envTag: "dev",
            },
            {
              instanceId: "runtime-advisor",
              instanceName: "Advisor Agent Runtime",
              productId: "agt",
              serviceId: "com.networknt.agent.advisor-1.0.0",
            },
            {
              instanceId: "ordinary-api",
              instanceName: "Ordinary API",
              productId: "api",
              serviceId: "com.networknt.api-1.0.0",
            },
          ],
        };
      }
      if (command?.action === "getInstanceApi") return { instanceApis: [] };
      throw new Error(`Unexpected request: ${url}`);
    });

    const user = userEvent.setup();
    renderStep();
    await user.click(screen.getByRole("radio", { name: "Use existing Agent runtime" }));
    const input = await screen.findByRole("combobox", { name: "Agent runtime" });
    await user.click(input);

    expect(await screen.findByText("Account Agent Runtime (dev)")).toBeInTheDocument();
    expect(screen.queryByText("Advisor Agent Runtime")).not.toBeInTheDocument();
    expect(screen.queryByText("Ordinary API")).not.toBeInTheDocument();
    await user.click(screen.getByText("Account Agent Runtime (dev)"));
    await user.click(screen.getByRole("button", { name: "Link Agent runtime" }));

    const result = await screen.findByTestId("route-result");
    expect(result).toHaveTextContent("instanceApiId=instance-api-a");
    expect(JSON.parse(window.sessionStorage.getItem("portal-view.taskContext.register-ai-agent") || "{}"))
      .toMatchObject({
        deploymentMode: "native",
        productId: "agt",
        instanceId: "runtime-account",
        runtimeInstanceId: "runtime-account",
        instanceApiId: "instance-api-a",
      });
  });

  it("locks new runtimes to the current agt product and returns to runtime verification", async () => {
    mocks.fetchClient.mockImplementation(async (url: string) => {
      const command = commandFromUrl(url);
      if (command?.action === "getProductVersion") {
        return {
          products: [
            { productVersionId: "agt-version", productId: "agt", current: true },
            { productVersionId: "api-version", productId: "api", current: true },
          ],
        };
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const user = userEvent.setup();
    renderStep();
    await user.click(screen.getByRole("radio", { name: "Create new Agent runtime" }));
    await user.click(screen.getByRole("button", { name: "Continue to Create Agent Runtime" }));

    await waitFor(() => {
      const result = screen.getByTestId("route-result");
      expect(result).toHaveTextContent("/app/form/createInstance");
      expect(result).toHaveTextContent("productVersionId=agt-version");
      expect(result).toHaveTextContent("serviceId=com.networknt.agent.account-1.0.0");
      expect(result).toHaveTextContent("returnTo=%2Fapp%2Ftasks%2Fregister-ai-agent%2Fruntime");
      expect(result).toHaveTextContent("taskStep=runtime");
      expect(result).toHaveTextContent('"lockedFields":["productVersionId","serviceId"]');
    });
  });

  it("queries the canonical type and finds an existing link", async () => {
    // After #890 migration the canonical code is queried. The apiType
    // filter remains server-side so unrelated API types cannot displace links;
    // the paginated loader reads every matching page.
    mocks.fetchClient.mockImplementation(async (url: string) => {
      const command = commandFromUrl(url);
      if (command?.action === "getInstance") {
        return {
          instances: [{
            instanceId: "runtime-account",
            instanceName: "Account Agent Runtime",
            productId: "agt",
            serviceId: "com.networknt.agent.account-1.0.0",
            envTag: "dev",
          }],
        };
      }
      if (command?.action === "getInstanceApi") {
        const filters = JSON.parse(command.data.filters ?? "[]");
        const apiType = filters.find((filter: any) => filter.id === "apiType")?.value;
        // The existing binding for this version is stored under the reference code.
        return apiType === "agent"
          ? {
            instanceApis: [{
              apiVersionId: "agent-version-a",
              apiType: "agent",
              instanceApiId: "instance-api-a",
              instanceId: "runtime-account",
              productId: "agt",
            }],
          }
          : { instanceApis: [] };
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const user = userEvent.setup();
    renderStep();
    await user.click(screen.getByRole("radio", { name: "Use existing Agent runtime" }));

    await waitFor(() => {
      const queried = mocks.fetchClient.mock.calls
        .map(([url]) => commandFromUrl(url as string))
        .filter((command) => command?.action === "getInstanceApi")
        .map((command) => JSON.parse(command.data.filters ?? "[]")
          .find((filter: any) => filter.id === "apiType")?.value);
      expect([...queried].sort()).toEqual(["agent"]);
    });

    // Every getInstanceApi query stays filtered server-side, so no host-wide page is requested.
    const unfiltered = mocks.fetchClient.mock.calls
      .map(([url]) => commandFromUrl(url as string))
      .filter((command) => command?.action === "getInstanceApi")
      .filter((command) => !JSON.parse(command.data.filters ?? "[]")
        .some((filter: any) => filter.id === "apiType"));
    expect(unfiltered).toEqual([]);
  });
});
