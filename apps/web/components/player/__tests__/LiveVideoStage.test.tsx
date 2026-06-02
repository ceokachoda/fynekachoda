import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Isolate the stage's own logic (fullscreen button + toggle) from the real
// react-youtube player, which needs the YT IFrame API + a real iframe.
vi.mock("@/components/player/WrappedYtPlayer", () => ({
  WrappedYtPlayer: ({ videoId }: { videoId: string }) => (
    <div data-testid="yt-stub">{videoId}</div>
  ),
}));
vi.mock("@/components/player/Watermark", () => ({
  Watermark: ({ text }: { text: string }) => (
    <span data-testid="wm-stub">{text}</span>
  ),
}));

import { LiveVideoStage } from "@/components/player/LiveVideoStage";

const protoReqFs = Element.prototype.requestFullscreen;

beforeEach(() => {
  Object.defineProperty(document, "fullscreenEnabled", {
    configurable: true,
    value: true,
  });
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    value: null,
  });
});

afterEach(() => {
  Element.prototype.requestFullscreen = protoReqFs;
  vi.restoreAllMocks();
});

describe("LiveVideoStage", () => {
  it("renders the player + watermark", () => {
    render(<LiveVideoStage videoId="vid123" watermarkText="Student · 99999" />);
    expect(screen.getByTestId("yt-stub")).toHaveTextContent("vid123");
    expect(screen.getByTestId("wm-stub")).toHaveTextContent("Student · 99999");
  });

  it("shows a fullscreen button when the browser supports it and requests fullscreen on click", async () => {
    const reqFs = vi.fn().mockResolvedValue(undefined);
    Element.prototype.requestFullscreen = reqFs;

    render(<LiveVideoStage videoId="vid123" watermarkText="wm" />);

    const btn = await screen.findByRole("button", { name: "Fullscreen" });
    fireEvent.click(btn);
    await waitFor(() => expect(reqFs).toHaveBeenCalledTimes(1));
  });

  it("renders an optional top-left slot", () => {
    render(
      <LiveVideoStage
        videoId="v"
        watermarkText="wm"
        topLeft={<a href="/x">Open Live Control</a>}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Open Live Control" }),
    ).toBeInTheDocument();
  });

  it("hides the fullscreen button when fullscreen is unsupported", async () => {
    Object.defineProperty(document, "fullscreenEnabled", {
      configurable: true,
      value: false,
    });
    render(<LiveVideoStage videoId="v" watermarkText="wm" />);
    // Give the mount effect a tick; the button must never appear.
    await waitFor(() => expect(screen.getByTestId("yt-stub")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Fullscreen" })).toBeNull();
  });
});
