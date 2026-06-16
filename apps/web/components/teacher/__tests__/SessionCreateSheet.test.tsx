import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SessionCreateSheet } from "@/components/teacher/SessionCreateSheet";
import type { AssignedBatch } from "@/features/teacher/useAssignedBatches";

// The component's only privileged dependency is the create-session mutation.
// Mock it so the sheet can be exercised without React Query / a real backend.
const mocks = vi.hoisted(() => ({ mutateAsync: vi.fn() }));
vi.mock("@/features/teacher/mutations", () => ({
  useCreateAdHocSession: () => ({
    mutateAsync: mocks.mutateAsync,
    isPending: false,
  }),
}));

const BATCHES: AssignedBatch[] = [
  {
    batch_id: "b1",
    batch_name: "Batch A",
    course_code: "GEN-2026",
    course_name: "General Program",
    student_count: 10,
    next_session: null,
  },
  {
    batch_id: "b2",
    batch_name: "Batch B",
    course_code: "GEN-2026",
    course_name: "General Program",
    student_count: 4,
    next_session: null,
  },
];

function renderSheet(
  overrides: Partial<React.ComponentProps<typeof SessionCreateSheet>> = {},
) {
  const onCreated = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <SessionCreateSheet
      open
      mode="live"
      batches={BATCHES}
      onCreated={onCreated}
      onOpenChange={onOpenChange}
      {...overrides}
    />,
  );
  return { onCreated, onOpenChange };
}

describe("SessionCreateSheet", () => {
  beforeEach(() => {
    mocks.mutateAsync.mockReset();
  });

  it("renders the live-class header + CTA in live mode", () => {
    renderSheet({ mode: "live" });
    expect(
      screen.getByRole("heading", { name: "Schedule live class" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Set up live class" }),
    ).toBeInTheDocument();
  });

  it("renders the offline header + CTA in adhoc mode", () => {
    renderSheet({ mode: "adhoc" });
    expect(
      screen.getByRole("heading", { name: "New offline class" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create class" }),
    ).toBeInTheDocument();
  });

  it("disables the CTA until the class has a name", () => {
    renderSheet({ mode: "live" });
    // Default date/time are pre-filled by the open effect, so only the missing
    // title keeps the button disabled.
    expect(
      screen.getByRole("button", { name: "Set up live class" }),
    ).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Class name"), {
      target: { value: "Physics Live" },
    });
    expect(
      screen.getByRole("button", { name: "Set up live class" }),
    ).toBeEnabled();
  });

  it("submits the trimmed title, selected batch, IST-anchored window and is_live_class", async () => {
    mocks.mutateAsync.mockResolvedValue({ session_id: "sess-1" });
    const { onCreated, onOpenChange } = renderSheet({ mode: "live" });

    fireEvent.change(screen.getByLabelText("Class name"), {
      target: { value: "  Physics Live  " },
    });
    // 16:00 IST == 10:30 UTC; default duration 60 min == +1h.
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-06-10" },
    });
    fireEvent.change(screen.getByLabelText("Start time"), {
      target: { value: "16:00" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Set up live class" }));

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      batch_id: "b1",
      title: "Physics Live",
      scheduled_start: "2026-06-10T10:30:00.000Z",
      scheduled_end: "2026-06-10T11:30:00.000Z",
      is_live_class: true,
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("sess-1"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("honours a 90-min duration and a different picked batch", async () => {
    mocks.mutateAsync.mockResolvedValue({ session_id: "sess-2" });
    renderSheet({ mode: "adhoc" });

    fireEvent.change(screen.getByLabelText("Class name"), {
      target: { value: "Chemistry" },
    });
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-06-10" },
    });
    fireEvent.change(screen.getByLabelText("Start time"), {
      target: { value: "16:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "90 min" }));
    // Switch to the second batch via the native select.
    fireEvent.change(screen.getByLabelText("Batch"), {
      target: { value: "b2" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create class" }));

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      batch_id: "b2",
      title: "Chemistry",
      scheduled_start: "2026-06-10T10:30:00.000Z",
      scheduled_end: "2026-06-10T12:00:00.000Z",
      is_live_class: false,
    });
  });

  it("surfaces a server conflict error and does not navigate", async () => {
    mocks.mutateAsync.mockRejectedValue(
      new Error(
        "This batch already has a class scheduled at that start time. Pick a different time.",
      ),
    );
    const { onCreated } = renderSheet({ mode: "live" });

    fireEvent.change(screen.getByLabelText("Class name"), {
      target: { value: "Trail" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set up live class" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/already has a class scheduled/i);
    expect(onCreated).not.toHaveBeenCalled();
  });
});
