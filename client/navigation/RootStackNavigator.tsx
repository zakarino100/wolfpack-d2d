import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import MainTabNavigator from "@/navigation/MainTabNavigator";
import AdminTabNavigator from "@/navigation/AdminTabNavigator";
import TechTabNavigator from "@/navigation/TechTabNavigator";
import LoginScreen from "@/screens/LoginScreen";
import TechLoginScreen from "@/screens/TechLoginScreen";
import LeadDetailScreen from "@/screens/LeadDetailScreen";
import TechJobStartScreen from "@/screens/tech/TechJobStartScreen";
import TechJobCompleteScreen from "@/screens/tech/TechJobCompleteScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/hooks/useAuth";
import { LoadingState } from "@/components/LoadingState";
import { ThemedView } from "@/components/ThemedView";

export type RootStackParamList = {
  Login: undefined;
  TechLogin: undefined;
  Main: undefined;
  TechMain: undefined;
  LeadDetail: { leadId: string };
  TechJobStart: { job: any };
  TechJobComplete: { job: any };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <ThemedView style={{ flex: 1 }}>
        <LoadingState />
      </ThemedView>
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {user ? (
        <>
          <Stack.Screen
            name="Main"
            component={user.role === "admin" ? AdminTabNavigator : MainTabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="TechMain"
            component={TechTabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="TechJobStart"
            component={TechJobStartScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="TechJobComplete"
            component={TechJobCompleteScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="LeadDetail"
            component={LeadDetailScreen}
            options={{ headerTitle: "Lead Details" }}
          />
        </>
      ) : (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="TechLogin"
            component={TechLoginScreen}
            options={{ headerShown: false }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
