import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { validatePortalConfig } from "./validate";

const index = "dist/index.html";
const check = existsSync(index) ? it : it.skip;
check("resolves deep-link assets and runtime config under the generated legacy base (skipped only when dist is absent)", () => {
  const html = readFileSync(index, "utf8");
  const document = new DOMParser().parseFromString(html, "text/html");
  const href = document.querySelector("base")?.getAttribute("href");
  expect(href).toBeTruthy();
  expect(html).not.toContain("__PORTAL_BASE_HREF__");
  const config = validatePortalConfig(JSON.parse(readFileSync("dist/portal-config.json", "utf8")));
  const expectedBase = config.routing.publicBasePath === "/" ? "/" : config.routing.publicBasePath + "/";
  expect(href).toBe(expectedBase);
  const base = new URL(href!, "https://h/portal/app/a/b");
  const asset = document.querySelector('script[type="module"][src]')?.getAttribute("src");
  expect(asset).toMatch(/^\.\/assets\//);
  expect(new URL(asset!, base).href).toBe(`https://h${expectedBase}${asset!.slice(2)}`);
  expect(new URL("portal-config.json", base).href).toBe(`https://h${expectedBase}portal-config.json`);
});
