import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";
import {
    DATA_VERSAO,
    VERSAO_PRIVACIDADE,
    VERSAO_TERMOS,
} from "../lib/termos-versoes";

export default function AceitarTermosScreen() {
  const [carregando, setCarregando] = useState(true);
  const [aceitou, setAceitou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const salvandoRef = useRef(false);

  // Ao abrir, checa se o usuário precisa mesmo aceitar.
  // Se já aceitou a versão atual, volta direto para o app.
  useEffect(() => {
    let ativo = true;

    async function verificar() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!ativo) return;

        if (!user) {
          router.replace("/login" as any);
          return;
        }

        const { data, error } = await supabase
          .from("termos_aceites")
          .select("versao_termos, versao_privacidade")
          .eq("user_id", user.id)
          .order("aceito_em", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!ativo) return;

        if (error) {
          console.log("Erro ao verificar aceite:", error);
        }

        if (
          data &&
          data.versao_termos === VERSAO_TERMOS &&
          data.versao_privacidade === VERSAO_PRIVACIDADE
        ) {
          // Já aceitou a versão atual: libera.
          router.replace("/(tabs)" as any);
          return;
        }

        setCarregando(false);
      } catch (err) {
        console.log("Erro ao verificar aceite (catch):", err);
        if (ativo) setCarregando(false);
      }
    }

    void verificar();

    return () => {
      ativo = false;
    };
  }, []);

  async function aceitar() {
    if (!aceitou || salvandoRef.current) return;
    salvandoRef.current = true;
    setSalvando(true);
    setErro("");

    try {
      const { error } = await supabase.rpc("registrar_aceite_termos", {
        p_versao_termos: VERSAO_TERMOS,
        p_versao_privacidade: VERSAO_PRIVACIDADE,
      });

      if (error) {
        console.log("Erro ao registrar aceite:", error);
        setErro("Não foi possível registrar o aceite. Tente novamente.");
        salvandoRef.current = false;
        setSalvando(false);
        return;
      }

      router.replace("/(tabs)" as any);
    } catch (err) {
      console.log("Exceção ao registrar aceite:", err);
      setErro("Não foi possível registrar o aceite. Tente novamente.");
      salvandoRef.current = false;
      setSalvando(false);
    }
  }

  async function sair() {
    await supabase.auth.signOut();
    router.replace("/login" as any);
  }

  if (carregando) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#7C5CFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.iconBox}>
            <Ionicons name="document-text-outline" size={28} color="#B6AAFF" />
          </View>

          <Text style={styles.brand}>ORVENA</Text>

          <Text style={styles.title}>Termos atualizados</Text>

          <Text style={styles.subtitle}>
            Para continuar usando o Orvena, você precisa aceitar a versão mais
            recente dos nossos documentos legais.
          </Text>

          <View style={styles.versionBox}>
            <View style={styles.versionRow}>
              <Text style={styles.versionLabel}>Termos de Uso</Text>
              <Text style={styles.versionValue}>v{VERSAO_TERMOS}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.versionRow}>
              <Text style={styles.versionLabel}>Política de Privacidade</Text>
              <Text style={styles.versionValue}>v{VERSAO_PRIVACIDADE}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.versionRow}>
              <Text style={styles.versionLabel}>Atualizado em</Text>
              <Text style={styles.versionValue}>{DATA_VERSAO}</Text>
            </View>
          </View>

          <Pressable
            style={styles.termsRow}
            onPress={() => setAceitou((v) => !v)}
          >
            <View style={[styles.checkbox, aceitou && styles.checkboxChecked]}>
              {aceitou ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <Text style={styles.termsText}>
              Li e concordo com os{" "}
              <Text
                style={styles.termsLink}
                onPress={(e) => {
                  e.stopPropagation();
                  router.push("/termos");
                }}
              >
                Termos de Uso
              </Text>{" "}
              e a{" "}
              <Text
                style={styles.termsLink}
                onPress={(e) => {
                  e.stopPropagation();
                  router.push("/privacidade");
                }}
              >
                Política de Privacidade
              </Text>
              .
            </Text>
          </Pressable>

          {erro ? <Text style={styles.error}>{erro}</Text> : null}

          <Pressable
            style={[
              styles.primaryButton,
              (!aceitou || salvando) && styles.primaryButtonDisabled,
            ]}
            onPress={aceitar}
            disabled={!aceitou || salvando}
          >
            {salvando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>ACEITAR E CONTINUAR</Text>
            )}
          </Pressable>

          <Pressable style={styles.logoutButton} onPress={sair}>
            <Text style={styles.logoutText}>Sair da conta</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B0C10",
  },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    paddingVertical: 30,
  },

  card: {
    width: "100%",
    maxWidth: 460,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#292D36",
    backgroundColor: "#12151B",
    padding: 28,
  },

  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: "#211C34",
    borderWidth: 1,
    borderColor: "#352D55",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  brand: {
    color: "#7C5CFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 8,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 8,
  },

  subtitle: {
    color: "#969DA8",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 22,
  },

  versionBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2E37",
    backgroundColor: "#0D1015",
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 20,
  },

  versionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },

  divider: {
    height: 1,
    backgroundColor: "#1C2029",
  },

  versionLabel: {
    color: "#A8AEB7",
    fontSize: 12,
    fontWeight: "600",
  },

  versionValue: {
    color: "#B6AAFF",
    fontSize: 12,
    fontWeight: "900",
  },

  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 20,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#3A3F49",
    backgroundColor: "#0F1217",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },

  checkboxChecked: {
    borderColor: "#7C5CFF",
    backgroundColor: "#7C5CFF",
  },

  checkmark: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },

  termsText: {
    flex: 1,
    color: "#7F8691",
    fontSize: 12,
    lineHeight: 19,
  },

  termsLink: {
    color: "#B4A7FF",
    fontWeight: "900",
  },

  error: {
    color: "#FF7D86",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },

  primaryButton: {
    height: 54,
    borderRadius: 15,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
  },

  primaryButtonDisabled: {
    opacity: 0.38,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  logoutButton: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 6,
  },

  logoutText: {
    color: "#777E89",
    fontSize: 12,
    fontWeight: "700",
  },
});