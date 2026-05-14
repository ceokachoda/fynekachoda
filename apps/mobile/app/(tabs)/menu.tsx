import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  User, Bell, Shield, HelpCircle, FileText, 
  Moon, Globe, Smartphone, LogOut, ChevronRight
} from 'lucide-react-native';

const menuGroups = [
  {
    title: 'General',
    items: [
      { icon: User, label: 'Account Information', subLabel: 'Manage your profile details', color: '#3b82f6', bg: 'bg-blue-50' },
      { icon: Bell, label: 'Notifications', subLabel: 'Customize alerts and pushes', color: '#f59e0b', bg: 'bg-amber-50' },
      { icon: Globe, label: 'Language', subLabel: 'English (US)', color: '#0ea5e9', bg: 'bg-sky-50' },
      { icon: Moon, label: 'Display Theme', subLabel: 'Light Mode', color: '#6366f1', bg: 'bg-indigo-50' },
    ]
  },
  {
    title: 'Security',
    items: [
      { icon: Shield, label: 'Privacy Settings', subLabel: 'Manage data sharing', color: '#10b981', bg: 'bg-emerald-50' },
      { icon: Smartphone, label: 'Connected Devices', subLabel: '2 devices active', color: '#8b5cf6', bg: 'bg-violet-50' },
    ]
  },
  {
    title: 'About',
    items: [
      { icon: HelpCircle, label: 'Help & Support', color: '#f43f5e', bg: 'bg-rose-50' },
      { icon: FileText, label: 'Terms & Policies', color: '#64748b', bg: 'bg-slate-100' },
    ]
  }
];

export default function MenuScreen() {
  // Create an animated value for each group + 1 for the logout button
  const animatedValues = useRef(
    Array.from({ length: menuGroups.length + 1 }).map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    const animations = animatedValues.map((val) => 
      Animated.timing(val, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    );

    // Stagger the animations so they cascade smoothly
    Animated.stagger(100, animations).start();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Header */}
      <View className="px-6 pt-6 pb-4">
        <Text className="text-3xl font-extrabold text-slate-900 tracking-tight">Settings</Text>
      </View>

      <ScrollView 
        className="flex-1" 
        contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {menuGroups.map((group, groupIdx) => {
          const animVal = animatedValues[groupIdx]!;

          return (
            <Animated.View
              key={groupIdx}
              className="mb-8"
              style={{
                opacity: animVal,
                transform: [{
                  translateY: animVal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0]
                  })
                }]
              }}
            >
              <Text className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3 ml-2">
                {group.title}
              </Text>
              
              <View className="bg-white rounded-[28px] shadow-sm shadow-slate-200/50 border border-slate-100 overflow-hidden">
                {group.items.map((item, itemIdx) => {
                  const Icon = item.icon;
                  const isLast = itemIdx === group.items.length - 1;
                  return (
                    <TouchableOpacity 
                      key={itemIdx}
                      className={`flex-row items-center p-4 ${!isLast ? 'border-b border-slate-50' : ''}`}
                    >
                      <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${item.bg}`}>
                        <Icon size={22} color={item.color} />
                      </View>
                      <View className="flex-1 justify-center">
                        <Text className="font-bold text-slate-800 text-base">{item.label}</Text>
                        {'subLabel' in item && item.subLabel ? (
                          <Text className="text-slate-500 text-xs font-medium mt-0.5">{item.subLabel}</Text>
                        ) : null}
                      </View>
                      <ChevronRight size={20} color="#cbd5e1" />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          );
        })}

        {/* Log Out Button */}
        <Animated.View
          style={{
            opacity: animatedValues[menuGroups.length]!,
            transform: [{
              translateY: animatedValues[menuGroups.length]!.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0]
              })
            }]
          }}
        >
          <TouchableOpacity className="bg-white rounded-[28px] p-5 flex-row items-center justify-center border border-red-100 shadow-sm shadow-red-100/50 mb-8">
            <LogOut size={22} color="#ef4444" style={{ marginRight: 8 }} />
            <Text className="text-red-600 font-bold text-base">Log Out</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
