import { describe, expect, it } from "vitest";
import forms from "../data/Forms";
import { taskRegistry } from "./taskRegistry";
import { buildTaskStepRoute, stepRouteForStatus } from "./taskUtils";
import type { TaskStep } from "./types";

const allSteps = taskRegistry.flatMap((task) => task.steps.map((step) => ({ task, step })));

function formIdFor(route: string) {
  const path = route.split("?")[0];
  return path.startsWith("/app/form/") ? path.slice("/app/form/".length) : null;
}

describe("task step completedRoute", () => {
  it("names a form that exists for every completedRoute", () => {
    const missing = allSteps
      .filter(({ step }) => step.completedRoute)
      .map(({ task, step }) => ({ task: task.id, step: step.id, formId: formIdFor(step.completedRoute!) }))
      .filter((entry) => !entry.formId || !(entry.formId in (forms as Record<string, unknown>)));

    expect(missing).toEqual([]);
  });

  it("only routes to a destination that can load its own record", () => {
    // Routing and prefill ship together: a completed step must never open an update form that
    // has no verified identity-only read behind it, or it opens with context keys only.
    const withoutPrefill = allSteps
      .filter(({ step }) => step.completedRoute)
      .filter(({ step }) => {
        const formId = formIdFor(step.completedRoute!);
        const form = formId ? (forms as Record<string, any>)[formId] : null;
        return !form?.prefill;
      })
      .map(({ task, step }) => `${task.id}:${step.id}`);

    expect(withoutPrefill).toEqual([]);
  });

  it("requires every identity key the destination form needs", () => {
    // completedRequires gates the routing; prefill.identity gates the load. If the first is
    // weaker than the second, a step routes to a form that cannot identify its record.
    const underSpecified = allSteps
      .filter(({ step }) => step.completedRoute)
      .map(({ task, step }) => {
        const formId = formIdFor(step.completedRoute!);
        const identity: string[] = (forms as Record<string, any>)[formId!]?.prefill?.identity ?? [];
        const required = new Set(step.completedRequires ?? []);
        const gaps = identity.filter((key) => !required.has(key as never));
        return { step: `${task.id}:${step.id}`, gaps };
      })
      .filter((entry) => entry.gaps.length > 0);

    expect(underSpecified).toEqual([]);
  });

  it("never declares a getFresh read for prefill", () => {
    // getFresh* request schemas mark aggregateVersion required and their handlers unbox it
    // into an int, so they cannot serve an identity-only load.
    const freshReads = Object.entries(forms as Record<string, any>)
      .filter(([, form]) => typeof form?.prefill?.action === "string")
      .filter(([, form]) => form.prefill.action.startsWith("getFresh"))
      .map(([formId]) => formId);

    expect(freshReads).toEqual([]);
  });

  it("does not carry creation defaults into the update form", () => {
    // Create routes pin defaults such as apiType and transportConfig. Replaying them on an
    // update form would overwrite the record's real values with the creation defaults.
    const withQuery = allSteps
      .filter(({ step }) => step.completedRoute?.includes("?"))
      .map(({ task, step }) => `${task.id}:${step.id}`);

    expect(withQuery).toEqual([]);
  });
});

describe("stepRouteForStatus", () => {
  const step: TaskStep = {
    id: "version",
    title: "Create agent API version",
    description: "",
    route: "/app/form/createApiVersion?apiType=agt",
    completedRoute: "/app/form/updateApiVersion",
    completedRequires: ["hostId", "apiId", "apiVersionId"],
    required: true,
  };

  const identity = { hostId: "h", apiId: "api-a", apiVersionId: "v1" };

  it("uses the create route until the step is complete", () => {
    expect(stepRouteForStatus(step, "ready", identity)).toBe(step.route);
    expect(stepRouteForStatus(step, "blocked", identity)).toBe(step.route);
    expect(stepRouteForStatus(step, undefined, identity)).toBe(step.route);
  });

  it("uses the completed route once the step is complete and identified", () => {
    expect(stepRouteForStatus(step, "complete", identity)).toBe("/app/form/updateApiVersion");
  });

  it("stays on the create route when the record is not identified", () => {
    // publish-api marks the version step complete when any version exists, but selects an
    // apiVersionId only when there is exactly one. Without it there is nothing to update.
    expect(stepRouteForStatus(step, "complete", { hostId: "h", apiId: "api-a" })).toBe(step.route);
  });

  it("falls back to the create route when no completed route is declared", () => {
    const bare: TaskStep = { ...step, completedRoute: undefined };
    expect(stepRouteForStatus(bare, "complete", identity)).toBe(bare.route);
  });
});

describe("buildTaskStepRoute with status", () => {
  const step: TaskStep = {
    id: "version",
    title: "Create agent API version",
    description: "",
    route: "/app/form/createApiVersion?apiType=agt",
    completedRoute: "/app/form/updateApiVersion",
    completedRequires: ["hostId", "apiId", "apiVersionId"],
    required: true,
  };

  it("keeps prior behaviour when no status is supplied", () => {
    const route = buildTaskStepRoute("register-ai-agent", step, new URLSearchParams(), { apiId: "api-a" });
    expect(route).toContain("/app/form/createApiVersion");
    expect(route).toContain("apiType=agt");
  });

  it("routes a completed step to the update form without the creation defaults", () => {
    const route = buildTaskStepRoute(
      "register-ai-agent",
      step,
      new URLSearchParams(),
      { hostId: "h", apiId: "api-a", apiVersionId: "v1" },
      "complete",
    );
    expect(route).toContain("/app/form/updateApiVersion");
    expect(route).not.toContain("apiType=agt");
    expect(route).toContain("apiVersionId=v1");
    expect(route).toContain("task=register-ai-agent");
    expect(route).toContain("taskStep=version");
  });
});
