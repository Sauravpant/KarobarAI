import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme/tokens';

interface TextFieldProps extends TextInputProps {
  label: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField({ label, style, ...props }, ref) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textSubtle}
        style={[styles.input, style]}
        accessibilityLabel={label}
        {...props}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { ...typography.caption, color: colors.textMuted, fontWeight: '500' },
  input: {
    ...typography.body,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
  },
});
