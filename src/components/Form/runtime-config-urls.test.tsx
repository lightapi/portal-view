import { render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishTestConfig } from "../../test/runtimeConfigFixture";
import Form from "./Form";

const mocks = vi.hoisted(() => ({ schemaForm: vi.fn(), realSchemaForm: false }));
const catalog = vi.hoisted(() => ({
  runtimeUrls: {
    schema: { type: "object", title: "Runtime URLs", properties: { country: { type: "string", title: "Country" } } },
    form: [
      { key: "country", type: "dynaselect", action: { url: "/r/data?name=country&filter=a%2Fb&filter=c", method: "GET" } },
      { key: "text", type: "text", action: { url: "/unchanged" } },
      { key: "missing", type: "dynaselect" },
      { key: "absent", type: "dynaselect", action: { method: "GET" } },
      { key: "null", type: "dynaselect", action: { url: null } },
      { key: "empty", type: "dynaselect", action: { url: "" } },
    ],
    actions: [],
  },
}));
vi.mock("../../data/Forms", () => ({ default: catalog }));
vi.mock("../../contexts/UserContext", () => ({ useUserState: () => ({ host: "host-a", isAuthenticated: true }) }));
vi.mock("../HelpLink", () => ({ default: () => null }));
vi.mock("react-schema-form", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-schema-form")>();
  return { ...actual, SchemaForm: (props: React.ComponentProps<typeof actual.SchemaForm>) => {
    mocks.schemaForm(props);
    return mocks.realSchemaForm ? createElement(actual.SchemaForm, { ...props, form: props.form.slice(0, 1) }) : null;
  } };
});

function renderForm() {
  return render(<MemoryRouter initialEntries={["/app/form/runtimeUrls"]}>
    <Routes><Route path="/app/form/:formId" element={<Form />} /></Routes>
  </MemoryRouter>);
}

beforeEach(() => {
  mocks.schemaForm.mockClear();
  mocks.realSchemaForm = false;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
});

describe("Form runtime dynamic-select URLs", () => {
  it.each(["", "/namespace-dev/service"])("resolves base %j once and preserves query and unaffected items", async (apiBasePath) => {
    publishTestConfig({ routing: { apiBasePath } });
    renderForm();
    await waitFor(() => expect(mocks.schemaForm).toHaveBeenCalled());
    const transformed = mocks.schemaForm.mock.lastCall![0].form;
    expect(transformed[0].action).toEqual({
      url: `${window.location.origin}${apiBasePath}/r/data?name=country&filter=a%2Fb&filter=c`, method: "GET",
    });
    expect(transformed.slice(1)).toEqual(catalog.runtimeUrls.form.slice(1));
    transformed.slice(1).forEach((item: unknown, index: number) => expect(item).toBe(catalog.runtimeUrls.form[index + 1]));
    expect(catalog.runtimeUrls.form[0].action?.url).toBe("/r/data?name=country&filter=a%2Fb&filter=c");
  });

  it("passes the resolved URL through the installed SchemaForm to native fetch without a second prefix", async () => {
    publishTestConfig({ routing: { apiBasePath: "/namespace-dev/service" } });
    mocks.realSchemaForm = true;
    renderForm();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      `${window.location.origin}/namespace-dev/service/r/data?name=country&filter=a%2Fb&filter=c`,
      expect.objectContaining({ credentials: "include" }),
    ));
    for (const [url] of vi.mocked(fetch).mock.calls) {
      expect(String(url).split("/namespace-dev/service")).toHaveLength(2);
    }
  });
});
