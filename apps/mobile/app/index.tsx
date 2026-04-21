import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Phone } from 'lucide-react-native';
import { FyneStudyLogo } from '../components/FyneStudyLogo';

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
          <FyneStudyLogo containerClassName="w-full mt-4 mb-2" />

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
