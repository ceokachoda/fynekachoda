import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Bell, QrCode, TrendingUp, Sigma, FlaskConical, FileText, Download, CircleDashed, User } from 'lucide-react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <ScrollView 
        className="flex-1" 
        contentContainerStyle={{ paddingBottom: 100 }} 
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
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

        {/* Greeting */}
        <View className="px-6 mt-4 mb-8">
          <Text className="text-3xl font-extrabold text-blue-800 tracking-tight">Good morning, Alex.</Text>
          <Text className="text-base text-slate-500 mt-2">You have 2 classes scheduled today.</Text>
        </View>

        {/* Today's Schedule */}
        <View className="mb-8">
          <View className="flex-row justify-between items-center px-6 mb-4">
            <Text className="text-xl font-bold text-blue-900">Today's Schedule</Text>
            <TouchableOpacity>
              <Text className="text-yellow-500 font-semibold">See all</Text>
            </TouchableOpacity>
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={{ paddingHorizontal: 24 }} 
            className="overflow-visible"
          >
            {/* Card 1 - Live Now */}
            <View className="bg-white rounded-[28px] p-5 mr-4 w-72 shadow-sm shadow-slate-200/50 border border-slate-100">
              <View className="flex-row justify-between items-start mb-4">
                <View className="bg-red-100 px-2 py-1 rounded-md flex-row items-center">
                  <View className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5" />
                  <Text className="text-red-600 text-xs font-bold">Live Now</Text>
                </View>
                <Text className="text-slate-500 text-sm font-medium">09:00 - 10:30 AM</Text>
              </View>
              <Text className="text-lg font-bold text-slate-900 mb-1">Advanced Calculus</Text>
              <View className="flex-row items-center mb-5">
                <User size={14} color="#64748b" style={{ marginRight: 4 }} />
                <Text className="text-slate-500 text-sm font-medium">Prof. Davis</Text>
              </View>
              <TouchableOpacity className="bg-blue-600 rounded-xl py-3 items-center">
                <Text className="text-white font-semibold text-base">Join Session</Text>
              </TouchableOpacity>
            </View>

            {/* Card 2 - Upcoming */}
            <View className="bg-white rounded-[28px] p-5 mr-4 w-72 shadow-sm shadow-slate-200/50 border border-slate-100">
              <View className="flex-row justify-between items-start mb-4">
                <View className="bg-slate-100 px-2 py-1 rounded-md flex-row items-center">
                  <Text className="text-slate-700 text-xs font-bold">Upcoming</Text>
                </View>
                <Text className="text-slate-500 text-sm font-medium">11:00 - 12:30 PM</Text>
              </View>
              <Text className="text-lg font-bold text-slate-900 mb-1">Physics 101</Text>
              <View className="flex-row items-center mb-5">
                <User size={14} color="#64748b" style={{ marginRight: 4 }} />
                <Text className="text-slate-500 text-sm font-medium">Dr. Rivers</Text>
              </View>
              <TouchableOpacity className="bg-white border border-green-200 rounded-xl py-3 items-center">
                <Text className="text-green-600 font-semibold text-base">View Details</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

        {/* Attendance Card */}
        <View className="px-6 mb-8">
          <View className="bg-white rounded-[28px] p-6 shadow-sm shadow-slate-200/50 border border-slate-100">
            <View className="flex-row justify-between items-start mb-6">
              <View>
                <Text className="text-lg font-bold text-blue-900">Attendance</Text>
                <Text className="text-slate-500 text-sm mt-0.5">Current Semester</Text>
              </View>
              <View className="w-10 h-10 bg-slate-50 rounded-2xl items-center justify-center">
                <CircleDashed size={20} color="#1e3a8a" />
              </View>
            </View>

            <View className="flex-row items-baseline mb-4">
              <Text className="text-5xl font-extrabold text-blue-800 tracking-tight">92%</Text>
              <View className="flex-row items-center ml-3">
                <TrendingUp size={14} color="#eab308" style={{ marginRight: 4 }} />
                <Text className="text-yellow-500 font-semibold text-sm">+2% this week</Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View className="h-2 bg-slate-100 rounded-full mb-6 flex-row overflow-hidden">
              <View className="h-full bg-blue-600 rounded-full" style={{ width: '92%' }} />
            </View>

            <TouchableOpacity className="bg-slate-50 rounded-xl py-3.5 flex-row items-center justify-center">
              <QrCode size={18} color="#1e3a8a" style={{ marginRight: 8 }} />
              <Text className="text-blue-900 font-semibold text-base">Show QR for Check-in</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Course Progress */}
        <View className="mb-8">
          <View className="flex-row justify-between items-center px-6 mb-4">
            <Text className="text-xl font-bold text-blue-900">Course Progress</Text>
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={{ paddingHorizontal: 24 }}
            className="overflow-visible"
          >
            {/* Progress Card 1 */}
            <View className="bg-white rounded-3xl p-5 mr-4 w-40 shadow-sm shadow-slate-200/50 border border-slate-100">
              <View className="w-10 h-10 bg-yellow-50 rounded-xl items-center justify-center mb-4">
                <Sigma size={20} color="#eab308" />
              </View>
              <Text className="font-bold text-slate-900 mb-1">Adv. Calculus</Text>
              <Text className="text-slate-500 text-[11px] mb-4">Module 4 of 12</Text>
              
              <Text className="text-blue-800 font-bold text-sm mb-2">35%</Text>
              <View className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex-row">
                <View className="h-full bg-yellow-400 rounded-full" style={{ width: '35%' }} />
              </View>
            </View>

            {/* Progress Card 2 */}
            <View className="bg-white rounded-3xl p-5 w-40 shadow-sm shadow-slate-200/50 border border-slate-100 mr-4">
              <View className="w-10 h-10 bg-green-50 rounded-xl items-center justify-center mb-4">
                <FlaskConical size={20} color="#22c55e" />
              </View>
              <Text className="font-bold text-slate-900 mb-1">Physics 101</Text>
              <Text className="text-slate-500 text-[11px] mb-4">Module 8 of 10</Text>
              
              <Text className="text-blue-800 font-bold text-sm mb-2">80%</Text>
              <View className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex-row">
                <View className="h-full bg-green-500 rounded-full" style={{ width: '80%' }} />
              </View>
            </View>
          </ScrollView>
        </View>

        {/* Recent Materials */}
        <View className="px-6 mb-8">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold text-blue-900">Recent Materials</Text>
            <TouchableOpacity>
              <Text className="text-yellow-500 font-semibold">See all</Text>
            </TouchableOpacity>
          </View>

          <View className="bg-white rounded-[28px] p-2 shadow-sm shadow-slate-200/50 border border-slate-100">
            {/* Material Item 1 */}
            <TouchableOpacity className="flex-row items-center p-3 border-b border-slate-50">
              <View className="w-12 h-12 bg-red-50 rounded-2xl items-center justify-center mr-4">
                <FileText size={22} color="#ef4444" />
              </View>
              <View className="flex-1">
                <Text className="font-bold text-slate-900 mb-0.5">Integration Formulas</Text>
                <Text className="text-slate-500 text-xs">Adv. Calculus • PDF • 2.4 MB</Text>
              </View>
              <TouchableOpacity className="w-8 h-8 items-center justify-center bg-slate-50 rounded-full">
                <Download size={16} color="#64748b" />
              </TouchableOpacity>
            </TouchableOpacity>

            {/* Material Item 2 */}
            <TouchableOpacity className="flex-row items-center p-3">
              <View className="w-12 h-12 bg-blue-50 rounded-2xl items-center justify-center mr-4">
                <FileText size={22} color="#3b82f6" />
              </View>
              <View className="flex-1">
                <Text className="font-bold text-slate-900 mb-0.5">Kinematics Practice</Text>
                <Text className="text-slate-500 text-xs">Physics 101 • PDF • 1.1 MB</Text>
              </View>
              <TouchableOpacity className="w-8 h-8 items-center justify-center bg-slate-50 rounded-full">
                <Download size={16} color="#64748b" />
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        </View>

        {/* Announcements */}
        <View className="px-6 mb-8">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold text-blue-900">Announcements</Text>
          </View>
          <View className="bg-white rounded-[28px] p-5 shadow-sm shadow-slate-200/50 border border-slate-100">
            <View className="flex-row items-start">
               <View className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 mr-3" />
               <View className="flex-1">
                 <Text className="font-bold text-slate-900 mb-1">Fee Reminder for Q2</Text>
                 <Text className="text-slate-500 text-sm leading-5">Please ensure your second quarter fees are paid by the 15th of this month to avoid interruption of services.</Text>
                 <Text className="text-slate-400 text-xs mt-3">2 hours ago</Text>
               </View>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

