import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, Eye, EyeOff, Mail, ShieldCheck } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '@/lib/firebase/auth-context';
import { Button, Card, Input, Label } from '@/components/ui';
import { haptics } from '@/lib/haptics';

type View_ = 'signin' | 'signup' | 'reset';

const VOLT = '#f3ff47';

/**
 * Google's mark, drawn inline so the button needs no image asset. The four
 * paths are copied verbatim from the web login page's `GoogleMark`, so both
 * apps show the identical official glyph.
 */
function GoogleMark() {
  return (
    <Svg viewBox="0 0 24 24" width={16} height={16} accessibilityElementsHidden>
      <Path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <Path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <Path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <Path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </Svg>
  );
}

/**
 * Sign-in / sign-up / password reset.
 *
 * A native port of `src/app/login/page.tsx`, deliberately matching its UI/UX:
 * the same three views, the same copy, the same order (heading → subhead →
 * fields → primary action → "or" rule → Google), and the same rule that a
 * local-mode build explains itself instead of showing a form that can only
 * fail with a configuration error.
 *
 * The web's two-column split (brand art | form) collapses to a single column
 * here — that is exactly what the web does below `lg`, so the phone layout is
 * the same layout, not a redesign.
 */
export default function LoginScreen() {
  const router = useRouter();

  const {
    mode,
    user,
    initializing,
    loading,
    authError,
    authInfo,
    signIn,
    signUp,
    signInWithGoogle,
    resetPassword,
    clearError,
  } = useAuth();

  const [view, setView] = useState<View_>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const cloud = mode === 'cloud';
  const isSignUp = view === 'signup';
  const isReset = view === 'reset';

  async function submit() {
    if (loading) return;
    void haptics.tap();
    if (isReset) {
      await resetPassword(email.trim());
      return;
    }
    if (isSignUp) {
      await signUp(email.trim(), password, name.trim() || undefined);
      return;
    }
    await signIn(email.trim(), password);
  }

  // ── Local mode ────────────────────────────────────────────────────────────
  // A deployment with no accounts must not show a sign-in form: every attempt
  // would fail with a configuration error and send the visitor in circles.
  // Same screen and same single action as the web.
  if (!cloud) {
    return (
      <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
          <View className="items-center gap-6">
            <Text className="text-primary text-2xl font-black tracking-tight">SmartFit</Text>
            <Card className="w-full items-center gap-3 p-6">
              <View className="bg-primary/15 h-12 w-12 items-center justify-center rounded-2xl">
                <ShieldCheck color={VOLT} size={24} />
              </View>
              <Text className="text-foreground text-center text-xl font-bold">
                This SmartFit runs on-device
              </Text>
              <Text className="text-muted-foreground text-center text-sm leading-6">
                No accounts or servers are configured for this app — your training lives on this
                device only.
              </Text>
              <Button
                label="Continue on this device"
                className="mt-3 w-full"
                onPress={() => router.replace('/')}
              />
            </Card>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Resolving / bouncing an already-signed-in user ─────────────────────────
  if (initializing || user) {
    return (
      <SafeAreaView
        className="bg-background flex-1 items-center justify-center"
        accessibilityLabel="Loading"
        accessible
      >
        <ActivityIndicator color={VOLT} size="large" />
      </SafeAreaView>
    );
  }

  // ── Cloud mode: the form ──────────────────────────────────────────────────
  const heading = isReset
    ? 'Reset your password'
    : isSignUp
      ? 'Create your account'
      : 'Welcome back';
  const subhead = isReset
    ? "Enter your email and we'll send you a reset link."
    : isSignUp
      ? 'Sign up to sync your training across every device.'
      : 'Sign in to pick up right where you left off.';
  const submitLabel = isReset ? 'Send reset link' : isSignUp ? 'Create account' : 'Sign in';

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Compact hero — the mobile half of the web's split layout. */}
          <View className="mb-6 items-center gap-3">
            <Text className="text-primary text-2xl font-black tracking-tight">SmartFit</Text>
            <Text className="text-foreground text-center text-2xl leading-tight font-black">
              Train on your terms
            </Text>
          </View>

          <Card className="w-full gap-1 p-6">
            <Text className="text-foreground text-2xl font-extrabold tracking-tight">
              {heading}
            </Text>
            <Text className="text-muted-foreground text-sm leading-6">{subhead}</Text>

            <View className="mt-6 gap-3.5">
              {isSignUp && (
                <View className="gap-1.5">
                  <Label>Name</Label>
                  <Input
                    placeholder="What should we call you?"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    accessibilityLabel="Name"
                  />
                </View>
              )}

              <View className="gap-1.5">
                <Label>Email</Label>
                <View className="justify-center">
                  <Mail
                    color="rgba(255,255,255,0.5)"
                    size={16}
                    style={{ position: 'absolute', left: 12, zIndex: 1 }}
                  />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    accessibilityLabel="Email"
                    className="border-border bg-card text-foreground rounded-xl border py-3 pr-3 pl-10"
                  />
                </View>
              </View>

              {!isReset && (
                <View className="gap-1.5">
                  <View className="flex-row items-center justify-between">
                    <Label>Password</Label>
                    {!isSignUp && (
                      <Pressable
                        onPress={() => {
                          clearError();
                          setView('reset');
                        }}
                        accessibilityRole="button"
                        hitSlop={8}
                      >
                        <Text className="text-primary mb-1.5 text-sm font-semibold">
                          Forgot password?
                        </Text>
                      </Pressable>
                    )}
                  </View>
                  <View className="justify-center">
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="••••••••"
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                      textContentType={isSignUp ? 'newPassword' : 'password'}
                      accessibilityLabel="Password"
                      className="border-border bg-card text-foreground rounded-xl border py-3 pr-12 pl-3"
                    />
                    <Pressable
                      onPress={() => setShowPassword((v) => !v)}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                      hitSlop={10}
                      style={{ position: 'absolute', right: 12 }}
                    >
                      {showPassword ? (
                        <EyeOff color="rgba(255,255,255,0.5)" size={18} />
                      ) : (
                        <Eye color="rgba(255,255,255,0.5)" size={18} />
                      )}
                    </Pressable>
                  </View>
                  {isSignUp && (
                    <Text className="text-muted-foreground text-xs">At least 6 characters.</Text>
                  )}
                </View>
              )}

              {authError ? <Text className="text-destructive text-sm">{authError}</Text> : null}
              {authInfo ? <Text className="text-primary text-sm">{authInfo}</Text> : null}

              <Button
                label={submitLabel}
                onPress={submit}
                loading={loading}
                icon={loading ? undefined : <ArrowRight color="#101010" size={16} />}
                className="h-12 w-full"
              />
            </View>

            {isReset ? (
              <Pressable
                onPress={() => {
                  clearError();
                  setView('signin');
                }}
                className="mt-5 items-center"
                accessibilityRole="button"
              >
                <Text className="text-primary text-sm font-bold">Back to sign in</Text>
              </Pressable>
            ) : (
              <>
                <View className="my-5 flex-row items-center gap-3">
                  <View className="bg-border h-px flex-1" />
                  <Text className="text-muted-foreground text-xs font-bold tracking-widest">
                    OR
                  </Text>
                  <View className="bg-border h-px flex-1" />
                </View>

                <Button
                  label="Continue with Google"
                  variant="secondary"
                  onPress={signInWithGoogle}
                  disabled={loading}
                  icon={<GoogleMark />}
                  className="h-12 w-full"
                />

                <View className="mt-6 flex-row items-center justify-center gap-1">
                  <Text className="text-muted-foreground text-sm">
                    {isSignUp ? 'Already have an account?' : 'New to SmartFit?'}
                  </Text>
                  <Pressable
                    onPress={() => {
                      clearError();
                      setView(isSignUp ? 'signin' : 'signup');
                    }}
                    accessibilityRole="button"
                    hitSlop={8}
                  >
                    <Text className="text-primary text-sm font-bold">
                      {isSignUp ? 'Sign in' : 'Create an account'}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </Card>

          <View className="mt-6 flex-row items-start justify-center gap-1.5 px-4">
            <ShieldCheck color="rgba(255,255,255,0.5)" size={14} style={{ marginTop: 2 }} />
            <Text className="text-muted-foreground text-center text-xs leading-5">
              Your training data is private to your account.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
