import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { shopsApi } from '@/api/endpoints';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { StateView } from '@/components/ui/state-view';
import { useEnterShop } from '@/features/shops/use-enter-shop';
import { useSession } from '@/providers/session-provider';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { Shop } from '@/types/api';

const LOCATION_LABEL: Record<Shop['location_type'], string> = {
  urban: 'Urban',
  semi_urban: 'Semi-urban',
  rural: 'Rural',
};

export default function ShopsScreen() {
  const { activeShop, signOut } = useSession();
  const onSelect = useEnterShop();
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['shops'],
    queryFn: shopsApi.list,
  });

  if (isLoading) return <StateView loading />;
  if (isError) return <StateView title="Couldn't load shops" message={errorMessage(error)} actionLabel="Retry" onAction={refetch} />;

  return (
    <FlatList
      data={data}
      keyExtractor={(s) => s.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      ListEmptyComponent={<StateView title="No shops yet" message="Create your first shop to start recording sales." />}
      renderItem={({ item }) => {
        const selected = item.id === activeShop?.id;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onSelect(item)}
            style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.rowPressed]}
          >
            <View style={styles.rowIcon}>
              <Icon name="store" size={20} color={colors.textMuted} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.name} numberOfLines={1}>
                {item.shop_name}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {item.address} · {LOCATION_LABEL[item.location_type]}
              </Text>
            </View>
            {selected ? (
              <Icon name="check" size={20} color={colors.brand} />
            ) : (
              <Icon name="chevronRight" size={16} color={colors.textSubtle} />
            )}
          </Pressable>
        );
      }}
      ListFooterComponent={
        <View style={styles.footer}>
          <Button
            label="New shop"
            variant="secondary"
            icon={<Icon name="plus" size={16} />}
            onPress={() => router.push('/create-shop')}
          />
          <Button label="Sign out" variant="ghost" onPress={signOut} />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowSelected: { borderColor: colors.brand },
  rowPressed: { backgroundColor: colors.surfaceMuted },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  name: { ...typography.bodyStrong, color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted },
  footer: { marginTop: spacing.lg, gap: spacing.sm },
});
