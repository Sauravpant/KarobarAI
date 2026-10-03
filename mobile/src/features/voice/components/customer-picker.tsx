import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { customersApi } from '@/api/endpoints';
import { Icon } from '@/components/ui/icon';
import { StateView } from '@/components/ui/state-view';
import { formatCurrency } from '@/lib/format';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { Customer } from '@/types/api';

export function useCustomers(shopId: string) {
  return useQuery({
    queryKey: ['customers', shopId],
    queryFn: () => customersApi.list(shopId),
    staleTime: 5 * 60_000,
  });
}

interface CustomerPickerProps {
  shopId: string;
  visible: boolean;
  selectedId: string | null;
  onSelect: (customer: Customer) => void;
  onClose: () => void;
}

export function CustomerPicker({ shopId, visible, selectedId, onSelect, onClose }: CustomerPickerProps) {
  const [query, setQuery] = useState('');
  const { data, isLoading, isError, error, refetch } = useCustomers(shopId);

  const filtered = useMemo(() => {
    const active = (data ?? []).filter((c) => c.is_active);
    const q = query.trim().toLowerCase();
    if (!q) return active;
    return active.filter((c) => c.full_name.toLowerCase().includes(q) || c.phone?.includes(q));
  }, [data, query]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Select customer</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={12}>
            <Icon name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or phone"
          placeholderTextColor={colors.textSubtle}
          style={styles.search}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {isLoading ? (
          <StateView loading />
        ) : isError ? (
          <StateView title="Couldn't load customers" message={errorMessage(error)} actionLabel="Retry" onAction={refetch} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(c) => c.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListEmptyComponent={<StateView message="No matching customers. Add customers from the web dashboard." />}
            renderItem={({ item }) => {
              const selected = item.id === selectedId;
              const remaining = item.credit_limit - item.current_outstanding_balance;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.name}>{item.full_name}</Text>
                    <Text style={styles.meta}>
                      Owes {formatCurrency(item.current_outstanding_balance)}
                      {item.credit_limit > 0 ? ` · ${formatCurrency(Math.max(0, remaining))} limit left` : ''}
                    </Text>
                  </View>
                  {selected && <Icon name="check" size={20} color={colors.brand} />}
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  title: { ...typography.heading, color: colors.text },
  search: {
    ...typography.body,
    marginHorizontal: spacing.lg,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
  },
  list: { padding: spacing.lg, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: { opacity: 0.6 },
  rowText: { flex: 1, gap: 2 },
  name: { ...typography.bodyStrong, color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted },
});
