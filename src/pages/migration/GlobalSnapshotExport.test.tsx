import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import GlobalSnapshotExport from "./GlobalSnapshotExport";
import fetchClient from "../../utils/fetchClient";

const USER_HOST_ID = "01964b05-552a-7c4b-9184-6857e7f3dc5f";

vi.mock("../../contexts/UserContext", () => ({
  useUserState: () => ({ host: USER_HOST_ID }),
}));

vi.mock("../../utils/fetchClient", () => ({
  default: vi.fn(),
}));

vi.mock("../../tasks/TaskActionPanel", () => ({
  default: ({ context }: { context: { hostId?: string; sourceHostId?: string } }) => (
    <div data-testid="task-context">
      {JSON.stringify({ hostId: context.hostId, sourceHostId: context.sourceHostId })}
    </div>
  ),
}));

describe("GlobalSnapshotExport source host selection", () => {
  it("keeps the select empty and export disabled until the current host option loads", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let resolveHosts!: (value: { hosts: Array<{ hostId: string; hostDesc: string }> }) => void;
    vi.mocked(fetchClient).mockReturnValue(new Promise((resolve) => {
      resolveHosts = resolve;
    }));

    render(
      <MemoryRouter initialEntries={["/app/migration/export"]}>
        <GlobalSnapshotExport />
      </MemoryRouter>,
    );

    expect(screen.getByRole("combobox", { name: "Source Host" })).not.toHaveTextContent(USER_HOST_ID);
    expect(screen.getByRole("button", { name: "Export Snapshot" })).toBeDisabled();

    await act(async () => {
      resolveHosts({ hosts: [{ hostId: USER_HOST_ID, hostDesc: "Current Host" }] });
    });

    expect(screen.getByRole("combobox", { name: "Source Host" })).toHaveTextContent("Current Host");
    expect(screen.getByRole("button", { name: "Export Snapshot" })).toBeEnabled();
    expect(warn.mock.calls.flat().join(" ")).not.toContain("out-of-range");
  });

  it("explains an unavailable current host and keeps it out of the selection", async () => {
    vi.mocked(fetchClient).mockResolvedValue({
      hosts: [{ hostId: "another-host", hostDesc: "Another Host" }],
    });

    render(
      <MemoryRouter initialEntries={["/app/migration/export"]}>
        <GlobalSnapshotExport />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      `Host ${USER_HOST_ID} is not in the available host list`,
    );
    expect(screen.getByRole("combobox", { name: "Source Host" })).not.toHaveTextContent(USER_HOST_ID);
    expect(screen.getByRole("button", { name: "Export Snapshot" })).toBeDisabled();
    expect(screen.getByTestId("task-context")).toHaveTextContent('{"hostId":"","sourceHostId":""}');
  });
});
