import { memo, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const Button = memo(function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
}: ButtonProps) {
  const inactive = disabled || loading;
  const textColor = variant === 'primary' ? colors.textInverse : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && pressedStyles[variant],
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: typography.bodyStrong,
  primary: { backgroundColor: colors.brand },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.5 },
});

const pressedStyles = StyleSheet.create({
  primary: { backgroundColor: colors.brandPressed },
  secondary: { backgroundColor: colors.surfaceMuted },
  ghost: { backgroundColor: colors.surfaceMuted },
});
