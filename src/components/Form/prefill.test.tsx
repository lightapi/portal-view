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

// Shaped like queryApiVersion's projection: a bare array of full rows carrying aggregateVersion.
const apiVersionRows = [
  {
    hostId: "host-a",
    apiId: "api-a",
    apiVersionId: "ver-1",
    apiVersion: "1.0.0",
    apiType: "agt",
    serviceId: "agent-service",
    apiVersionDesc: "Existing description",
    envTag: "dev",
    aggregateVersion: 7,
  },
  {
    hostId: "host-a",
    apiId: "api-a",
    apiVersionId: "ver-2",
    apiVersion: "2.0.0",
    apiType: "agt",
    serviceId: "other-service",
    apiVersionDesc: "Second version",
    envTag: "sit",
    aggregateVersion: 3,
  },
];

function queryCalls(action: string) {
  return mocks.fetchClient.mock.calls.filter(
    ([url]) => typeof url === "string" && url.includes(action),
  );
}

function parsedCmd(action: string) {
  const call = queryCalls(action)[0];
  if (!call) return null;
  return JSON.parse(decodeURIComponent(String(call[0]).split("cmd=")[1]));
}

function renderForm(entry: any) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/app/form/:formId" element={<Form />} />
      </Routes>
    </MemoryRouter>,
  );
}

function mockApiVersions(rows: unknown = apiVersionRows) {
  mocks.fetchClient.mockImplementation((url: string) => {
    if (typeof url === "string" && url.includes("getApiVersion")) return Promise.resolve(rows);
    return Promise.resolve([]);
  });
}

const versionEntry = "/app/form/updateApiVersion?task=register-ai-agent&taskStep=version"
  + "&returnTo=%2Fapp%2Ftasks%2Fregister-ai-agent&hostId=host-a&apiId=api-a&apiVersionId=ver-1";

describe("form prefill from task context", () => {
  beforeEach(() => {
    mocks.fetchClient.mockReset();
    mockApiVersions();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => [], ok: true, status: 200 }));
  });

  it("loads the identified record through an identity-only read", async () => {
    renderForm(versionEntry);

    const description = await screen.findByRole("textbox", { name: /Api Version Desc/ });
    await waitFor(() => expect(description).toHaveValue("Existing description"));
    expect(screen.getByRole("textbox", { name: /Service Id/ })).toHaveValue("agent-service");

    const cmd = parsedCmd("getApiVersion");
    expect(cmd).toMatchObject({
      service: "service",
      action: "getApiVersion",
      data: { hostId: "host-a", apiId: "api-a" },
    });
  });

  it("preserves the agent API type so it matches the reference dropdown", async () => {
    mockApiVersions([{ ...apiVersionRows[0], apiType: "agent" }]);
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: "agent", label: "Agent" }],
    } as Response);
    renderForm(versionEntry);
    await waitFor(() => expect(screen.getByRole("combobox", { name: /Api Type/ })).toHaveValue("Agent"));
  });

  it("never sends a getFresh read, which requires an aggregateVersion we do not have", () => {
    renderForm(versionEntry);
    expect(queryCalls("getFresh")).toHaveLength(0);
  });

  it("selects the requested row rather than the first one returned", async () => {
    renderForm(versionEntry.replace("apiVersionId=ver-1", "apiVersionId=ver-2"));

    const description = await screen.findByRole("textbox", { name: /Api Version Desc/ });
    await waitFor(() => expect(description).toHaveValue("Second version"));
  });

  it("keeps the concurrency version out of the visible form but in the model", async () => {
    renderForm(versionEntry);
    await waitFor(() => expect(
      screen.getByRole("textbox", { name: /Api Version Desc/ }),
    ).toHaveValue("Existing description"));

    // aggregateVersion is not a schema property, so it must not surface as an input.
    expect(screen.queryByRole("textbox", { name: /Aggregate Version/ })).not.toBeInTheDocument();
  });

  it("does not refetch when a list page already handed over the row", async () => {
    renderForm({
      pathname: "/app/form/updateApiVersion",
      search: "?hostId=host-a&apiId=api-a&apiVersionId=ver-1",
      state: { data: { ...apiVersionRows[0], apiVersionDesc: "Row description" } },
    });

    const description = await screen.findByRole("textbox", { name: /Api Version Desc/ });
    expect(description).toHaveValue("Row description");
    expect(queryCalls("getApiVersion")).toHaveLength(0);
  });

  it("never issues a prefill query for a create form", async () => {
    renderForm("/app/form/createApiVersion?apiType=agt&hostId=host-a&apiId=api-a&apiVersionId=ver-1");

    await screen.findByRole("textbox", { name: /Api Version Desc/ });
    expect(queryCalls("getApiVersion")).toHaveLength(0);
  });
});

describe("form prefill blocks unsafe editing", () => {
  beforeEach(() => {
    mocks.fetchClient.mockReset();
    mockApiVersions();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => [], ok: true, status: 200 }));
  });

  it("refuses to open an update form whose record cannot be identified", async () => {
    renderForm("/app/form/updateApiVersion?hostId=host-a&apiId=api-a");

    expect(await screen.findByText(/could not be identified/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Api Version Desc/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Update/ })).not.toBeInTheDocument();
    expect(queryCalls("getApiVersion")).toHaveLength(0);
  });

  it("refuses to open the form when the read fails, and offers a retry", async () => {
    mocks.fetchClient.mockImplementation((url: string) => (
      typeof url === "string" && url.includes("getApiVersion")
        ? Promise.reject(new Error("boom"))
        : Promise.resolve([])
    ));

    renderForm(versionEntry);

    expect(await screen.findByText(/could not be loaded/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Api Version Desc/ })).not.toBeInTheDocument();

    // Retry re-runs the read and, once it succeeds, the form opens populated.
    mockApiVersions();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    const description = await screen.findByRole("textbox", { name: /Api Version Desc/ });
    await waitFor(() => expect(description).toHaveValue("Existing description"));
  });

  it("refuses to open the form when the requested record is absent", async () => {
    mockApiVersions([]);
    renderForm(versionEntry);

    expect(await screen.findByText(/could not be loaded/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Api Version Desc/ })).not.toBeInTheDocument();
  });

  it("refuses a record that carries no concurrency version", async () => {
    // Without aggregateVersion the update would lose its optimistic-concurrency check.
    mockApiVersions([{ ...apiVersionRows[0], aggregateVersion: undefined }]);
    renderForm(versionEntry);

    expect(await screen.findByText(/could not be loaded/)).toBeInTheDocument();
  });

  it("refuses a row that omits an identity field", async () => {
    // An absent identity column is not proof of a match; both verified read models project
    // every identity field, so a row missing one is not the record we asked for.
    const { apiVersionId, ...withoutId } = apiVersionRows[0];
    mockApiVersions([withoutId]);
    renderForm(versionEntry);

    expect(await screen.findByText(/could not be loaded/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Api Version Desc/ })).not.toBeInTheDocument();
  });

  it("refuses a non-numeric concurrency version", async () => {
    // aggregate_version is projected via getLong, so a string means the payload is not the
    // read-model record this form expects.
    mockApiVersions([{ ...apiVersionRows[0], aggregateVersion: "7" }]);
    renderForm(versionEntry);

    expect(await screen.findByText(/could not be loaded/)).toBeInTheDocument();
  });

  it("refuses when identity matches more than one row", async () => {
    mockApiVersions([apiVersionRows[0], { ...apiVersionRows[0] }]);
    renderForm(versionEntry);

    expect(await screen.findByText(/could not be loaded/)).toBeInTheDocument();
  });
});

describe("agent definition prefill", () => {
  beforeEach(() => {
    mocks.fetchClient.mockReset();
    mocks.fetchClient.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("getAgentDefinition")) {
        return Promise.resolve({
          total: 1,
          agentDefinitions: [{
            hostId: "host-a",
            agentDefId: "ver-1",
            apiVersionId: "ver-1",
            modelProvider: "openai",
            modelName: "gpt-4o",
            apiKeyRef: "vault://key",
            temperature: 0.4,
            maxTokens: 2048,
            active: true,
            aggregateVersion: 2,
          }],
        });
      }
      return Promise.resolve([]);
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => [], ok: true, status: 200 }));
  });

  it("reads the record out of the agentDefinitions envelope", async () => {
    renderForm("/app/form/updateAgentDefinition?task=register-ai-agent&taskStep=profile"
      + "&returnTo=%2Fapp%2Ftasks%2Fregister-ai-agent&hostId=host-a&agentDefId=ver-1");

    const provider = await screen.findByRole("textbox", { name: /Model Provider/ });
    await waitFor(() => expect(provider).toHaveValue("openai"));
    expect(screen.getByRole("textbox", { name: /Model Name/ })).toHaveValue("gpt-4o");

    const cmd = parsedCmd("getAgentDefinition");
    expect(cmd.data.filters).toBe('[{"id":"agentDefId","value":"ver-1"}]');
    expect(cmd.data).not.toHaveProperty("aggregateVersion");
  });
});
