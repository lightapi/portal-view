import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from "vitest";
import fixture from "../../contracts/portal-config/fixtures/valid/root-oauth2.json";
import { deepFreeze, getPortalConfig, publishPortalConfig, resetPortalConfigForTests } from "./store";
import type { DeepReadonly, ReadonlyPortalRuntimeConfig } from "./types";
import { validatePortalConfig } from "./validate";

beforeEach(resetPortalConfigForTests);
afterEach(resetPortalConfigForTests);

describe("deepFreeze", () => {
  it("freezes nested objects and arrays, including objects inside nested arrays", () => {
    const value = { nested: { arrays: [[{ name: "original" }]] }, empty: [], mapping: { api: "apiId" } };
    const frozen = deepFreeze(value);
    expectTypeOf(frozen).toEqualTypeOf<DeepReadonly<typeof value>>();
    expect(frozen).toBe(value);
    for (const object of [frozen, frozen.nested, frozen.nested.arrays, frozen.nested.arrays[0],
      frozen.nested.arrays[0][0], frozen.empty, frozen.mapping]) {
      expect(Object.isFrozen(object)).toBe(true);
    }
    expect(() => { value.nested.arrays[0][0].name = "changed"; }).toThrow(TypeError);
    expect(() => value.nested.arrays.push([])).toThrow(TypeError);
    expect(() => { value.mapping.api = "changed"; }).toThrow(TypeError);
  });

  it.each([null, undefined, true, 7, "text"])("preserves primitive %s", (value) => {
    expect(deepFreeze(value)).toBe(value);
  });

  it("recurses into a shallow-frozen parent", () => {
    const value = Object.freeze({ child: { fields: ["apiId"] } });
    deepFreeze(value);
    expect(Object.isFrozen(value.child)).toBe(true);
    expect(Object.isFrozen(value.child.fields)).toBe(true);
  });
});

describe("runtime config publication", () => {
  it("throws the exact unloaded error without publication", () => {
    expect(() => getPortalConfig()).toThrowError(new Error("Portal runtime configuration is not loaded"));
  });

  it("publishes and returns the same deeply frozen configuration", () => {
    const cfg = validatePortalConfig(fixture);
    const published = publishPortalConfig(cfg);
    expectTypeOf(published).toEqualTypeOf<ReadonlyPortalRuntimeConfig>();
    expect(published).toBe(cfg);
    expect(getPortalConfig()).toBe(published);
    expect(window.__PORTAL_CONFIG__).toBe(published);
    for (const object of [published, published.routing, published.authentication, published.features,
      published.externalLinks, published.features.preRegistrationPayloadMapping, published.features.wizardRequiredApiFields]) {
      expect(Object.isFrozen(object)).toBe(true);
    }
    expect(() => { cfg.features.preRegistrationPayloadMapping.api = "changed"; }).toThrow(TypeError);
    expect(() => cfg.features.wizardRequiredApiFields.push("changed")).toThrow(TypeError);
    expect(getPortalConfig()).toEqual(validatePortalConfig(fixture));
  });

  it("rejects repeated publication of either the same or a different object", () => {
    const cfg = validatePortalConfig(fixture);
    const published = publishPortalConfig(cfg);
    expect(() => publishPortalConfig(cfg)).toThrow();
    const next = validatePortalConfig(fixture);
    expect(() => publishPortalConfig(next)).toThrow();
    expect(Object.isFrozen(next)).toBe(false);
    expect(getPortalConfig()).toBe(published);
  });

  it("deletes the global on reset and allows independent publication", () => {
    const previous = publishPortalConfig(validatePortalConfig(fixture));
    resetPortalConfigForTests();
    expect(Object.hasOwn(window, "__PORTAL_CONFIG__")).toBe(false);
    expect(() => getPortalConfig()).toThrowError(new Error("Portal runtime configuration is not loaded"));
    resetPortalConfigForTests();
    expect(publishPortalConfig(validatePortalConfig(fixture))).not.toBe(previous);
  });
});
