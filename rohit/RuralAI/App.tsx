import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import RootNavigator from "./src/navigation/RootNavigator";

import { AlertProvider } from "./src/components/ui/AlertProvider";

export default function App() {
  return (
    <AlertProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AlertProvider>
  );
}