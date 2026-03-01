import React, { useEffect, useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import SplashScreen from "../screens/SplashScreen";
<<<<<<< HEAD
import AskScreen from "../screens/AskScreen";
=======
import HomeScreen from "../screens/HomeScreen";
import AskScreen from "../screens/AskScreen";
import CommunityScreen from "../screens/CommunityScreen";
import SavedScreen from "../screens/SavedScreen";
>>>>>>> 492a6d0b8c297864aefb0807859b20bdee4b0ca0
import ProfileScreen from "../screens/ProfileScreen";
import CustomTabBar from "./CustomTabBar";
import HomeStack from "./HomeStack";

<<<<<<< HEAD
// Community still accessible from Ask top icon (stack screen)
import CommunityScreen from "../screens/CommunityScreen";

=======
>>>>>>> 492a6d0b8c297864aefb0807859b20bdee4b0ca0
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function Tabs() {
  return (
    <Tab.Navigator
<<<<<<< HEAD
      initialRouteName="Ask"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Ask" component={AskScreen} />
=======
      initialRouteName="Home"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="Ask" component={AskScreen} />
      <Tab.Screen name="Community" component={CommunityScreen} />
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Saved" component={SavedScreen} />
>>>>>>> 492a6d0b8c297864aefb0807859b20bdee4b0ca0
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {showSplash ? (
        <Stack.Screen name="Splash" component={SplashScreen} />
      ) : (
<<<<<<< HEAD
        <>
          <Stack.Screen name="Main" component={Tabs} />
          <Stack.Screen name="Community" component={CommunityScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
=======
        <Stack.Screen name="Main" component={Tabs} />
      )}
    </Stack.Navigator>
  );
}
>>>>>>> 492a6d0b8c297864aefb0807859b20bdee4b0ca0
