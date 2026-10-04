import { AppState, Platform } from "react-native";
import "react-native-url-polyfill/auto";

import { createClient } from "@supabase/supabase-js";

import { armazenamentoSessaoSeguro } from "./secure-session-storage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_URL não foi configurada no arquivo .env."
  );
}

if (!supabasePublishableKey) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY não foi configurada no arquivo .env."
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      ...(Platform.OS !== "web"
        ? {
            storage: armazenamentoSessaoSeguro,
          }
        : {}),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  }
);

if (Platform.OS !== "web") {
  if (AppState.currentState === "active") {
    supabase.auth.startAutoRefresh();
  }

  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
