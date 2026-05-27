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
import { changeOwnPassword, signOut } from "@/features/auth/auth";
import { makeNewPasswordSchema } from "@/features/auth/schemas";

export default function ForcePasswordChangeScreen() {
  const router = useRouter();
  const { user, appUser, refresh } = useSession();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isMandatory = appUser?.must_change_password ?? true;
  const title = isMandatory ? "Choose a new password" : "Change password";
  const subtitle = isMandatory
    ? "Your admin-issued temporary password must be changed before you can continue."
    : "Pick a new password to replace your current one.";
  const cta = pending
    ? "Saving…"
    : isMandatory
      ? "Save and continue"
      : "Save password";

  async function handleSubmit() {
    setError(null);

    if (password && confirm && password !== confirm) {
      setError("Passwords do not match.");
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
    const result = await changeOwnPassword(password);
    if (!result.ok) {
      setPending(false);
      setError(result.error);
      return;
    }
    await refresh();
    setPending(false);
    router.replace("/");
  }

  async function handleEscape() {
    if (isMandatory) {
      await signOut();
      router.replace("/login");
      return;
    }
    router.back();
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
            {title}
          </Text>
          <Text className="mt-2 text-sm text-slate-600">{subtitle}</Text>

          <View className="mt-8 space-y-4">
            <View>
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
              <Text className="mt-1 text-[11px] text-slate-500">
                At least 10 characters, including upper, lower, and a digit. No
                spaces. Cannot match your email.
              </Text>
            </View>

            <View className="mt-4">
              <Text className="text-xs font-semibold text-slate-700 mb-1">
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
            </View>

            {error ? (
              <View className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <Text className="text-sm text-red-700">{error}</Text>
              </View>
            ) : null}
          </View>

          <View className="mt-auto pb-6">
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={pending || !password || !confirm}
              activeOpacity={0.85}
              className={`h-12 items-center justify-center rounded-xl ${
                pending || !password || !confirm
                  ? "bg-[#BFDBFE]"
                  : "bg-[#2563EB]"
              }`}
            >
              <Text className="text-base font-bold text-white">{cta}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleEscape}
              disabled={pending}
              activeOpacity={0.7}
              className="mt-3 h-11 items-center justify-center"
            >
              <Text className="text-sm text-slate-500">
                {isMandatory ? "Sign out" : "Cancel"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
