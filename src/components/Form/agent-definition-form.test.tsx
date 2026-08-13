import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Form from "./Form";

const mocks = vi.hoisted(() => ({ fetchClient: vi.fn() }));

vi.mock("../../contexts/UserContext", () => ({
  useUserState: () => ({ host: "host-a", isAuthenticated: true }),
}));
vi.mock("../../utils/fetchClient", () => ({ BASE_URL: "", default: mocks.fetchClient }));
vi.mock("../HelpLink", () => ({ default: () => null }));

function renderAgentForm(data: Record<string, unknown>) {
  return render(
    <MemoryRouter initialEntries={[{
      pathname: "/app/form/createAgentDefinition",
      state: { data },
    }]}>
      <Routes>
        <Route path="/app/form/:formId" element={<Form />} />
        <Route path="/app/success" element={<div>Success</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Create Agent Definition form", () => {
  beforeEach(() => {
    mocks.fetchClient.mockReset();
    mocks.fetchClient.mockImplementation((url: string) => {
      if (url.includes("getApiVersionIdLabel")) return Promise.resolve([{ id: "version-a", label: "Agent v1" }]);
      if (url.includes("getLlmPublicAliasLabel")) return Promise.resolve([{ id: "alias-a", label: "Public Alias" }]);
      if (url.includes("getLlmModelPolicyLabel")) return Promise.resolve([{ id: "policy-a", label: "Model Policy" }]);
      return Promise.resolve({ agentDefId: "version-a" });
    });
  });

  it("shows only the model source selected by the radio buttons", async () => {
    const user = userEvent.setup();
    renderAgentForm({ hostId: "host-a", agentDefId: "version-a", apiVersionId: "version-a" });

    expect(await screen.findByRole("radio", { name: "Model Alias" })).toBeChecked();
    expect(screen.getByText("Model Alias", { selector: "label" })).toBeInTheDocument();
    expect(screen.queryByText("Model Policy", { selector: "label" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Model Policy" }));
    expect(screen.getByText("Model Policy", { selector: "label" })).toBeInTheDocument();
    expect(screen.queryByText("Model Alias", { selector: "label" })).not.toBeInTheDocument();
  });

  it("submits the selected model policy without the form-only discriminator", async () => {
    const user = userEvent.setup();
    renderAgentForm({
      hostId: "host-a",
      agentDefId: "version-a",
      apiVersionId: "version-a",
      modelPolicyId: "policy-a",
      modelSelectionType: "policy",
    });

    await user.click(await screen.findByRole("button", { name: "Create Agent Definition Form" }));
    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledWith(
      "/portal/command",
      expect.objectContaining({
        body: expect.objectContaining({
          action: "createAgentDefinition",
          data: expect.objectContaining({ modelPolicyId: "policy-a" }),
        }),
      }),
    ));
    const command = mocks.fetchClient.mock.calls.find(([url]) => url === "/portal/command")?.[1].body;
    expect(command.data).not.toHaveProperty("modelAliasId");
    expect(command.data).not.toHaveProperty("modelSelectionType");
  });
});
