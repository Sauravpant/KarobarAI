import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const TONES = {
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  warning: { bg: colors.warningSoft, fg: colors.warning },
} as const;

export function Banner({ message, tone = 'danger' }: { message: string; tone?: keyof typeof TONES }) {
  const { bg, fg } = TONES[tone];
  return (
    <View style={[styles.banner, { backgroundColor: bg }]} accessibilityRole="alert">
      <Icon name="warning" size={16} color={fg} />
      <Text style={[styles.text, { color: fg }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  text: { ...typography.caption, flex: 1 },
});
