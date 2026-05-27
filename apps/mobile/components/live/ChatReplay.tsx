// Phase 9 — chat replay for recordings. Reveals messages whose offset (relative
// to session.started_at) has been reached by the player's current time. Because
// it keys off the player's actual position, a faster playback speed reveals
// messages faster automatically.

import { memo, useEffect, useMemo, useRef } from "react";
import { FlatList, Text, View } from "react-native";
import type { ChatMessage } from "@/features/chat/useChatChannel";
import { MessageBubble } from "./ChatPane";
import { messagesUpTo, withReplayOffsets } from "@/features/live/chat-replay";

type ReplayMsg = ChatMessage & { offsetSec: number };

// Memoized: the recording screen re-renders ~1.3×/s to move the scrubber, but it
// passes a whole-second `currentSec`, so this only re-renders when a new message
// is revealed (or the message set changes) — keeps the list cheap on low-end.
export const ChatReplay = memo(function ChatReplay({
  messages,
  startedAt,
  currentSec,
}: {
  messages: ChatMessage[];
  startedAt: string;
  currentSec: number;
}) {
  const listRef = useRef<FlatList<ReplayMsg>>(null);

  const withOffsets = useMemo(
    () =>
      withReplayOffsets(
        // chat + teacher announcements replay inline; the 'system' end marker
        // and soft-deleted messages are excluded.
        messages.filter((m) => m.kind !== "system" && !m.is_deleted),
        startedAt,
      ),
    [messages, startedAt],
  );

  const visible = useMemo(
    () => messagesUpTo(withOffsets, currentSec),
    [withOffsets, currentSec],
  );

  useEffect(() => {
    if (visible.length > 0) {
      const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
      return () => clearTimeout(t);
    }
  }, [visible.length]);

  if (visible.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-slate-400 text-sm text-center">
          Chat from the class will replay here as the video plays.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={visible}
      keyExtractor={(m) => m.id}
      contentContainerStyle={{ padding: 16 }}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => <MessageBubble msg={item} />}
    />
  );
});
