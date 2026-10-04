import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";

type Chamado = {
  id: string;
  titulo: string;
  mensagem: string | null;
  status: string;
  prioridade: string;
  criado_em: string;
  atualizado_em: string;
};

function formatarDataHora(valor: string) {
  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return "";
  }

  return data.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function statusVisual(status: string) {
  const normalizado = status.toLowerCase();

  if (normalizado === "resolvido") {
    return {
      label: "RESOLVIDO",
      backgroundColor: "#123225",
      borderColor: "#245D47",
      color: "#74E7AF",
    };
  }

  if (normalizado === "ativo") {
    return {
      label: "EM ATENDIMENTO",
      backgroundColor: "#1F1A35",
      borderColor: "#4D3C8A",
      color: "#C4B9FF",
    };
  }

  if (normalizado === "inativo") {
    return {
      label: "ARQUIVADO",
      backgroundColor: "#1A1C21",
      borderColor: "#363A42",
      color: "#969CA6",
    };
  }

  return {
    label: "PENDENTE",
    backgroundColor: "#302414",
    borderColor: "#65481D",
    color: "#F3C675",
  };
}

export default function SuporteScreen() {
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [email, setEmail] = useState("");

  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [])
  );

  async function carregar() {
    try {
      setCarregando(true);
      setErro("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login" as any);
        return;
      }

      setEmail(user.email || "");

      const { data, error } = await supabase
        .from("admin_comunicacao")
        .select(
          "id, titulo, mensagem, status, prioridade, criado_em, atualizado_em"
        )
        .eq("tipo", "suporte")
        .eq("usuario_id", user.id)
        .order("criado_em", {
          ascending: false,
        });

      if (error) {
        console.log("Erro ao carregar suporte:", error);
        setErro(
          "Não foi possível carregar seus atendimentos. Tente novamente."
        );
        return;
      }

      setChamados((data || []) as Chamado[]);
    } catch (error) {
      console.log("Erro suporte:", error);
      setErro(
        "Não foi possível carregar o suporte. Tente novamente."
      );
    } finally {
      setCarregando(false);
    }
  }

  const podeEnviar = useMemo(() => {
    return (
      assunto.trim().length >= 3 &&
      mensagem.trim().length >= 10 &&
      !enviando
    );
  }, [assunto, mensagem, enviando]);

  async function enviarChamado() {
    setErro("");
    setSucesso("");

    if (assunto.trim().length < 3) {
      setErro("Informe um assunto com pelo menos 3 caracteres.");
      return;
    }

    if (mensagem.trim().length < 10) {
      setErro("Explique sua dúvida ou problema com um pouco mais de detalhes.");
      return;
    }

    try {
      setEnviando(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login" as any);
        return;
      }

      const agora = new Date().toISOString();

      const { error } = await supabase
        .from("admin_comunicacao")
        .insert({
          tipo: "suporte",
          titulo: assunto.trim(),
          mensagem: mensagem.trim(),
          status: "pendente",
          prioridade: "normal",
          categoria: "suporte_app",
          email_usuario: user.email || null,
          usuario_id: user.id,
          destino: "admin",
          criado_por: user.email || null,
          criado_em: agora,
          atualizado_em: agora,
        });

      if (error) {
        console.log("Erro ao enviar suporte:", error);
        setErro(
          "Não foi possível enviar sua solicitação. Tente novamente."
        );
        return;
      }

      setAssunto("");
      setMensagem("");
      setSucesso(
        "Solicitação enviada. Você pode acompanhar o status abaixo."
      );

      await carregar();
    } catch (error) {
      console.log("Erro ao enviar suporte:", error);
      setErro(
        "Não foi possível enviar sua solicitação. Tente novamente."
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.page}>
          <View style={styles.header}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Text style={styles.backText}>←</Text>
            </Pressable>

            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>ORVENA</Text>
              <Text style={styles.title}>Ajuda e suporte</Text>
              <Text style={styles.subtitle}>
                Envie sua dúvida ou problema diretamente para o suporte do Orvena.
              </Text>
            </View>
          </View>

          {erro ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{erro}</Text>
            </View>
          ) : null}

          {sucesso ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{sucesso}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <View style={styles.cardIcon}>
                <Text style={styles.cardIconText}>💬</Text>
              </View>

              <View style={styles.cardTitleMain}>
                <Text style={styles.cardTitle}>Novo atendimento</Text>
                <Text style={styles.cardSubtitle}>
                  Nossa equipe verá a solicitação no painel administrativo.
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <Text style={styles.label}>E-mail da conta</Text>
            <View style={styles.readOnlyInput}>
              <Text style={styles.readOnlyText}>
                {email || "Conta sem e-mail"}
              </Text>
            </View>

            <Text style={styles.label}>Assunto</Text>
            <TextInput
              style={styles.input}
              value={assunto}
              onChangeText={setAssunto}
              placeholder="Ex.: Não consigo gerar um orçamento"
              placeholderTextColor="#555C67"
              maxLength={120}
            />

            <Text style={styles.label}>Mensagem</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={mensagem}
              onChangeText={setMensagem}
              placeholder="Explique o que está acontecendo..."
              placeholderTextColor="#555C67"
              multiline
              textAlignVertical="top"
              maxLength={2500}
            />

            <Text style={styles.counter}>
              {mensagem.length}/2500
            </Text>

            <Pressable
              style={[
                styles.sendButton,
                !podeEnviar && styles.sendButtonDisabled,
              ]}
              onPress={enviarChamado}
              disabled={!podeEnviar}
            >
              {enviando ? (
                <ActivityIndicator color="#0B0C10" />
              ) : (
                <Text style={styles.sendButtonText}>
                  ENVIAR SOLICITAÇÃO
                </Text>
              )}
            </Pressable>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>MEUS ATENDIMENTOS</Text>

            <Pressable
              style={styles.refreshButton}
              onPress={carregar}
              disabled={carregando}
            >
              <Text style={styles.refreshText}>
                {carregando ? "..." : "ATUALIZAR"}
              </Text>
            </Pressable>
          </View>

          {carregando ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#7C5CFF" />
              <Text style={styles.loadingText}>
                Carregando atendimentos...
              </Text>
            </View>
          ) : chamados.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>✓</Text>
              <Text style={styles.emptyTitle}>
                Nenhum atendimento ainda
              </Text>
              <Text style={styles.emptyText}>
                Quando você enviar uma solicitação, ela aparecerá aqui.
              </Text>
            </View>
          ) : (
            chamados.map((chamado) => {
              const visual = statusVisual(chamado.status);

              return (
                <View key={chamado.id} style={styles.ticketCard}>
                  <View style={styles.ticketTop}>
                    <View style={styles.ticketMain}>
                      <Text style={styles.ticketTitle}>
                        {chamado.titulo}
                      </Text>

                      <Text style={styles.ticketDate}>
                        {formatarDataHora(chamado.criado_em)}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: visual.backgroundColor,
                          borderColor: visual.borderColor,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          {
                            color: visual.color,
                          },
                        ]}
                      >
                        {visual.label}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.ticketMessage}>
                    {chamado.mensagem || "Sem mensagem."}
                  </Text>
                </View>
              );
            })
          )}
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

  scroll: {
    flexGrow: 1,
  },

  page: {
    width: "100%",
    maxWidth: 850,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 50,
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 13,
    marginBottom: 20,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#292E37",
    backgroundColor: "#13161C",
    alignItems: "center",
    justifyContent: "center",
  },

  backText: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
  },

  headerText: {
    flex: 1,
  },

  eyebrow: {
    color: "#7C5CFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.3,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 29,
    fontWeight: "900",
    marginTop: 4,
  },

  subtitle: {
    color: "#7D848F",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },

  errorBox: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#552C35",
    backgroundColor: "#211217",
    padding: 12,
    marginBottom: 14,
  },

  errorText: {
    color: "#FF8A93",
    fontSize: 10,
    lineHeight: 16,
  },

  successBox: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#245D47",
    backgroundColor: "#10251B",
    padding: 12,
    marginBottom: 14,
  },

  successText: {
    color: "#75E6AE",
    fontSize: 10,
    lineHeight: 16,
  },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2B3039",
    backgroundColor: "#12151B",
    padding: 16,
  },

  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#211B38",
    borderWidth: 1,
    borderColor: "#4D3C8A",
    alignItems: "center",
    justifyContent: "center",
  },

  cardIconText: {
    fontSize: 18,
  },

  cardTitleMain: {
    flex: 1,
  },

  cardTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  cardSubtitle: {
    color: "#747B86",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 4,
  },

  divider: {
    height: 1,
    backgroundColor: "#252A32",
    marginVertical: 16,
  },

  label: {
    color: "#8B929D",
    fontSize: 9,
    fontWeight: "800",
    marginBottom: 7,
    marginTop: 4,
  },

  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#292E37",
    backgroundColor: "#0E1116",
    paddingHorizontal: 13,
    color: "#FFFFFF",
    fontSize: 11,
    marginBottom: 14,
  },

  textArea: {
    minHeight: 135,
    paddingTop: 13,
    paddingBottom: 13,
    lineHeight: 18,
    marginBottom: 5,
  },

  readOnlyInput: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#252A32",
    backgroundColor: "#101319",
    paddingHorizontal: 13,
    justifyContent: "center",
    marginBottom: 14,
  },

  readOnlyText: {
    color: "#7B828D",
    fontSize: 11,
  },

  counter: {
    color: "#555C67",
    fontSize: 8,
    textAlign: "right",
    marginBottom: 14,
  },

  sendButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  sendButtonDisabled: {
    opacity: 0.35,
  },

  sendButtonText: {
    color: "#0B0C10",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.6,
  },

  sectionHeader: {
    marginTop: 24,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionTitle: {
    color: "#7C8490",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  refreshButton: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#292E37",
    backgroundColor: "#12151B",
  },

  refreshText: {
    color: "#949AA4",
    fontSize: 7,
    fontWeight: "900",
  },

  loadingBox: {
    minHeight: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#292E37",
    backgroundColor: "#12151B",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  loadingText: {
    color: "#747B86",
    fontSize: 9,
  },

  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#292E37",
    backgroundColor: "#12151B",
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 18,
  },

  emptyIcon: {
    color: "#777E89",
    fontSize: 20,
    fontWeight: "900",
  },

  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 10,
  },

  emptyText: {
    color: "#737A85",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 5,
    textAlign: "center",
  },

  ticketCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#292E37",
    backgroundColor: "#12151B",
    padding: 14,
    marginBottom: 9,
  },

  ticketTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },

  ticketMain: {
    flex: 1,
  },

  ticketTitle: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },

  ticketDate: {
    color: "#606772",
    fontSize: 8,
    marginTop: 4,
  },

  ticketMessage: {
    color: "#8A919B",
    fontSize: 9,
    lineHeight: 15,
    marginTop: 12,
  },

  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  statusText: {
    fontSize: 7,
    fontWeight: "900",
  },
});
