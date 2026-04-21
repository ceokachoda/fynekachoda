import { View, Text } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, Rect } from 'react-native-svg';

interface FyneStudyLogoProps {
  variant?: 'large' | 'header';
  containerClassName?: string;
}

export const FyneStudyLogo = ({ variant = 'large', containerClassName = '' }: FyneStudyLogoProps) => {
  const isLarge = variant === 'large';
  
  return (
    <View className={`flex-row items-center justify-center ${containerClassName}`}>
      <Svg width={isLarge ? "46" : "28"} height={isLarge ? "46" : "28"} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#2563eb" />
            <Stop offset="100%" stopColor="#1e3a8a" />
          </LinearGradient>
        </Defs>
        <Path 
          d="M 50 5 C 85 5 95 15 95 50 C 95 85 85 95 50 95 C 15 95 5 85 5 50 C 5 15 15 5 50 5 Z" 
          fill="url(#grad)" 
        />
        <Rect x="50" y="34" width="24" height="12" rx="2.5" fill="white" />
        <Rect x="28" y="50" width="26" height="12" rx="2.5" fill="white" />
        <Rect x="28" y="66" width="12" height="12" rx="2.5" fill="white" />
      </Svg>
      <Text 
        className={`${isLarge ? 'text-[32px] ml-3' : 'text-xl ml-2'} font-bold text-slate-900 tracking-tighter`} 
        style={{ fontFamily: 'System' }}
      >
        fynestudy
      </Text>
    </View>
  );
};
