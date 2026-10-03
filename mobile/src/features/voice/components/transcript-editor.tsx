import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { colors, radius, spacing, typography } from '@/theme/tokens';

interface TranscriptEditorProps {
  text: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  onRedo: () => void;
  loading: boolean;
}

export function TranscriptEditor({ text, onChange, onSubmit, onRedo, loading }: TranscriptEditorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>ट्रान्सक्रिप्ट जाँच गर्नुहोस्</Text>
      <TextInput
        value={text}
        onChangeText={onChange}
        multiline
        editable={!loading}
        placeholder="बोलेको पाठ…"
        placeholderTextColor={colors.textSubtle}
        accessibilityLabel="Transcript"
        style={styles.input}
        textAlignVertical="top"
      />
      <View style={styles.actions}>
        <Button
          label="Re-record"
          variant="secondary"
          onPress={onRedo}
          disabled={loading}
          icon={<Icon name="redo" size={16} />}
          style={styles.secondary}
        />
        <Button label="Extract items" onPress={onSubmit} loading={loading} disabled={!text.trim()} style={styles.primary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  label: { ...typography.caption, color: colors.textMuted, fontWeight: '500' },
  input: {
    ...typography.body,
    fontSize: 17,
    lineHeight: 26,
    minHeight: 140,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  actions: { flexDirection: 'row', gap: spacing.md },
  secondary: { flex: 1 },
  primary: { flex: 2 },
});
