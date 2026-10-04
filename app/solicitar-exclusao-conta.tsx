import { router } from "expo-router";
import { useEffect, useState } from "react";
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

type Solicitacao = {
  id: string;
  motivo: string;
  status: "PENDENTE" | "APROVADA" | "REPROVADA";
  observacao_analise: string | null;
  solicitado_em: string;
  analisado_em: string | null;
};

export default function SolicitarExclusaoContaScreen() {
  const [motivo, setMotivo] = useState("");
  const [email, setEmail] = useState("");
  const [solicitacao, setSolicitacao] = useState<Solicitacao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [redirecionandoLogin, setRedirecionandoLogin] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    void carregar();
  }, []);

  async function carregar() {
    try {
      setCarregando(true);
      setErro("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setRedirecionandoLogin(true);
        router.replace("/login" as any);
        return;
      }

      setEmail(user.email || "");

      const { data, error } = await supabase
        .from("solicitacoes_exclusao_conta")
        .select(
          "id, motivo, status, observacao_analise, solicitado_em, analisado_em"
        )
        .eq("user_id", user.id)
        .order("solicitado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.log("Erro ao carregar solicitação de exclusão:", error);
        setErro("Não foi possível carregar sua solicitação.");
        return;
      }

      setSolicitacao(data as Solicitacao | null);
    } catch (error) {
      console.log("Erro ao carregar exclusão de conta:", error);
      setErro("Não foi possível carregar esta página.");
    } finally {
      setCarregando(false);
    }
  }

  async function enviarSolicitacao() {
    const motivoLimpo = motivo.trim();

    setErro("");
    setMensagem("");

    if (solicitacao?.status === "PENDENTE") {
      setErro("Você já possui uma solicitação de exclusão em análise.");
      return;
    }

    if (motivoLimpo.length < 10) {
      setErro("Explique o motivo da exclusão com pelo menos 10 caracteres.");
      return;
    }

    try {
      setEnviando(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErro("Sua sessão expirou. Entre novamente.");
        return;
      }

      const { error } = await supabase.rpc("solicitar_exclusao_conta", {
        p_motivo: motivoLimpo,
      });

      if (error) {
        console.log("Erro ao solicitar exclusão:", error);

        const mensagemErro = String(error.message || "");

        if (mensagemErro.includes("já possui uma solicitação")) {
          setErro("Você já possui uma solicitação de exclusão em análise.");
          await carregar();
          return;
        }

        if (mensagemErro.includes("pelo menos 10 caracteres")) {
          setErro("Explique o motivo da exclusão com pelo menos 10 caracteres.");
          return;
        }

        if (mensagemErro.includes("no máximo 1000 caracteres")) {
          setErro("O motivo pode ter no máximo 1000 caracteres.");
          return;
        }

        setErro("Não foi possível enviar sua solicitação. Tente novamente.");
        return;
      }

      setMotivo("");
      setMensagem(
        "Solicitação enviada. Sua conta continuará ativa enquanto analisamos o pedido."
      );

      await carregar();
    } catch (error) {
      console.log("Erro ao enviar solicitação:", error);
      setErro("Não foi possível enviar sua solicitação. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  function statusTexto(status: Solicitacao["status"]) {
    if (status === "PENDENTE") return "EM ANÁLISE";
    if (status === "APROVADA") return "APROVADA";
    return "REPROVADA";
  }

  function formatarData(valor?: string | null) {
    if (!valor) return "";
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return "";
    return data.toLocaleString("pt-BR");
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

  const pendente = solicitacao?.status === "PENDENTE";

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
              <Pressable style={styles.backButton} onPress={() => router.replace("/minha-conta" as any)}>
                <Text style={styles.backText}>←</Text>
              </Pressable>

              <View style={styles.headerText}>
                <Text style={styles.eyebrow}>ORVENA</Text>
                <Text style={styles.title}>Solicitar exclusão da conta</Text>
                <Text style={styles.subtitle}>
                  Seu pedido será analisado antes de qualquer exclusão.
                </Text>
              </View>
            </View>

            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>Sua conta não será excluída agora</Text>
              <Text style={styles.noticeText}>
                Após enviar a solicitação, sua conta continuará funcionando normalmente.
                O pedido ficará em análise. Quando o processo for analisado, o resultado
                será enviado para o e-mail da conta.
              </Text>
            </View>

            {solicitacao ? (
              <View style={styles.statusCard}>
                <View style={styles.statusTop}>
                  <Text style={styles.statusTitle}>Última solicitação</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      solicitacao.status === "APROVADA" && styles.statusApproved,
                      solicitacao.status === "REPROVADA" && styles.statusRejected,
                    ]}
                  >
                    <Text style={styles.statusBadgeText}>
                      {statusTexto(solicitacao.status)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.statusLabel}>Solicitada em</Text>
                <Text style={styles.statusValue}>
                  {formatarData(solicitacao.solicitado_em)}
                </Text>

                <Text style={styles.statusLabel}>Motivo informado</Text>
                <Text style={styles.statusReason}>{solicitacao.motivo}</Text>

                {solicitacao.observacao_analise ? (
                  <>
                    <Text style={styles.statusLabel}>Resultado da análise</Text>
                    <Text style={styles.statusReason}>
                      {solicitacao.observacao_analise}
                    </Text>
                  </>
                ) : null}
              </View>
            ) : null}

            {!pendente ? (
              <View style={styles.formCard}>
                <Text style={styles.label}>E-mail da conta</Text>
                <View style={styles.readonlyInput}>
                  <Text style={styles.readonlyText}>{email || "E-mail não encontrado"}</Text>
                </View>

                <Text style={styles.label}>Por que você quer excluir sua conta?</Text>
                <TextInput
                  value={motivo}
                  onChangeText={setMotivo}
                  placeholder="Conte o motivo da sua solicitação..."
                  placeholderTextColor="#5B616C"
                  multiline
                  maxLength={1000}
                  textAlignVertical="top"
                  style={styles.textArea}
                />

                <Text style={styles.counter}>{motivo.length}/1000</Text>

                {erro ? <Text style={styles.error}>{erro}</Text> : null}
                {mensagem ? <Text style={styles.success}>{mensagem}</Text> : null}

                <Pressable
                  style={[styles.submitButton, enviando && styles.buttonDisabled]}
                  onPress={enviarSolicitacao}
                  disabled={enviando}
                >
                  {enviando ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>ENVIAR SOLICITAÇÃO</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <View style={styles.pendingBox}>
                <Text style={styles.pendingTitle}>Solicitação em análise</Text>
                <Text style={styles.pendingText}>
                  Você não precisa enviar outro pedido. Quando a análise for concluída,
                  o resultado será enviado para seu e-mail.
                </Text>
              </View>
            )}

            {mensagem && pendente ? (
              <Text style={styles.successStandalone}>{mensagem}</Text>
            ) : null}
            {erro && pendente ? (
              <Text style={styles.errorStandalone}>{erro}</Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0B0C10" },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: 18, paddingVertical: 28 },
  page: { width: "100%", maxWidth: 760, alignSelf: "center" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: "#A9AFB9", fontSize: 14 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 22 },
  backButton: {
    width: 42, height: 42, borderRadius: 14, backgroundColor: "#15181E",
    borderWidth: 1, borderColor: "#252A33", alignItems: "center", justifyContent: "center"
  },
  backText: { color: "#FFFFFF", fontSize: 24, lineHeight: 26 },
  headerText: { flex: 1 },
  eyebrow: { color: "#8E78FF", fontSize: 11, fontWeight: "800", letterSpacing: 1.8, marginBottom: 5 },
  title: { color: "#FFFFFF", fontSize: 25, fontWeight: "800", marginBottom: 7 },
  subtitle: { color: "#9299A4", fontSize: 14, lineHeight: 21 },
  notice: {
    backgroundColor: "#17151E", borderWidth: 1, borderColor: "#3B305F",
    borderRadius: 18, padding: 18, marginBottom: 16
  },
  noticeTitle: { color: "#D4CAFF", fontSize: 16, fontWeight: "800", marginBottom: 7 },
  noticeText: { color: "#A9A3BE", fontSize: 13, lineHeight: 20 },
  statusCard: {
    backgroundColor: "#12151A", borderWidth: 1, borderColor: "#252A33",
    borderRadius: 18, padding: 18, marginBottom: 16
  },
  statusTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 },
  statusTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  statusBadge: { backgroundColor: "#4A3D13", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusApproved: { backgroundColor: "#183E2A" },
  statusRejected: { backgroundColor: "#48222A" },
  statusBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900", letterSpacing: .6 },
  statusLabel: { color: "#747B86", fontSize: 11, fontWeight: "700", marginTop: 8, marginBottom: 4 },
  statusValue: { color: "#CFD4DC", fontSize: 13 },
  statusReason: { color: "#CFD4DC", fontSize: 13, lineHeight: 20 },
  formCard: {
    backgroundColor: "#12151A", borderWidth: 1, borderColor: "#252A33",
    borderRadius: 18, padding: 18
  },
  label: { color: "#D9DDE3", fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 3 },
  readonlyInput: {
    minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: "#252A33",
    backgroundColor: "#0E1014", justifyContent: "center", paddingHorizontal: 14, marginBottom: 18
  },
  readonlyText: { color: "#8C939E", fontSize: 14 },
  textArea: {
    minHeight: 150, borderRadius: 14, borderWidth: 1, borderColor: "#303641",
    backgroundColor: "#0E1014", color: "#FFFFFF", fontSize: 14, padding: 14, lineHeight: 21
  },
  counter: { color: "#666D78", fontSize: 11, textAlign: "right", marginTop: 7, marginBottom: 8 },
  error: { color: "#FF8D96", fontSize: 13, marginTop: 4, marginBottom: 10 },
  success: { color: "#7FD7A4", fontSize: 13, marginTop: 4, marginBottom: 10 },
  submitButton: {
    minHeight: 52, borderRadius: 14, backgroundColor: "#D94C5B",
    alignItems: "center", justifyContent: "center", marginTop: 8
  },
  submitButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900", letterSpacing: .7 },
  buttonDisabled: { opacity: .6 },
  pendingBox: {
    backgroundColor: "#131820", borderWidth: 1, borderColor: "#283442",
    borderRadius: 18, padding: 18
  },
  pendingTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "800", marginBottom: 7 },
  pendingText: { color: "#9BA4AF", fontSize: 13, lineHeight: 20 },
  successStandalone: { color: "#7FD7A4", fontSize: 13, marginTop: 14 },
  errorStandalone: { color: "#FF8D96", fontSize: 13, marginTop: 14 },
});