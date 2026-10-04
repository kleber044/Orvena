import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: "#0B0C10",
        },
        animation: "fade",
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
