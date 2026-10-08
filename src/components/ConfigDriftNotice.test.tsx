import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConfigDriftNotice, { DRIFT_CHECK_INTERVAL_MS } from "./ConfigDriftNotice";
import { checkConfigDrift, setInitialConfigDigest } from "../runtimeConfig/digest";

vi.mock("../runtimeConfig/digest", async (importOriginal) => {
  const original = await importOriginal<typeof import("../runtimeConfig/digest")>();
  return {
    ...original,
    get initialConfigDigest() { return original.initialConfigDigest; },
    checkConfigDrift: vi.fn(),
  };
});

const check = vi.mocked(checkConfigDrift);
const message = "Portal configuration changed. Reload to apply.";
const locationDescriptor = Object.getOwnPropertyDescriptor(window, "location")!;

beforeEach(() => {
  vi.useFakeTimers();
  check.mockReset().mockResolvedValue(false);
  setInitialConfigDigest("initial");
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  setInitialConfigDigest("");
  Object.defineProperty(window, "location", locationDescriptor);
});

async function tick() {
  await act(async () => { await vi.advanceTimersByTimeAsync(DRIFT_CHECK_INTERVAL_MS); });
}

async function visibility(state: DocumentVisibilityState) {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(state);
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
}

describe("ConfigDriftNotice", () => {
  it("waits five minutes before its first check and keeps the five-minute interval", async () => {
    expect(DRIFT_CHECK_INTERVAL_MS).toBe(300_000);
    expect(DRIFT_CHECK_INTERVAL_MS).toBeGreaterThanOrEqual(300_000);
    render(<ConfigDriftNotice />);
    expect(screen.queryByText(message)).not.toBeInTheDocument();
    expect(check).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(299_999); });
    expect(check).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(check).toHaveBeenCalledTimes(1);
    await tick();
    expect(check).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });

  it("does not show a notice when a check fails", async () => {
    check.mockRejectedValue(new Error("offline"));
    render(<ConfigDriftNotice />);
    await tick();
    expect(check).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });

  it("shows the exact message and reloads only when Reload is clicked", async () => {
    const reload = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { reload } });
    check.mockResolvedValue(true);
    render(<ConfigDriftNotice />);
    await tick();
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("checks visibility changes only when visible", async () => {
    render(<ConfigDriftNotice />);
    await visibility("hidden");
    expect(check).not.toHaveBeenCalled();
    check.mockResolvedValue(true);
    await visibility("visible");
    expect(check).toHaveBeenCalledTimes(1);
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("disables timers and visibility checks when the initial digest is empty", async () => {
    setInitialConfigDigest("");
    const interval = vi.spyOn(window, "setInterval");
    const add = vi.spyOn(document, "addEventListener");
    render(<ConfigDriftNotice />);
    expect(interval).not.toHaveBeenCalled();
    expect(add.mock.calls.filter(([event]) => event === "visibilitychange")).toHaveLength(0);
    await tick();
    await visibility("visible");
    expect(check).not.toHaveBeenCalled();
    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });

  it("keeps the notice after unchanged and rejected checks, elapsed time, and Escape", async () => {
    check.mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockRejectedValueOnce(new Error("offline"));
    render(<ConfigDriftNotice />);
    await tick();
    expect(screen.getByText(message)).toBeInTheDocument();
    await tick();
    expect(screen.getByText(message)).toBeInTheDocument();
    await tick();
    expect(check).toHaveBeenCalledTimes(3);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("removes its interval and the same visibility listener on unmount", async () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const interval = vi.spyOn(window, "setInterval");
    const clear = vi.spyOn(window, "clearInterval");
    const { unmount } = render(<ConfigDriftNotice />);
    const listener = add.mock.calls.find(([event]) => event === "visibilitychange")![1];
    unmount();
    expect(clear).toHaveBeenCalledWith(interval.mock.results[0].value);
    expect(remove).toHaveBeenCalledWith("visibilitychange", listener);
    expect(vi.getTimerCount()).toBe(0);
    await tick();
    await visibility("visible");
    expect(check).not.toHaveBeenCalled();
  });

  it.each(["resolve", "reject"])("safely handles a pending check that will %s after unmount", async (outcome) => {
    let resolve!: (value: boolean) => void;
    let reject!: (reason: Error) => void;
    check.mockReturnValueOnce(new Promise<boolean>((res, rej) => { resolve = res; reject = rej; }));
    const { unmount } = render(<ConfigDriftNotice />);
    await tick();
    expect(check).toHaveBeenCalledTimes(1);
    unmount();
    // A new instance must not receive the previous instance's late result.
    render(<ConfigDriftNotice />);
    await act(async () => {
      if (outcome === "resolve") resolve(true);
      else reject(new Error("offline"));
    });
    expect(screen.queryByText(message)).not.toBeInTheDocument();
    expect(check).toHaveBeenCalledTimes(1);
  });
});
