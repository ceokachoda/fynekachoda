// Phase 9 — live chat list. Renders kind='chat' messages (announcements show in
// PinnedBanner, system messages drive navigation in the screen). Soft-deleted
// messages drop out automatically when the Realtime UPDATE flips is_deleted.
// Teachers can long-press a message to moderate it.

import { useEffect, useRef } from "react";
import { FlatList, Platform, Pressable, Text, View } from "react-native";
import type { ChatMessage } from "@/features/chat/useChatChannel";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  const first = parts[0]![0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1]![0] ?? "" : "";
  return (first + second).toUpperCase();
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageBubble({
  msg,
  isOwn,
  onLongPress,
}: {
  msg: ChatMessage;
  isOwn?: boolean;
  onLongPress?: () => void;
}) {
  const isStaff = msg.author_role === "teacher" || msg.author_role === "admin";
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={350}
      className="mb-3 flex-row"
    >
      <View
        className={`w-7 h-7 rounded-full items-center justify-center mr-2 mt-0.5 ${
          isStaff ? "bg-emerald-100" : "bg-blue-100"
        }`}
      >
        <Text
          className={`text-[10px] font-bold ${
            isStaff ? "text-emerald-700" : "text-blue-700"
          }`}
        >
          {initials(msg.author_name)}
        </Text>
      </View>
      <View className="flex-1">
        <View className="flex-row items-center mb-0.5">
          <Text
            className={`text-xs font-bold mr-2 ${
              isStaff ? "text-emerald-700" : "text-slate-800"
            }`}
            numberOfLines={1}
          >
            {msg.author_name}
            {isOwn ? " (you)" : ""}
          </Text>
          {isStaff ? (
            <View className="bg-emerald-600 px-1.5 py-0.5 rounded mr-2">
              <Text className="text-white text-[8px] font-bold uppercase tracking-wider">
                {msg.author_role === "admin" ? "Admin" : "Teacher"}
              </Text>
            </View>
          ) : null}
          <Text className="text-slate-400 text-[10px]">{timeOf(msg.posted_at)}</Text>
        </View>
        <Text className="text-slate-700 text-sm leading-5">{msg.body}</Text>
      </View>
    </Pressable>
  );
}

export function ChatPane({
  messages,
  currentUserId,
  canModerate,
  onModerate,
  emptyHint,
}: {
  messages: ChatMessage[];
  currentUserId?: string;
  canModerate?: boolean;
  onModerate?: (msg: ChatMessage) => void;
  emptyHint?: string;
}) {
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const data = messages.filter((m) => m.kind === "chat" && !m.is_deleted);

  useEffect(() => {
    if (data.length > 0) {
      const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
      return () => clearTimeout(t);
    }
  }, [data.length]);

  if (data.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-slate-400 text-sm text-center">
          {emptyHint ?? "No messages yet. Say hello!"}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={data}
      keyExtractor={(m) => m.id}
      contentContainerStyle={{ padding: 16 }}
      removeClippedSubviews
      windowSize={11}
      initialNumToRender={15}
      maxToRenderPerBatch={12}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      renderItem={({ item }) => (
        <MessageBubble
          msg={item}
          isOwn={item.author_id === currentUserId}
          onLongPress={canModerate ? () => onModerate?.(item) : undefined}
        />
      )}
    />
  );
}
