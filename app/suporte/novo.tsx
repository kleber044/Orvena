import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../lib/supabase";

export default function NovoSuporteScreen() {
  const { width } = useWindowDimensions();
  const desktop = width >= 960;
  const startPlayer = useAudioPlayer(
    require("../../assets/sounds/support-send.wav")
  );

  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const podeEnviar = useMemo(
    () =>
      assunto.trim().length >= 3 &&
      mensagem.trim().length >= 10 &&
      !enviando,
    [assunto, mensagem, enviando]
  );

  async function iniciarAtendimento() {
    setErro("");

    if (!podeEnviar) return;

    try {
      setEnviando(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login" as any);
        return;
      }

      const { data: aberto, error: abertoError } = await supabase
        .from("suporte_chamados")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "aberto")
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (abertoError) {
        console.log("Erro ao verificar atendimento aberto:", abertoError);
        setErro("Não foi possível verificar seus atendimentos.");
        return;
      }

      if (aberto?.id) {
        router.replace({
          pathname: "/suporte/chat/[id]",
          params: { id: aberto.id },
        } as any);
        return;
      }

      const agora = new Date().toISOString();

      const { data: chamado, error: chamadoError } = await supabase
        .from("suporte_chamados")
        .insert({
          user_id: user.id,
          email_usuario: user.email || null,
          assunto: assunto.trim(),
          status: "aberto",
          criado_em: agora,
          atualizado_em: agora,
        })
        .select("id")
        .single();

      if (chamadoError || !chamado) {
        console.log("Erro ao criar atendimento:", chamadoError);

        if (chamadoError?.code === "23505") {
          const { data: existente } = await supabase
            .from("suporte_chamados")
            .select("id")
            .eq("user_id", user.id)
            .eq("status", "aberto")
            .limit(1)
            .maybeSingle();

          if (existente?.id) {
            router.replace({
              pathname: "/suporte/chat/[id]",
              params: { id: existente.id },
            } as any);
            return;
          }
        }

        setErro("Não foi possível iniciar o atendimento.");
        return;
      }

      const { error: mensagemError } = await supabase
        .from("suporte_mensagens")
        .insert({
          chamado_id: chamado.id,
          remetente_tipo: "usuario",
          remetente_id: user.id,
          remetente_email: user.email || null,
          mensagem: mensagem.trim(),
          criado_em: agora,
        });

      if (mensagemError) {
        console.log("Erro ao enviar primeira mensagem:", mensagemError);
        setErro("O atendimento foi criado, mas a mensagem não foi enviada.");
        return;
      }

      await supabase
        .from("suporte_chamados")
        .update({ atualizado_em: agora })
        .eq("id", chamado.id)
        .eq("user_id", user.id);

      try {
        startPlayer.seekTo(0);
        startPlayer.play();
      } catch (error) {
        console.log("Erro ao tocar som de início do chat:", error);
      }

      setTimeout(() => {
        router.replace({
          pathname: "/suporte/chat/[id]",
          params: { id: chamado.id },
        } as any);
      }, 180);
    } catch (error) {
      console.log("Erro novo suporte:", error);
      setErro("Não foi possível iniciar o atendimento.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.page, desktop && styles.pageDesktop]}>
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" color="#FFFFFF" size={21} />
            </Pressable>

            <View style={styles.headerMain}>
              <Text style={styles.eyebrow}>NOVO ATENDIMENTO</Text>
              <Text style={styles.title}>Fale com o suporte</Text>
              <Text style={styles.subtitle}>
                Conte o que aconteceu. Depois do envio, um chat será aberto.
              </Text>
            </View>
          </View>

          {erro ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{erro}</Text>
            </View>
          ) : null}

          <View style={[styles.layout, desktop && styles.layoutDesktop]}>
          <View style={styles.card}>
            <View style={styles.agentRow}>
              <View style={styles.agentAvatar}>
                <Ionicons name="headset-outline" size={27} color="#B7A5FF" />
              </View>

              <View style={styles.agentMain}>
                <Text style={styles.agentTitle}>Equipe Orvena</Text>
                <Text style={styles.agentSubtitle}>
                  Sua mensagem será enviada para o painel administrativo.
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <Text style={styles.formHeading}>Descreva sua solicitação</Text>
            <Text style={styles.formSubheading}>Nossa equipe terá acesso às informações abaixo para ajudar você.</Text>
            <Text style={styles.label}>ASSUNTO</Text>
            <TextInput
              style={styles.input}
              value={assunto}
              onChangeText={setAssunto}
              placeholder="Ex.: Problema ao gerar orçamento"
              placeholderTextColor="#555C67"
              maxLength={120}
            />

            <Text style={styles.label}>EXPLIQUE O QUE ACONTECEU</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={mensagem}
              onChangeText={setMensagem}
              placeholder="Escreva sua mensagem..."
              placeholderTextColor="#555C67"
              multiline
              textAlignVertical="top"
              maxLength={2500}
            />

            <View style={styles.fieldFooter}><Text style={styles.fieldTip}>Mínimo de 10 caracteres</Text><Text style={styles.counter}>{mensagem.length}/2500</Text></View>

            <Pressable
              style={[
                styles.sendButton,
                !podeEnviar && styles.sendButtonDisabled,
              ]}
              onPress={iniciarAtendimento}
              disabled={!podeEnviar}
            >
              {enviando ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.sendContent}><Ionicons name="chatbubble-ellipses-outline" size={20} color="#FFFFFF" /><Text style={styles.sendButtonText}>Iniciar conversa com o suporte</Text><Ionicons name="arrow-forward" size={18} color="#FFFFFF" /></View>
              )}
            </Pressable>
          </View>

          <View style={styles.notice}>
            <View style={styles.noticeIcon}><Ionicons name="shield-checkmark-outline" size={22} color="#B7A5FF" /></View>
            <View style={styles.noticeContent}><Text style={styles.noticeTitle}>Um atendimento por vez</Text>
            <Text style={styles.noticeText}>
              Se você já tiver um chat aberto, o Orvena vai continuar esse
              atendimento em vez de criar outro. O chat fica aberto até você ou
              um administrador encerrar.
            </Text></View>
          </View>
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#09090F" },
  scroll: { flexGrow: 1, paddingBottom: 45 },
  page: { width: "100%", maxWidth: 820, alignSelf: "center", paddingHorizontal: 16, paddingTop: 30 },
  pageDesktop: { maxWidth: 1200, paddingHorizontal: 36, paddingTop: 48 },
  header: { flexDirection: "row", alignItems: "center", gap: 15, marginBottom: 32 },
  backButton: { width: 46, height: 46, borderRadius: 14, borderWidth: 1, borderColor: "#353044", backgroundColor: "#191620", alignItems: "center", justifyContent: "center" },
  backText: { color: "#FFFFFF", fontSize: 22 },
  headerMain: { flex: 1, minWidth: 0 },
  eyebrow: { color: "#B7A5FF", fontSize: 11, fontWeight: "800", letterSpacing: 1.6 },
  title: { color: "#FFFFFF", fontSize: 29, fontWeight: "800", marginTop: 5, letterSpacing: -0.6 },
  subtitle: { color: "#A49DAF", fontSize: 13, lineHeight: 20, marginTop: 5 },
  errorBox: { borderRadius: 14, borderWidth: 1, borderColor: "#704051", backgroundColor: "#301923", padding: 16, marginBottom: 17 },
  errorText: { color: "#FFADB7", fontSize: 13, lineHeight: 20 },
  layout: { gap: 17 },
  layoutDesktop: { flexDirection: "row", alignItems: "flex-start", gap: 22 },
  card: { flex: 2, minWidth: 0, borderRadius: 22, borderWidth: 1, borderColor: "#383044", backgroundColor: "#17141E", padding: 24 },
  agentRow: { flexDirection: "row", alignItems: "center", gap: 13 },
  agentAvatar: { width: 54, height: 54, borderRadius: 16, backgroundColor: "#2B2242", borderWidth: 1, borderColor: "#50416B", alignItems: "center", justifyContent: "center" },
  agentEmoji: { fontSize: 25 },
  agentMain: { flex: 1, minWidth: 0 },
  agentTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  agentSubtitle: { color: "#ABA3B8", fontSize: 12, lineHeight: 19, marginTop: 5 },
  divider: { height: 1, backgroundColor: "#332D3E", marginVertical: 22 },
  formHeading: { color: "#FFFFFF", fontSize: 19, fontWeight: "800" },
  formSubheading: { color: "#9E96AB", fontSize: 12, lineHeight: 19, marginTop: 5, marginBottom: 23 },
  label: { color: "#C7BED4", fontSize: 11, fontWeight: "800", letterSpacing: 0.8, marginBottom: 10 },
  input: { minHeight: 54, borderRadius: 13, borderWidth: 1, borderColor: "#433B4F", backgroundColor: "#100F17", paddingHorizontal: 16, color: "#FFFFFF", fontSize: 14, marginBottom: 22 },
  textArea: { minHeight: 192, paddingTop: 16, paddingBottom: 16, lineHeight: 22, marginBottom: 0 },
  fieldFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 9, marginBottom: 22, gap: 8 },
  fieldTip: { color: "#8A8297", fontSize: 11 },
  counter: { color: "#9890A7", fontSize: 11 },
  sendButton: { minHeight: 56, borderRadius: 14, backgroundColor: "#7C5CFF", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  sendButtonDisabled: { opacity: 0.4 },
  sendContent: { flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center" },
  sendButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", textAlign: "center", flexShrink: 1 },
  notice: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 19, borderWidth: 1, borderColor: "#423653", backgroundColor: "#201A2C", padding: 19 },
  noticeIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#312644", alignItems: "center", justifyContent: "center" },
  noticeContent: { flex: 1, minWidth: 0 },
  noticeTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  noticeText: { color: "#B6ACC6", fontSize: 12, lineHeight: 20, marginTop: 8 },
});
