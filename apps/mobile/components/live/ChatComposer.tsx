// Phase 9 — chat input. Disabled (with a reason) when the viewer is banned.
// Surfaces the server's error (rate-limit / ban) inline without a raw stack.

import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Send } from "lucide-react-native";

export function ChatComposer({
  onSend,
  disabled,
  disabledReason,
  placeholder,
}: {
  onSend: (text: string) => Promise<{ ok: boolean; error?: string }>;
  disabled?: boolean;
  disabledReason?: string;
  placeholder?: string;
}) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (sending || !text.trim()) return;
    setSending(true);
    setError(null);
    const res = await onSend(text);
    if (res.ok) {
      setText("");
      // Keep the keyboard up so the user can fire off another message without
      // re-tapping the field (sending blurs the input on some platforms).
      inputRef.current?.focus();
    } else {
      setError(res.error ?? "Couldn't send.");
    }
    setSending(false);
  };

  if (disabled) {
    return (
      <View
        className="px-4 pt-3 bg-slate-100 border-t border-slate-200"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Text className="text-slate-500 text-xs text-center">
          {disabledReason ?? "You can read the chat but can't send messages."}
        </Text>
      </View>
    );
  }

  return (
    <View className="bg-slate-50 border-t border-slate-100">
      {error ? (
        <View className="px-4 pt-2">
          <Text className="text-red-600 text-xs">{error}</Text>
        </View>
      ) : null}
      <View
        className="flex-row items-center px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <View className="flex-1 bg-white min-h-11 rounded-3xl border border-slate-200 flex-row items-center px-4">
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={(t) => {
              setText(t);
              if (error) setError(null);
            }}
            placeholder={placeholder ?? "Type a message…"}
            placeholderTextColor="#94a3b8"
            maxLength={500}
            multiline
            blurOnSubmit={false}
            className="flex-1 text-sm text-slate-800 py-2"
            style={{ maxHeight: 96 }}
          />
        </View>
        <Pressable
          onPress={send}
          disabled={sending || !text.trim()}
          className={`w-11 h-11 rounded-full items-center justify-center ml-3 ${
            text.trim() ? "bg-blue-600" : "bg-slate-300"
          }`}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Send size={18} color="#fff" style={{ marginLeft: -2 }} />
          )}
        </Pressable>
      </View>
    </View>
  );
}
