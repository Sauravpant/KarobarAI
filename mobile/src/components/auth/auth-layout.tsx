import { Image } from 'expo-image';
import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '@/theme/tokens';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footerText: string;
  footerLinkLabel: string;
  footerHref: Href;
}

export function AuthLayout({ title, subtitle, children, footerText, footerLinkLabel, footerHref }: AuthLayoutProps) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Image source={require('@/assets/images/karobar_ai_logo.png')} style={styles.logo} contentFit="contain" accessibilityLabel="KarobarAI" />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <View style={styles.form}>{children}</View>
          <Text style={styles.footer}>
            {footerText}{' '}
            <Link href={footerHref} replace style={styles.footerLink}>
              {footerLinkLabel}
            </Link>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  logo: { width: 160, height: 79, marginBottom: spacing.xl },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs },
  form: { gap: spacing.lg, marginTop: spacing.xxl },
  footer: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  footerLink: { color: colors.brand, fontWeight: '600' },
});
