import React, { useCallback, useState } from "react";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/contexts/AuthContext";
import RootNavigator from "./src/navigation/RootNavigator";

export default function App() {
  const navigationRef = useNavigationContainerRef();
  const [activeRouteName, setActiveRouteName] = useState<string | null>(null);

  const syncActiveRoute = useCallback(() => {
    setActiveRouteName(navigationRef.getCurrentRoute()?.name ?? null);
  }, [navigationRef]);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer
          ref={navigationRef}
          onReady={syncActiveRoute}
          onStateChange={syncActiveRoute}
        >
          <RootNavigator activeRouteName={activeRouteName} />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
