import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import RegisterAiAgentApiStep from "./RegisterAiAgentApiStep";

const mocks = vi.hoisted(() => ({
  fetchClient: vi.fn(),
}));

vi.mock("../../contexts/UserContext", () => ({
  useUserState: () => ({ host: "host-a" }),
}));
vi.mock("../../utils/fetchClient", () => ({ default: mocks.fetchClient }));

function RouteResult() {
  const location = useLocation();
  return <output data-testid="route-result">{location.pathname}{location.search}</output>;
}

const entry = "/app/tasks/register-ai-agent/api?task=register-ai-agent&taskStep=api&returnTo=%2Fapp%2Ftasks%2Fregister-ai-agent";

function renderStep() {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/app/tasks/register-ai-agent/api" element={<RegisterAiAgentApiStep />} />
        <Route path="/app/tasks/register-ai-agent" element={<RouteResult />} />
        <Route path="/app/form/createApi" element={<RouteResult />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Register AI agent API step", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    mocks.fetchClient.mockReset();
    mocks.fetchClient.mockResolvedValue({
      services: [
        { hostId: "host-a", apiId: "api-b", apiName: "Billing API", apiDesc: "Billing" },
        { hostId: "host-a", apiId: "api-a", apiName: "Accounts API" },
      ],
    });
  });

  it("offers existing and new API choices before loading the dropdown", () => {
    renderStep();

    expect(screen.getByRole("radio", { name: "Select existing API" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Create new API" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "API" })).not.toBeInTheDocument();
    expect(mocks.fetchClient).not.toHaveBeenCalled();
  });

  it("selects an existing API and returns it to the task checklist", async () => {
    const user = userEvent.setup();
    renderStep();

    await user.click(screen.getByRole("radio", { name: "Select existing API" }));
    const apiInput = await screen.findByRole("combobox", { name: "API" });
    await user.click(apiInput);
    await user.click(await screen.findByText("Accounts API (api-a)"));
    await user.click(screen.getByRole("button", { name: "Continue with selected API" }));

    const result = await screen.findByTestId("route-result");
    expect(result).toHaveTextContent("/app/tasks/register-ai-agent");
    expect(result).toHaveTextContent("apiId=api-a");
    expect(JSON.parse(window.sessionStorage.getItem("portal-view.taskContext.register-ai-agent") || "{}"))
      .toMatchObject({ hostId: "host-a", apiId: "api-a" });
  });

  it("opens the create API form while preserving task context", async () => {
    const user = userEvent.setup();
    renderStep();

    await user.click(screen.getByRole("radio", { name: "Create new API" }));
    await user.click(screen.getByRole("button", { name: "Continue to Create API" }));

    await waitFor(() => {
      const result = screen.getByTestId("route-result");
      expect(result).toHaveTextContent("/app/form/createApi");
      expect(result).toHaveTextContent("task=register-ai-agent");
      expect(result).toHaveTextContent("taskStep=api");
      expect(result).toHaveTextContent("hostId=host-a");
    });
  });
});
