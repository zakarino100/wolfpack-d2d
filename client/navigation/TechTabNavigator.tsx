import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet } from "react-native";
import { useTheme } from "@/hooks/useTheme";

import TechJobsScreen from "@/screens/tech/TechJobsScreen";
import TechClockScreen from "@/screens/tech/TechClockScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import { HeaderTitle } from "@/components/HeaderTitle";

export type TechTabParamList = {
  TechJobsTab: undefined;
  TechClockTab: undefined;
  TechProfileTab: undefined;
};

const Tab = createBottomTabNavigator<TechTabParamList>();

export default function TechTabNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="TechJobsTab"
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: theme.backgroundRoot,
            web: theme.backgroundRoot,
          }),
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        headerTitleAlign: "center",
        headerTintColor: theme.text,
        headerStyle: { backgroundColor: theme.backgroundRoot },
      }}
    >
      <Tab.Screen
        name="TechJobsTab"
        component={TechJobsScreen}
        options={{
          title: "My Jobs",
          headerTitle: () => <HeaderTitle title="My Jobs" />,
          tabBarIcon: ({ color, size }) => <Feather name="briefcase" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="TechClockTab"
        component={TechClockScreen}
        options={{
          title: "Clock",
          headerTitle: () => <HeaderTitle title="Clock" />,
          tabBarIcon: ({ color, size }) => <Feather name="clock" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="TechProfileTab"
        component={ProfileScreen}
        options={{
          title: "Profile",
          headerTitle: () => <HeaderTitle title="Profile" />,
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
