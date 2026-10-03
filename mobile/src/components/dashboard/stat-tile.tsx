import { memo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Card } from '@/components/ui/card';
import { colors, spacing, typography } from '@/theme/tokens';

interface StatTileProps {
  label: string;
  value: string;
  tone?: 'default' | 'warning';
}

export const StatTile = memo(function StatTile({ label, value, tone = 'default' }: StatTileProps) {
  return (
    <Card style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, tone === 'warning' && styles.warning]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </Card>
  );
});

const styles = StyleSheet.create({
  tile: { flexBasis: '47%', flexGrow: 1, gap: spacing.xs },
  label: { ...typography.caption, color: colors.textMuted },
  value: { ...typography.metric, color: colors.text },
  warning: { color: colors.warning },
});
