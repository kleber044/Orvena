import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

import {
  erroLimiteAuth,
  erroOcultaExistenciaDaConta,
  traduzirErroAuth,
} from "../lib/auth-errors";
import { supabase } from "../lib/supabase";

const REMEMBER_KEY = "@orvena:lembrar_login";
const EMAIL_KEY = "@orvena:login_email";

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [lembrarLogin, setLembrarLogin] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [carregandoPreferencias, setCarregandoPreferencias] = useState(true);
  const [erro, setErro] = useState("");
  const falhasLogin = useRef(0);
  const loginBloqueadoAte = useRef(0);

  useEffect(() => {
    let ativo = true;

    async function iniciarLogin() {
      try {
        /*
         * Não usamos apenas getSession() aqui.
         * Uma conta excluída pelo administrador pode deixar uma
         * sessão antiga salva localmente no aparelho.
         *
         * getUser() confirma no Supabase Auth se a conta ainda existe.
         */
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (!ativo) return;

        if (!error && user) {
          router.replace("/(tabs)" as any);
          return;
        }

        /*
         * Se a conta foi excluída, removemos o token antigo do aparelho.
         * Assim o login não redireciona de volta para a Home em loop.
         */
        try {
          await supabase.auth.signOut({
            scope: "local",
          });
        } catch (signOutError) {
          console.log(
            "Não foi possível limpar a sessão antiga:",
            signOutError
          );
        }

        if (!ativo) return;

        await carregarLoginSalvo();
      } catch (error) {
        console.log("Erro ao iniciar a tela de login:", error);

        try {
          await supabase.auth.signOut({
            scope: "local",
          });
        } catch {
          // A tela de login continua normalmente.
        }

        if (ativo) {
          await carregarLoginSalvo();
        }
      }
    }

    void iniciarLogin();

    return () => {
      ativo = false;
    };
  }, []);

  async function carregarLoginSalvo() {
    try {
      const lembrar = await AsyncStorage.getItem(REMEMBER_KEY);
      const emailSalvo = await AsyncStorage.getItem(EMAIL_KEY);

      if (lembrar === "true") {
        setLembrarLogin(true);

        if (emailSalvo) {
          setEmail(emailSalvo);
        }
      }
    } catch (error) {
      console.log("Não foi possível carregar o login salvo:", error);
    } finally {
      setCarregandoPreferencias(false);
    }
  }

  async function salvarPreferenciaLogin(emailLimpo: string) {
    try {
      if (lembrarLogin) {
        await AsyncStorage.multiSet([
          [REMEMBER_KEY, "true"],
          [EMAIL_KEY, emailLimpo],
        ]);
      } else {
        await AsyncStorage.multiRemove([REMEMBER_KEY, EMAIL_KEY]);
      }
    } catch (error) {
      console.log("Não foi possível salvar a preferência de login:", error);
    }
  }

  async function entrar() {
    const emailLimpo = email.trim().toLowerCase();

    if (!emailLimpo || !senha) {
      setErro("Preencha seu e-mail e sua senha.");
      return;
    }

    if (Date.now() < loginBloqueadoAte.current) {
      setErro("Aguarde alguns instantes antes de tentar novamente.");
      return;
    }

    try {
      setCarregando(true);
      setErro("");

      const { error } = await supabase.auth.signInWithPassword({
        email: emailLimpo,
        password: senha,
      });

      if (error) {
        falhasLogin.current += 1;

        if (falhasLogin.current >= 5) {
          falhasLogin.current = 0;
          loginBloqueadoAte.current = Date.now() + 30_000;
        }

        setErro(traduzirErroAuth(error));
        return;
      }

      falhasLogin.current = 0;
      loginBloqueadoAte.current = 0;
      await salvarPreferenciaLogin(emailLimpo);
      router.replace("/(tabs)");
    } catch {
      Alert.alert(
        "Não foi possível entrar",
        "Verifique sua conexão com a internet e tente novamente."
      );
    } finally {
      setCarregando(false);
    }
  }

  async function recuperarSenha() {
    const emailLimpo = email.trim().toLowerCase();

    if (!emailLimpo || !emailLimpo.includes("@")) {
      setErro("Digite seu e-mail primeiro.");
      return;
    }

    try {
      setCarregando(true);
      setErro("");

      const { error } = await supabase.auth.signInWithOtp({
        email: emailLimpo,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error && (erroLimiteAuth(error) || !erroOcultaExistenciaDaConta(error))) {
        setErro(traduzirErroAuth(error));
        return;
      }

      router.push({
        pathname: "/recuperar-senha",
        params: {
          email: emailLimpo,
          etapa: "codigo",
        },
      });
    } catch {
      setErro("Não foi possível enviar o código. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  async function verificarCodigo() {
    const emailLimpo = email.trim().toLowerCase();

    if (!emailLimpo) {
      setErro("Digite seu e-mail para receber o código.");
      return;
    }

    try {
      setCarregando(true);
      setErro("");

      const { error } = await supabase.auth.resend({
        type: "signup",
        email: emailLimpo,
      });

      if (error) {
        const mensagem = error.message.toLowerCase();

        if (
          mensagem.includes("already confirmed") ||
          mensagem.includes("already been confirmed") ||
          mensagem.includes("email not found")
        ) {
          setErro("Não foi possível reenviar o código para este e-mail.");
          return;
        }

        setErro(traduzirErroAuth(error));
        return;
      }

      router.push({
        pathname: "/verificar-email",
        params: {
          email: emailLimpo,
        },
      });
    } catch {
      setErro("Não foi possível enviar o código. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }


  async function esqueceuSenha() {
    const emailLimpo = email.trim().toLowerCase();

    if (!emailLimpo || !emailLimpo.includes("@")) {
      setErro("Digite seu e-mail primeiro.");
      return;
    }

    try {
      setCarregando(true);
      setErro("");

      const { error } = await supabase.auth.signInWithOtp({
        email: emailLimpo,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error && (erroLimiteAuth(error) || !erroOcultaExistenciaDaConta(error))) {
        setErro(traduzirErroAuth(error));
        return;
      }

      router.push({
        pathname: "/recuperar-senha",
        params: {
          email: emailLimpo,
          etapa: "codigo",
        },
      });
    } catch {
      setErro("Não foi possível enviar o código. Tente novamente.");
    } finally {
      setCarregando(false);
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
          <View style={[styles.shell, isDesktop && styles.shellDesktop]}>
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
                    Gestão simples para quem precisa ganhar tempo.
                  </Text>

                  <Text style={styles.heroText}>
                    Organize orçamentos, clientes, obras, serviços e financeiro
                    em um só lugar.
                  </Text>
                </View>

                <View style={styles.heroFeatures}>
                  <Feature
                    icon="document-text-outline"
                    text="Orçamentos profissionais em PDF"
                  />
                  <Feature
                    icon="people-outline"
                    text="Clientes e serviços organizados"
                  />
                  <Feature
                    icon="bar-chart-outline"
                    text="Visão clara do seu negócio"
                  />
                </View>

                <Text style={styles.heroFooter}>
                  ORVENA • GESTÃO INTELIGENTE
                </Text>
              </View>
            ) : null}

            <View style={[styles.card, isDesktop && styles.cardDesktop]}>
              {!isDesktop ? (
                <View style={styles.brandArea}>
                  <View style={styles.logoBox}>
                    <Text style={styles.logoText}>O</Text>
                  </View>

                  <Text style={styles.brandName}>ORVENA</Text>
                  <Text style={styles.brandSubtitle}>
                    Seu negócio, organizado.
                  </Text>
                </View>
              ) : (
                <View style={styles.desktopFormBrand}>
                  <Text style={styles.desktopFormBrandText}>ORVENA</Text>
                </View>
              )}

              <View style={styles.heading}>
                <Text style={styles.title}>Bem-vindo de volta</Text>
                <Text style={styles.subtitle}>
                  Entre com seus dados para acessar sua conta.
                </Text>
              </View>

              <Text style={styles.label}>E-mail</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={20} color="#717784" />

                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="seuemail@exemplo.com"
                  placeholderTextColor="#555B65"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  style={styles.input}
                />
              </View>

              <Text style={styles.label}>Senha</Text>
              <View style={styles.inputWrap}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#717784"
                />

                <TextInput
                  value={senha}
                  onChangeText={setSenha}
                  placeholder="Sua senha"
                  placeholderTextColor="#555B65"
                  secureTextEntry={!mostrarSenha}
                  autoCapitalize="none"
                  style={styles.input}
                  onSubmitEditing={entrar}
                />

                <Pressable
                  onPress={() => setMostrarSenha((valor) => !valor)}
                  hitSlop={8}
                >
                  <Ionicons
                    name={mostrarSenha ? "eye-off-outline" : "eye-outline"}
                    size={21}
                    color="#777E89"
                  />
                </Pressable>
              </View>

              <View style={styles.optionsRow}>
                <Pressable
                  style={styles.rememberRow}
                  onPress={() => setLembrarLogin((valor) => !valor)}
                  disabled={carregandoPreferencias}
                >
                  <View
                    style={[
                      styles.checkbox,
                      lembrarLogin && styles.checkboxChecked,
                    ]}
                  >
                    {lembrarLogin ? (
                      <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                    ) : null}
                  </View>

                  <Text style={styles.rememberText}>Salvar login</Text>
                </Pressable>

                <Pressable
                  style={styles.forgotButton}
                  onPress={recuperarSenha}
                  disabled={carregando}
                  hitSlop={12}
                >
                  <Text style={styles.forgotText}>
                    Esqueci minha senha
                  </Text>
                </Pressable>
              </View>

              {erro ? <Text style={styles.error}>{erro}</Text> : null}

              <Pressable
                style={[
                  styles.primaryButton,
                  carregando && styles.buttonDisabled,
                ]}
                disabled={carregando}
                onPress={entrar}
              >
                {carregando ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>ENTRAR</Text>
                )}
              </Pressable>
<View style={styles.signupRow}>
                <Text style={styles.signupText}>Ainda não tem uma conta?</Text>

                <Pressable onPress={() => router.push("/cadastro")}>
                  <Text style={styles.signupLink}>Criar conta</Text>
                </Pressable>
              </View>

              <View style={styles.legalRow}>
                <Pressable onPress={() => router.push("/termos")}>
                  <Text style={styles.legalLink}>Termos de Uso</Text>
                </Pressable>

                <View style={styles.legalDot} />

                <Pressable onPress={() => router.push("/privacidade")}>
                  <Text style={styles.legalLink}>Privacidade</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Feature({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={styles.feature}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={21} color="#B6AAFF" />
      </View>

      <Text style={styles.featureText}>{text}</Text>
    </View>
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
    maxWidth: 1120,
    minHeight: 650,
    flexDirection: "row",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#282D36",
    backgroundColor: "#111319",
    overflow: "hidden",
  },
  desktopHero: {
    flex: 1.08,
    minHeight: 650,
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
    fontSize: 38,
    lineHeight: 46,
    fontWeight: "900",
    maxWidth: 430,
    marginTop: 72,
  },
  heroText: {
    color: "#969DA8",
    fontSize: 15,
    lineHeight: 24,
    maxWidth: 450,
    marginTop: 17,
  },
  heroFeatures: {
    gap: 14,
    marginTop: 34,
  },
  feature: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#211C34",
    borderWidth: 1,
    borderColor: "#352D55",
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    color: "#B8BEC6",
    fontSize: 13,
    fontWeight: "700",
  },
  heroFooter: {
    color: "#5F6570",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginTop: 36,
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
    flex: 0.92,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: "#111319",
    paddingHorizontal: 46,
    paddingVertical: 44,
    justifyContent: "center",
  },
  brandArea: {
    alignItems: "center",
    marginBottom: 28,
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
  },
  brandName: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: 2,
    marginTop: 12,
  },
  brandSubtitle: {
    color: "#747B87",
    fontSize: 11,
    marginTop: 4,
  },
  desktopFormBrand: {
    marginBottom: 34,
  },
  desktopFormBrandText: {
    color: "#7C5CFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
  },
  heading: {
    marginBottom: 12,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 29,
    fontWeight: "900",
  },
  subtitle: {
    color: "#7D848F",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
  },
  label: {
    color: "#A8AEB7",
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 17,
  },
  inputWrap: {
    minHeight: 56,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#292E37",
    backgroundColor: "#0D1015",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    gap: 11,
  },
  input: {
    flex: 1,
    minHeight: 54,
    color: "#FFFFFF",
    fontSize: 14,
    outlineStyle: "none",
  } as any,
  optionsRow: {
    marginTop: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  checkbox: {
    width: 21,
    height: 21,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#3A3F49",
    backgroundColor: "#0F1217",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    borderColor: "#7C5CFF",
    backgroundColor: "#7C5CFF",
  },
  rememberText: {
    color: "#8B929D",
    fontSize: 11,
    fontWeight: "700",
  },
  forgotButton: {
    minHeight: 40,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    zIndex: 20,
  },

  forgotButtonDisabled: {
    opacity: 0.45,
  },

  forgotText: {
    color: "#B4A7FF",
    fontSize: 11,
    fontWeight: "800",
  },

  forgotTextDisabled: {
    color: "#666C76",
  },
  error: {
    color: "#FF7D86",
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
    marginTop: 23,
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
  verifyButton: {
    height: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#3A3260",
    backgroundColor: "#171421",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },

  verifyButtonText: {
    color: "#B4A7FF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 22,
  },
  signupText: {
    color: "#777E89",
    fontSize: 12,
  },
  signupLink: {
    color: "#B4A7FF",
    fontSize: 12,
    fontWeight: "900",
  },
  legalRow: {
    marginTop: 24,
    paddingTop: 19,
    borderTopWidth: 1,
    borderTopColor: "#24282F",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  legalLink: {
    color: "#6F7681",
    fontSize: 10,
    fontWeight: "700",
  },
  legalDot: {
    width: 3,
    height: 3,
    borderRadius: 999,
    backgroundColor: "#4C515A",
  },
});
