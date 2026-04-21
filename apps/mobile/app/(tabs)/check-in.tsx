import { View, Text, ScrollView, TouchableOpacity, Animated, Easing } from 'react-native';
import { Bell, MapPin, History, CheckCircle2, CalendarDays, Sigma, FlaskConical } from 'lucide-react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import QRCode from 'react-native-qrcode-svg';

export default function CheckInScreen() {
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [slideAnim]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Header (App Header) */}
      <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
        <Image 
          source={{ uri: 'https://i.pravatar.cc/150?img=11' }} 
          className="w-10 h-10 rounded-full bg-slate-200" 
        />
        <Text className="text-xl font-bold italic text-blue-900">Coaching OS</Text>
        <TouchableOpacity className="w-10 h-10 items-end justify-center">
          <Bell size={24} color="#1e3a8a" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        className="flex-1" 
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Title */}
        <View className="mt-4 mb-6 px-6 items-center">
          <Text className="text-3xl font-extrabold text-blue-600 tracking-tight">Check-in Pass</Text>
          <Text className="text-base text-slate-500 mt-1">Scan at the classroom entrance</Text>
        </View>

        {/* QR Code Card */}
        <View className="px-6 mb-8">
          <View className="bg-white rounded-[28px] p-8 items-center shadow-sm shadow-slate-200/50 border border-slate-100">
            {/* QR Area with blue brackets */}
            <View className="relative p-6 mb-6">
              {/* Brackets */}
              <View className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-blue-500 rounded-tl-xl" />
              <View className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-blue-500 rounded-tr-xl" />
              <View className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-blue-500 rounded-bl-xl" />
              <View className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-blue-500 rounded-br-xl" />
              
              <View className="bg-white p-2">
                <QRCode
                  value="https://coachingos.com/checkin/user123"
                  size={160}
                  color="#1e293b"
                  backgroundColor="transparent"
                />
              </View>

              {/* Scanning Glow Line */}
              <Animated.View 
                className="absolute left-0 right-0 h-[2px] bg-emerald-400 shadow-md shadow-emerald-400"
                style={{ 
                  top: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['10%', '90%']
                  }),
                  shadowColor: '#34d399',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.8,
                  shadowRadius: 8,
                  elevation: 5
                }} 
              />
            </View>

            <Text className="text-blue-600 uppercase text-[10px] font-bold tracking-widest mb-1">Pass Valid For</Text>
            <Text className="text-3xl font-extrabold text-blue-900 tracking-tight">04:59</Text>
          </View>
        </View>

        {/* Attendance Summary */}
        <View className="px-6 mb-8">
          <View className="bg-white rounded-[28px] p-6 shadow-sm shadow-slate-200/50 border border-slate-100">
            <Text className="text-lg font-bold text-slate-900 mb-6">Attendance Summary</Text>
            
            <View className="flex-row justify-between mb-8">
              <View className="flex-1">
                <Text className="text-sm text-slate-500 mb-1 font-medium">Current Streak</Text>
                <View className="flex-row items-baseline">
                  <Text className="text-4xl font-extrabold text-blue-600 tracking-tight">14</Text>
                  <Text className="text-sm text-slate-500 ml-1.5 font-medium">days</Text>
                </View>
              </View>
              <View className="flex-1 pl-4 border-l border-slate-100">
                <Text className="text-sm text-slate-500 mb-1 font-medium">Attendance Rate</Text>
                <View className="flex-row items-baseline">
                  <Text className="text-4xl font-extrabold text-blue-600 tracking-tight">98</Text>
                  <Text className="text-xl font-bold text-blue-600 ml-0.5">%</Text>
                </View>
              </View>
            </View>

            <View className="bg-slate-50 p-4 rounded-2xl">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm font-semibold text-slate-700">Classes Attended</Text>
                <Text className="text-sm font-bold text-slate-900">42 <Text className="text-slate-400 font-medium">/ 43</Text></Text>
              </View>
              <View className="h-2.5 bg-slate-200 rounded-full overflow-hidden flex-row">
                <View className="h-full bg-blue-700 rounded-full" style={{ width: '97.6%' }} />
              </View>
            </View>
          </View>
        </View>

        {/* Upcoming Classes for Check-in */}
        <View className="mb-8">
          <View className="flex-row items-center px-6 mb-4">
            <CalendarDays size={22} color="#2563eb" style={{ marginRight: 8 }} />
            <Text className="text-xl font-bold text-slate-900">Upcoming Classes for Check-in</Text>
          </View>

          {/* Active Card */}
          <View className="bg-white rounded-[28px] p-5 mx-6 mb-4 shadow-sm shadow-slate-200/50 border-l-[6px] border-l-blue-600">
            <View className="flex-row mb-4">
              <View className="w-12 h-12 bg-blue-50 rounded-2xl items-center justify-center mr-4">
                <Sigma size={24} color="#2563eb" />
              </View>
              <View className="flex-1 justify-center">
                <Text className="font-bold text-lg text-slate-900 mb-1">Advanced Calculus</Text>
                <View className="flex-row items-center">
                  <MapPin size={12} color="#64748b" style={{ marginRight: 4 }} />
                  <Text className="text-sm text-slate-500">Room 304, Science Wing</Text>
                </View>
              </View>
            </View>
            <View className="flex-row items-center justify-between mt-2 pl-16">
              <Text className="font-bold text-slate-900">9:00 AM</Text>
              <View className="bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                <Text className="text-indigo-600 font-semibold text-xs">Check-in Open</Text>
              </View>
            </View>
          </View>

          {/* Inactive Card */}
          <View className="bg-white rounded-[28px] p-5 mx-6 shadow-sm shadow-slate-200/50 border border-slate-100">
            <View className="flex-row mb-4">
              <View className="w-12 h-12 bg-slate-100 rounded-2xl items-center justify-center mr-4">
                <FlaskConical size={24} color="#64748b" />
              </View>
              <View className="flex-1 justify-center">
                <Text className="font-bold text-lg text-slate-900 mb-1">Physics 101</Text>
                <View className="flex-row items-center">
                  <MapPin size={12} color="#64748b" style={{ marginRight: 4 }} />
                  <Text className="text-sm text-slate-500">Lab 2, Engineering Bldg</Text>
                </View>
              </View>
            </View>
            <View className="flex-row items-center justify-between mt-2 pl-16">
              <Text className="font-bold text-slate-900">11:30 AM</Text>
              <Text className="text-slate-500 text-sm font-medium">Opens in 2h</Text>
            </View>
          </View>
        </View>

        {/* Recent Attendance History */}
        <View className="mb-6">
          <View className="flex-row items-center px-6 mb-4">
            <History size={22} color="#475569" style={{ marginRight: 8 }} />
            <Text className="text-xl font-bold text-slate-900">Recent Attendance History</Text>
          </View>

          <View className="bg-white rounded-[28px] p-6 mx-6 shadow-sm shadow-slate-200/50 border border-slate-100">
            {/* Timeline Item 1 */}
            <View className="flex-row mb-6 relative">
              <View className="items-center mr-4">
                <View className="bg-white rounded-full z-10 relative">
                  <CheckCircle2 size={24} color="#0891b2" />
                </View>
                <View className="absolute top-6 bottom-[-30px] w-px bg-slate-200" />
              </View>
              <View className="flex-1 flex-row justify-between pt-0.5">
                <View>
                  <Text className="font-bold text-slate-900 mb-1">European History</Text>
                  <Text className="text-xs text-slate-500 font-medium">Today</Text>
                </View>
                <View className="items-end">
                  <Text className="text-xs font-semibold text-cyan-600 mb-1">Verified</Text>
                  <Text className="text-xs text-slate-400">08:55 AM</Text>
                </View>
              </View>
            </View>

            {/* Timeline Item 2 */}
            <View className="flex-row mb-6 relative">
              <View className="items-center mr-4">
                <View className="bg-white rounded-full z-10 relative">
                  <CheckCircle2 size={24} color="#0891b2" />
                </View>
                <View className="absolute top-6 bottom-[-30px] w-px bg-slate-200" />
              </View>
              <View className="flex-1 flex-row justify-between pt-0.5">
                <View>
                  <Text className="font-bold text-slate-900 mb-1">Creative Writing Workshop</Text>
                  <Text className="text-xs text-slate-500 font-medium">Yesterday</Text>
                </View>
                <View className="items-end">
                  <Text className="text-xs font-semibold text-cyan-600 mb-1">Verified</Text>
                  <Text className="text-xs text-slate-400">02:14 PM</Text>
                </View>
              </View>
            </View>

            {/* Timeline Item 3 */}
            <View className="flex-row mb-2 relative">
              <View className="items-center mr-4">
                <View className="bg-white rounded-full z-10 relative">
                  <CheckCircle2 size={24} color="#0891b2" />
                </View>
              </View>
              <View className="flex-1 flex-row justify-between pt-0.5">
                <View>
                  <Text className="font-bold text-slate-900 mb-1">Macroeconomics</Text>
                  <Text className="text-xs text-slate-500 font-medium">Yesterday</Text>
                </View>
                <View className="items-end">
                  <Text className="text-xs font-semibold text-cyan-600 mb-1">Verified</Text>
                  <Text className="text-xs text-slate-400">10:02 AM</Text>
                </View>
              </View>
            </View>

            {/* Button */}
            <TouchableOpacity className="bg-slate-50 rounded-2xl py-3.5 mt-6 items-center justify-center border border-slate-100">
              <Text className="text-blue-700 font-semibold text-sm">View Full History</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
