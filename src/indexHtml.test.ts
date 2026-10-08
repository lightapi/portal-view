import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("index.html", "utf8");
describe("portable source HTML", () => {
  it("has exactly one placeholder immediately after charset and before resources", () => {
    expect(html.match(/__PORTAL_BASE_HREF__/g)).toHaveLength(1);
    const document = new DOMParser().parseFromString(html, "text/html");
    expect(document.head.children[0].outerHTML).toMatch(/charset="UTF-8"/i);
    expect(document.head.children[1].tagName).toBe("BASE");
    expect(document.querySelector("base")?.getAttribute("href")).toBe("__PORTAL_BASE_HREF__");
    expect(html.indexOf("<base")).toBeLessThan(html.indexOf("<link"));
    expect(html.indexOf("<base")).toBeLessThan(html.indexOf("<script"));
    expect(document.title).toBe("Light Portal");
    expect(document.querySelector('meta[name="viewport"]')).not.toBeNull();
  });
  it("uses relative assets and retains only the WP3 bootstrap dev entry", () => {
    const document = new DOMParser().parseFromString(html, "text/html");
    expect(document.querySelector('link[rel="icon"]')?.getAttribute("href")).toBe("favicon.ico");
    expect(Array.from(document.querySelectorAll('[href^="/"], [src^="/"]')).map(element => element.getAttribute("src"))).toEqual(["/src/bootstrap.ts"]);
    expect(document.querySelector('script[type="module"]')?.getAttribute("src")).toBe("/src/bootstrap.ts");
  });
});
