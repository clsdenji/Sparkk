import { Tabs } from "expo-router";
import CustomNavBar from "./CustomNavBar";
import { enableScreens } from 'react-native-screens'; // import enableScreens

// Call enableScreens at the start of the app
enableScreens();

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="map"
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" }, // Hide default tab bar
      }}
      tabBar={(props) => <CustomNavBar {...props} />}
    >
      <Tabs.Screen
        name="map"
        options={{
          headerShown: false,
          title: "Map",
          // Define transitions here for custom tab transitions
          // Example: Using `tabBarOptions` for animations or custom transitions
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          headerShown: false,
          title: "Saved",
          // Apply fade or other custom transitions in the correct way
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          headerShown: false,
          title: "History",
          // Apply fade or other custom transitions in the correct way
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          headerShown: false,
          title: "Profile",
          // Apply fade or other custom transitions in the correct way
        }}
      />
    </Tabs>
  );
}
