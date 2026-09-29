import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Tabs } from 'expo-router';
import { StoreProvider } from '@/lib/store';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { QuickActionsProvider } from '@/components/QuickActionsProvider';
import { StoreStatusGate } from '@/components/StoreStatusGate';
import { BiometricGate } from '@/components/BiometricGate';
import { CosmicBackground } from '@/components/CosmicBackground';
import '../global.css';

export default function RootLayout() {
  return (
    <StoreProvider>
      {/* OLED cosmic wallpaper sits behind every screen. */}
      <CosmicBackground />
      {/* The Volt system is dark-first: light content on the near-black ground. */}
      <StatusBar style="light" />
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
    </StoreProvider>
  );
}
