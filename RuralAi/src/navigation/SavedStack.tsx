import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SavedScreen from "../screens/SavedScreen";
import SavedDetailScreen from "../screens/SavedDetailScreen";

export type SavedStackParamList = {
  SavedMain: undefined;
  SavedDetail: { itemId: string };
};

const Stack = createNativeStackNavigator<SavedStackParamList>();

export default function SavedStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SavedMain" component={SavedScreen} />
      <Stack.Screen name="SavedDetail" component={SavedDetailScreen} />
    </Stack.Navigator>
  );
}