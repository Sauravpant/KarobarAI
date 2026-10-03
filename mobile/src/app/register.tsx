import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';

import { errorMessage } from '@/api/client';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { isValidEmail, normalizeEmail } from '@/lib/validation';
import { useSession } from '@/providers/session-provider';

export default function RegisterScreen() {
  const { signUp } = useSession();
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password/phone rules are owned by the backend (UserRegisterRequest); its 422 detail is shown as-is.
  const canSubmit = fullName.trim().length > 0 && isValidEmail(email) && password.length > 0;

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // On success the session gets a token and the route guard moves to shop selection.
      await signUp({
        full_name: fullName.trim(),
        email: normalizeEmail(email),
        password,
        phone: phone.trim() || null,
      });
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Same account works on the KarobarAI web dashboard."
      footerText="Already have an account?"
      footerLinkLabel="Sign in"
      footerHref="/login"
    >
      {error && <Banner message={error} />}
      <TextField
        label="Full name"
        value={fullName}
        onChangeText={setFullName}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <TextField
        ref={emailRef}
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => phoneRef.current?.focus()}
      />
      <TextField
        ref={phoneRef}
        label="Phone (optional)"
        value={phone}
        onChangeText={setPhone}
        autoComplete="tel"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Button label="Create account" onPress={submit} loading={submitting} disabled={!canSubmit} />
    </AuthLayout>
  );
}
