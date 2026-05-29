import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import { Eye, EyeOff } from "lucide-react-native";
import { FyneStudyLogo } from "@/components/FyneStudyLogo";
import { signInWithPassword } from "@/features/auth/auth";
import { LoginSchema } from "@/features/auth/schemas";
import { useSession } from "@/features/auth/useSession";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get("window");
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;
const widthScale = width / BASE_WIDTH;
const heightScale = height / BASE_HEIGHT;
const uiScale = Math.min(widthScale, heightScale);
const isSmallDevice = height < 700;
const rs = (s: number) => Math.round(s * uiScale);
const rh = (s: number) => Math.round(s * heightScale);
const ILLUSTRATION_HEIGHT = rh(isSmallDevice ? 180 : 220);
const NO_SCALE = { allowFontScaling: false as const };

function HeaderIllustration({ opacity }: { opacity: Animated.AnimatedInterpolation<number> }) {
  return (
    <Animated.View
      style={{
        position: "absolute",
        top: -10,
        right: -10,
        width: width * 0.82,
        height: ILLUSTRATION_HEIGHT,
        opacity,
      }}
      pointerEvents="none"
    >
      <Svg width="100%" height="100%" viewBox="0 0 400 400" preserveAspectRatio="xMaxYMin meet">
        <Path
          d="M260.5,48.5C320.5,68.5,382.5,112.5,397.5,175.5C412.5,238.5,380.5,320.5,320.5,360.5C260.5,400.5,172.5,398.5,112.5,358.5C52.5,318.5,20.5,240.5,16.5,170.5C12.5,100.5,36.5,38.5,96.5,8.5C156.5,-21.5,200.5,28.5,260.5,48.5Z"
          fill="#DBEAFE"
          transform="translate(20, -30)"
        />
        <G transform="translate(60, -10)">
          <Path d="M 100 270 Q 190 290 280 270 L 330 320 Q 190 360 60 320 Z" fill="#1E293B" />
          <Path d="M 100 260 Q 190 280 280 260 L 320 305 Q 190 345 70 305 Z" fill="#FFFFFF" />
          <Path d="M 105 255 Q 190 275 275 255 L 310 295 Q 190 330 80 295 Z" fill="#F8FAFC" />
          <Path d="M 195 270 L 195 325" stroke="#CBD5E1" strokeWidth="2" />
          <Path d="M 105 270 L 180 285" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />
          <Path d="M 110 285 L 185 298" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />
          <Path d="M 210 285 L 285 270" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />
          <G transform="translate(130, 130) rotate(-20)">
            <Rect x="0" y="0" width="16" height="100" rx="2" fill="#FBBF24" />
            <Path d="M 0 100 L 8 120 L 16 100 Z" fill="#FDE68A" />
            <Path d="M 6 115 L 8 120 L 10 115 Z" fill="#1E293B" />
            <Rect x="0" y="-15" width="16" height="15" rx="2" fill="#F87171" />
            <Rect x="0" y="0" width="16" height="5" fill="#9CA3AF" />
          </G>
          <G transform="translate(250, 130) rotate(10)">
            <Path d="M -40 0 L 0 -20 L 40 0 L 0 20 Z" fill="#1E293B" />
            <Path d="M -20 10 L -20 30 Q 0 45 20 30 L 20 10 Z" fill="#1E293B" />
            <Path d="M 30 5 L 30 35" stroke="#FBBF24" strokeWidth="3" />
            <Circle cx="30" cy="35" r="4" fill="#FBBF24" />
          </G>
          <Path d="M 80 100 L 85 115 L 100 120 L 85 125 L 80 140 L 75 125 L 60 120 L 75 115 Z" fill="#3B82F6" />
          <Path d="M 340 160 L 343 168 L 350 170 L 343 172 L 340 180 L 337 172 L 330 170 L 337 168 Z" fill="#FBBF24" />
          <Circle cx="160" cy="80" r="5" fill="#3B82F6" />
          <Circle cx="300" cy="90" r="4" fill="#34D399" />
        </G>
      </Svg>
    </Animated.View>
  );
}

function FloatingLabelInput({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: rs(20) }} className="relative">
      <View
        style={{
          borderWidth: 1,
          borderRadius: rs(12),
          paddingHorizontal: rs(14),
          paddingVertical: rs(10),
          minHeight: rs(56),
        }}
        className="border-slate-300 bg-white justify-center shadow-sm shadow-slate-100/50"
      >
        {children}
      </View>
      <View
        style={{
          position: "absolute",
          top: -rs(9),
          left: rs(14),
          paddingHorizontal: rs(6),
        }}
        className="bg-white z-10"
      >
        <Text {...NO_SCALE} style={{ fontSize: rs(11) }} className="font-semibold text-slate-500">
          {label}
        </Text>
      </View>
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { session } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const illustrationOpacity = useRef(new Animated.Value(1)).current;

  // If a session arrives (either from the in-flight signInWithPassword or
  // from supabase-js's auto-restore on app open), bounce to root which will
  // route us by role. Covers the iOS Expo Go case where /token returns 200
  // but the supabase-js promise misses the 30s window — onAuthStateChange
  // still fires later and SessionProvider's session becomes non-null.
  useEffect(() => {
    if (session) router.replace("/");
  }, [session, router]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, () => {
      LayoutAnimation.configureNext({
        duration: 220,
        create: { type: "easeInEaseOut", property: "opacity" },
        update: { type: "easeInEaseOut" },
        delete: { type: "easeInEaseOut", property: "opacity" },
      });
      setKeyboardOpen(true);
      Animated.timing(illustrationOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      LayoutAnimation.configureNext({
        duration: 220,
        create: { type: "easeInEaseOut", property: "opacity" },
        update: { type: "easeInEaseOut" },
        delete: { type: "easeInEaseOut", property: "opacity" },
      });
      setKeyboardOpen(false);
      Animated.timing(illustrationOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [illustrationOpacity]);

  async function handleSignIn() {
    setError(null);
    const parsed = LoginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input.");
      return;
    }
    Keyboard.dismiss();
    setPending(true);
    const result = await signInWithPassword(parsed.data.email, parsed.data.password);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // SessionProvider updates the session; root index.tsx re-routes to the
    // right destination based on role + must_change.
    router.replace("/");
  }

  return (
    <View className="flex-1 bg-white">
      <HeaderIllustration opacity={illustrationOpacity} />

      <SafeAreaView className="flex-1 bg-transparent" edges={["top", "bottom"]}>
        {/* Inline style, NOT className: KeyboardAvoidingView is a class
            component, and css-interop's remapProps wrapper injects a fresh
            placeholder style object on every render, which loops its
            setState lifecycle ("Maximum update depth exceeded"). */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View className="flex-1">
            {!keyboardOpen && (
              <View
                style={{
                  marginLeft: rs(18),
                  marginTop: rs(4),
                  alignSelf: "flex-start",
                }}
              >
                <FyneStudyLogo variant="large" />
              </View>
            )}

            <View
              style={{
                flex: 1,
                paddingHorizontal: rs(24),
                paddingTop: keyboardOpen ? rs(16) : ILLUSTRATION_HEIGHT - rs(40),
                paddingBottom: rs(12),
                justifyContent: keyboardOpen ? "flex-start" : "space-between",
              }}
            >
              <View
                style={{
                  alignItems: "center",
                  marginBottom: keyboardOpen ? rs(12) : rs(isSmallDevice ? 10 : 16),
                }}
              >
                {!keyboardOpen && (
                  <Text
                    {...NO_SCALE}
                    style={{ fontSize: rs(28), lineHeight: rs(32), marginBottom: rs(2) }}
                    className="font-extrabold text-[#2563EB]"
                  >
                    Welcome
                  </Text>
                )}
                <Text
                  {...NO_SCALE}
                  style={{
                    fontSize: keyboardOpen ? rs(18) : rs(22),
                    lineHeight: keyboardOpen ? rs(22) : rs(26),
                    marginBottom: keyboardOpen ? 0 : rs(8),
                  }}
                  className="font-extrabold text-slate-900"
                >
                  {keyboardOpen ? "Sign in to FyneStudy" : "to FyneStudy"}
                </Text>
                {!keyboardOpen && (
                  <Text
                    {...NO_SCALE}
                    style={{ fontSize: rs(11), lineHeight: rs(16) }}
                    className="text-slate-500 text-center font-bold tracking-wide"
                  >
                    Best Teachers · Live Classes · Mock Tests · Notes
                  </Text>
                )}
              </View>

              <View>
                <FloatingLabelInput label="Email">
                  <TextInput
                    {...NO_SCALE}
                    style={{ fontSize: rs(16), padding: 0 }}
                    className="text-slate-900 font-semibold"
                    placeholder="you@example.com"
                    placeholderTextColor="#cbd5e1"
                    value={email}
                    onChangeText={(v) => {
                      setEmail(v);
                      setError(null);
                    }}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    returnKeyType="next"
                    editable={!pending}
                  />
                </FloatingLabelInput>

                <FloatingLabelInput label="Password">
                  <View className="flex-row items-center">
                    <TextInput
                      {...NO_SCALE}
                      style={{ fontSize: rs(16), padding: 0, flex: 1 }}
                      className="text-slate-900 font-semibold"
                      placeholder="••••••••••"
                      placeholderTextColor="#cbd5e1"
                      value={password}
                      onChangeText={(v) => {
                        setPassword(v);
                        setError(null);
                      }}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoComplete="current-password"
                      returnKeyType="done"
                      onSubmitEditing={handleSignIn}
                      editable={!pending}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword((v) => !v)}
                      disabled={pending}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={
                        showPassword ? "Hide password" : "Show password"
                      }
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      style={{ marginLeft: rs(10) }}
                    >
                      {showPassword ? (
                        <EyeOff size={rs(20)} color="#94a3b8" />
                      ) : (
                        <Eye size={rs(20)} color="#94a3b8" />
                      )}
                    </TouchableOpacity>
                  </View>
                </FloatingLabelInput>

                {error ? (
                  <Text
                    {...NO_SCALE}
                    style={{ fontSize: rs(12), marginTop: rs(10) }}
                    className="text-red-600 text-center"
                  >
                    {error}
                  </Text>
                ) : null}

                <View
                  style={{ marginTop: rs(10), alignSelf: "flex-end" }}
                >
                  <Link href="/forgot-password" asChild>
                    <TouchableOpacity disabled={pending}>
                      <Text
                        {...NO_SCALE}
                        style={{ fontSize: rs(12) }}
                        className="text-[#2563EB] font-semibold"
                      >
                        Forgot password?
                      </Text>
                    </TouchableOpacity>
                  </Link>
                </View>
              </View>

              <View style={{ marginTop: rs(isSmallDevice ? 14 : 20) }}>
                <TouchableOpacity
                  onPress={handleSignIn}
                  activeOpacity={0.85}
                  disabled={pending || !email.trim() || !password}
                  style={{
                    paddingVertical: rs(14),
                    borderRadius: rs(12),
                    marginBottom: rs(12),
                  }}
                  className={`w-full items-center justify-center shadow-sm ${
                    !pending && email.trim() && password
                      ? "bg-[#2563EB] shadow-blue-200"
                      : "bg-[#BFDBFE]"
                  }`}
                >
                  <Text
                    {...NO_SCALE}
                    style={{ fontSize: rs(17) }}
                    className="text-white font-bold tracking-wide"
                  >
                    {pending ? "Signing in…" : "Sign in"}
                  </Text>
                </TouchableOpacity>

                {!keyboardOpen && (
                  <Text
                    {...NO_SCALE}
                    style={{ fontSize: rs(11), lineHeight: rs(15) }}
                    className="text-center text-slate-500"
                  >
                    Admin-issued accounts only. Contact your institute if you don&apos;t have one.
                  </Text>
                )}
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
