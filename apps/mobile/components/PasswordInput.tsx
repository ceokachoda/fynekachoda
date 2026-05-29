import { useState } from "react";
import {
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from "react-native";
import { Eye, EyeOff } from "lucide-react-native";

// Bordered password field with a show/hide eye toggle. Matches the existing
// h-12 rounded-xl inputs on the force-password-change + reset screens. The
// caller passes behaviour props (value, onChangeText, placeholder, editable…);
// secureTextEntry is owned internally and toggled by the eye button.
export function PasswordInput({
  editable = true,
  ...props
}: Omit<TextInputProps, "secureTextEntry">) {
  const [visible, setVisible] = useState(false);

  return (
    <View className="relative">
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
        editable={editable}
        secureTextEntry={!visible}
        className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-3 pr-12 text-base text-slate-900"
      />
      <TouchableOpacity
        onPress={() => setVisible((v) => !v)}
        disabled={!editable}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Hide password" : "Show password"}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        className="absolute right-0 top-0 h-12 w-12 items-center justify-center"
      >
        {visible ? (
          <EyeOff size={20} color="#64748b" />
        ) : (
          <Eye size={20} color="#64748b" />
        )}
      </TouchableOpacity>
    </View>
  );
}
