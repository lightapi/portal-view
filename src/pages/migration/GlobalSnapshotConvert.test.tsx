import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GlobalSnapshotConvert from "./GlobalSnapshotConvert";
import fetchClient from "../../utils/fetchClient";

const USER_HOST_ID = "01964b05-552a-7c4b-9184-6857e7f3dc5f";

vi.mock("../../contexts/UserContext", () => ({
  useUserState: () => ({ host: USER_HOST_ID }),
}));

vi.mock("../../utils/fetchClient", () => ({
  default: vi.fn(),
}));

vi.mock("../../tasks/TaskActionPanel", () => ({
  default: ({ context }: { context: { targetHostId?: string } }) => (
    <div data-testid="task-context">{JSON.stringify({ targetHostId: context.targetHostId })}</div>
  ),
}));

describe("GlobalSnapshotConvert target host selection", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("keeps the select empty without an out-of-range warning until the current host loads", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let resolveHosts!: (value: { hosts: Array<{ hostId: string; hostDesc: string }> }) => void;
    vi.mocked(fetchClient).mockReturnValue(new Promise((resolve) => {
      resolveHosts = resolve;
    }));

    render(
      <MemoryRouter initialEntries={["/app/migration/convert"]}>
        <GlobalSnapshotConvert />
      </MemoryRouter>,
    );

    expect(screen.getByRole("combobox", { name: "Target Host" })).not.toHaveTextContent(USER_HOST_ID);

    await act(async () => {
      resolveHosts({ hosts: [{ hostId: USER_HOST_ID, hostDesc: "Current Host" }] });
    });

    expect(screen.getByRole("combobox", { name: "Target Host" })).toHaveTextContent("Current Host");
    expect(warn.mock.calls.flat().join(" ")).not.toContain("out-of-range");
  });

  it("explains when the current target host is unavailable", async () => {
    vi.mocked(fetchClient).mockResolvedValue({
      hosts: [{ hostId: "another-host", hostDesc: "Another Host" }],
    });

    render(
      <MemoryRouter initialEntries={["/app/migration/convert"]}>
        <GlobalSnapshotConvert />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      `Host ${USER_HOST_ID} is not in the available host list`,
    );
    expect(screen.getByRole("combobox", { name: "Target Host" })).not.toHaveTextContent(USER_HOST_ID);
    expect(screen.getByTestId("task-context")).toHaveTextContent('{"targetHostId":""}');
  });

  it("preserves a stored target host when snapshot data arrives before hosts load", async () => {
    const taskId = "portal-snapshot-migration";
    const taskStorageKey = `portal-view.taskContext.${taskId}`;
    const snapshotStorageKey = "globalSnapshotExport:source-host";
    sessionStorage.setItem(taskStorageKey, JSON.stringify({
      hostId: USER_HOST_ID,
      targetHostId: USER_HOST_ID,
    }));
    sessionStorage.setItem(snapshotStorageKey, "{}");
    vi.mocked(fetchClient).mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={[{
        pathname: "/app/migration/convert",
        search: `?task=${taskId}`,
        state: { snapshotStorageKey, sourceHostId: "source-host" },
      }]}>
        <GlobalSnapshotConvert />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(JSON.parse(sessionStorage.getItem(taskStorageKey) || "{}")).toEqual({
        hostId: USER_HOST_ID,
        targetHostId: USER_HOST_ID,
        snapshotExportReady: true,
      });
    });
    expect(screen.getByTestId("task-context")).toHaveTextContent('{"targetHostId":""}');
  });
});
