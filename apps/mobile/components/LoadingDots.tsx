import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";

interface LoadingDotsProps {
  color?: string;
  size?: number;
  gap?: number;
}

// Three staggered bouncing dots. Pure React Native Animated (native driver) so
// it stays at 60fps on Redmi-8A-class hardware without pulling in Reanimated.
export function LoadingDots({
  color = "#2563EB",
  size = 9,
  gap = 7,
}: LoadingDotsProps) {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = dots.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(value, {
            toValue: 1,
            duration: 320,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 320,
            useNativeDriver: true,
          }),
          Animated.delay((2 - i) * 150),
        ]),
      ),
    );
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [dots]);

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {dots.map((value, i) => (
        <Animated.View
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            marginHorizontal: gap / 2,
            opacity: value.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 1],
            }),
            transform: [
              {
                translateY: value.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -6],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}
