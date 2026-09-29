/**
 * Biometric app-lock (Face ID / Touch ID / Fingerprint) for the mobile app.
 *
 * Controlled by a profile flag (`profile.biometricLock: true`). When enabled,
 * the root layout shows an unlock gate until the user authenticates. The
 * gate does nothing on web or when no hardware is available.
 */
import { Platform } from 'react-native';

type AuthModule = {
  hasHardwareAsync: () => Promise<boolean>;
  isEnrolledAsync: () => Promise<boolean>;
  supportedAuthenticationTypesAsync: () => Promise<number[]>;
  authenticateAsync: (
    reason: string,
    opts?: {
      promptMessage?: string;
      cancelLabel?: string;
      fallbackLabel?: string;
      disableDeviceFallback?: boolean;
    },
  ) => Promise<{ success: boolean; error?: string }>;
  AuthenticationType?: { FACIAL: number; FINGERPRINT: number; IRIS: number };
};

let Auth: AuthModule | null = null;
let tried = false;

function load(): AuthModule | null {
  if (tried) return Auth;
  tried = true;
  if (Platform.OS === 'web') return null;
  try {
    Auth = require('expo-local-authentication');
  } catch {
    Auth = null;
  }
  return Auth;
}

export interface BiometricAvailability {
  available: boolean;
  enrolled: boolean;
  /** List of supported auth types, e.g. ['Face ID', 'Fingerprint']. */
  types: string[];
}

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  const a = load();
  if (!a) return { available: false, enrolled: false, types: [] };
  try {
    const [available, enrolled, types] = await Promise.all([
      a.hasHardwareAsync(),
      a.isEnrolledAsync(),
      a.supportedAuthenticationTypesAsync?.().catch(() => [] as number[]) ?? Promise.resolve([]),
    ]);
    const labels: string[] = [];
    const mask = a.AuthenticationType;
    if (mask) {
      if (types.includes(mask.FACIAL)) labels.push(Platform.OS === 'ios' ? 'Face ID' : 'Face');
      if (types.includes(mask.FINGERPRINT))
        labels.push(Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint');
      if (types.includes(mask.IRIS)) labels.push('Iris');
    }
    return { available, enrolled, types: labels };
  } catch {
    return { available: false, enrolled: false, types: [] };
  }
}

export async function authenticate(promptMessage = 'Unlock SmartFit'): Promise<boolean> {
  const a = load();
  if (!a) return true; // no module -> no lock
  try {
    const res = await a.authenticateAsync(promptMessage, {
      promptMessage,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return !!res.success;
  } catch {
    return false;
  }
}
