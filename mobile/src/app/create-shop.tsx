import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, type TextInput } from 'react-native';

import { errorMessage } from '@/api/client';
import { shopsApi } from '@/api/endpoints';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { TextField } from '@/components/ui/text-field';
import { useEnterShop } from '@/features/shops/use-enter-shop';
import { colors, spacing, typography } from '@/theme/tokens';
import type { LocationType } from '@/types/api';

const LOCATION_OPTIONS = [
  { value: 'urban', label: 'Urban' },
  { value: 'semi_urban', label: 'Semi-urban' },
  { value: 'rural', label: 'Rural' },
] as const satisfies readonly { value: LocationType; label: string }[];

export default function CreateShopScreen() {
  const queryClient = useQueryClient();
  const enterShop = useEnterShop();
  const addressRef = useRef<TextInput>(null);
  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [locationType, setLocationType] = useState<LocationType>('urban');

  const create = useMutation({
    mutationFn: shopsApi.create,
    onSuccess: (shop) => {
      queryClient.invalidateQueries({ queryKey: ['shops'] });
      enterShop(shop);
    },
  });

  const canSubmit = shopName.trim().length > 0 && address.trim().length > 0 && !create.isPending;
  const submit = () => {
    if (!canSubmit) return;
    create.mutate({ shop_name: shopName.trim(), address: address.trim(), location_type: locationType });
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {create.isError && <Banner message={errorMessage(create.error)} />}
        <TextField
          label="Shop name"
          value={shopName}
          onChangeText={setShopName}
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => addressRef.current?.focus()}
        />
        <TextField
          ref={addressRef}
          label="Address"
          value={address}
          onChangeText={setAddress}
          autoCapitalize="words"
          autoComplete="street-address"
          textContentType="fullStreetAddress"
          returnKeyType="done"
        />
        <View style={styles.field}>
          <Text style={styles.label}>Location type</Text>
          <SegmentedControl options={LOCATION_OPTIONS} value={locationType} onChange={setLocationType} />
        </View>
        <Button label="Create shop" onPress={submit} loading={create.isPending} disabled={!canSubmit} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  field: { gap: spacing.xs },
  label: { ...typography.caption, color: colors.textMuted, fontWeight: '500' },
});
