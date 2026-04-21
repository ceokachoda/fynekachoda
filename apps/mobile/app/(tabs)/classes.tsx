import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Bell, User, PlayCircle, Calendar, Clock, Video } from 'lucide-react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { router } from 'expo-router';

export default function ClassesScreen() {
  const [activeTab, setActiveTab] = useState<'live' | 'upcoming' | 'recorded'>('upcoming');

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
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

      <ScrollView 
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Title Section */}
        <View className="px-6 mt-4 mb-6">
          <Text className="text-3xl font-extrabold text-blue-800 tracking-tight mb-2">My Classes</Text>
          <Text className="text-sm text-slate-500 leading-5">
            Manage your daily schedule and jump into live or recorded sessions.
          </Text>
        </View>

        {/* Segmented Control */}
        <View className="px-6 mb-8">
          <View className="bg-slate-200/70 p-1.5 rounded-2xl flex-row">
            {(['live', 'upcoming', 'recorded'] as const).map((tab) => {
              const isActive = activeTab === tab;
              const label = tab === 'live' ? 'Live Now' : tab === 'upcoming' ? 'Upcoming' : 'Recorded';
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  className="flex-1 py-2.5 rounded-xl items-center justify-center"
                  style={
                    isActive
                      ? {
                          backgroundColor: '#FFFFFF',
                          shadowColor: '#CBD5E1',
                          shadowOpacity: 0.6,
                          shadowRadius: 2,
                          shadowOffset: { width: 0, height: 1 },
                          elevation: 1,
                        }
                      : undefined
                  }
                >
                  <Text
                    className="font-bold text-sm"
                    style={{ color: isActive ? '#1D4ED8' : '#64748B' }}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Content based on tab */}
        <View className="px-6">
          
          {activeTab === 'live' && (
            <View>
              {/* Live Class Card */}
              <View className="bg-white rounded-[28px] p-5 mb-4 shadow-sm shadow-slate-200/50 border border-slate-100">
                <View className="flex-row justify-between items-start mb-4">
                  <View className="bg-red-100 px-2.5 py-1.5 rounded-lg flex-row items-center">
                    <View className="w-2 h-2 bg-red-500 rounded-full mr-1.5" />
                    <Text className="text-red-600 text-xs font-bold uppercase tracking-wider">Live Now</Text>
                  </View>
                  <Text className="text-slate-500 text-sm font-medium">09:00 - 10:30 AM</Text>
                </View>
                <Text className="text-xl font-bold text-slate-900 mb-1">Advanced Calculus: Integration</Text>
                <Text className="text-slate-500 text-sm mb-5 leading-5">JEE Advanced Batch • Module 4</Text>
                
                <View className="flex-row items-center mb-5">
                  <Image source={{ uri: 'https://i.pravatar.cc/150?img=68' }} className="w-8 h-8 rounded-full mr-2 bg-slate-200" />
                  <Text className="text-slate-700 text-sm font-medium">Dr. H.C. Verma</Text>
                </View>
                
                <TouchableOpacity 
                  className="bg-blue-600 rounded-xl py-3.5 flex-row items-center justify-center"
                  onPress={() => router.push('/live-session')}
                >
                  <Video size={18} color="white" style={{ marginRight: 8 }} />
                  <Text className="text-white font-bold text-base">Join Live Session</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {activeTab === 'upcoming' && (
            <View>
              {/* Upcoming Class Card 1 */}
              <View className="bg-white rounded-[28px] p-5 mb-4 shadow-sm shadow-slate-200/50 border border-slate-100">
                <View className="flex-row justify-between items-start mb-4">
                  <View className="bg-slate-100 px-2.5 py-1.5 rounded-lg flex-row items-center">
                    <Calendar size={12} color="#475569" style={{ marginRight: 6 }} />
                    <Text className="text-slate-700 text-xs font-bold uppercase tracking-wider">Today</Text>
                  </View>
                  <Text className="text-slate-500 text-sm font-medium">11:00 - 12:30 PM</Text>
                </View>
                <Text className="text-xl font-bold text-slate-900 mb-1">Physics 101: Kinematics</Text>
                <Text className="text-slate-500 text-sm mb-5 leading-5">NEET UG Batch • Module 2</Text>
                
                <View className="flex-row items-center mb-5 justify-between">
                  <View className="flex-row items-center">
                    <Image source={{ uri: 'https://i.pravatar.cc/150?img=32' }} className="w-8 h-8 rounded-full mr-2 bg-slate-200" />
                    <Text className="text-slate-700 text-sm font-medium">Dr. Rivers</Text>
                  </View>
                  <View className="bg-orange-50 px-3 py-1 rounded-full border border-orange-100">
                    <Text className="text-orange-600 text-xs font-bold">Starts in 45m</Text>
                  </View>
                </View>
                
                <TouchableOpacity className="bg-slate-50 border border-slate-200 rounded-xl py-3.5 items-center">
                  <Text className="text-slate-600 font-bold text-base">View Details</Text>
                </TouchableOpacity>
              </View>

              {/* Upcoming Class Card 2 */}
              <View className="bg-white rounded-[28px] p-5 mb-4 shadow-sm shadow-slate-200/50 border border-slate-100">
                <View className="flex-row justify-between items-start mb-4">
                  <View className="bg-slate-100 px-2.5 py-1.5 rounded-lg flex-row items-center">
                    <Calendar size={12} color="#475569" style={{ marginRight: 6 }} />
                    <Text className="text-slate-700 text-xs font-bold uppercase tracking-wider">Tomorrow</Text>
                  </View>
                  <Text className="text-slate-500 text-sm font-medium">02:00 - 04:00 PM</Text>
                </View>
                <Text className="text-xl font-bold text-slate-900 mb-1">Organic Chemistry: Basics</Text>
                <Text className="text-slate-500 text-sm mb-5 leading-5">CBSE 12th Batch • Module 1</Text>
                
                <View className="flex-row items-center mb-5">
                  <Image source={{ uri: 'https://i.pravatar.cc/150?img=45' }} className="w-8 h-8 rounded-full mr-2 bg-slate-200" />
                  <Text className="text-slate-700 text-sm font-medium">Prof. Sharma</Text>
                </View>
                
                <TouchableOpacity className="bg-slate-50 border border-slate-200 rounded-xl py-3.5 items-center">
                  <Text className="text-slate-600 font-bold text-base">View Details</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {activeTab === 'recorded' && (
            <View>
              {/* Recorded Class Card 1 */}
              <View className="bg-white rounded-[28px] p-4 mb-4 shadow-sm shadow-slate-200/50 border border-slate-100 flex-row items-center">
                <View className="w-24 h-24 rounded-2xl overflow-hidden relative">
                  <Image 
                    source={{ uri: 'https://images.unsplash.com/photo-1632559646095-fc7c08287e07?q=80&w=300&auto=format&fit=crop' }} 
                    className="w-full h-full"
                    contentFit="cover"
                  />
                  <View className="absolute inset-0 bg-black/20 items-center justify-center">
                    <PlayCircle size={24} color="white" opacity={0.9} />
                  </View>
                </View>
                <View className="flex-1 ml-4 justify-center">
                  <Text className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">JEE Advanced</Text>
                  <Text className="font-bold text-slate-900 mb-1 leading-tight text-base">Rotational Mechanics</Text>
                  <View className="flex-row items-center mt-1">
                    <Clock size={12} color="#64748b" style={{ marginRight: 4 }} />
                    <Text className="text-xs text-slate-500 font-medium">1h 45m • Oct 24</Text>
                  </View>
                </View>
              </View>

              {/* Recorded Class Card 2 */}
              <View className="bg-white rounded-[28px] p-4 mb-4 shadow-sm shadow-slate-200/50 border border-slate-100 flex-row items-center">
                <View className="w-24 h-24 rounded-2xl overflow-hidden relative">
                  <Image 
                    source={{ uri: 'https://images.unsplash.com/photo-1603126857599-f6e15782ffa5?q=80&w=300&auto=format&fit=crop' }} 
                    className="w-full h-full"
                    contentFit="cover"
                  />
                  <View className="absolute inset-0 bg-black/20 items-center justify-center">
                    <PlayCircle size={24} color="white" opacity={0.9} />
                  </View>
                  {/* Progress bar overlay */}
                  <View className="absolute bottom-0 left-0 right-0 h-1 bg-white/40">
                    <View className="h-full bg-blue-500" style={{ width: '40%' }} />
                  </View>
                </View>
                <View className="flex-1 ml-4 justify-center">
                  <Text className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">NEET UG</Text>
                  <Text className="font-bold text-slate-900 mb-1 leading-tight text-base">Reaction Mechanisms</Text>
                  <View className="flex-row items-center mt-1">
                    <Clock size={12} color="#64748b" style={{ marginRight: 4 }} />
                    <Text className="text-xs text-slate-500 font-medium">55m left • Oct 20</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
