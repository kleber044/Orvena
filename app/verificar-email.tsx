import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
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

import { traduzirErroAuth } from "../lib/auth-errors";
import { supabase } from "../lib/supabase";

const NOME_STORAGE_KEY = "@orvena:usuario_nome";

export default function VerificarEmailScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === "string" ? params.email : "";

  const [codigo, setCodigo] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  async function confirmarCodigo() {
    const codigoLimpo = codigo.replace(/\D/g, "");

    if (!email) {
      setErro("E-mail não encontrado. Volte ao cadastro e tente novamente.");
      return;
    }

    if (codigoLimpo.length !== 8) {
      setErro("Digite o código de 8 dígitos enviado para seu e-mail.");
      return;
    }

    try {
      setCarregando(true);
      setErro("");
      setMensagem("");

      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: codigoLimpo,
        type: "email",
      });

      if (error) {
        const mensagemErro = error.message.toLowerCase();

        if (
          mensagemErro.includes("expired") ||
          mensagemErro.includes("invalid")
        ) {
          setErro("Código inválido ou expirado. Solicite um novo código.");
          return;
        }

        setErro(traduzirErroAuth(error));
        return;
      }

      const nome =
        typeof data.user?.user_metadata?.nome === "string"
          ? data.user.user_metadata.nome.trim()
          : "";

      if (nome) {
        await AsyncStorage.setItem(NOME_STORAGE_KEY, nome);
      }

      router.replace("/(tabs)");
    } catch {
      setErro("Não foi possível confirmar o código. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  async function reenviarCodigo() {
    if (!email) {
      setErro("E-mail não encontrado. Volte ao cadastro e tente novamente.");
      return;
    }

    try {
      setReenviando(true);
      setErro("");
      setMensagem("");

      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      });

      if (error) {
        setErro(traduzirErroAuth(error));
        return;
      }

      setMensagem("Novo código enviado para seu e-mail.");
    } catch {
      setErro("Não foi possível reenviar o código. Tente novamente.");
    } finally {
      setReenviando(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isDesktop && styles.scrollContentDesktop,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.shell,
              isDesktop && styles.shellDesktop,
            ]}
          >
            {isDesktop ? (
              <View style={styles.desktopHero}>
                <View>
                  <View style={styles.heroBrandRow}>
                    <View style={styles.heroLogo}>
                      <Text style={styles.heroLogoText}>O</Text>
                    </View>

                    <View>
                      <Text style={styles.heroBrand}>ORVENA</Text>
                      <Text style={styles.heroTagline}>
                        Seu negócio, organizado.
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.heroTitle}>
                    Falta só confirmar seu e-mail.
                  </Text>

                  <Text style={styles.heroText}>
                    Enviamos um código de segurança para garantir que este
                    e-mail realmente pertence a você.
                  </Text>
                </View>

                <View style={styles.heroInfo}>
                  <View style={styles.heroInfoIcon}>
                    <Text style={styles.heroInfoIconText}>✓</Text>
                  </View>

                  <View style={styles.heroInfoTextArea}>
                    <Text style={styles.heroInfoTitle}>
                      Verificação simples
                    </Text>
                    <Text style={styles.heroInfoText}>
                      Digite o código recebido e sua conta será liberada.
                    </Text>
                  </View>
                </View>

                <Text style={styles.heroFooter}>
                  ORVENA • VERIFICAÇÃO DE CONTA
                </Text>
              </View>
            ) : null}

            <View style={[styles.card, isDesktop && styles.cardDesktop]}>
              {!isDesktop ? (
                <View style={styles.mobileBrand}>
                  <View style={styles.mobileLogo}>
                    <Text style={styles.mobileLogoText}>O</Text>
                  </View>
                  <Text style={styles.mobileBrandText}>ORVENA</Text>
                </View>
              ) : (
                <Text style={styles.formBrand}>ORVENA</Text>
              )}

              <Text style={styles.title}>Verifique seu e-mail</Text>

              <Text style={styles.subtitle}>
                Digite o código de 8 dígitos enviado para:
              </Text>

              <Text style={styles.emailText}>{email || "seu e-mail"}</Text>

              <Text style={styles.label}>Código de verificação</Text>

              <TextInput
                value={codigo}
                onChangeText={(valor) =>
                  setCodigo(valor.replace(/\D/g, "").slice(0, 8))
                }
                placeholder="00000000"
                placeholderTextColor="#4E5560"
                keyboardType="number-pad"
                maxLength={8}
                autoFocus
                style={styles.codeInput}
                onSubmitEditing={confirmarCodigo}
              />

              <Text style={styles.codeHint}>
                O código possui 8 dígitos.
              </Text>

              {erro ? <Text style={styles.error}>{erro}</Text> : null}
              {mensagem ? (
                <Text style={styles.success}>{mensagem}</Text>
              ) : null}

              <Pressable
                style={[
                  styles.primaryButton,
                  carregando && styles.buttonDisabled,
                ]}
                onPress={confirmarCodigo}
                disabled={carregando}
              >
                {carregando ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    CONFIRMAR CONTA
                  </Text>
                )}
              </Pressable>

              <Pressable
                style={styles.resendButton}
                onPress={reenviarCodigo}
                disabled={reenviando}
              >
                {reenviando ? (
                  <ActivityIndicator size="small" color="#B4A7FF" />
                ) : (
                  <Text style={styles.resendText}>
                    Não recebeu? Reenviar código
                  </Text>
                )}
              </Pressable>

              <Pressable
                style={styles.backButton}
                onPress={() => router.replace("/cadastro")}
              >
                <Text style={styles.backButtonText}>
                  Voltar para o cadastro
                </Text>
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
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    paddingVertical: 30,
  },
  scrollContentDesktop: {
    padding: 30,
  },
  shell: {
    width: "100%",
    maxWidth: 500,
  },
  shellDesktop: {
    maxWidth: 1050,
    minHeight: 610,
    flexDirection: "row",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#282D36",
    backgroundColor: "#111319",
    overflow: "hidden",
  },
  desktopHero: {
    flex: 1.02,
    minHeight: 610,
    backgroundColor: "#15131F",
    paddingHorizontal: 46,
    paddingVertical: 44,
    justifyContent: "space-between",
    borderRightWidth: 1,
    borderRightColor: "#28243A",
  },
  heroBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  heroLogo: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
  },
  heroLogoText: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
  },
  heroBrand: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: 2,
  },
  heroTagline: {
    color: "#777E89",
    fontSize: 11,
    marginTop: 3,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 37,
    lineHeight: 45,
    fontWeight: "900",
    maxWidth: 420,
    marginTop: 70,
  },
  heroText: {
    color: "#969DA8",
    fontSize: 15,
    lineHeight: 24,
    maxWidth: 440,
    marginTop: 17,
  },
  heroInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginTop: 30,
  },
  heroInfoIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#211C34",
    borderWidth: 1,
    borderColor: "#352D55",
    alignItems: "center",
    justifyContent: "center",
  },
  heroInfoIconText: {
    color: "#B6AAFF",
    fontSize: 22,
    fontWeight: "900",
  },
  heroInfoTextArea: {
    flex: 1,
  },
  heroInfoTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  heroInfoText: {
    color: "#8D949F",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 3,
  },
  heroFooter: {
    color: "#5F6570",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  card: {
    width: "100%",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#292D36",
    backgroundColor: "#12151B",
    padding: 22,
  },
  cardDesktop: {
    flex: 0.98,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: "#111319",
    paddingHorizontal: 48,
    paddingVertical: 44,
    justifyContent: "center",
  },
  mobileBrand: {
    alignItems: "center",
    marginBottom: 28,
  },
  mobileLogo: {
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
  },
  mobileLogoText: {
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "900",
  },
  mobileBrandText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 2,
    marginTop: 11,
  },
  formBrand: {
    color: "#7C5CFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 30,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 29,
    fontWeight: "900",
  },
  subtitle: {
    color: "#858C97",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 9,
  },
  emailText: {
    color: "#C5BFFF",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4,
  },
  label: {
    color: "#A8AEB7",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 26,
    marginBottom: 9,
  },
  codeInput: {
    width: "100%",
    minHeight: 68,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#343A45",
    backgroundColor: "#0D1015",
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: 9,
    textAlign: "center",
    paddingHorizontal: 14,
    outlineStyle: "none",
  } as any,
  codeHint: {
    color: "#606772",
    fontSize: 10,
    marginTop: 8,
    textAlign: "center",
  },
  error: {
    color: "#FF7D86",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
  },
  success: {
    color: "#6BE6AC",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
  },
  primaryButton: {
    height: 56,
    borderRadius: 15,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  resendButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 9,
  },
  resendText: {
    color: "#B4A7FF",
    fontSize: 11,
    fontWeight: "900",
  },
  backButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  backButtonText: {
    color: "#707782",
    fontSize: 10,
    fontWeight: "800",
  },
});
