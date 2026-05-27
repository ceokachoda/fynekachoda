import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "@/features/auth/useSession";
import { setPasswordAfterReset } from "@/features/auth/auth";
import { makeNewPasswordSchema } from "@/features/auth/schemas";

// Deep-link target: fynestudy://reset
// The session is set by Supabase's onAuthStateChange handler firing
// 'PASSWORD_RECOVERY' when the user opens the emailed link. If no session
// exists (user landed here without a valid link), we route back to login.

export default function ResetScreen() {
  const router = useRouter();
  const { session, user, refresh } = useSession();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit() {
    setError(null);

    if (!session) {
      setError(
        "This reset link is invalid or expired. Request a new one from the sign-in screen.",
      );
      return;
    }

    const schema = makeNewPasswordSchema(user?.email ?? null);
    const parsed = schema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid password.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setPending(true);
    const result = await setPasswordAfterReset(password);
    if (!result.ok) {
      setPending(false);
      setError(result.error);
      return;
    }
    await refresh();
    setPending(false);
    router.replace("/");
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* Inline style, NOT className: KeyboardAvoidingView is a class
          component, and css-interop's remapProps wrapper injects a fresh
          placeholder style object on every render, which loops its
          setState lifecycle ("Maximum update depth exceeded"). */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View className="flex-1 px-6 pt-10">
          <Text className="text-2xl font-extrabold text-slate-900">
            Set a new password
          </Text>
          <Text className="mt-2 text-sm text-slate-600">
            Pick something you&apos;ll remember.
          </Text>

          <View className="mt-8">
            <Text className="text-xs font-semibold text-slate-700 mb-1">
              New password
            </Text>
            <TextInput
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setError(null);
              }}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              editable={!pending}
              className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900"
            />

            <Text className="mt-4 text-xs font-semibold text-slate-700 mb-1">
              Confirm new password
            </Text>
            <TextInput
              value={confirm}
              onChangeText={(v) => {
                setConfirm(v);
                setError(null);
              }}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              editable={!pending}
              className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900"
            />

            {error ? (
              <View className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <Text className="text-sm text-red-700">{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={pending || !password || !confirm}
              activeOpacity={0.85}
              className={`mt-6 h-12 items-center justify-center rounded-xl ${
                pending || !password || !confirm
                  ? "bg-[#BFDBFE]"
                  : "bg-[#2563EB]"
              }`}
            >
              <Text className="text-base font-bold text-white">
                {pending ? "Saving…" : "Save and sign in"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
