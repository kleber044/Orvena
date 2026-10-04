import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";

type Conta = {
  nome: string;
  email: string;
  plano: string;
};

export default function MinhaContaScreen() {
  const [conta, setConta] = useState<Conta | null>(null);
  const [nome, setNome] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [redirecionandoLogin, setRedirecionandoLogin] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  useFocusEffect(
    useCallback(() => {
      void carregarConta();
    }, [])
  );

  async function carregarConta() {
    try {
      setCarregando(true);
      setErro("");
      setMensagem("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setRedirecionandoLogin(true);
        router.replace("/login" as any);
        return;
      }

      const { data: perfil, error: perfilError } = await supabase
        .from("profiles")
        .select("nome, plano")
        .eq("id", user.id)
        .maybeSingle();

      if (perfilError) {
        console.log("Erro ao carregar perfil:", perfilError);
      }

      const nomeMetadata =
        typeof user.user_metadata?.nome === "string"
          ? user.user_metadata.nome.trim()
          : "";

      const nomeFinal =
        perfil?.nome?.trim() ||
        nomeMetadata ||
        "";

      const contaFinal = {
        nome: nomeFinal,
        email: user.email || "",
        plano: String(perfil?.plano || "free"),
      };

      setConta(contaFinal);
      setNome(contaFinal.nome);
    } catch (error) {
      console.log("Erro ao carregar Minha Conta:", error);
      setErro("Não foi possível carregar sua conta.");
    } finally {
      setCarregando(false);
    }
  }

  async function salvarNome() {
    const nomeLimpo = nome.trim();

    setErro("");
    setMensagem("");

    if (nomeLimpo.length < 2) {
      setErro("Informe um nome válido.");
      return;
    }

    try {
      setSalvando(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErro("Sua sessão expirou. Entre novamente.");
        return;
      }

      const { error: perfilError } = await supabase
        .from("profiles")
        .update({
          nome: nomeLimpo,
        })
        .eq("id", user.id);

      if (perfilError) {
        console.log("Erro ao atualizar nome no perfil:", perfilError);
        setErro("Não foi possível salvar seu nome. Tente novamente.");
        return;
      }

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          nome: nomeLimpo,
        },
      });

      if (authError) {
        console.log("Erro ao atualizar nome no Auth:", authError);
      }

      setConta((atual) =>
        atual
          ? {
              ...atual,
              nome: nomeLimpo,
            }
          : atual
      );

      setMensagem("Nome atualizado com sucesso.");
    } catch (error) {
      console.log("Erro ao salvar nome:", error);
      setErro("Não foi possível salvar seu nome. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  function planoTexto() {
    if (conta?.plano === "pro") return "Orvena Pro";
    if (conta?.plano === "trialing") return "Teste Pro";
    return "Plano Grátis";
  }

  if (carregando || redirecionandoLogin) {
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
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.page}>
            <View style={styles.header}>
              <Pressable
                style={styles.backButton}
                onPress={() => router.replace("/(tabs)" as any)}
              >
                <Text style={styles.backText}>←</Text>
              </Pressable>

              <View style={styles.headerText}>
                <Text style={styles.eyebrow}>ORVENA</Text>
                <Text style={styles.title}>Minha conta</Text>
                <Text style={styles.subtitle}>
                  Consulte e atualize seus dados pessoais.
                </Text>
              </View>
            </View>

            <View style={styles.profileCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(nome?.[0] || conta?.email?.[0] || "O").toUpperCase()}
                </Text>
              </View>

              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>
                  {nome.trim() || "Usuário"}
                </Text>
                <Text style={styles.profileEmail}>
                  {conta?.email || ""}
                </Text>
              </View>

              <View style={styles.planBadge}>
                <Text style={styles.planBadgeText}>{planoTexto()}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Dados pessoais</Text>

              <Text style={styles.label}>Nome</Text>
              <TextInput
                value={nome}
                onChangeText={setNome}
                placeholder="Seu nome"
                placeholderTextColor="#5B616C"
                autoCapitalize="words"
                maxLength={80}
                style={styles.input}
              />

              <Text style={styles.label}>E-mail</Text>
              <View style={styles.readonlyInput}>
                <Text style={styles.readonlyText}>
                  {conta?.email || "E-mail não encontrado"}
                </Text>
              </View>

              <Text style={styles.emailHint}>
                O e-mail da conta não pode ser alterado por aqui.
              </Text>

              {erro ? <Text style={styles.error}>{erro}</Text> : null}
              {mensagem ? <Text style={styles.success}>{mensagem}</Text> : null}

              <Pressable
                style={[styles.primaryButton, salvando && styles.buttonDisabled]}
                onPress={salvarNome}
                disabled={salvando}
              >
                {salvando ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    SALVAR ALTERAÇÕES
                  </Text>
                )}
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Segurança</Text>

              <Pressable
                style={styles.optionRow}
                onPress={() => router.push("/alterar-senha" as any)}
              >
                <View style={styles.optionIcon}>
                  <Text style={styles.optionIconText}>🔐</Text>
                </View>
                <View style={styles.optionTextArea}>
                  <Text style={styles.optionTitle}>Alterar senha</Text>
                  <Text style={styles.optionSubtitle}>
                    Troque a senha de acesso à sua conta
                  </Text>
                </View>
                <Text style={styles.optionArrow}>›</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Privacidade da conta</Text>

              <Pressable
                style={styles.optionRow}
                onPress={() =>
                  router.push("/solicitar-exclusao-conta" as any)
                }
              >
                <View style={[styles.optionIcon, styles.dangerIcon]}>
                  <Text style={styles.optionIconText}>🗑️</Text>
                </View>
                <View style={styles.optionTextArea}>
                  <Text style={[styles.optionTitle, styles.dangerText]}>
                    Solicitar exclusão da conta
                  </Text>
                  <Text style={styles.optionSubtitle}>
                    Envie um pedido para análise
                  </Text>
                </View>
                <Text style={styles.optionArrow}>›</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B0C10",
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    padding: 18,
    paddingVertical: 28,
  },
  page: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: "#A9AFB9",
    fontSize: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 22,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#15181E",
    borderWidth: 1,
    borderColor: "#252A33",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    color: "#FFFFFF",
    fontSize: 24,
    lineHeight: 26,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    color: "#8E78FF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginBottom: 5,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "800",
    marginBottom: 7,
  },
  subtitle: {
    color: "#9299A4",
    fontSize: 14,
    lineHeight: 21,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: "#12151A",
    borderWidth: 1,
    borderColor: "#252A33",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 3,
  },
  profileEmail: {
    color: "#8E95A0",
    fontSize: 12,
  },
  planBadge: {
    backgroundColor: "#211A3A",
    borderWidth: 1,
    borderColor: "#4C3A85",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  planBadgeText: {
    color: "#C8BCFF",
    fontSize: 10,
    fontWeight: "900",
  },
  card: {
    backgroundColor: "#12151A",
    borderWidth: 1,
    borderColor: "#252A33",
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 16,
  },
  label: {
    color: "#D9DDE3",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  input: {
    minHeight: 50,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#303641",
    backgroundColor: "#0E1014",
    color: "#FFFFFF",
    fontSize: 14,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  readonlyInput: {
    minHeight: 50,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#252A33",
    backgroundColor: "#0E1014",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  readonlyText: {
    color: "#8C939E",
    fontSize: 14,
  },
  emailHint: {
    color: "#666D78",
    fontSize: 11,
    marginTop: 7,
    marginBottom: 12,
  },
  error: {
    color: "#FF8D96",
    fontSize: 13,
    marginBottom: 10,
  },
  success: {
    color: "#7FD7A4",
    fontSize: 13,
    marginBottom: 10,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#191D24",
    alignItems: "center",
    justifyContent: "center",
  },
  dangerIcon: {
    backgroundColor: "#251519",
  },
  optionIconText: {
    fontSize: 18,
  },
  optionTextArea: {
    flex: 1,
  },
  optionTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 3,
  },
  optionSubtitle: {
    color: "#777F8B",
    fontSize: 12,
  },
  optionArrow: {
    color: "#666D78",
    fontSize: 24,
  },
  dangerText: {
    color: "#FF9098",
  },
});