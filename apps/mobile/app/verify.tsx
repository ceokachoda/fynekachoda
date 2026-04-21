import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ShieldCheck } from 'lucide-react-native';
import { FyneStudyLogo } from '../components/FyneStudyLogo';

export default function VerifyScreen() {
  const router = useRouter();
  const [otp, setOtp] = useState('');

  const handleVerify = () => {
    if (otp.length > 0) {
      router.push('/select-course');
    }
  };

  const isFormValid = otp.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
            <Image 
              source={{ uri: 'https://i.pravatar.cc/150?img=11' }} 
              className="w-10 h-10 rounded-full bg-slate-200" 
            />
            <FyneStudyLogo variant="header" />
            <View className="w-10 h-10" />
          </View>

          <View className="flex-1 px-6 justify-center pb-12 pt-8">
            <View className="mb-8">
              <Text className="text-4xl font-extrabold text-blue-800 tracking-tight mb-2">
                Check your phone.
              </Text>
              <Text className="text-base text-slate-500">
                We've sent a one-time password to your number.
              </Text>
            </View>

            <View className="bg-white rounded-[28px] p-6 shadow-sm shadow-slate-200/50 border border-slate-100 mb-8 items-center">
              <View className="w-16 h-16 bg-blue-50 rounded-2xl items-center justify-center mb-6">
                <ShieldCheck size={32} color="#2563eb" />
              </View>

              <View className="w-full">
                <Text className="text-sm font-bold text-blue-900 mb-2 ml-1 text-center">Enter 6-digit Code</Text>
                <View className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 mt-2">
                  <TextInput
                    className="w-full text-blue-900 text-3xl text-center tracking-[0.5em] font-extrabold"
                    placeholder="------"
                    placeholderTextColor="#cbd5e1"
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleVerify}
              className={`w-full py-4 rounded-2xl items-center justify-center shadow-sm ${
                isFormValid ? 'bg-blue-600 shadow-blue-200' : 'bg-slate-300'
              }`}
              disabled={!isFormValid}
            >
              <Text className="text-white font-bold text-lg">Verify Code</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => router.back()}
              className="mt-6 py-4 items-center border border-slate-200 rounded-2xl bg-white shadow-sm shadow-slate-100"
            >
              <Text className="text-blue-600 font-bold text-lg">Go Back</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
