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
import NotificationsScreen from "@/screens/admin/NotificationsScreen";
import CanvassScreen from "@/screens/CanvassScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useTheme } from "@/hooks/useTheme";
import { useQuery } from "@tanstack/react-query";
import { Lead } from "@/types";

export type AdminTabParamList = {
  LiveMapTab: undefined;
  CanvassTab: undefined;
  RouteBuilderTab: undefined;
  AllLeadsTab: undefined;
  NotificationsTab: undefined;
  AnalyticsTab: undefined;
  TeamTab: undefined;
  ImportTab: undefined;
};

const Tab = createBottomTabNavigator<AdminTabParamList>();

const INBOUND_SOURCES = ["ad", "wolf_pack_wash_website", "call", "Meta - Wolf Pack Wash"];

export default function AdminTabNavigator() {
  const { theme, isDark } = useTheme();

  // Badge count — new inbound leads in last 24h
  const { data: leadsData } = useQuery<{ leads: Lead[] }>({
    queryKey: ["/api/leads"],
    refetchInterval: 30000,
  });
  const newInboundCount = (leadsData?.leads ?? []).filter(l =>
    (INBOUND_SOURCES.some(s => l.source?.includes(s)) || (l.source !== "d2d" && l.source !== "referral" && l.created_by !== "canvass")) &&
    Date.now() - new Date(l.created_at).getTime() < 86400000 &&
    (l.status === "follow_up" || (l.status as string) === "new")
  ).length;

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
        name="NotificationsTab"
        component={NotificationsScreen}
        options={{
          title: "Inbound",
          headerTitle: () => <HeaderTitle title="Inbound Leads" />,
          tabBarBadge: newInboundCount > 0 ? newInboundCount : undefined,
          tabBarIcon: ({ color, size }) => (
            <Feather name="bell" size={size} color={color} />
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
