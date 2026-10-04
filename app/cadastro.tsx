import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import { validarSenhaNova } from "../lib/security";
import { supabase } from "../lib/supabase";
import { VERSAO_PRIVACIDADE, VERSAO_TERMOS } from "../lib/termos-versoes";

const NOME_STORAGE_KEY = "@orvena:usuario_nome";

export default function CadastroScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [aceitouTermos, setAceitouTermos] = useState(false);

  const [codigo, setCodigo] = useState("");
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [emailConfirmado, setEmailConfirmado] = useState(false);

  const [enviandoCodigo, setEnviandoCodigo] = useState(false);
  const [confirmandoCodigo, setConfirmandoCodigo] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [segundosReenvio, setSegundosReenvio] = useState(0);

  // Evita registrar o aceite duas vezes na mesma sessão.
  const aceiteRegistradoRef = useRef(false);

  useEffect(() => {
    let ativo = true;

    async function verificarSessaoExistente() {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!ativo) return;

        if (error) {
          console.log(
            "Não foi possível verificar a sessão no cadastro:",
            error
          );
          return;
        }

        if (session?.user) {
          router.replace("/(tabs)" as any);
        }
      } catch (error) {
        console.log("Erro ao verificar sessão no cadastro:", error);
      }
    }

    void verificarSessaoExistente();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (segundosReenvio <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setSegundosReenvio((valor) => {
        if (valor <= 1) {
          clearInterval(timer);
          return 0;
        }

        return valor - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [segundosReenvio]);

  function validarDadosAntesDoOtp() {
    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim().toLowerCase();

    if (!nomeLimpo || !emailLimpo || !senha || !confirmarSenha) {
      setErro(
        "Preencha nome, e-mail, senha e confirmação de senha antes de enviar o código."
      );
      return false;
    }

    if (nomeLimpo.length < 2) {
      setErro("Informe seu nome.");
      return false;
    }

    const erroSenha = validarSenhaNova(senha);

    if (erroSenha) {
      setErro(erroSenha);
      return false;
    }

    if (senha !== confirmarSenha) {
      setErro("As senhas não são iguais.");
      return false;
    }

    if (!aceitouTermos) {
      setErro(
        "Aceite os Termos de Uso e a Política de Privacidade antes de verificar o e-mail."
      );
      return false;
    }

    return true;
  }

  async function enviarCodigo() {
    if (emailConfirmado) {
      return;
    }

    if (codigoEnviado && segundosReenvio > 0) {
      setErro(
        `Aguarde ${segundosReenvio} segundos para solicitar um novo código.`
      );
      return;
    }

    if (!validarDadosAntesDoOtp()) {
      return;
    }

    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim().toLowerCase();

    try {
      setEnviandoCodigo(true);
      setErro("");
      setMensagem("");

      if (codigoEnviado) {
        const { error } = await supabase.auth.resend({
          type: "signup",
          email: emailLimpo,
        });

        if (error) {
          setErro(traduzirErroAuth(error));
          return;
        }

        setCodigo("");
        setSegundosReenvio(120);
        setMensagem("Novo código enviado para seu e-mail.");
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: emailLimpo,
        password: senha,
        options: {
          data: {
            nome: nomeLimpo,
            plano: "free",
            aceitou_termos: true,
            aceitou_termos_em: new Date().toISOString(),
            versao_termos: VERSAO_TERMOS,
            versao_privacidade: VERSAO_PRIVACIDADE,
          },
        },
      });

      if (error) {
        const mensagemErro = error.message.toLowerCase();

        if (
          mensagemErro.includes("already registered") ||
          mensagemErro.includes("already been registered")
        ) {
          setErro(
            "Não foi possível criar a conta com este e-mail. Se você já tem cadastro, entre pela tela de login."
          );
          return;
        }

        setErro(traduzirErroAuth(error));
        return;
      }

      setCodigoEnviado(true);
      setSegundosReenvio(120);
      setMensagem("Código enviado. Confira seu e-mail.");
    } catch {
      setErro("Não foi possível enviar o código. Tente novamente.");
    } finally {
      setEnviandoCodigo(false);
    }
  }

  async function confirmarCodigoOtp() {
    const emailLimpo = email.trim().toLowerCase();
    const codigoLimpo = codigo.replace(/\D/g, "");

    if (!codigoEnviado) {
      setErro("Envie o código primeiro.");
      return;
    }

    if (codigoLimpo.length !== 8) {
      setErro("Digite o código de 8 dígitos enviado para seu e-mail.");
      return;
    }

    try {
      setConfirmandoCodigo(true);
      setErro("");
      setMensagem("");

      const { data, error } = await supabase.auth.verifyOtp({
        email: emailLimpo,
        token: codigoLimpo,
        type: "email",
      });

      if (error) {
        const mensagemErro = error.message.toLowerCase();

        if (
          mensagemErro.includes("invalid") ||
          mensagemErro.includes("expired")
        ) {
          setErro("Código inválido ou expirado. Solicite um novo código.");
          return;
        }

        setErro(traduzirErroAuth(error));
        return;
      }

      if (!data.user) {
        setErro("Não foi possível confirmar este e-mail.");
        return;
      }

      const nomeLimpo = nome.trim();

      await AsyncStorage.setItem(NOME_STORAGE_KEY, nomeLimpo);

      // Registra o aceite de termos de forma auditável.
      // A função RPC só aceita ser chamada por usuário autenticado,
      // e grava user_id, versões e data no servidor.
      if (!aceiteRegistradoRef.current) {
        aceiteRegistradoRef.current = true;
        try {
          const { error: aceiteErro } = await supabase.rpc(
            "registrar_aceite_termos",
            {
              p_versao_termos: VERSAO_TERMOS,
              p_versao_privacidade: VERSAO_PRIVACIDADE,
            }
          );
          if (aceiteErro) {
            console.log("Erro ao registrar aceite de termos:", aceiteErro);
            // Não bloqueia o cadastro. O aceite também vai em user_metadata
            // como fallback; o registro em tabela é o auditável.
          }
        } catch (err) {
          console.log("Exceção ao registrar aceite de termos:", err);
        }
      }

      setEmailConfirmado(true);
      setCodigo("");
      setMensagem("E-mail confirmado com sucesso.");
    } catch {
      setErro("Não foi possível confirmar o código. Tente novamente.");
    } finally {
      setConfirmandoCodigo(false);
    }
  }

  async function finalizarCadastro() {
    if (!emailConfirmado) {
      setErro("Confirme seu e-mail antes de criar a conta.");
      return;
    }

    try {
      setFinalizando(true);
      setErro("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setErro(
          "Seu e-mail foi confirmado, mas a sessão não foi encontrada. Entre pela tela de login."
        );
        return;
      }

      router.replace("/(tabs)");
    } finally {
      setFinalizando(false);
    }
  }

  const camposBloqueados = codigoEnviado || emailConfirmado;

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
                    Comece simples e evolua no seu ritmo.
                  </Text>

                  <Text style={styles.heroText}>
                    Crie sua conta, confirme seu e-mail e tenha uma base
                    profissional para organizar o seu negócio.
                  </Text>
                </View>

                <View style={styles.heroFeatures}>
                  <Feature symbol="✓" text="Cadastro rápido e seguro" />
                  <Feature symbol="✉" text="Verificação por código OTP" />
                  <Feature symbol="▣" text="Celular e computador" />
                </View>

                <Text style={styles.heroFooter}>
                  ORVENA • GESTÃO INTELIGENTE
                </Text>
              </View>
            ) : null}

            <View style={[styles.card, isDesktop && styles.cardDesktop]}>
              <View style={styles.topRow}>
                <Pressable
                  style={styles.backButton}
                  onPress={() => router.replace("/login" as any)}
                >
                  <Text style={styles.backSymbol}>←</Text>
                </Pressable>

                {!isDesktop ? (
                  <View style={styles.logoBox}>
                    <Text style={styles.logoText}>O</Text>
                  </View>
                ) : (
                  <Text style={styles.desktopFormBrand}>ORVENA</Text>
                )}

                <View style={styles.topSpacer} />
              </View>

              <View style={styles.heading}>
                <Text style={styles.title}>Criar conta</Text>
                <Text style={styles.subtitle}>
                  Preencha seus dados e confirme seu e-mail.
                </Text>
              </View>

              <Text style={styles.label}>Nome</Text>
              <View
                style={[
                  styles.inputWrap,
                  camposBloqueados && styles.inputWrapDisabled,
                ]}
              >
                <Text style={styles.fieldIcon}>●</Text>
                <TextInput
                  value={nome}
                  onChangeText={setNome}
                  placeholder="Seu nome"
                  placeholderTextColor="#555B65"
                  autoCapitalize="words"
                  editable={!camposBloqueados}
                  style={styles.input}
                />
              </View>

              <Text style={styles.label}>E-mail</Text>

              <View style={styles.emailRow}>
                <View
                  style={[
                    styles.inputWrap,
                    styles.emailInputWrap,
                    camposBloqueados && styles.inputWrapDisabled,
                    emailConfirmado && styles.inputWrapConfirmed,
                  ]}
                >
                  <Text style={styles.fieldIcon}>✉</Text>

                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="seuemail@exemplo.com"
                    placeholderTextColor="#555B65"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    editable={!camposBloqueados}
                    style={styles.input}
                  />

                  {emailConfirmado ? (
                    <Text style={styles.confirmedCheck}>✓</Text>
                  ) : null}
                </View>

                <Pressable
                  style={[
                    styles.otpButton,
                    emailConfirmado && styles.otpButtonConfirmed,
                  ]}
                  onPress={enviarCodigo}
                  disabled={enviandoCodigo || emailConfirmado || (codigoEnviado && segundosReenvio > 0)}
                >
                  {enviandoCodigo ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text
                      style={[
                        styles.otpButtonText,
                        emailConfirmado && styles.otpButtonTextConfirmed,
                      ]}
                    >
                      {emailConfirmado
                        ? "OK"
                        : codigoEnviado && segundosReenvio > 0
                          ? `${segundosReenvio}s`
                          : codigoEnviado
                            ? "REENVIAR"
                            : "OTP"}
                    </Text>
                  )}
                </Pressable>
              </View>

              {codigoEnviado && !emailConfirmado ? (
                <View style={styles.otpArea}>
                  <Text style={styles.otpAreaTitle}>
                    Código de verificação
                  </Text>

                  <Text style={styles.otpAreaSubtitle}>
                    Digite o código de 8 dígitos enviado para {email.trim()}.
                  </Text>

                  <View style={styles.otpConfirmRow}>
                    <TextInput
                      value={codigo}
                      onChangeText={(valor) =>
                        setCodigo(valor.replace(/\D/g, "").slice(0, 8))
                      }
                      placeholder="00000000"
                      placeholderTextColor="#4F5660"
                      keyboardType="number-pad"
                      maxLength={8}
                      style={styles.otpInput}
                      onSubmitEditing={confirmarCodigoOtp}
                    />

                    <Pressable
                      style={styles.confirmOtpButton}
                      onPress={confirmarCodigoOtp}
                      disabled={confirmandoCodigo}
                    >
                      {confirmandoCodigo ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.confirmOtpButtonText}>
                          CONFIRMAR
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {emailConfirmado ? (
                <View style={styles.emailConfirmedBox}>
                  <View style={styles.emailConfirmedIcon}>
                    <Text style={styles.emailConfirmedIconText}>✓</Text>
                  </View>

                  <View style={styles.emailConfirmedTextArea}>
                    <Text style={styles.emailConfirmedTitle}>
                      E-mail confirmado
                    </Text>
                    <Text style={styles.emailConfirmedText}>
                      Seu endereço de e-mail foi verificado com sucesso.
                    </Text>
                  </View>
                </View>
              ) : null}

              <Text style={styles.label}>Senha</Text>
              <View
                style={[
                  styles.inputWrap,
                  camposBloqueados && styles.inputWrapDisabled,
                ]}
              >
                <Text style={styles.fieldIcon}>●</Text>

                <TextInput
                  value={senha}
                  onChangeText={setSenha}
                  placeholder="Mínimo de 6 caracteres"
                  placeholderTextColor="#555B65"
                  secureTextEntry={!mostrarSenha}
                  autoCapitalize="none"
                  editable={!camposBloqueados}
                  style={styles.input}
                />

                <Pressable
                  onPress={() => setMostrarSenha((valor) => !valor)}
                >
                  <Text style={styles.eyeIcon}>
                    {mostrarSenha ? "🙈" : "👁"}
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.label}>Confirmar senha</Text>
              <View
                style={[
                  styles.inputWrap,
                  camposBloqueados && styles.inputWrapDisabled,
                ]}
              >
                <Text style={styles.fieldIcon}>✓</Text>

                <TextInput
                  value={confirmarSenha}
                  onChangeText={setConfirmarSenha}
                  placeholder="Digite a senha novamente"
                  placeholderTextColor="#555B65"
                  secureTextEntry={!mostrarSenha}
                  autoCapitalize="none"
                  editable={!camposBloqueados}
                  style={styles.input}
                />
              </View>

              <Pressable
                style={[
                  styles.termsRow,
                  camposBloqueados && styles.termsRowDisabled,
                ]}
                onPress={() => {
                  if (!camposBloqueados) {
                    setAceitouTermos((valor) => !valor);
                  }
                }}
              >
                <View
                  style={[
                    styles.checkbox,
                    aceitouTermos && styles.checkboxChecked,
                  ]}
                >
                  {aceitouTermos ? (
                    <Text style={styles.checkmark}>✓</Text>
                  ) : null}
                </View>

                <Text style={styles.termsText}>
                  Li e concordo com os{" "}
                  <Text
                    style={styles.termsLink}
                    onPress={(event) => {
                      event.stopPropagation();
                      router.push("/termos");
                    }}
                  >
                    Termos de Uso
                  </Text>{" "}
                  e a{" "}
                  <Text
                    style={styles.termsLink}
                    onPress={(event) => {
                      event.stopPropagation();
                      router.push("/privacidade");
                    }}
                  >
                    Política de Privacidade
                  </Text>
                  .
                </Text>
              </Pressable>

              {erro ? <Text style={styles.error}>{erro}</Text> : null}
              {mensagem ? (
                <Text
                  style={[
                    styles.message,
                    emailConfirmado && styles.messageSuccess,
                  ]}
                >
                  {mensagem}
                </Text>
              ) : null}

              <Pressable
                style={[
                  styles.primaryButton,
                  !emailConfirmado && styles.primaryButtonDisabled,
                ]}
                onPress={finalizarCadastro}
                disabled={!emailConfirmado || finalizando}
              >
                {finalizando ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    CRIAR CONTA
                  </Text>
                )}
              </Pressable>

              <View style={styles.loginRow}>
                <Text style={styles.loginText}>Já tem uma conta?</Text>

                <Pressable onPress={() => router.replace("/login")}>
                  <Text style={styles.loginLink}>Entrar</Text>
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
  symbol,
  text,
}: {
  symbol: string;
  text: string;
}) {
  return (
    <View style={styles.feature}>
      <View style={styles.featureIcon}>
        <Text style={styles.featureIconText}>{symbol}</Text>
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
    minHeight: 760,
    flexDirection: "row",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#282D36",
    backgroundColor: "#111319",
    overflow: "hidden",
  },

  desktopHero: {
    flex: 1.02,
    minHeight: 760,
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

  featureIconText: {
    color: "#B6AAFF",
    fontSize: 18,
    fontWeight: "900",
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
    flex: 0.98,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: "#111319",
    paddingHorizontal: 46,
    paddingVertical: 38,
    justifyContent: "center",
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#2A2E37",
    backgroundColor: "#171A20",
    alignItems: "center",
    justifyContent: "center",
  },

  backSymbol: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },

  logoBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
  },

  logoText: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "900",
  },

  desktopFormBrand: {
    color: "#7C5CFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
  },

  topSpacer: {
    width: 42,
  },

  heading: {
    marginTop: 22,
    marginBottom: 10,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 29,
    fontWeight: "900",
  },

  subtitle: {
    color: "#7D848F",
    fontSize: 13,
    marginTop: 6,
  },

  label: {
    color: "#A8AEB7",
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 14,
  },

  inputWrap: {
    minHeight: 54,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#292E37",
    backgroundColor: "#0D1015",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    gap: 11,
  },

  inputWrapDisabled: {
    opacity: 0.68,
  },

  inputWrapConfirmed: {
    borderColor: "#2C6D50",
    backgroundColor: "#0F1714",
  },

  fieldIcon: {
    width: 20,
    textAlign: "center",
    color: "#717784",
    fontSize: 15,
    fontWeight: "900",
  },

  input: {
    flex: 1,
    minHeight: 52,
    color: "#FFFFFF",
    fontSize: 14,
    outlineStyle: "none",
  } as any,

  emailRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 9,
  },

  emailInputWrap: {
    flex: 1,
  },

  otpButton: {
    minWidth: 88,
    borderRadius: 15,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  otpButtonConfirmed: {
    backgroundColor: "#173A2B",
    borderWidth: 1,
    borderColor: "#286546",
  },

  otpButtonText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  otpButtonTextConfirmed: {
    color: "#74E7AD",
  },

  confirmedCheck: {
    color: "#6BE6AC",
    fontSize: 17,
    fontWeight: "900",
  },

  otpArea: {
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#302A4C",
    backgroundColor: "#151321",
    padding: 14,
    marginTop: 11,
  },

  otpAreaTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  otpAreaSubtitle: {
    color: "#858C97",
    fontSize: 10,
    lineHeight: 16,
    marginTop: 4,
  },

  otpConfirmRow: {
    flexDirection: "row",
    gap: 9,
    marginTop: 12,
  },

  otpInput: {
    flex: 1,
    minHeight: 50,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#343A45",
    backgroundColor: "#0D1015",
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 5,
    textAlign: "center",
    paddingHorizontal: 10,
    outlineStyle: "none",
  } as any,

  confirmOtpButton: {
    minWidth: 105,
    borderRadius: 13,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  confirmOtpButtonText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },

  emailConfirmedBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#285A42",
    backgroundColor: "#101B17",
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginTop: 11,
  },

  emailConfirmedIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#173A2B",
    alignItems: "center",
    justifyContent: "center",
  },

  emailConfirmedIconText: {
    color: "#6BE6AC",
    fontSize: 19,
    fontWeight: "900",
  },

  emailConfirmedTextArea: {
    flex: 1,
  },

  emailConfirmedTitle: {
    color: "#E8FFF3",
    fontSize: 12,
    fontWeight: "900",
  },

  emailConfirmedText: {
    color: "#789487",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 2,
  },

  eyeIcon: {
    fontSize: 18,
    width: 24,
    textAlign: "center",
  },

  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 20,
  },

  termsRowDisabled: {
    opacity: 0.72,
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
    fontSize: 11,
    lineHeight: 18,
  },

  termsLink: {
    color: "#B4A7FF",
    fontWeight: "900",
  },

  error: {
    color: "#FF7D86",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
  },

  message: {
    color: "#B4A7FF",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 12,
  },

  messageSuccess: {
    color: "#6BE6AC",
  },

  primaryButton: {
    height: 54,
    borderRadius: 15,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
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

  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 20,
  },

  loginText: {
    color: "#777E89",
    fontSize: 12,
  },

  loginLink: {
    color: "#B4A7FF",
    fontSize: 12,
    fontWeight: "900",
  },
});