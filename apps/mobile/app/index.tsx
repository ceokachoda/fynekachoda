import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Phone } from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Stop, Path, Rect } from 'react-native-svg';

const FyneStudyLogo = () => (
  <View className="flex-row items-center justify-center w-full mt-4 mb-2">
    <Svg width="46" height="46" viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#2563eb" />
          <Stop offset="100%" stopColor="#1e3a8a" />
        </LinearGradient>
      </Defs>
      <Path 
        d="M 50 5 C 85 5 95 15 95 50 C 95 85 85 95 50 95 C 15 95 5 85 5 50 C 5 15 15 5 50 5 Z" 
        fill="url(#grad)" 
      />
      <Rect x="50" y="34" width="24" height="12" rx="2.5" fill="white" />
      <Rect x="28" y="50" width="26" height="12" rx="2.5" fill="white" />
      <Rect x="28" y="66" width="12" height="12" rx="2.5" fill="white" />
    </Svg>
    <Text className="text-[32px] font-bold ml-3 text-black tracking-tighter" style={{ fontFamily: 'System' }}>
      fynestudy
    </Text>
  </View>
);

export default function LoginScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const handleLogin = () => {
    if (name.trim() && phone.trim()) {
      router.push('/verify');
    }
  };

  const isFormValid = name.trim() && phone.trim();

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <FyneStudyLogo />

          <View className="flex-1 px-6 justify-center pb-12 pt-8">
            <View className="mb-8">
              <Text className="text-4xl font-extrabold text-blue-800 tracking-tight mb-2">
                Welcome back.
              </Text>
              <Text className="text-base text-slate-500">
                Sign in to continue your learning journey.
              </Text>
            </View>

            <View className="bg-white rounded-[28px] p-6 shadow-sm shadow-slate-200/50 border border-slate-100 mb-8">
              <View className="mb-5">
                <Text className="text-sm font-bold text-blue-900 mb-2 ml-1">Full Name</Text>
                <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5">
                  <User size={20} color="#64748b" style={{ marginRight: 12 }} />
                  <TextInput
                    className="flex-1 text-slate-900 text-base font-medium"
                    placeholder="E.g. Alex Rivers"
                    placeholderTextColor="#94a3b8"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <View>
                <Text className="text-sm font-bold text-blue-900 mb-2 ml-1">Phone Number</Text>
                <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5">
                  <Phone size={20} color="#64748b" style={{ marginRight: 12 }} />
                  <TextInput
                    className="flex-1 text-slate-900 text-base font-medium"
                    placeholder="+1 (555) 000-0000"
                    placeholderTextColor="#94a3b8"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleLogin}
              className={`w-full py-4 rounded-2xl items-center justify-center shadow-sm ${
                isFormValid ? 'bg-blue-600 shadow-blue-200' : 'bg-slate-300'
              }`}
              disabled={!isFormValid}
            >
              <Text className="text-white font-bold text-lg">Continue</Text>
            </TouchableOpacity>

            <View className="mt-8 px-4">
              <Text className="text-center text-sm text-slate-500 leading-relaxed">
                By continuing, you agree to our{' '}
                <Text className="font-semibold text-blue-600">Terms of Service</Text>
                {' '}and{' '}
                <Text className="font-semibold text-blue-600">Privacy Policy</Text>.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
