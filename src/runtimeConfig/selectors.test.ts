import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import oauthFixture from "../../contracts/portal-config/fixtures/valid/root-oauth2.json";
import entraFixture from "../../contracts/portal-config/fixtures/valid/k8s-entra.json";
import { publishPortalConfig, resetPortalConfigForTests } from "./store";
import { validatePortalConfig } from "./validate";

beforeEach(() => {
  resetPortalConfigForTests();
  vi.resetModules();
});
afterEach(() => {
  resetPortalConfigForTests();
  vi.restoreAllMocks();
});

describe("lazy runtime selectors", () => {
  it("evaluates the config module before publication without reading the store", async () => {
    expect(Object.hasOwn(window, "__PORTAL_CONFIG__")).toBe(false);
    // No static config import: resetModules forces actual unpublished module initialization.
    const moduleImport = import("../../config");
    await expect(moduleImport).resolves.toBeDefined();
    const selectors = await moduleImport;
    expect(() => selectors.isSsoEnabled()).toThrowError(new Error("Portal runtime configuration is not loaded"));
    expect(() => selectors.getPortalConfig()).toThrowError(new Error("Portal runtime configuration is not loaded"));
    publishPortalConfig(validatePortalConfig(oauthFixture));
    expect(selectors.isSsoEnabled()).toBe(false);
  });

  it.each([oauthFixture, entraFixture])("returns every fixture-derived value for $authentication.mode", async (fixture) => {
    const selectors = await import("../../config");
    const cfg = validatePortalConfig(fixture);
    publishPortalConfig(cfg);
    const expected = {
      getPortalConfig: cfg,
      isSsoEnabled: cfg.authentication.mode === "entra-sso",
      isPreRegistrationEnabled: cfg.features.preRegistrationEnabled,
      preRegistrationUrl: cfg.features.preRegistrationUrl,
      preRegistrationApiIdPath: cfg.features.preRegistrationApiIdPath,
      preRegistrationServiceIdPath: cfg.features.preRegistrationServiceIdPath,
      preRegistrationErrorPath: cfg.features.preRegistrationErrorPath,
      preRegistrationPayloadMapping: cfg.features.preRegistrationPayloadMapping,
      isToolsSyncEnabled: cfg.features.toolsSyncEnabled,
      toolsSyncUrl: cfg.features.toolsSyncUrl,
      toolsSyncErrorPath: cfg.features.toolsSyncErrorPath,
      wizardRequiredApiFields: cfg.features.wizardRequiredApiFields,
      publicBasePath: cfg.routing.publicBasePath,
      externalLinks: cfg.externalLinks,
    };
    expect(Object.keys(selectors).sort()).toEqual(Object.keys(expected).sort());
    for (const name of Object.keys(expected) as (keyof typeof expected)[]) {
      expect(selectors[name]()).toBe(expected[name]);
    }
  });

  it("reads the current publication on each call", async () => {
    const selectors = await import("../../config");
    publishPortalConfig(validatePortalConfig(oauthFixture));
    expect(selectors.isSsoEnabled()).toBe(false);
    expect(selectors.publicBasePath()).toBe("/");
    resetPortalConfigForTests();
    expect(() => selectors.publicBasePath()).toThrowError(new Error("Portal runtime configuration is not loaded"));
    publishPortalConfig(validatePortalConfig(entraFixture));
    expect(selectors.isSsoEnabled()).toBe(true);
    expect(selectors.publicBasePath()).toBe(entraFixture.routing.publicBasePath);
  });
});
