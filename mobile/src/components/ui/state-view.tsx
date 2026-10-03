import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { colors, spacing, typography } from '@/theme/tokens';

interface StateViewProps {
  loading?: boolean;
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Centered loading / empty / error state. */
export function StateView({ loading, title, message, actionLabel, onAction }: StateViewProps) {
  return (
    <View style={styles.container}>
      {loading && <ActivityIndicator color={colors.textMuted} />}
      {title && <Text style={styles.title}>{title}</Text>}
      {message && <Text style={styles.message}>{message}</Text>}
      {actionLabel && onAction && (
        <Button label={actionLabel} variant="secondary" onPress={onAction} style={styles.action} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  title: { ...typography.heading, color: colors.text, textAlign: 'center' },
  message: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  action: { marginTop: spacing.md, minWidth: 160 },
});
