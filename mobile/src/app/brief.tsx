import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { dashboardApi } from '@/api/endpoints';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StatTile } from '@/components/dashboard/stat-tile';
import { ConfirmationPlayer } from '@/features/voice/components/confirmation-player';
import { formatCurrency, formatNumber, isoDateFromToday } from '@/lib/format';
import { useActiveShop } from '@/providers/session-provider';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { DailyBrief, RestockSuggestion } from '@/types/api';

type Day = 'today' | 'yesterday';
const DAY_OPTIONS = [
  { value: 'today', label: 'आज' },
  { value: 'yesterday', label: 'हिजो' },
] as const;

export default function BriefScreen() {
  const shop = useActiveShop();
  const [day, setDay] = useState<Day>('today');
  const date = isoDateFromToday(day === 'today' ? 0 : -1);

  const brief = useQuery({
    queryKey: ['brief', shop.id, date],
    queryFn: ({ signal }) => dashboardApi.brief(shop.id, date, signal),
    staleTime: Infinity, // server never regenerates a saved brief
  });

  // Audio is synthesized per request; gcTime 0 because the player deletes the file on unmount.
  const audio = useQuery({
    queryKey: ['brief-audio', shop.id, date],
    queryFn: ({ signal }) => dashboardApi.briefAudio(shop.id, date, signal),
    enabled: brief.isSuccess,
    staleTime: Infinity,
    gcTime: 0,
  });

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <SegmentedControl options={DAY_OPTIONS} value={day} onChange={setDay} />

        {brief.isPending && (
          <Card style={styles.loading}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.loadingTitle}>सारांश तयार हुँदैछ…</Text>
            <Text style={styles.loadingHint}>Crunching today&apos;s sales, credit and stock. First time takes ~20s.</Text>
          </Card>
        )}

        {brief.isError && (
          <View style={styles.section}>
            <Banner message={`Couldn't build the brief: ${errorMessage(brief.error)}`} />
            <Button label="Try again" variant="secondary" onPress={() => brief.refetch()} />
          </View>
        )}

        {brief.data && (
          <>
            <AudioSection uri={audio.data} loading={audio.isFetching} error={audio.error} onRetry={() => audio.refetch()} />
            <InsightCard text={brief.data.ai_insight} />
            <Numbers brief={brief.data} />
            <TranscriptCard transcript={brief.data.transcript} insight={brief.data.ai_insight} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function AudioSection({
  uri,
  loading,
  error,
  onRetry,
}: {
  uri: string | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  if (uri) return <ConfirmationPlayer key={uri} audioUri={uri} />;
  if (loading) {
    return (
      <Card style={styles.audioPending}>
        <ActivityIndicator color={colors.textMuted} />
        <Text style={styles.audioPendingText}>आवाज तयार हुँदैछ…</Text>
      </Card>
    );
  }
  if (error) {
    return (
      <View style={styles.section}>
        <Banner tone="warning" message={`Audio unavailable: ${errorMessage(error)}. You can still read the brief below.`} />
        <Button label="Retry audio" variant="secondary" onPress={onRetry} />
      </View>
    );
  }
  return null;
}

function InsightCard({ text }: { text: string }) {
  return (
    <View style={styles.insight}>
      <View style={styles.insightHeader}>
        <Icon name="sparkles" size={16} color={colors.brand} />
        <Text style={styles.insightLabel}>AI सुझाव</Text>
      </View>
      <Text style={styles.insightText}>{text}</Text>
    </View>
  );
}

function Numbers({ brief }: { brief: DailyBrief }) {
  const customer = brief.highest_credit_customer;
  return (
    <>
      <Text style={styles.sectionLabel}>NUMBERS</Text>
      <View style={styles.grid}>
        <StatTile label="Sales" value={formatCurrency(brief.total_sales)} />
        <StatTile label="Credit given" value={formatCurrency(brief.total_credit_today)} />
      </View>

      <Card style={styles.listCard}>
        <Row icon="trendUp" label="Best seller" value={brief.top_selling_product} />
        <Row icon="trendDown" label="Slowest seller" value={brief.min_selling_product} divider />
        <Row
          icon="person"
          label="Highest credit"
          value={customer && `${customer.name} · ${formatCurrency(customer.outstanding_balance)}`}
          divider
        />
      </Card>

      {brief.restock_suggestions.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>TOMORROW&apos;S STOCK</Text>
          <Card style={styles.listCard}>
            {brief.restock_suggestions.map((s, i) => (
              <RestockRow key={s.product_name} s={s} divider={i > 0} />
            ))}
          </Card>
        </>
      )}

      {brief.low_stock_alerts.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>LOW STOCK</Text>
          <View style={styles.chips}>
            {brief.low_stock_alerts.map((name) => (
              <View key={name} style={styles.chip}>
                <Text style={styles.chipText}>{name}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </>
  );
}

function Row({ icon, label, value, divider }: { icon: IconName; label: string; value: string | null; divider?: boolean }) {
  return (
    <View style={[styles.row, divider && styles.divider]}>
      <Icon name={icon} size={16} color={colors.textMuted} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, !value && styles.rowEmpty]} numberOfLines={1}>
        {value ?? '—'}
      </Text>
    </View>
  );
}

function RestockRow({ s, divider }: { s: RestockSuggestion; divider: boolean }) {
  return (
    <View style={[styles.row, divider && styles.divider]}>
      <Icon name="box" size={16} color={s.needs_restock ? colors.warning : colors.textMuted} />
      <View style={styles.restockText}>
        <Text style={styles.rowValueLeft} numberOfLines={1}>
          {s.product_name}
        </Text>
        <Text style={styles.rowCaption}>
          {formatNumber(s.current_stock)} in stock · ~{formatNumber(s.predicted_tomorrow)} needed tomorrow
        </Text>
      </View>
      <View style={[styles.badge, s.needs_restock ? styles.badgeWarn : styles.badgeOk]}>
        <Text style={[styles.badgeText, { color: s.needs_restock ? colors.warning : colors.success }]}>
          {s.needs_restock ? 'Restock' : 'OK'}
        </Text>
      </View>
    </View>
  );
}

function TranscriptCard({ transcript, insight }: { transcript: string; insight: string }) {
  // Insight is the transcript's last paragraph and already has its own card.
  const paragraphs = transcript
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && p !== insight.trim());
  if (!paragraphs.length) return null;
  return (
    <>
      <Text style={styles.sectionLabel}>FULL BRIEF</Text>
      <Card style={styles.transcript}>
        {paragraphs.map((p, i) => (
          <Text key={i} style={styles.transcriptText}>
            {p}
          </Text>
        ))}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  section: { gap: spacing.md },
  loading: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  loadingTitle: { ...typography.heading, color: colors.text },
  loadingHint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  audioPending: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  audioPendingText: { ...typography.body, color: colors.textMuted },
  insight: {
    backgroundColor: colors.brandSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.brand,
  },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  insightLabel: { ...typography.label, color: colors.brand },
  insightText: { ...typography.body, fontSize: 18, lineHeight: 28, fontWeight: '600', color: colors.text },
  sectionLabel: { ...typography.label, color: colors.textSubtle, marginTop: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  listCard: { paddingVertical: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowLabel: { ...typography.body, color: colors.textMuted },
  rowValue: { ...typography.bodyStrong, color: colors.text, flex: 1, textAlign: 'right' },
  rowValueLeft: { ...typography.bodyStrong, color: colors.text },
  rowEmpty: { color: colors.textSubtle, fontWeight: '400' },
  rowCaption: { ...typography.caption, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  restockText: { flex: 1, gap: 2 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  badgeWarn: { backgroundColor: colors.warningSoft },
  badgeOk: { backgroundColor: colors.successSoft },
  badgeText: { ...typography.label },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipText: { ...typography.caption, color: colors.warning, fontWeight: '600' },
  transcript: { gap: spacing.md },
  transcriptText: { ...typography.body, fontSize: 17, lineHeight: 28, color: colors.text },
});
