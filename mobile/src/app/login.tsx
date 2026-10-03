import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';

import { errorMessage } from '@/api/client';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { isValidEmail, normalizeEmail } from '@/lib/validation';
import { useSession } from '@/providers/session-provider';

export default function LoginScreen() {
  const { signIn } = useSession();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = isValidEmail(email) && password.length > 0;

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await signIn(normalizeEmail(email), password);
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in to KarobarAI"
      subtitle="Record sales and purchases by voice."
      footerText="New to KarobarAI?"
      footerLinkLabel="Create an account"
      footerHref="/register"
    >
      {error && <Banner message={error} />}
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Button label="Sign in" onPress={submit} loading={submitting} disabled={!canSubmit} />
    </AuthLayout>
  );
}
