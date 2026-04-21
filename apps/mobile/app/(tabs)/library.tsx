import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Bell, Search, Play, Download, ClipboardList, ArrowRight, PlayCircle, Video, FileText, CheckSquare } from 'lucide-react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FyneStudyLogo } from '../../components/FyneStudyLogo';

export default function LibraryScreen() {
  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
        <Image 
          source={{ uri: 'https://i.pravatar.cc/150?img=11' }} 
          className="w-10 h-10 rounded-full bg-slate-200" 
        />
        <FyneStudyLogo variant="header" />
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
          <Text className="text-3xl font-extrabold text-blue-800 tracking-tight mb-2">Content Library</Text>
          <Text className="text-sm text-slate-500 leading-5">
            Access your recorded sessions, study materials, and assignments to accelerate your progress.
          </Text>
        </View>

        {/* Search Bar */}
        <View className="px-6 mb-6">
          <View className="flex-row items-center bg-white h-12 px-4 rounded-2xl shadow-sm shadow-slate-200/50 border border-slate-100">
            <Search size={20} color="#94a3b8" />
            <TextInput 
              placeholder="Search library..." 
              className="flex-1 ml-3 text-base text-slate-800"
              placeholderTextColor="#94a3b8"
            />
          </View>
        </View>

        {/* Exam Categories (Filter Tabs) */}
        <View className="mb-6">
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={{ paddingHorizontal: 24 }}
            className="overflow-visible"
          >
            <TouchableOpacity className="bg-blue-500 px-5 py-2.5 rounded-full mr-3 shadow-sm shadow-blue-200">
              <Text className="text-white font-semibold">All Materials</Text>
            </TouchableOpacity>
            <TouchableOpacity className="bg-white px-5 py-2.5 rounded-full mr-3 shadow-sm shadow-slate-200/50 border border-slate-100">
              <Text className="text-slate-600 font-semibold">JEE Advanced</Text>
            </TouchableOpacity>
            <TouchableOpacity className="bg-white px-5 py-2.5 rounded-full mr-3 shadow-sm shadow-slate-200/50 border border-slate-100">
              <Text className="text-slate-600 font-semibold">JEE Mains</Text>
            </TouchableOpacity>
            <TouchableOpacity className="bg-white px-5 py-2.5 rounded-full mr-3 shadow-sm shadow-slate-200/50 border border-slate-100">
              <Text className="text-slate-600 font-semibold">NEET UG</Text>
            </TouchableOpacity>
            <TouchableOpacity className="bg-white px-5 py-2.5 rounded-full mr-3 shadow-sm shadow-slate-200/50 border border-slate-100">
              <Text className="text-slate-600 font-semibold">CBSE Boards</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Content Cards */}
        {/* Card 1: JEE Advanced - Recorded Class */}
        <View className="bg-white rounded-[28px] mx-6 mb-6 p-4 shadow-sm shadow-slate-200/50 border border-slate-100">
          <View className="w-full h-40 rounded-2xl overflow-hidden mb-4 relative">
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1632559646095-fc7c08287e07?q=80&w=600&auto=format&fit=crop' }} 
              className="w-full h-full"
              contentFit="cover"
            />
            <View className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg flex-row items-center">
              <Video size={12} color="#eab308" style={{ marginRight: 6 }} />
              <Text className="text-slate-900 text-xs font-bold">Recorded</Text>
            </View>
          </View>

          <View className="flex-row items-center mb-2">
            <Text className="text-yellow-500 text-[10px] font-bold tracking-widest uppercase mr-2">JEE ADVANCED</Text>
            <Text className="text-slate-300 text-[10px]">•</Text>
            <Text className="text-slate-500 text-[10px] font-medium ml-2">Oct 24, 2023</Text>
          </View>

          <Text className="text-xl font-bold text-blue-900 mb-2 leading-tight">Rotational Mechanics: Rolling Friction</Text>
          
          <Text className="text-sm text-slate-500 mb-4 leading-5">
            A deep dive into advanced problem-solving techniques for rolling motion and friction on inclined planes.
          </Text>

          <View className="flex-row items-center justify-between mt-2">
            <View className="flex-row items-center">
              <Image 
                source={{ uri: 'https://i.pravatar.cc/150?img=68' }} 
                className="w-7 h-7 rounded-full bg-slate-200 mr-2" 
              />
              <Text className="text-slate-700 text-xs font-medium">Dr. H.C. Verma</Text>
            </View>
            <TouchableOpacity className="w-8 h-8 bg-blue-50 rounded-full items-center justify-center">
              <Play size={14} color="#2563eb" style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Card 2: NEET UG - PDF Notes */}
        <View className="bg-white rounded-[28px] mx-6 mb-6 p-4 shadow-sm shadow-slate-200/50 border border-slate-100">
          <View className="w-full h-40 bg-slate-900 rounded-2xl overflow-hidden mb-4 relative items-center justify-center">
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1603126857599-f6e15782ffa5?q=80&w=600&auto=format&fit=crop' }} 
              className="w-full h-full opacity-60"
              contentFit="cover"
            />
            <View className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg flex-row items-center">
              <FileText size={12} color="#10b981" style={{ marginRight: 6 }} />
              <Text className="text-slate-900 text-xs font-bold">PDF Notes</Text>
            </View>
          </View>

          <View className="flex-row items-center mb-2">
            <Text className="text-slate-500 text-[10px] font-bold tracking-widest uppercase mr-2">NEET UG</Text>
            <Text className="text-slate-300 text-[10px]">•</Text>
            <Text className="text-slate-500 text-[10px] font-medium ml-2">Oct 20, 2023</Text>
          </View>

          <Text className="text-xl font-bold text-blue-900 mb-2 leading-tight">Organic Chemistry: Reaction Mechanisms</Text>
          
          <Text className="text-sm text-slate-500 mb-4 leading-5">
            Comprehensive slides detailing the electrophilic and nucleophilic substitution reactions.
          </Text>

          <View className="flex-row items-center justify-between mt-2 pt-4 border-t border-slate-50">
            <Text className="text-slate-400 text-xs font-medium">4.2 MB</Text>
            <TouchableOpacity className="flex-row items-center">
              <Text className="text-yellow-500 text-sm font-bold mr-1">Download</Text>
              <Download size={14} color="#eab308" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Card 3: JEE Mains - Assignment */}
        <View className="bg-white rounded-[28px] mx-6 mb-6 p-4 shadow-sm shadow-slate-200/50 border border-slate-100">
          <View className="w-full h-40 bg-slate-100 rounded-2xl mb-4 relative items-center justify-center">
            <View className="w-16 h-16 bg-blue-500 rounded-2xl items-center justify-center shadow-sm shadow-blue-200">
              <ClipboardList size={32} color="white" />
            </View>
            <View className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg flex-row items-center">
              <CheckSquare size={12} color="#ef4444" style={{ marginRight: 6 }} />
              <Text className="text-slate-900 text-xs font-bold">Assignment</Text>
            </View>
          </View>

          <View className="flex-row items-center mb-2">
            <Text className="text-red-500 text-[10px] font-bold tracking-widest uppercase mr-2">Due in 3 days</Text>
            <Text className="text-slate-300 text-[10px]">•</Text>
            <Text className="text-slate-500 text-[10px] font-medium ml-2">Oct 18, 2023</Text>
          </View>

          <Text className="text-xl font-bold text-blue-900 mb-2 leading-tight">Calculus Weekly Practice Sheet</Text>
          
          <Text className="text-sm text-slate-500 mb-4 leading-5">
            Complete the 50 objective questions focusing on Definite Integration properties from the JEE syllabus.
          </Text>

          <View className="flex-row items-center justify-between mt-2 pt-4 border-t border-slate-50">
            <View className="bg-slate-50 px-2.5 py-1 rounded-md">
              <Text className="text-slate-600 text-xs font-bold">50 Qs</Text>
            </View>
            <TouchableOpacity className="flex-row items-center">
              <Text className="text-yellow-500 text-sm font-bold mr-1">Open</Text>
              <ArrowRight size={14} color="#eab308" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Card 4: CBSE Boards - Recorded Class */}
        <View className="bg-white rounded-[28px] mx-6 mb-8 p-4 shadow-sm shadow-slate-200/50 border border-slate-100">
          <View className="w-full h-40 rounded-2xl overflow-hidden mb-4 relative">
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=600&auto=format&fit=crop' }} 
              className="w-full h-full"
              contentFit="cover"
            />
            {/* Progress Bar overlay */}
            <View className="absolute bottom-0 left-0 right-0 h-1 bg-white/30">
              <View className="h-full bg-yellow-400" style={{ width: '65%' }} />
            </View>
            
            <View className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg flex-row items-center">
              <Video size={12} color="#eab308" style={{ marginRight: 6 }} />
              <Text className="text-slate-900 text-xs font-bold">Recorded</Text>
            </View>
          </View>

          <View className="flex-row items-center mb-2">
            <Text className="text-slate-500 text-[10px] font-bold tracking-widest uppercase mr-2">CBSE 12TH</Text>
            <Text className="text-slate-300 text-[10px]">•</Text>
            <Text className="text-slate-500 text-[10px] font-medium ml-2">Oct 10, 2023</Text>
          </View>

          <Text className="text-xl font-bold text-blue-900 mb-2 leading-tight">Human Reproduction: Part 2</Text>
          
          <Text className="text-sm text-slate-500 mb-4 leading-5">
            Understanding the menstrual cycle and fertilization processes in detail as per NCERT guidelines.
          </Text>

          <View className="flex-row items-center justify-between mt-2 pt-4 border-t border-slate-50">
            <Text className="text-slate-400 text-xs font-medium">45 mins left</Text>
            <TouchableOpacity className="flex-row items-center">
              <Text className="text-yellow-500 text-sm font-bold mr-1">Resume</Text>
              <PlayCircle size={14} color="#eab308" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Load More Button */}
        <View className="px-6 mb-8">
          <TouchableOpacity className="w-full py-4 rounded-2xl border border-blue-100 bg-white items-center justify-center shadow-sm shadow-slate-100">
            <Text className="text-blue-600 font-bold text-sm">Load More Content</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
