import { useEffect, useRef } from "react";
import { Animated, Modal, Text, TouchableOpacity, View } from "react-native";
import { BadgeIcon } from "./BadgeIcon";
import type { UnseenBadge } from "@/features/gamification/useUnseenBadges";

const CONFETTI_COLORS = ["#2563eb", "#10b981", "#f97316", "#eab308", "#a855f7", "#ef4444"];

// Lightweight built-in-Animated confetti (no extra dependency, Expo Go-safe). A burst
// of colour chips falls from the top once on mount.
function Confetti() {
  const pieces = useRef(
    Array.from({ length: 18 }, (_, i) => ({
      x: Math.random() * 320 - 160,
      delay: Math.random() * 350,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      spin: Math.random() > 0.5 ? 1 : -1,
      anim: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    const burst = Animated.stagger(
      35,
      pieces.map((p) =>
        Animated.timing(p.anim, { toValue: 1, duration: 1300, delay: p.delay, useNativeDriver: true }),
      ),
    );
    burst.start();
    return () => burst.stop();
  }, [pieces]);

  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: "50%", height: 0 }}>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            width: 8,
            height: 13,
            borderRadius: 2,
            backgroundColor: p.color,
            opacity: p.anim.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateX: p.x },
              { translateY: p.anim.interpolate({ inputRange: [0, 1], outputRange: [-30, 460] }) },
              {
                rotate: p.anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", `${p.spin * 540}deg`],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}

export function BadgeEarnedModal({
  badge,
  iconUrl,
  onDismiss,
}: {
  badge: UnseenBadge;
  iconUrl: string | null;
  onDismiss: () => void;
}) {
  const scale = useRef(new Animated.Value(0.4)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scale.setValue(0.4);
    fade.setValue(0);
    const entrance = Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]);
    entrance.start();
    return () => entrance.stop();
  }, [badge.code, scale, fade]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View className="flex-1 bg-black/60 items-center justify-center px-8">
        <Confetti />
        <Animated.View
          style={{ opacity: fade, transform: [{ scale }] }}
          className="bg-white rounded-[32px] p-8 w-full max-w-sm items-center"
        >
          <Text className="text-xs font-bold uppercase tracking-widest text-violet-500 mb-2">
            Badge unlocked!
          </Text>
          <View className="my-3">
            <BadgeIcon uri={iconUrl} size={104} />
          </View>
          <Text className="text-2xl font-extrabold text-slate-900 text-center">{badge.name}</Text>
          <Text className="text-sm text-slate-500 text-center mt-2 leading-5">{badge.description}</Text>

          <View className="flex-row mt-7 w-full" style={{ gap: 12 }}>
            <View className="flex-1 bg-slate-100 rounded-2xl py-3.5 items-center opacity-50">
              <Text className="font-bold text-slate-400">Share</Text>
            </View>
            <TouchableOpacity
              onPress={onDismiss}
              activeOpacity={0.85}
              className="flex-1 bg-blue-600 rounded-2xl py-3.5 items-center"
            >
              <Text className="font-bold text-white">Awesome!</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
