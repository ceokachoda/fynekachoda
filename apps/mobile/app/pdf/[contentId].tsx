import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { usePreventScreenCapture } from "expo-screen-capture";
import { useContentItem } from "@/features/library/useContentItem";
import { usePdfProgress } from "@/features/library/usePdfProgress";
import { useSession } from "@/features/auth/useSession";
import { createSignedPdfUrl, pdfJsViewerHtml } from "@/lib/pdf";
import { PdfWatermark } from "@/components/live/PdfWatermark";
import { formatWatermark } from "@/lib/watermark";

export default function PdfScreen() {
  // D-061: in-app reader only — block OS-level screenshots on Android.
  usePreventScreenCapture();
  const router = useRouter();
  const navigation = useNavigation();
  const { appUser } = useSession();
  const { contentId } = useLocalSearchParams<{ contentId: string }>();
  const { data: item, isLoading: itemLoading, error: itemErr } = useContentItem(
    contentId,
  );
  const { initial, isLoading: progressLoading, setPage } = usePdfProgress(
    contentId,
  );
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [signErr, setSignErr] = useState<string | null>(null);
  const [pageInfo, setPageInfo] = useState<{ current: number; total: number }>({
    current: initial?.last_page ?? 1,
    total: initial?.total_pages ?? 0,
  });
  const webRef = useRef<WebView | null>(null);

  const watermark = formatWatermark(appUser?.full_name, appUser?.phone);

  useEffect(() => {
    if (!item?.id) return;
    let cancelled = false;
    createSignedPdfUrl(item.id)
      .then((u) => {
        if (!cancelled) setSignedUrl(u);
      })
      .catch((e) => {
        if (!cancelled) setSignErr((e as Error).message ?? "Couldn't load PDF.");
      });
    return () => {
      cancelled = true;
    };
  }, [item?.id]);

  useEffect(() => {
    const unsub = navigation.addListener("blur", () => {
      // Persist final page on blur.
      if (pageInfo.current > 0) {
        void setPage(pageInfo.current, pageInfo.total || undefined);
      }
    });
    return unsub;
  }, [navigation, pageInfo, setPage]);

  const onMsg = (e: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(e.nativeEvent.data) as {
        t: string;
        page?: number;
        total?: number;
        message?: string;
      };
      if (data.t === "total" && data.total) {
        setPageInfo((p) => ({ ...p, total: data.total! }));
      } else if (data.t === "pageChange" && data.page) {
        setPageInfo((p) => ({ ...p, current: data.page! }));
        void setPage(data.page!, pageInfo.total || undefined);
      } else if (data.t === "loaded" && data.total) {
        setPageInfo((p) => ({ ...p, total: data.total! }));
      }
    } catch {
      // ignore parse errors
    }
  };

  if (itemLoading || progressLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-900 items-center justify-center">
        <ActivityIndicator size="large" color="#fff" />
      </SafeAreaView>
    );
  }
  if (itemErr || !item || !item.file_path) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 p-6">
        <Text className="text-red-600">
          {itemErr ?? "This document is no longer available."}
        </Text>
      </SafeAreaView>
    );
  }
  if (signErr) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 p-6">
        <Text className="text-red-600 mb-3">{signErr}</Text>
        <Pressable
          onPress={() => router.back()}
          className="self-start bg-slate-200 px-4 py-2 rounded-xl"
        >
          <Text className="text-slate-800">Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-900" edges={["top"]}>
      <View className="flex-row items-center px-4 py-3 bg-slate-900">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 items-center justify-center rounded-full bg-slate-800 mr-3"
        >
          <ChevronLeft size={20} color="#fff" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-base font-bold text-white" numberOfLines={1}>
            {item.title}
          </Text>
          {pageInfo.total > 0 ? (
            <Text className="text-xs text-slate-400">
              Page {pageInfo.current} of {pageInfo.total}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={{ flex: 1, position: "relative" }}>
        {signedUrl ? (
          <WebView
            ref={webRef}
            originWhitelist={["*"]}
            source={{
              html: pdfJsViewerHtml(signedUrl, initial?.last_page ?? 1),
            }}
            onMessage={onMsg}
            style={{ flex: 1, backgroundColor: "#111" }}
            javaScriptEnabled
            domStorageEnabled={false}
            allowFileAccess={false}
            allowsLinkPreview={false}
            mixedContentMode={Platform.OS === "android" ? "compatibility" : undefined}
            setSupportMultipleWindows={false}
          />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}
        <PdfWatermark text={watermark} />
      </View>
    </SafeAreaView>
  );
}
