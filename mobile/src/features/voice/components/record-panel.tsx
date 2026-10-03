import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Icon } from '@/components/ui/icon';
import { formatDuration } from '@/lib/format';
import { colors, radius, spacing, typography } from '@/theme/tokens';

interface RecordPanelProps {
  isRecording: boolean;
  busyLabel: string | null;
  durationMillis: number;
  onPress: () => void;
}

const SIZE = 112;

export function RecordPanel({ isRecording, busyLabel, durationMillis, onPress }: RecordPanelProps) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (isRecording) {
      pulse.value = withRepeat(withTiming(1, { duration: 1100 }), -1, false);
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
  }, [isRecording, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.45 }],
  }));

  const busy = busyLabel !== null;
  const hint = busy
    ? busyLabel
    : isRecording
      ? 'बोल्नुहोस्… रोक्न फेरि थिच्नुहोस्'
      : 'नेपालीमा बोल्नुहोस् — एक वा धेरै सामान (बिक्री/खरिद)';

  return (
    <View style={styles.container}>
      <Text style={styles.timer} accessibilityLiveRegion="polite">
        {isRecording ? formatDuration(durationMillis) : ' '}
      </Text>
      <View style={styles.buttonWrap}>
        <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
          accessibilityState={{ busy, disabled: busy }}
          disabled={busy}
          onPress={onPress}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, busy && styles.buttonBusy]}
        >
          {busy ? (
            <ActivityIndicator size="large" color={colors.textInverse} />
          ) : (
            <Icon name={isRecording ? 'stop' : 'mic'} size={isRecording ? 34 : 42} color={colors.textInverse} />
          )}
        </Pressable>
      </View>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.xl, paddingVertical: spacing.xxl },
  timer: { ...typography.metric, color: colors.text, minHeight: 28 },
  buttonWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: { backgroundColor: colors.brandPressed },
  buttonBusy: { opacity: 0.85 },
  hint: { ...typography.body, color: colors.textMuted, textAlign: 'center', maxWidth: 300 },
});
