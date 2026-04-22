import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { FyneStudyLogo } from '../components/FyneStudyLogo';
import { CheckCircle2, Circle } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Path, G, Rect, Circle as SvgCircle } from 'react-native-svg';

const { width } = Dimensions.get('window');

const CourseIllustration = () => (
  <View
    style={{
      position: 'absolute',
      top: -20,
      right: -20,
      width: width * 0.85,
      height: 280,
      opacity: 0.85,
    }}
    pointerEvents="none"
  >
    <Svg width="100%" height="100%" viewBox="0 0 400 400" preserveAspectRatio="xMaxYMin meet">
      {/* Abstract Blob Background */}
      <Path
        d="M280.5,50.5C340.5,70.5,390.5,120.5,410.5,180.5C430.5,240.5,380.5,310.5,320.5,340.5C260.5,370.5,180.5,340.5,130.5,290.5C80.5,240.5,60.5,160.5,80.5,100.5C100.5,40.5,180.5,10.5,240.5,20.5C254.5,23.5,268.5,36.5,280.5,50.5Z"
        fill="#DBEAFE"
        transform="translate(20, -30)"
      />
      
      {/* Floating Target/Goal Elements */}
      <G transform="translate(180, 80)">
        {/* Outer Target Circle */}
        <SvgCircle cx="100" cy="100" r="80" fill="#DBEAFE" />
        <SvgCircle cx="100" cy="100" r="50" fill="#BFDBFE" />
        <SvgCircle cx="100" cy="100" r="25" fill="#3B82F6" />
        
        {/* Arrow hitting target */}
        <G transform="translate(130, -20) rotate(45)">
          <Rect x="-5" y="40" width="10" height="80" fill="#1E293B" rx="5" />
          <Path d="M -15 40 L 0 15 L 15 40 Z" fill="#FBBF24" />
          {/* Feathers */}
          <Path d="M -15 100 L 0 80 L 15 100 Z" fill="#EF4444" />
          <Path d="M -15 110 L 0 90 L 15 110 Z" fill="#EF4444" />
        </G>
        
        {/* Floating Book */}
        <G transform="translate(-40, 140) rotate(-15)">
          <Path d="M 0 10 Q 20 0 40 10 L 40 50 Q 20 40 0 50 Z" fill="#60A5FA" />
          <Path d="M 40 10 Q 60 0 80 10 L 80 50 Q 60 40 40 50 Z" fill="#3B82F6" />
          <Path d="M 40 10 L 40 50" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" />
          <Path d="M 5 45 Q 20 35 38 45" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" fill="none" />
          <Path d="M 42 45 Q 60 35 75 45" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" fill="none" />
        </G>
        
        {/* Stars / Sparks */}
        <Path d="M -20 20 L -15 35 L 0 40 L -15 45 L -20 60 L -25 45 L -40 40 L -25 35 Z" fill="#FBBF24" />
        <Path d="M 180 160 L 183 168 L 190 170 L 183 172 L 180 180 L 177 172 L 170 170 L 177 168 Z" fill="#3B82F6" />
        <SvgCircle cx="220" cy="50" r="7" fill="#34D399" />
        <SvgCircle cx="-30" cy="120" r="6" fill="#F87171" />
      </G>
    </Svg>
  </View>
);

const COURSES = [
  { 
    id: '1', 
    title: 'JEE Main', 
    description: 'Engineering Entrance Test', 
    imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=200&auto=format&fit=crop',
  },
  { 
    id: '2', 
    title: 'JEE Advanced', 
    description: 'IIT Entrance Examination', 
    imageUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=200&auto=format&fit=crop',
  },
  { 
    id: '3', 
    title: 'NEET UG', 
    description: 'Medical Entrance Test', 
    imageUrl: 'https://images.unsplash.com/photo-1576091160399-11cbbe12ce75?q=80&w=200&auto=format&fit=crop',
  },
  { 
    id: '4', 
    title: 'CUET UG', 
    description: 'Central University Test', 
    imageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=200&auto=format&fit=crop',
  },
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
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <CourseIllustration />
        
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 pt-4 pb-2 z-10">
          <Image 
            source={{ uri: 'https://i.pravatar.cc/150?img=11' }} 
            className="w-10 h-10 rounded-full bg-slate-200" 
          />
          <FyneStudyLogo variant="header" />
          <View className="w-10 h-10" />
        </View>

        <View className="px-6 pt-10 pb-6 items-center z-10">
          <Animated.Text entering={FadeInDown.delay(100).duration(500)} className="text-[32px] leading-[36px] font-extrabold text-[#2563EB] tracking-tight mb-1 text-center">
            Your Goal.
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(200).duration(500)} className="text-base text-slate-900 font-extrabold text-center mb-1">
            Select the examination you are preparing
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(200).duration(500)} className="text-[13px] text-slate-500 font-semibold tracking-wide text-center px-4">
            for to personalize your experience.
          </Animated.Text>
        </View>

        <View className="px-6 mt-4">
          {COURSES.map((course, index) => {
            const isSelected = selectedCourse === course.id;
            
            return (
              <Animated.View 
                key={course.id} 
                entering={FadeInDown.delay(300 + index * 100).duration(500)}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setSelectedCourse(course.id)}
                  className={`w-full flex-row items-center p-4 mb-4 rounded-2xl border bg-white ${
                    isSelected ? 'border-[#2563EB] shadow-sm shadow-blue-100' : 'border-slate-200 shadow-sm shadow-slate-50'
                  }`}
                  style={isSelected ? { backgroundColor: '#F0F9FF' } : {}}
                >
                  <View className={`w-14 h-14 rounded-xl mr-4 items-center justify-center p-2 border ${
                    isSelected ? 'bg-white border-blue-100' : 'bg-slate-50 border-slate-100'
                  }`}>
                    <Image
                      source={{ uri: course.imageUrl }}
                      className="w-full h-full rounded-lg"
                      contentFit="cover"
                      transition={200}
                    />
                  </View>
                  
                  <View className="flex-1">
                    <Text className={`text-lg font-bold mb-0.5 ${
                      isSelected ? 'text-[#1E3A8A]' : 'text-slate-900'
                    }`}>
                      {course.title}
                    </Text>
                    <Text className="text-sm text-slate-500 font-medium">
                      {course.description}
                    </Text>
                  </View>

                  <View className="ml-3">
                    {isSelected ? (
                      <CheckCircle2 size={24} color="#2563EB" fill="#DBEAFE" />
                    ) : (
                      <Circle size={24} color="#CBD5E1" />
                    )}
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>

      {/* Solid Blue Button at Bottom */}
      <View className="absolute bottom-0 w-full pt-4 pb-8 px-6 bg-white border-t border-slate-100">
        <TouchableOpacity
          onPress={handleContinue}
          activeOpacity={0.85}
          disabled={!selectedCourse}
          className={`w-full py-4 rounded-xl items-center justify-center shadow-sm ${
            selectedCourse ? 'bg-[#2563EB] shadow-blue-200' : 'bg-[#BFDBFE]'
          }`}
        >
          <Text className={`text-[17px] font-bold tracking-wide ${selectedCourse ? 'text-white' : 'text-blue-500/50'}`}>
            Continue to Dashboard
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
