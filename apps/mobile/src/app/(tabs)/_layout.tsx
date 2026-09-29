import React from 'react';
import { Tabs } from 'expo-router';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { QuickActionsProvider } from '@/components/QuickActionsProvider';
import { StoreStatusGate } from '@/components/StoreStatusGate';
import { BiometricGate } from '@/components/BiometricGate';

/**
 * The configured-app shell: the floating tab bar is the only navigation chrome,
 * and every screen inside it is a tab (coach and run are hidden tabs reached by
 * push).
 *
 * Providers that only matter once a profile exists — biometric unlock, quick
 * actions, the load/error gate — live here rather than at the root, so they
 * never wrap the onboarding flow.
 */
export default function TabsLayout() {
  return (
    <BiometricGate>
      <QuickActionsProvider>
        <StoreStatusGate>
          <Tabs
            screenOptions={{
              headerShown: false,
              // Hide the native tab bar chrome; our FloatingTabBar is the only nav.
              tabBarStyle: { display: 'none' },
            }}
            tabBar={(props) => <FloatingTabBar {...props} />}
          >
            <Tabs.Screen name="index" options={{ title: 'Home' }} />
            <Tabs.Screen name="plan" options={{ title: 'Plan' }} />
            <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
            <Tabs.Screen name="goals" options={{ title: 'Goals' }} />
            <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
            <Tabs.Screen name="coach" options={{ href: null }} />
            <Tabs.Screen name="run" options={{ href: null }} />
          </Tabs>
        </StoreStatusGate>
      </QuickActionsProvider>
    </BiometricGate>
  );
}
