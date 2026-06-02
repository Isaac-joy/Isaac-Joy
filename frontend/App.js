import "react-native-url-polyfill/auto";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "./lib/supabase";
import { api } from "./lib/api";
import { colors } from "./theme";
import AuthScreen from "./screens/AuthScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import DashboardScreen from "./screens/DashboardScreen";
import DailyLogScreen from "./screens/DailyLogScreen";
import MissionsScreen from "./screens/MissionsScreen";
import WorkoutsScreen from "./screens/WorkoutsScreen";
import ResourcesScreen from "./screens/ResourcesScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.bg,
    card: colors.bgAlt,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
};

const TAB_ICON = {
  Dashboard: ["stats-chart", "stats-chart-outline"],
  Missions: ["flash", "flash-outline"],
  Workouts: ["barbell", "barbell-outline"],
  Resources: ["library", "library-outline"],
  Report: ["pulse", "pulse-outline"],
};

function SignOutButton() {
  return (
    <TouchableOpacity onPress={() => supabase.auth.signOut()} hitSlop={10} style={{ marginRight: 16 }}>
      <Text style={styles.exit}>EXIT</Text>
    </TouchableOpacity>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      sceneContainerStyle={{ backgroundColor: colors.bg }}
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.bgAlt },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: { letterSpacing: 2, fontWeight: "900" },
        tabBarStyle: {
          backgroundColor: colors.bgAlt,
          borderTopColor: colors.border,
          height: 62,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accentGlow,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: { fontSize: 9, letterSpacing: 0.5, fontWeight: "700" },
        tabBarIcon: ({ focused, color, size }) => {
          const [on, off] = TAB_ICON[route.name] || ["ellipse", "ellipse-outline"];
          return <Ionicons name={focused ? on : off} size={size - 3} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: "THE SYSTEM", tabBarLabel: "SYSTEM", headerRight: () => <SignOutButton /> }}
      />
      <Tab.Screen
        name="Missions"
        component={MissionsScreen}
        options={{ title: "MISSIONS", tabBarLabel: "MISSIONS" }}
      />
      <Tab.Screen
        name="Workouts"
        component={WorkoutsScreen}
        options={{ title: "THE FORGE", tabBarLabel: "TRAIN" }}
      />
      <Tab.Screen
        name="Resources"
        component={ResourcesScreen}
        options={{ title: "THE ARMORY", tabBarLabel: "LIBRARY" }}
      />
      <Tab.Screen
        name="Report"
        component={DailyLogScreen}
        options={{ title: "REPORT", tabBarLabel: "REPORT" }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function decideOnboarding() {
      try {
        const profile = await api.getProfile();
        const done =
          profile && (profile.age || profile.occupation || profile.academic_goal);
        if (mounted) setNeedsOnboarding(!done);
      } catch (_) {
        if (mounted) setNeedsOnboarding(true);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) decideOnboarding();
      else setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      if (s) {
        setLoading(true);
        decideOnboarding();
      } else {
        setNeedsOnboarding(false);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.splash}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!session) {
    return (
      <>
        <StatusBar style="light" />
        <AuthScreen />
      </>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName={needsOnboarding ? "Onboarding" : "Main"}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{
            headerShown: true,
            title: "THE AWAKENING",
            headerBackVisible: false,
            headerStyle: { backgroundColor: colors.bgAlt },
            headerShadowVisible: false,
            headerTintColor: colors.text,
            headerTitleStyle: { letterSpacing: 2, fontWeight: "900" },
          }}
        />
        <Stack.Screen name="Main" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
  },
  exit: { color: colors.textDim, fontSize: 12, letterSpacing: 1, fontWeight: "700" },
});
