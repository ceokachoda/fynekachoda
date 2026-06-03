import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// react-youtube needs the real YT IFrame API + a window-only iframe, so we
// stub it out via next/dynamic and exercise OUR chrome (shield + controls +
// fullscreen) directly.
vi.mock("next/dynamic", () => ({
  default: () =>
    function YouTubeStub({ videoId }: { videoId: string }) {
      return <div data-testid="yt-stub">{videoId}</div>;
    },
}));

import { WrappedYtPlayer } from "@/components/player/WrappedYtPlayer";

const protoReqFs = Element.prototype.requestFullscreen;

beforeEach(() => {
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    value: null,
  });
});

afterEach(() => {
  Element.prototype.requestFullscreen = protoReqFs;
  vi.restoreAllMocks();
});

describe("WrappedYtPlayer — chrome", () => {
  it("renders the video + the moving watermark", () => {
    render(
      <WrappedYtPlayer videoId="vid123" watermarkText="Student · 99999" seekable />,
    );
    expect(screen.getByTestId("yt-stub")).toHaveTextContent("vid123");
    expect(screen.getByText("Student · 99999")).toBeInTheDocument();
  });

  it("blocks every pointer route to YouTube with a shield over the iframe", () => {
    render(<WrappedYtPlayer videoId="vid123" />);
    // The shield is a full-bleed control that swallows taps so the iframe's
    // residual 'Watch on YouTube' chrome is never reachable.
    expect(
      screen.getByRole("button", { name: "Toggle player controls" }),
    ).toBeInTheDocument();
  });

  it("enters fullscreen on the player container when the button is clicked", async () => {
    const reqFs = vi.fn().mockResolvedValue(undefined);
    Element.prototype.requestFullscreen = reqFs;

    render(<WrappedYtPlayer videoId="vid123" watermarkText="wm" seekable />);

    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));
    await waitFor(() => expect(reqFs).toHaveBeenCalledTimes(1));
  });

  it("shows a seek timeline + time readout for recordings/lessons", () => {
    render(<WrappedYtPlayer videoId="v" watermarkText="wm" seekable />);
    expect(screen.getByLabelText("Seek")).toBeInTheDocument();
    expect(screen.getByLabelText("Rewind 10 seconds")).toBeInTheDocument();
  });

  it("shows a LIVE pill and NO scrubber in live mode", () => {
    render(<WrappedYtPlayer videoId="v" live watermarkText="wm" />);
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.queryByLabelText("Seek")).toBeNull();
  });

  it("renders an optional top-left slot (teacher link)", () => {
    render(
      <WrappedYtPlayer
        videoId="v"
        watermarkText="wm"
        topLeft={<a href="/x">Open Live Control</a>}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Open Live Control" }),
    ).toBeInTheDocument();
  });
});

// Lock the security-critical player vars in source so a future refactor that
// re-exposes a YouTube escape hatch fails loudly (mirrors cameraGesture.test).
describe("WrappedYtPlayer — no YouTube escape hatch (source invariants)", () => {
  const src = readFileSync(
    resolve(__dirname, "../WrappedYtPlayer.tsx"),
    "utf8",
  );

  it("disables the native control bar (YouTube logo + Watch-on-YouTube live there)", () => {
    expect(src).toMatch(/controls:\s*0/);
  });
  it("disables the native fullscreen button (we own fullscreen)", () => {
    expect(src).toMatch(/fs:\s*0/);
  });
  it("plays inline on iOS so the overlay can sit on top", () => {
    expect(src).toMatch(/playsinline:\s*1/);
  });
  it("disables keyboard shortcuts + related videos + annotations", () => {
    expect(src).toMatch(/disablekb:\s*1/);
    expect(src).toMatch(/rel:\s*0/);
    expect(src).toMatch(/iv_load_policy:\s*3/);
  });
  it("kills pinch/double-tap zoom on the video shield", () => {
    expect(src).toMatch(/touchAction:\s*["']none["']/);
  });
  it("suppresses the right-click 'Copy video URL' menu", () => {
    expect(src).toMatch(/onContextMenu=\{\(e\)\s*=>\s*e\.preventDefault\(\)\}/);
  });
});
