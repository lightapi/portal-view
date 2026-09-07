import { describe, expect, it } from "vitest";
import {
  AGENT_API_TYPE_CODES,
  AGENT_API_TYPE_OPTION,
  AGENT_API_TYPE_STORED,
  apiTypeForDisplay,
  apiTypeForStorage,
  canonicalApiType,
  isAgentApiType,
} from "./apiType";

describe("canonicalApiType", () => {
  it("trims and lower-cases without translating between codes", () => {
    expect(canonicalApiType(" AGT ")).toBe("agt");
    expect(canonicalApiType("Agent")).toBe("agent");
  });

  it("returns an empty string for a missing or non-string value", () => {
    expect(canonicalApiType(undefined)).toBe("");
    expect(canonicalApiType(null)).toBe("");
    expect(canonicalApiType(42)).toBe("");
  });
});

describe("apiTypeForDisplay", () => {
  it("maps the stored code onto the reference option id", () => {
    // The dynaselect matches option ids, and the reference list offers "agent".
    expect(apiTypeForDisplay("agt")).toBe(AGENT_API_TYPE_OPTION);
    expect(apiTypeForDisplay(" AGT ")).toBe(AGENT_API_TYPE_OPTION);
  });

  it("leaves the option id alone", () => {
    expect(apiTypeForDisplay("agent")).toBe(AGENT_API_TYPE_OPTION);
  });

  it("passes other api types through, trimmed and lower-cased", () => {
    expect(apiTypeForDisplay("openapi")).toBe("openapi");
    expect(apiTypeForDisplay("openapi-mcp")).toBe("openapi-mcp");
    expect(apiTypeForDisplay(" MCP ")).toBe("mcp");
  });
});

describe("apiTypeForStorage", () => {
  it("maps the reference option id back onto the stored code", () => {
    // #890 backend accepts both codes; all new writes use the canonical option code.
    expect(apiTypeForStorage("agent")).toBe(AGENT_API_TYPE_STORED);
    expect(apiTypeForStorage(" Agent ")).toBe(AGENT_API_TYPE_STORED);
  });

  it("leaves the stored code alone", () => {
    expect(apiTypeForStorage("agt")).toBe(AGENT_API_TYPE_STORED);
  });

  it("passes other api types through", () => {
    expect(apiTypeForStorage("workflow")).toBe("workflow");
    expect(apiTypeForStorage("graphql")).toBe("graphql");
  });

  it("round-trips with apiTypeForDisplay", () => {
    expect(apiTypeForStorage(apiTypeForDisplay("agt"))).toBe("agent");
    expect(apiTypeForDisplay(apiTypeForStorage("agent"))).toBe("agent");
  });
});

describe("isAgentApiType", () => {
  it("accepts either stored code", () => {
    expect(isAgentApiType("agent")).toBe(true);
    expect(isAgentApiType("agt")).toBe(true);
    expect(isAgentApiType(" Agent ")).toBe(true);
  });

  it("rejects every other api type", () => {
    for (const type of ["openapi", "graphql", "hybrid", "kafka", "mcp", "openapi-mcp", "workflow"]) {
      expect(isAgentApiType(type)).toBe(false);
    }
    expect(isAgentApiType(undefined)).toBe(false);
  });
});

describe("AGENT_API_TYPE_CODES", () => {
  it("queries only the canonical code after migration", () => {
    // av.api_type is not a search column, so dynamicFilter emits `= ?` rather than ILIKE and
    // no single filter value can match both codes.
    expect([...AGENT_API_TYPE_CODES].sort()).toEqual(["agent"]);
    for (const code of AGENT_API_TYPE_CODES) expect(isAgentApiType(code)).toBe(true);
  });
});
