import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Tabs } from 'expo-router';
import {
  CalendarCheck2,
  Home,
  LineChart,
  Target,
  UserRound,
} from 'lucide-react-native';
import { StoreProvider } from '@/lib/store';
import '../global.css';

export default function RootLayout() {
  return (
    <StoreProvider>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#15803D',
          tabBarInactiveTintColor: '#9AA7A0',
          tabBarStyle: { borderTopColor: '#E2E8E3', height: 60, paddingBottom: 8, paddingTop: 6 },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="plan"
          options={{
            title: 'Plan',
            tabBarIcon: ({ color, size }) => <CalendarCheck2 color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progress',
            tabBarIcon: ({ color, size }) => <LineChart color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="goals"
          options={{
            title: 'Goals',
            tabBarIcon: ({ color, size }) => <Target color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} />,
          }}
        />
      </Tabs>
    </StoreProvider>
  );
}
