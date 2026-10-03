import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { CustomerPicker, useCustomers } from '@/features/voice/components/customer-picker';
import { DUE_PRESETS, type DraftItem, type DraftTransaction } from '@/features/voice/draft';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { PaymentType } from '@/types/api';

const PAYMENT_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'qr', label: 'QR' },
  { value: 'credit', label: 'Credit' },
] as const satisfies readonly { value: PaymentType; label: string }[];

const DUE_OPTIONS = DUE_PRESETS.map((d) => ({ value: String(d), label: `${d} days` }));

interface TransactionCardProps {
  tx: DraftTransaction;
  shopId: string;
  error: string | null;
  onChange: (tx: DraftTransaction) => void;
}

export const TransactionCard = memo(function TransactionCard({ tx, shopId, error, onChange }: TransactionCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const isSale = tx.action === 'sale';
  const isCredit = isSale && tx.paymentType === 'credit';
  const { data: customers } = useCustomers(shopId);
  const customer = customers?.find((c) => c.id === tx.customerId);

  const updateItem = (key: string, patch: Partial<DraftItem>) =>
    onChange({ ...tx, items: tx.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) });

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.badge, isSale ? styles.badgeSale : styles.badgePurchase]}>
          <Text style={[styles.badgeText, { color: isSale ? colors.success : colors.textMuted }]}>
            {isSale ? 'SALE' : 'PURCHASE'}
          </Text>
        </View>
      </View>

      {tx.items.map((item) => (
        <ItemRow key={item.key} item={item} isSale={isSale} onChange={(patch) => updateItem(item.key, patch)} />
      ))}

      {isSale && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Payment</Text>
          <SegmentedControl
            options={PAYMENT_OPTIONS}
            value={tx.paymentType}
            onChange={(paymentType) =>
              onChange({ ...tx, paymentType, dueInDays: paymentType === 'credit' ? (tx.dueInDays ?? DUE_PRESETS[0]) : null })
            }
          />
        </View>
      )}

      {isCredit && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Customer</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPickerOpen(true)}
              style={({ pressed }) => [styles.select, pressed && styles.selectPressed]}
            >
              <Text style={[styles.selectText, !customer && styles.placeholder]} numberOfLines={1}>
                {customer?.full_name ?? (tx.spokenCustomer ? `Heard “${tx.spokenCustomer}” — select` : 'Select customer')}
              </Text>
              <Icon name="chevronRight" size={14} color={colors.textSubtle} />
            </Pressable>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Due in</Text>
            <SegmentedControl
              options={DUE_OPTIONS}
              value={String(tx.dueInDays ?? DUE_PRESETS[0])}
              onChange={(v) => onChange({ ...tx, dueInDays: Number(v) })}
            />
          </View>
          <CustomerPicker
            shopId={shopId}
            visible={pickerOpen}
            selectedId={tx.customerId}
            onSelect={(c) => onChange({ ...tx, customerId: c.id })}
            onClose={() => setPickerOpen(false)}
          />
        </>
      )}

      {error && <Banner message={error} />}
    </Card>
  );
});

interface ItemRowProps {
  item: DraftItem;
  isSale: boolean;
  onChange: (patch: Partial<DraftItem>) => void;
}

function ItemRow({ item, isSale, onChange }: ItemRowProps) {
  const matched = item.productId !== null;
  const overStock = isSale && item.included && item.stock !== null && item.quantity > item.stock;

  return (
    <View style={[styles.item, !item.included && styles.itemExcluded]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.included, disabled: !matched }}
        accessibilityLabel={`Include ${item.productName}`}
        disabled={!matched}
        onPress={() => onChange({ included: !item.included })}
        hitSlop={8}
        style={[styles.checkbox, item.included && styles.checkboxOn]}
      >
        {item.included && <Icon name="check" size={14} color={colors.textInverse} />}
      </Pressable>

      <View style={styles.itemText}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.productName}
        </Text>
        {!matched ? (
          <Text style={[styles.itemMeta, { color: colors.danger }]}>Not found in inventory — will be skipped</Text>
        ) : overStock ? (
          <Text style={[styles.itemMeta, { color: colors.warning }]}>Only {item.stock} in stock</Text>
        ) : (
          <Text style={styles.itemMeta}>
            {item.stock !== null ? `${item.stock} in stock` : ''}
            {item.spokenProduct !== item.productName ? ` · heard “${item.spokenProduct}”` : ''}
          </Text>
        )}
      </View>

      {matched && (
        <View style={styles.stepper}>
          <StepButton
            icon="minus"
            label="Decrease quantity"
            disabled={!item.included || item.quantity <= 1}
            onPress={() => onChange({ quantity: item.quantity - 1 })}
          />
          <Text style={styles.qty}>{item.quantity}</Text>
          <StepButton
            icon="plus"
            label="Increase quantity"
            disabled={!item.included}
            onPress={() => onChange({ quantity: item.quantity + 1 })}
          />
        </View>
      )}
    </View>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'minus' | 'plus';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.step, pressed && styles.stepPressed, disabled && styles.stepDisabled]}
    >
      <Icon name={icon} size={14} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  header: { flexDirection: 'row' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  badgeSale: { backgroundColor: colors.successSoft },
  badgePurchase: { backgroundColor: colors.surfaceMuted },
  badgeText: typography.label,
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemExcluded: { opacity: 0.55 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  itemText: { flex: 1, gap: 2 },
  itemName: { ...typography.bodyStrong, color: colors.text },
  itemMeta: { ...typography.caption, color: colors.textMuted },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  step: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  stepPressed: { backgroundColor: colors.surfaceMuted },
  stepDisabled: { opacity: 0.35 },
  qty: {
    ...typography.bodyStrong,
    minWidth: 32,
    textAlign: 'center',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  section: { gap: spacing.sm },
  sectionLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '500' },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  selectPressed: { backgroundColor: colors.surfaceMuted },
  selectText: { ...typography.body, color: colors.text, flex: 1 },
  placeholder: { color: colors.textSubtle },
});
