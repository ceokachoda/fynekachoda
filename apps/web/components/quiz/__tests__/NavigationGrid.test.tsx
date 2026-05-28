import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  NavigationGrid,
  type QuestionStatus,
} from "@/components/quiz/NavigationGrid";

describe("NavigationGrid", () => {
  it("renders one button per question with the right aria-selected", () => {
    render(
      <NavigationGrid
        total={3}
        currentIndex={1}
        statuses={["answered", "unanswered", "flagged_unanswered"]}
        onJump={() => {}}
      />,
    );
    const buttons = screen.getAllByRole("tab");
    expect(buttons).toHaveLength(3);
    expect(buttons[1]).toHaveAttribute("aria-selected", "true");
    expect(buttons[0]).toHaveAttribute("aria-selected", "false");
  });

  it("sets data-status to 'current' on the current button (overrides input array)", () => {
    render(
      <NavigationGrid
        total={3}
        currentIndex={0}
        statuses={["answered", "flagged_answered", "unanswered"] as QuestionStatus[]}
        onJump={() => {}}
      />,
    );
    const buttons = screen.getAllByRole("tab");
    expect(buttons[0]).toHaveAttribute("data-status", "current");
    expect(buttons[1]).toHaveAttribute("data-status", "flagged_answered");
    expect(buttons[2]).toHaveAttribute("data-status", "unanswered");
  });

  it("invokes onJump with the clicked index", () => {
    const onJump = vi.fn();
    render(
      <NavigationGrid
        total={3}
        currentIndex={0}
        statuses={["unanswered", "unanswered", "unanswered"]}
        onJump={onJump}
      />,
    );
    const buttons = screen.getAllByRole("tab");
    const third = buttons[2];
    if (!third) throw new Error("expected a third button");
    third.click();
    expect(onJump).toHaveBeenCalledWith(2);
  });
});
