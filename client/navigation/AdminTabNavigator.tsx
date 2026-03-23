import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet } from "react-native";

import AdminMapScreen from "@/screens/admin/AdminMapScreen";
import RouteBuilderScreen from "@/screens/admin/RouteBuilderScreen";
import AllLeadsScreen from "@/screens/admin/AllLeadsScreen";
import AnalyticsScreen from "@/screens/admin/AnalyticsScreen";
import TeamScreen from "@/screens/admin/TeamScreen";
import ImportScreen from "@/screens/admin/ImportScreen";
import CanvassScreen from "@/screens/CanvassScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useTheme } from "@/hooks/useTheme";

export type AdminTabParamList = {
  LiveMapTab: undefined;
  CanvassTab: undefined;
  RouteBuilderTab: undefined;
  AllLeadsTab: undefined;
  AnalyticsTab: undefined;
  TeamTab: undefined;
  ImportTab: undefined;
};

const Tab = createBottomTabNavigator<AdminTabParamList>();

export default function AdminTabNavigator() {
  const { theme, isDark } = useTheme();
  return (
    <Tab.Navigator
      initialRouteName="LiveMapTab"
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
        headerStyle: {
          backgroundColor: theme.backgroundRoot,
        },
      }}
    >
      <Tab.Screen
        name="LiveMapTab"
        component={AdminMapScreen}
        options={{
          title: "Live Map",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Feather name="map" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="CanvassTab"
        component={CanvassScreen}
        options={{
          title: "Canvass",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Feather name="map-pin" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="RouteBuilderTab"
        component={RouteBuilderScreen}
        options={{
          title: "Routes",
          headerTitle: () => <HeaderTitle title="Routes" />,
          tabBarIcon: ({ color, size }) => (
            <Feather name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="AllLeadsTab"
        component={AllLeadsScreen}
        options={{
          title: "Leads",
          headerTitle: () => <HeaderTitle title="All Leads" />,
          tabBarIcon: ({ color, size }) => (
            <Feather name="users" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="AnalyticsTab"
        component={AnalyticsScreen}
        options={{
          title: "Analytics",
          headerTitle: () => <HeaderTitle title="Analytics" />,
          tabBarIcon: ({ color, size }) => (
            <Feather name="bar-chart-2" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="TeamTab"
        component={TeamScreen}
        options={{
          title: "Team",
          headerTitle: () => <HeaderTitle title="Team" />,
          tabBarIcon: ({ color, size }) => (
            <Feather name="briefcase" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ImportTab"
        component={ImportScreen}
        options={{
          title: "Import",
          headerTitle: () => <HeaderTitle title="WPW Import" />,
          tabBarIcon: ({ color, size }) => (
            <Feather name="upload-cloud" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
