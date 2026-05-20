// Web stub for WrappedYtPlayer.
//
// react-native-youtube-iframe's web entry imports `react-native-web-webview`,
// which we do not depend on (the mobile app is the only first-class target;
// the web bundle is built for the admin/static export pipeline and never
// renders this screen). Providing a `.web.tsx` shim makes Metro pick this
// file when bundling for web and avoids walking into the broken import.

import { forwardRef, useImperativeHandle } from "react";
import { Text, View } from "react-native";

export interface WrappedYtPlayerHandle {
  pause: () => void;
  seekTo: (sec: number) => void;
  getCurrentTime: () => Promise<number>;
}

export interface WrappedYtPlayerProps {
  videoId: string;
  watermark: string;
  startSec?: number;
  onProgress?: (sec: number, durationSec: number) => void;
  onDuration?: (durationSec: number) => void;
  onEnded?: () => void;
}

export const WrappedYtPlayer = forwardRef<
  WrappedYtPlayerHandle,
  WrappedYtPlayerProps
>(function WrappedYtPlayerWeb(_props, ref) {
  useImperativeHandle(ref, () => ({
    pause: () => {},
    seekTo: () => {},
    getCurrentTime: async () => 0,
  }), []);

  return (
    <View
      style={{
        width: "100%",
        aspectRatio: 16 / 9,
        backgroundColor: "#000",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff" }}>
        Video playback is only supported in the mobile app.
      </Text>
    </View>
  );
});
