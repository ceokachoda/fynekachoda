import { View, Text, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { ArrowLeft, MoreVertical, Eye, Maximize, MicOff, Hand, Pin, Plus, Send } from 'lucide-react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';

export default function LiveSessionScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View className="flex-row items-center justify-between px-2 pt-2 pb-3 bg-white">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <ArrowLeft size={24} color="#334155" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-blue-800">Live Session</Text>
        <TouchableOpacity className="p-2">
          <MoreVertical size={24} color="#334155" />
        </TouchableOpacity>
      </View>

      {/* Video Area Placeholder */}
      <View className="w-full aspect-video bg-slate-900 relative items-center justify-center">
        <ActivityIndicator size="large" color="#ffffff" />
        <Text className="text-white mt-3 font-semibold text-sm">Live will start soon...</Text>
        
        {/* Top Left Badges */}
        <View className="absolute top-4 left-4 flex-row items-center">
          <View className="bg-red-600 px-2 py-1 rounded flex-row items-center mr-2">
            <View className="w-1.5 h-1.5 bg-white rounded-full mr-1.5" />
            <Text className="text-white text-[10px] font-bold uppercase tracking-wider">Live</Text>
          </View>
          <View className="bg-black/50 px-2 py-1 rounded flex-row items-center">
            <Eye size={12} color="white" style={{ marginRight: 4 }} />
            <Text className="text-white text-[10px] font-bold">1.2k</Text>
          </View>
        </View>

        {/* Bottom Info */}
        <View className="absolute bottom-4 left-4">
          <Text className="text-white text-base font-bold">Advanced Mathematics</Text>
          <Text className="text-slate-300 text-xs mt-0.5">Dr. Emily Chen</Text>
        </View>

        {/* Fullscreen Button */}
        <TouchableOpacity className="absolute bottom-4 right-4 w-8 h-8 bg-black/50 rounded-lg items-center justify-center">
          <Maximize size={16} color="white" />
        </TouchableOpacity>
      </View>

      {/* Presenter Bar */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
        <View className="flex-row items-center flex-1">
          <Image source={{ uri: 'https://i.pravatar.cc/150?img=44' }} className="w-10 h-10 rounded-full bg-slate-200" />
          <View className="ml-3">
            <Text className="text-blue-800 font-bold text-sm">Dr. Emily Chen</Text>
            <Text className="text-slate-500 text-[11px] mt-0.5">Lead Instructor</Text>
          </View>
        </View>
        <View className="flex-row items-center">
          <TouchableOpacity className="w-10 h-10 border border-slate-200 rounded-full items-center justify-center mr-3">
            <MicOff size={20} color="#1e40af" />
          </TouchableOpacity>
          <TouchableOpacity className="bg-blue-800 flex-row items-center px-4 py-2.5 rounded-xl">
            <Hand size={16} color="white" style={{ marginRight: 6 }} />
            <Text className="text-white font-bold text-sm">Raise Hand</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat Area */}
      <ScrollView className="flex-1 bg-white px-4 pt-4" showsVerticalScrollIndicator={false}>
        {/* Pinned Message */}
        <View className="bg-blue-50/80 rounded-2xl p-4 mb-6 border border-blue-100">
          <View className="flex-row items-center mb-2">
            <Pin size={12} color="#1d4ed8" style={{ marginRight: 6 }} />
            <Text className="text-blue-800 text-[10px] font-bold tracking-widest uppercase">Pinned by Moderator</Text>
          </View>
          <Text className="text-blue-900 text-sm leading-5">
            Welcome! Please drop your questions regarding Chapter 4 integration below. We'll address them at the end.
          </Text>
        </View>

        {/* Chat Message 1 */}
        <View className="mb-5">
          <View className="flex-row items-center mb-1.5">
            <View className="w-7 h-7 bg-amber-100 rounded-full items-center justify-center mr-2">
              <Text className="text-amber-700 text-xs font-bold">JS</Text>
            </View>
            <Text className="text-blue-800 font-bold text-sm mr-2">James S.</Text>
            <Text className="text-slate-400 text-xs">10:14 AM</Text>
          </View>
          <View className="ml-9 bg-white border border-slate-100 shadow-sm shadow-slate-100/50 rounded-2xl rounded-tl-sm p-3.5">
            <Text className="text-slate-700 text-sm leading-5">
              Could you explain the substitution method again? I got lost on step 3.
            </Text>
          </View>
        </View>

        {/* Chat Message 2 */}
        <View className="mb-5">
          <View className="flex-row items-center mb-1.5">
            <Image source={{ uri: 'https://i.pravatar.cc/150?img=5' }} className="w-7 h-7 rounded-full bg-slate-200 mr-2" />
            <Text className="text-blue-800 font-bold text-sm mr-2">Sarah M.</Text>
            <Text className="text-slate-400 text-xs">10:15 AM</Text>
          </View>
          <View className="ml-9 bg-white border border-slate-100 shadow-sm shadow-slate-100/50 rounded-2xl rounded-tl-sm p-3.5">
            <Text className="text-slate-700 text-sm leading-5">
              Yes, same here! The transition from dx to du was a bit fast.
            </Text>
          </View>
        </View>

        {/* Chat Message 3 (Instructor) */}
        <View className="mb-5">
          <View className="flex-row items-center mb-1.5">
            <Image source={{ uri: 'https://i.pravatar.cc/150?img=44' }} className="w-7 h-7 rounded-full bg-slate-200 mr-2" />
            <Text className="text-emerald-600 font-bold text-sm mr-2">Dr. Emily Chen</Text>
            <View className="bg-emerald-600 px-1.5 py-0.5 rounded flex-row items-center justify-center mr-2">
              <Text className="text-white text-[9px] font-bold uppercase tracking-wider">Instructor</Text>
            </View>
            <Text className="text-slate-400 text-xs">10:17 AM</Text>
          </View>
          <View className="ml-9 bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-sm p-3.5">
            <Text className="text-slate-800 text-sm leading-5">
              I see those questions. I'll pause in 5 mins to review substitution with a simpler example!
            </Text>
          </View>
        </View>

        <View className="h-4" />
      </ScrollView>

      {/* Input Area */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-row items-center px-4 py-3 bg-slate-50 border-t border-slate-100">
          <TouchableOpacity className="w-8 h-8 bg-slate-600 rounded-full items-center justify-center mr-3">
            <Plus size={16} color="white" />
          </TouchableOpacity>
          <View className="flex-1 bg-white h-11 rounded-full border border-slate-200 flex-row items-center px-4 shadow-sm shadow-slate-100">
            <TextInput 
              placeholder="Type a message..." 
              placeholderTextColor="#94a3b8"
              className="flex-1 text-sm text-slate-800 h-full"
            />
          </View>
          <TouchableOpacity className="w-11 h-11 bg-blue-800 rounded-full items-center justify-center ml-3 shadow-sm shadow-blue-200">
            <Send size={18} color="white" style={{ marginLeft: -2 }} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
