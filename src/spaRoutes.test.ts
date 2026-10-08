import { readFileSync } from "node:fs";
import ts from "typescript";
import { expect, it } from "vitest";
import routes from "./spaRoutes.json";

it("matches App's direct Routes children, excluding the error catch-all", () => {
  const source = ts.createSourceFile("App.tsx", readFileSync("src/App.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const actual: { path: string; match: string }[] = [];
  let containers = 0;
  function visit(node: ts.Node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === "Routes") {
      containers++;
      for (const child of node.children) {
        if (ts.isJsxText(child) || ts.isJsxExpression(child) && !child.expression) continue;
        expect(ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)).toBe(true);
        if (!ts.isJsxElement(child) && !ts.isJsxSelfClosingElement(child)) continue;
        const opening = ts.isJsxElement(child) ? child.openingElement : child;
        expect(opening.tagName.getText(source)).toBe("Route");
        const attribute = opening.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(source) === "path");
        expect(attribute && ts.isJsxAttribute(attribute) && attribute.initializer && ts.isStringLiteral(attribute.initializer)).toBeTruthy();
        if (!attribute || !ts.isJsxAttribute(attribute) || !attribute.initializer || !ts.isStringLiteral(attribute.initializer)) continue;
        const path = attribute.initializer.text;
        // The design explicitly excludes the router's error catch-all.
        if (path === "*") continue;
        actual.push(path.endsWith("/*") ? { path: path.slice(0, -2), match: "prefix" } : { path, match: "exact" });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  expect(containers).toBe(1);
  const sorted = (entries: typeof actual) => [...entries].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  expect(sorted(actual)).toEqual(sorted(routes));
});
