import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Tabs } from 'expo-router';
import { StoreProvider } from '@/lib/store';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import '../global.css';

export default function RootLayout() {
  return (
    <StoreProvider>
      {/* The Volt system is dark-first: light content on the near-black ground. */}
      <StatusBar style="light" />
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
      </Tabs>
    </StoreProvider>
  );
}
