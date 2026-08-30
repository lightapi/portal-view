import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Form from "./Form";

const mocks = vi.hoisted(() => ({ fetchClient: vi.fn() }));

vi.mock("../../contexts/UserContext", () => ({
  useUserState: () => ({ host: "host-a", isAuthenticated: true }),
}));
vi.mock("../../utils/fetchClient", () => ({ BASE_URL: "", default: mocks.fetchClient }));
vi.mock("../HelpLink", () => ({ default: () => null }));

describe("task-locked form fields", () => {
  beforeEach(() => {
    mocks.fetchClient.mockReset();
    mocks.fetchClient.mockResolvedValue([]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => [],
      ok: true,
      status: 200,
    }));
  });

  it("prevents a task flow from changing its product and service identity", async () => {
    render(
      <MemoryRouter initialEntries={[{
        pathname: "/app/form/createInstance",
        state: {
          data: {
            hostId: "host-a",
            productVersionId: "agt-version",
            serviceId: "agent-service",
          },
          lockedFields: ["productVersionId", "serviceId"],
        },
      }]}>
        <Routes>
          <Route path="/app/form/:formId" element={<Form />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("textbox", { name: /Product Version Id/ })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: /Service Id/ })).toBeDisabled();
  });
});
