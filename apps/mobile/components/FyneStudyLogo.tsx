import { View, Text } from 'react-native';
import { Image } from 'expo-image';

interface FyneStudyLogoProps {
  variant?: 'large' | 'header';
  containerClassName?: string;
}

// Official FyneStudy shield mark (assets/images/fyne-mark.png — the same art the
// app icon and native splash are generated from, so the shape stays identical
// across the OS icon, the native splash and this in-app logo). The wordmark in the
// source art is white and reserved for dark surfaces; on light chrome we render the
// name as text so it stays legible.
const MARK = require('../assets/images/fyne-mark.png');

export const FyneStudyLogo = ({ variant = 'large', containerClassName = '' }: FyneStudyLogoProps) => {
  const isLarge = variant === 'large';
  const size = isLarge ? 46 : 28;

  return (
    <View className={`flex-row items-center justify-center ${containerClassName}`}>
      <Image
        source={MARK}
        style={{ width: size, height: size }}
        contentFit="contain"
        cachePolicy="memory-disk"
        accessibilityLabel="FyneStudy"
      />
      <Text
        className={`${isLarge ? 'text-[32px] ml-3' : 'text-xl ml-2'} font-bold text-slate-900 tracking-tighter`}
        style={{ fontFamily: 'System' }}
      >
        fynestudy
      </Text>
    </View>
  );
};
