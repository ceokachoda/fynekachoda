import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react-native";
import { useQrToken } from "@/features/attendance/useQrToken";

// Isolated 1s countdown leaf. Only this tiny Text re-renders each second; the
// parent QrDisplay card and the <QRCode> SVG stay mounted/stable between the
// 25s token refreshes — no per-second SVG re-render on low-end devices.
function QrCountdown({ exp }: { exp: number }): React.ReactElement {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, exp - Math.floor(Date.now() / 1000)),
  );
  useEffect(() => {
    setSecondsLeft(Math.max(0, exp - Math.floor(Date.now() / 1000)));
    const t = setInterval(() => {
      setSecondsLeft(Math.max(0, exp - Math.floor(Date.now() / 1000)));
    }, 1000);
    return () => clearInterval(t);
  }, [exp]);
  return (
    <Text className="text-slate-500 text-xs mt-4">Refreshes in {secondsLeft}s</Text>
  );
}

interface Props {
  sessionId: string;
  sessionLabel: string;
}

export function QrDisplay({ sessionId, sessionLabel }: Props): React.ReactElement {
  const { state, refresh } = useQrToken(sessionId);

  return (
    <View className="bg-white rounded-[28px] p-6 items-center shadow-sm shadow-slate-200/50 border border-slate-100">
      <Text className="text-blue-600 uppercase text-[10px] font-bold tracking-widest mb-1">
        QR for
      </Text>
      <Text className="text-base font-bold text-slate-900 mb-4">{sessionLabel}</Text>

      {state.kind === "loading" || state.kind === "idle" ? (
        <View className="w-[180px] h-[180px] items-center justify-center">
          <ActivityIndicator size="large" color="#2563eb" />
          <Text className="text-slate-500 text-sm mt-3">Getting QR…</Text>
        </View>
      ) : state.kind === "token" ? (
        <>
          <View className="p-3 bg-white">
            <QRCode
              value={state.payload_b64}
              size={180}
              color="#1e293b"
              backgroundColor="#ffffff"
            />
          </View>
          <QrCountdown exp={state.exp} />
        </>
      ) : state.code === "already_marked" ? (
        <View className="w-[200px] items-center justify-center py-6">
          <CheckCircle2 size={48} color="#10b981" />
          <Text className="text-emerald-700 font-bold text-base mt-3 text-center">
            You&apos;re marked!
          </Text>
          <Text className="text-slate-500 text-sm mt-1 text-center">
            {state.message}
          </Text>
        </View>
      ) : (
        <View className="w-[200px] items-center justify-center py-6">
          <AlertCircle size={40} color="#ef4444" />
          <Text className="text-red-600 font-semibold text-sm mt-3 text-center">
            {state.message}
          </Text>
          <TouchableOpacity
            className="bg-blue-600 rounded-xl py-2.5 px-4 mt-4 flex-row items-center"
            onPress={refresh}
          >
            <RefreshCw size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text className="text-white font-semibold text-sm">Try again</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
