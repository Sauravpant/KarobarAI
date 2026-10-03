import { useQuery } from '@tanstack/react-query';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { dashboardApi } from '@/api/endpoints';
import { Banner } from '@/components/ui/banner';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { StatTile } from '@/components/dashboard/stat-tile';
import { listRecordings } from '@/features/voice/offline-store';
import { formatCurrency, formatNumber } from '@/lib/format';
import { useActiveShop, useSession } from '@/providers/session-provider';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export default function HomeScreen() {
  const shop = useActiveShop();
  const { user, signOut } = useSession();
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard', shop.id],
    queryFn: () => dashboardApi.get(shop.id),
  });

  const [offlineCount, setOfflineCount] = useState(0);
  useFocusEffect(
    useCallback(() => {
      try {
        setOfflineCount(listRecordings(shop.id).length);
      } catch {
        setOfflineCount(0);
      }
    }, [shop.id]),
  );

  const s = data?.summary;
  const placeholder = isLoading ? '—' : '0';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <View style={styles.header}>
          <Link href="/shops" asChild>
            <Pressable accessibilityRole="button" accessibilityLabel="Switch shop" style={styles.shopSwitch}>
              <Text style={styles.greeting} numberOfLines={1}>
                {user?.full_name ? `Namaste, ${user.full_name.split(' ')[0]}` : 'Namaste'}
              </Text>
              <View style={styles.shopRow}>
                <Text style={styles.shopName} numberOfLines={1}>
                  {shop.shop_name}
                </Text>
                <Icon name="chevronRight" size={14} color={colors.textMuted} />
              </View>
            </Pressable>
          </Link>
          <Pressable accessibilityRole="button" accessibilityLabel="Sign out" onPress={signOut} hitSlop={12} style={styles.iconButton}>
            <Icon name="logout" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        <Link href="/brief" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hear today's brief"
            style={({ pressed }) => [styles.briefCta, pressed && styles.briefCtaPressed]}
          >
            <View style={styles.briefTop}>
              <Icon name="sparkles" size={16} color={colors.brandSoft} />
              <Text style={styles.briefEyebrow}>DAILY BRIEF</Text>
            </View>
            <Text style={styles.briefTitle}>आजको सारांश सुन्नुहोस्</Text>
            <Text style={styles.briefSubtitle}>Sales, credit, stock and an AI tip, read out in Nepali.</Text>
            <View style={styles.briefPlay}>
              <Icon name="play" size={16} color={colors.text} />
              <Text style={styles.briefPlayText}>Play brief</Text>
            </View>
          </Pressable>
        </Link>

        <Link href="/voice" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Record a transaction by voice"
            style={({ pressed }) => [styles.voiceCta, pressed && styles.voiceCtaPressed]}
          >
            <View style={styles.voiceIcon}>
              <Icon name="mic" size={26} color={colors.textInverse} />
            </View>
            <View style={styles.voiceText}>
              <Text style={styles.voiceTitle}>Record a transaction</Text>
              <Text style={styles.voiceSubtitle}>बिक्री वा खरिद नेपालीमा बोल्नुहोस्</Text>
            </View>
            <Icon name="chevronRight" size={16} color={colors.textSubtle} />
          </Pressable>
        </Link>

        <Link href="/offline" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Offline recordings, ${offlineCount} saved`}
            style={({ pressed }) => [styles.voiceCta, pressed && styles.voiceCtaPressed]}
          >
            <View style={[styles.voiceIcon, styles.offlineIcon]}>
              <Icon name="cloudOff" size={24} color={colors.text} />
            </View>
            <View style={styles.voiceText}>
              <Text style={styles.voiceTitle}>Offline recordings</Text>
              <Text style={styles.voiceSubtitle}>
                {offlineCount ? `${offlineCount} waiting to process` : 'Record without internet, process later'}
              </Text>
            </View>
            <Icon name="chevronRight" size={16} color={colors.textSubtle} />
          </Pressable>
        </Link>

        {isError && <Banner message={`Couldn't load dashboard: ${errorMessage(error)}`} />}

        <Text style={styles.sectionLabel}>TODAY</Text>
        <View style={styles.grid}>
          <StatTile label="Revenue" value={s ? formatCurrency(s.today_revenue) : placeholder} />
          <StatTile label="Profit" value={s ? formatCurrency(s.today_profit) : placeholder} />
          <StatTile label="Transactions" value={s ? formatNumber(s.today_transactions) : placeholder} />
          <StatTile
            label="Low stock"
            value={s ? formatNumber(s.low_stock_count) : placeholder}
            tone={s && s.low_stock_count > 0 ? 'warning' : 'default'}
          />
        </View>

        <Text style={styles.sectionLabel}>OUTSTANDING CREDIT</Text>
        <Card>
          <Text style={styles.metric}>{s ? formatCurrency(s.total_credit_outstanding) : placeholder}</Text>
          <Text style={styles.caption}>
            Across {s ? formatNumber(s.total_customers) : placeholder} customers
          </Text>
        </Card>

        {!!data?.top_products.length && (
          <>
            <Text style={styles.sectionLabel}>TOP PRODUCTS</Text>
            <Card style={styles.listCard}>
              {data.top_products.slice(0, 5).map((p, i) => (
                <View key={p.product_name} style={[styles.listRow, i > 0 && styles.listDivider]}>
                  <Text style={styles.listName} numberOfLines={1}>
                    {p.product_name}
                  </Text>
                  <Text style={styles.listValue}>{formatNumber(p.total_sold)} sold</Text>
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  shopSwitch: { flex: 1, gap: 2 },
  greeting: { ...typography.caption, color: colors.textMuted },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  shopName: { ...typography.title, color: colors.text, flexShrink: 1 },
  iconButton: { padding: spacing.sm },
  briefCta: {
    backgroundColor: colors.text,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  briefCtaPressed: { opacity: 0.9 },
  briefTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  briefEyebrow: { ...typography.label, color: colors.brandSoft },
  briefTitle: { ...typography.title, color: colors.textInverse, marginTop: spacing.xs },
  briefSubtitle: { ...typography.caption, color: colors.textSubtle },
  briefPlay: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  briefPlayText: { ...typography.bodyStrong, color: colors.text },
  voiceCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  voiceCtaPressed: { backgroundColor: colors.surfaceMuted },
  voiceIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineIcon: { backgroundColor: colors.surfaceMuted },
  voiceText: { flex: 1, gap: 2 },
  voiceTitle: { ...typography.heading, color: colors.text },
  voiceSubtitle: { ...typography.caption, color: colors.textMuted },
  sectionLabel: { ...typography.label, color: colors.textSubtle, marginTop: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metric: { ...typography.metric, color: colors.text },
  caption: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  listCard: { paddingVertical: spacing.xs },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md },
  listDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  listName: { ...typography.body, color: colors.text, flex: 1 },
  listValue: { ...typography.caption, color: colors.textMuted, fontVariant: ['tabular-nums'] },
});
