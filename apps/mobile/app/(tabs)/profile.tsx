import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Settings, ChevronRight, User, CreditCard, Bell, ShieldQuestion, LogOut, Award, Target, Activity } from 'lucide-react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
        {/* Spacer for centering */}
        <View className="w-10 h-10" />
        <Text className="text-xl font-bold italic text-blue-900">My Profile</Text>
        <TouchableOpacity className="w-10 h-10 items-end justify-center">
          <Settings size={24} color="#1e3a8a" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Profile Info Card */}
        <View className="bg-white rounded-[32px] mx-6 mt-4 mb-6 p-6 shadow-sm shadow-slate-200/50 border border-slate-100 items-center relative">
          {/* Avatar */}
          <View className="w-24 h-24 rounded-full border-4 border-slate-50 mb-4 shadow-sm shadow-slate-200 bg-slate-200">
            <Image 
              source={{ uri: 'https://i.pravatar.cc/150?img=11' }} 
              className="w-full h-full rounded-full" 
            />
          </View>
          
          <Text className="text-2xl font-extrabold text-slate-900 mb-2">Alex Johnson</Text>
          
          <View className="bg-blue-50 px-3 py-1.5 rounded-full mb-4">
            <Text className="text-blue-700 text-xs font-bold tracking-wide">ID: COS-24-9021</Text>
          </View>
          
          <Text className="text-slate-500 text-sm font-medium text-center leading-5">
            alex.johnson@example.com{'\n'}JEE Advanced 2024 Batch
          </Text>
        </View>

        {/* Quick Stats Grid */}
        <View className="flex-row px-6 mb-8 justify-between">
          {/* Stat 1 */}
          <View className="bg-white flex-1 rounded-[24px] py-5 px-2 mr-3 items-center shadow-sm shadow-slate-200/50 border border-slate-100">
            <View className="w-10 h-10 bg-emerald-50 rounded-2xl items-center justify-center mb-3">
              <Target size={20} color="#10b981" />
            </View>
            <Text className="text-2xl font-extrabold text-slate-900 tracking-tight">92%</Text>
            <Text className="text-xs text-slate-500 font-semibold mt-1 text-center">Attendance</Text>
          </View>

          {/* Stat 2 */}
          <View className="bg-white flex-1 rounded-[24px] py-5 px-2 mr-3 items-center shadow-sm shadow-slate-200/50 border border-slate-100">
            <View className="w-10 h-10 bg-blue-50 rounded-2xl items-center justify-center mb-3">
              <Activity size={20} color="#3b82f6" />
            </View>
            <Text className="text-2xl font-extrabold text-slate-900 tracking-tight">84%</Text>
            <Text className="text-xs text-slate-500 font-semibold mt-1 text-center">Test Avg</Text>
          </View>

          {/* Stat 3 */}
          <View className="bg-white flex-1 rounded-[24px] py-5 px-2 items-center shadow-sm shadow-slate-200/50 border border-slate-100">
            <View className="w-10 h-10 bg-amber-50 rounded-2xl items-center justify-center mb-3">
              <Award size={20} color="#f59e0b" />
            </View>
            <Text className="text-2xl font-extrabold text-slate-900 tracking-tight">#12</Text>
            <Text className="text-xs text-slate-500 font-semibold mt-1 text-center">Batch Rank</Text>
          </View>
        </View>

        {/* Settings List */}
        <View className="px-6 mb-8">
          <Text className="text-lg font-bold text-slate-900 mb-4 px-2">Account Settings</Text>
          
          <View className="bg-white rounded-[28px] shadow-sm shadow-slate-200/50 border border-slate-100 overflow-hidden">
            {/* Item 1 */}
            <TouchableOpacity className="flex-row items-center p-4 border-b border-slate-50">
              <View className="w-12 h-12 bg-slate-50 rounded-2xl items-center justify-center mr-4">
                <User size={22} color="#475569" />
              </View>
              <View className="flex-1">
                <Text className="font-bold text-slate-800 text-base mb-0.5">Personal Information</Text>
                <Text className="text-slate-500 text-xs font-medium">Update your email, phone, and address</Text>
              </View>
              <ChevronRight size={20} color="#cbd5e1" />
            </TouchableOpacity>

            {/* Item 2 */}
            <TouchableOpacity className="flex-row items-center p-4 border-b border-slate-50">
              <View className="w-12 h-12 bg-blue-50 rounded-2xl items-center justify-center mr-4">
                <CreditCard size={22} color="#3b82f6" />
              </View>
              <View className="flex-1">
                <Text className="font-bold text-slate-800 text-base mb-0.5">Fees & Subscriptions</Text>
                <Text className="text-slate-500 text-xs font-medium">Manage your payment schedule</Text>
              </View>
              <ChevronRight size={20} color="#cbd5e1" />
            </TouchableOpacity>

            {/* Item 3 */}
            <TouchableOpacity className="flex-row items-center p-4 border-b border-slate-50">
              <View className="w-12 h-12 bg-amber-50 rounded-2xl items-center justify-center mr-4">
                <Bell size={22} color="#d97706" />
              </View>
              <View className="flex-1">
                <Text className="font-bold text-slate-800 text-base mb-0.5">Notifications</Text>
                <Text className="text-slate-500 text-xs font-medium">Configure alerts and reminders</Text>
              </View>
              <ChevronRight size={20} color="#cbd5e1" />
            </TouchableOpacity>

            {/* Item 4 */}
            <TouchableOpacity className="flex-row items-center p-4">
              <View className="w-12 h-12 bg-emerald-50 rounded-2xl items-center justify-center mr-4">
                <ShieldQuestion size={22} color="#10b981" />
              </View>
              <View className="flex-1">
                <Text className="font-bold text-slate-800 text-base mb-0.5">Help & Support</Text>
                <Text className="text-slate-500 text-xs font-medium">FAQs and contact information</Text>
              </View>
              <ChevronRight size={20} color="#cbd5e1" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Log Out */}
        <View className="px-6 mb-8">
          <TouchableOpacity className="bg-red-50 rounded-2xl py-4 flex-row items-center justify-center border border-red-100 shadow-sm shadow-red-100/50">
            <LogOut size={20} color="#ef4444" style={{ marginRight: 8 }} />
            <Text className="text-red-600 font-bold text-base">Sign Out</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
