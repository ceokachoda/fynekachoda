import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Keyboard,
  LayoutAnimation,
  UIManager,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, G, Rect } from 'react-native-svg';
import { FyneStudyLogo } from '../components/FyneStudyLogo';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');

const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;
const widthScale = width / BASE_WIDTH;
const heightScale = height / BASE_HEIGHT;
const uiScale = Math.min(widthScale, heightScale);
const isSmallDevice = height < 700;

const rs = (size: number) => Math.round(size * uiScale);
const rh = (size: number) => Math.round(size * heightScale);

const ILLUSTRATION_HEIGHT = rh(isSmallDevice ? 180 : 220);

const NO_SCALE = { allowFontScaling: false as const };

const PWLogoPlaceholder = () => (
  <View
    style={{
      marginLeft: rs(20),
      marginTop: rs(10),
      alignSelf: 'flex-start',
    }}
  >
    <FyneStudyLogo variant="header" />
  </View>
);

const OTPIllustration = ({ opacity }: { opacity: Animated.AnimatedInterpolation<number> }) => (
  <Animated.View
    style={{
      position: 'absolute',
      top: -10,
      right: -10,
      width: width * 0.82,
      height: ILLUSTRATION_HEIGHT,
      opacity,
    }}
    pointerEvents="none"
  >
    <Svg width="100%" height="100%" viewBox="0 0 400 400" preserveAspectRatio="xMaxYMin meet">
      {/* Background Blob - Light Purple */}
      <Path
        d="M260.5,48.5C320.5,68.5,382.5,112.5,397.5,175.5C412.5,238.5,380.5,320.5,320.5,360.5C260.5,400.5,172.5,398.5,112.5,358.5C52.5,318.5,20.5,240.5,16.5,170.5C12.5,100.5,36.5,38.5,96.5,8.5C156.5,-21.5,200.5,28.5,260.5,48.5Z"
        fill="#DBEAFE"
        transform="translate(20, -30)"
      />
      
      {/* Shift entire graphic slightly for better framing */}
      <G transform="translate(60, 20)">
        {/* Mobile Phone Device */}
        <Rect x="150" y="160" width="100" height="180" rx="20" fill="#1E293B" />
        <Rect x="155" y="170" width="90" height="160" rx="15" fill="#FFFFFF" />
        {/* Notch */}
        <Rect x="180" y="165" width="40" height="4" rx="2" fill="#9CA3AF" />
        {/* Mock Screen Content (Checkmark inside phone) */}
        <Circle cx="200" cy="250" r="30" fill="#DBEAFE" />
        <Path d="M 185 250 L 195 260 L 215 240" stroke="#3B82F6" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        
        {/* Floating Chat Bubble (OTP Message) */}
        <G transform="translate(100, 100)">
          {/* Main Bubble */}
          <Path d="M 0 40 Q 0 0 40 0 L 120 0 Q 160 0 160 40 L 160 80 Q 160 120 120 120 L 40 120 Q 0 120 0 80 Z" fill="#3B82F6" />
          {/* Tail */}
          <Path d="M 20 115 L 0 150 L 45 115 Z" fill="#3B82F6" />
          
          {/* Asterisks for code *** *** */}
          <Circle cx="40" cy="60" r="8" fill="#FFFFFF" />
          <Circle cx="65" cy="60" r="8" fill="#FFFFFF" />
          <Circle cx="90" cy="60" r="8" fill="#FFFFFF" />
          <Circle cx="120" cy="60" r="8" fill="#FFFFFF" />
        </G>

        {/* Floating Shield */}
        <G transform="translate(50, 200) rotate(-15)">
          <Path d="M 25 0 L 75 0 L 75 35 Q 75 75 50 100 Q 25 75 25 35 Z" fill="#FBBF24" />
          <Path d="M 37 12 L 63 12 L 63 35 Q 63 60 50 80 Q 37 60 37 35 Z" fill="#FDE68A" />
          <Path d="M 43 40 L 48 45 L 58 35" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </G>

        {/* Decorative Stars */}
        <Path d="M 80 50 L 85 65 L 100 70 L 85 75 L 80 90 L 75 75 L 60 70 L 75 65 Z" fill="#3B82F6" />
        <Path d="M 280 90 L 283 98 L 290 100 L 283 102 L 280 110 L 277 102 L 270 100 L 277 98 Z" fill="#FBBF24" />
        <Circle cx="300" cy="180" r="6" fill="#34D399" />
        <Circle cx="70" cy="290" r="5" fill="#3B82F6" />
      </G>
    </Svg>
  </Animated.View>
);

export default function VerifyScreen() {
  const router = useRouter();
  const [otp, setOtp] = useState('');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const illustrationOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      LayoutAnimation.configureNext({
        duration: 220,
        create: { type: 'easeInEaseOut', property: 'opacity' },
        update: { type: 'easeInEaseOut' },
        delete: { type: 'easeInEaseOut', property: 'opacity' },
      });
      setKeyboardOpen(true);
      Animated.timing(illustrationOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      LayoutAnimation.configureNext({
        duration: 220,
        create: { type: 'easeInEaseOut', property: 'opacity' },
        update: { type: 'easeInEaseOut' },
        delete: { type: 'easeInEaseOut', property: 'opacity' },
      });
      setKeyboardOpen(false);
      Animated.timing(illustrationOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [illustrationOpacity]);

  const handleVerify = () => {
    if (otp.length === 6) {
      Keyboard.dismiss();
      router.push('/select-course');
    }
  };

  const isFormValid = otp.length === 6;

  return (
    <View className="flex-1 bg-white">
      <OTPIllustration opacity={illustrationOpacity} />

      <SafeAreaView className="flex-1 bg-transparent" edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <View className="flex-1">
            {!keyboardOpen && <PWLogoPlaceholder />}

            <View
              style={{
                flex: 1,
                paddingHorizontal: rs(24),
                paddingTop: keyboardOpen ? rs(16) : ILLUSTRATION_HEIGHT - rs(40),
                paddingBottom: rs(12),
                justifyContent: keyboardOpen ? 'flex-start' : 'space-between',
              }}
            >
              <View
                style={{
                  alignItems: 'center',
                  marginBottom: keyboardOpen ? rs(12) : rs(isSmallDevice ? 10 : 16),
                }}
              >
                {!keyboardOpen && (
                  <Text
                    {...NO_SCALE}
                    style={{ fontSize: rs(28), lineHeight: rs(32), marginBottom: rs(2) }}
                    className="font-extrabold text-[#2563EB]"
                  >
                    Check your phone
                  </Text>
                )}
                <Text
                  {...NO_SCALE}
                  style={{
                    fontSize: keyboardOpen ? rs(18) : rs(22),
                    lineHeight: keyboardOpen ? rs(22) : rs(26),
                    marginBottom: keyboardOpen ? 0 : rs(8),
                    textAlign: 'center',
                  }}
                  className="font-extrabold text-slate-900"
                >
                  Enter Verification Code
                </Text>
                {!keyboardOpen && (
                  <Text
                    {...NO_SCALE}
                    style={{ fontSize: rs(13), lineHeight: rs(18), paddingHorizontal: rs(20) }}
                    className="text-slate-500 text-center font-semibold tracking-wide"
                  >
                    We&apos;ve sent a 6-digit one-time password to your mobile number.
                  </Text>
                )}
              </View>

              <View>
                {/* OTP Input Container */}
                <View className="relative mt-7">
                  <View
                    style={{
                      borderWidth: 1,
                      borderRadius: rs(12),
                      paddingHorizontal: rs(14),
                      paddingVertical: rs(16),
                      minHeight: rs(70),
                    }}
                    className="border-slate-300 bg-white justify-center shadow-sm shadow-slate-100/50"
                  >
                    <TextInput
                      {...NO_SCALE}
                      style={{ fontSize: rs(32), letterSpacing: rs(12), textAlign: 'center' }}
                      className="text-slate-900 font-extrabold"
                      placeholder="------"
                      placeholderTextColor="#cbd5e1"
                      value={otp}
                      onChangeText={setOtp}
                      keyboardType="number-pad"
                      maxLength={6}
                      returnKeyType="done"
                      onSubmitEditing={handleVerify}
                    />
                  </View>
                  <View
                    style={{ position: 'absolute', top: -rs(9), left: rs(14), paddingHorizontal: rs(6) }}
                    className="bg-white z-10"
                  >
                    <Text {...NO_SCALE} style={{ fontSize: rs(11) }} className="font-semibold text-slate-500">
                      6-Digit OTP
                    </Text>
                  </View>
                </View>
              </View>

              <View style={{ marginTop: rs(isSmallDevice ? 14 : 20) }}>
                <TouchableOpacity
                  onPress={handleVerify}
                  activeOpacity={0.85}
                  disabled={!isFormValid}
                  style={{
                    paddingVertical: rs(14),
                    borderRadius: rs(12),
                    marginBottom: rs(12),
                  }}
                  className={`w-full items-center justify-center shadow-sm ${
                    isFormValid ? 'bg-[#2563EB] shadow-blue-200' : 'bg-[#BFDBFE]'
                  }`}
                >
                  <Text
                    {...NO_SCALE}
                    style={{ fontSize: rs(17) }}
                    className="text-white font-bold tracking-wide"
                  >
                    Verify Code
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.back()}
                  activeOpacity={0.85}
                  style={{
                    paddingVertical: rs(14),
                    borderRadius: rs(12),
                    marginBottom: rs(12),
                    borderWidth: 1,
                  }}
                  className="w-full items-center justify-center border-slate-200 bg-white shadow-sm shadow-slate-50"
                >
                  <Text
                    {...NO_SCALE}
                    style={{ fontSize: rs(16) }}
                    className="text-slate-700 font-bold tracking-wide"
                  >
                    Go Back
                  </Text>
                </TouchableOpacity>

                {!keyboardOpen && (
                  <Text
                    {...NO_SCALE}
                    style={{ fontSize: rs(12), lineHeight: rs(16) }}
                    className="text-center text-slate-500 mt-2"
                  >
                    Didn&apos;t receive it?{' '}
                    <Text {...NO_SCALE} className="text-[#2563EB] font-semibold">
                      Resend OTP
                    </Text>
                  </Text>
                )}
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
