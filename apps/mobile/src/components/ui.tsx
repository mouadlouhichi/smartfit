import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput as RNTextInput,
  View,
  type TextInputProps,
  type PressableProps,
} from 'react-native';
import { cn } from '@/lib/cn';

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <View className={cn('rounded-2xl border border-border bg-card p-4', className)}>{children}</View>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text className="mb-1.5 text-sm font-medium text-foreground/80">{children}</Text>;
}

export function Input(props: TextInputProps) {
  return (
    <RNTextInput
      placeholderTextColor="#9aa7a0"
      className="h-11 rounded-xl border border-border bg-background px-3 text-base text-foreground"
      {...props}
    />
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  className,
  ...rest
}: PressableProps & { label: string; variant?: Variant; loading?: boolean; className?: string }) {
  const styles: Record<Variant, string> = {
    primary: 'bg-primary',
    secondary: 'bg-muted',
    ghost: 'bg-transparent',
    destructive: 'bg-destructive',
  };
  const textColor: Record<Variant, string> = {
    primary: 'text-primary-foreground',
    secondary: 'text-foreground',
    ghost: 'text-primary',
    destructive: 'text-white',
  };
  return (
    <Pressable
      onPress={onPress}
      disabled={loading || rest.disabled}
      className={cn(
        'h-11 flex-row items-center justify-center rounded-full px-5 active:opacity-80',
        styles[variant],
        rest.disabled && 'opacity-50',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#0B0E09' : '#C8F135'} />
      ) : (
        <Text className={cn('text-sm font-semibold', textColor[variant])}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Badge({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <View
      className="rounded-full px-2.5 py-1"
      style={{ backgroundColor: color ? `${color}1a` : '#1B2113' }}
    >
      <Text className="text-xs font-semibold" style={{ color: color ?? '#EFF3E6' }}>
        {children}
      </Text>
    </View>
  );
}

export function ProgressBar({ value, color = '#C8F135' }: { value: number; color?: string }) {
  return (
    <View className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
      <View
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }}
      />
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{children}</Text>;
}
