import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Target, Rocket, Activity, BookOpen } from 'lucide-react-native';
import { FyneStudyLogo } from '../components/FyneStudyLogo';

const COURSES = [
  { id: '1', title: 'JEE Main', description: 'Joint Entrance Examination - Main', Icon: Target, color: '#3b82f6', bg: 'bg-blue-50' },
  { id: '2', title: 'JEE Advanced', description: 'IIT Joint Entrance Examination', Icon: Rocket, color: '#8b5cf6', bg: 'bg-violet-50' },
  { id: '3', title: 'NEET UG', description: 'National Eligibility cum Entrance Test', Icon: Activity, color: '#22c55e', bg: 'bg-green-50' },
  { id: '4', title: 'CUET UG', description: 'Common University Entrance Test', Icon: BookOpen, color: '#f97316', bg: 'bg-orange-50' },
];

export default function SelectCourseScreen() {
  const router = useRouter();
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);

  const handleContinue = () => {
    if (selectedCourse) {
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
        <Image 
          source={{ uri: 'https://i.pravatar.cc/150?img=11' }} 
          className="w-10 h-10 rounded-full bg-slate-200" 
        />
        <FyneStudyLogo variant="header" />
        <View className="w-10 h-10" />
      </View>

      <View className="flex-1 px-6 pt-8 pb-6">
        <View className="mb-8">
          <Text className="text-4xl font-extrabold text-blue-800 tracking-tight mb-2">
            Choose your course.
          </Text>
          <Text className="text-base text-slate-500">
            Select the course you'd like to study today.
          </Text>
        </View>

        <ScrollView className="flex-1 overflow-visible" showsVerticalScrollIndicator={false}>
          {COURSES.map((course) => {
            const isSelected = selectedCourse === course.id;
            const { Icon } = course;
            return (
              <TouchableOpacity
                key={course.id}
                activeOpacity={0.7}
                onPress={() => setSelectedCourse(course.id)}
                className={`w-full flex-row items-center p-5 mb-4 rounded-[28px] shadow-sm transition-all ${
                  isSelected 
                    ? 'border-2 border-blue-600 bg-blue-50/50 shadow-blue-200' 
                    : 'border border-slate-100 bg-white shadow-slate-200/50'
                }`}
              >
                <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${course.bg}`}>
                  <Icon size={24} color={course.color} />
                </View>
                <View className="flex-1">
                  <Text className={`text-lg font-bold mb-0.5 ${
                    isSelected ? 'text-blue-900' : 'text-slate-900'
                  }`}>
                    {course.title}
                  </Text>
                  <Text className="text-sm text-slate-500">
                    {course.description}
                  </Text>
                </View>
                <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                  isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                }`}>
                  {isSelected && <View className="w-2.5 h-2.5 rounded-full bg-white" />}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View className="pt-4 mt-2">
          <TouchableOpacity
            onPress={handleContinue}
            className={`w-full py-4 rounded-2xl items-center justify-center shadow-sm ${
              selectedCourse ? 'bg-blue-600 shadow-blue-200' : 'bg-slate-300'
            }`}
            disabled={!selectedCourse}
          >
            <Text className="text-white font-bold text-lg">Go to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
