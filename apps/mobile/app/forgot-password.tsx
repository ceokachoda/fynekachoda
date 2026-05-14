import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { requestPasswordReset } from "@/features/auth/auth";
import { EmailSchema } from "@/features/auth/schemas";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    setError(null);
    const parsed = EmailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid email.");
      return;
    }
    setPending(true);
    const result = await requestPasswordReset(parsed.data);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 px-6 pt-10">
          <Text className="text-2xl font-extrabold text-slate-900">
            Reset password
          </Text>
          <Text className="mt-2 text-sm text-slate-600">
            We&apos;ll send a one-time reset link to your registered email.
          </Text>

          {done ? (
            <View className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <Text className="text-sm text-emerald-800">
                Check your inbox at <Text className="font-semibold">{email}</Text>.
                The link expires in 1 hour.
              </Text>
            </View>
          ) : (
            <View className="mt-8">
              <Text className="text-xs font-semibold text-slate-700 mb-1">
                Email
              </Text>
              <TextInput
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setError(null);
                }}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                editable={!pending}
                className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900"
              />
              {error ? (
                <Text className="mt-2 text-sm text-red-600">{error}</Text>
              ) : null}
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={pending || !email.trim()}
                activeOpacity={0.85}
                className={`mt-6 h-12 items-center justify-center rounded-xl ${
                  pending || !email.trim() ? "bg-[#BFDBFE]" : "bg-[#2563EB]"
                }`}
              >
                <Text className="text-base font-bold text-white">
                  {pending ? "Sending…" : "Send reset link"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View className="mt-auto pb-6">
            <Link href="/login" replace>
              <Text className="text-center text-sm text-[#2563EB] font-semibold">
                ← Back to sign in
              </Text>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
