import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";

export default function RecuperarSenhaScreen() {
  const params = useLocalSearchParams<{
    email?: string;
    etapa?: string;
  }>();

  const [etapa, setEtapa] = useState<"email" | "codigo" | "senha">("email");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    const emailRecebido =
      typeof params.email === "string"
        ? params.email.trim().toLowerCase()
        : "";

    if (emailRecebido) {
      setEmail(emailRecebido);

      if (params.etapa === "codigo") {
        setEtapa("codigo");
        setMensagem("Código enviado para o e-mail informado.");
      }
    }
  }, [params.email, params.etapa]);

  async function enviarCodigo() {
    const emailLimpo = email.trim().toLowerCase();

    setErro("");
    setMensagem("");

    if (!emailLimpo || !emailLimpo.includes("@")) {
      setErro("Digite um e-mail válido.");
      return;
    }

    try {
      setCarregando(true);

      const { error } = await supabase.auth.signInWithOtp({
        email: emailLimpo,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) {
        setErro(error.message);
        return;
      }

      setEmail(emailLimpo);
      setCodigo("");
      setEtapa("codigo");
      setMensagem("Código enviado para o e-mail informado.");
    } catch {
      setErro("Não foi possível enviar o código.");
    } finally {
      setCarregando(false);
    }
  }

  async function confirmarCodigo() {
    const token = codigo.replace(/\D/g, "");

    setErro("");
    setMensagem("");

    if (token.length !== 8) {
      setErro("Digite os 8 números do código enviado ao seu e-mail.");
      return;
    }

    try {
      setCarregando(true);

      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: "email",
      });

      if (error || !data.session) {
        setErro("Código inválido ou expirado.");
        return;
      }

      setEtapa("senha");
      setMensagem("Código confirmado. Agora crie sua nova senha.");
    } catch {
      setErro("Não foi possível confirmar o código.");
    } finally {
      setCarregando(false);
    }
  }

  async function salvarSenha() {
    setErro("");
    setMensagem("");

    if (senha.length < 8) {
      setErro("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    if (senha !== confirmacao) {
      setErro("As senhas não são iguais.");
      return;
    }

    try {
      setCarregando(true);

      const { error } = await supabase.auth.updateUser({
        password: senha,
      });

      if (error) {
        setErro(error.message);
        return;
      }

      await supabase.auth.signOut();

      setMensagem("Senha alterada com sucesso. Entre novamente.");

      setTimeout(() => {
        router.replace("/login" as any);
      }, 1200);
    } catch {
      setErro("Não foi possível alterar sua senha.");
    } finally {
      setCarregando(false);
    }
  }

  function voltar() {
    if (etapa === "email") {
      router.replace("/login" as any);
      return;
    }

    if (etapa === "codigo") {
      router.replace("/login" as any);
      return;
    }

    setSenha("");
    setConfirmacao("");
    setErro("");
    setMensagem("");
    setEtapa("codigo");
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={voltar}>
            <Text style={styles.backText}>←</Text>
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>ORVENA</Text>
            <Text style={styles.title}>Recuperar senha</Text>
            <Text style={styles.subtitle}>
              Receba um código no seu e-mail, confirme e crie uma nova senha.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          {etapa === "email" ? (
            <>
              <Text style={styles.label}>E-mail da conta</Text>

              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="seuemail@exemplo.com"
                placeholderTextColor="#555D68"
                style={styles.input}
              />

              <Pressable
                style={[styles.button, carregando && styles.disabled]}
                onPress={enviarCodigo}
                disabled={carregando}
              >
                {carregando ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>ENVIAR CÓDIGO</Text>
                )}
              </Pressable>
            </>
          ) : null}

          {etapa === "codigo" ? (
            <>
              <Text style={styles.emailInfo}>
                Código enviado para {email}
              </Text>

              <Text style={styles.label}>Código de 8 números</Text>

              <TextInput
                value={codigo}
                onChangeText={(valor) =>
                  setCodigo(valor.replace(/\D/g, "").slice(0, 8))
                }
                keyboardType="number-pad"
                maxLength={8}
                placeholder="00000000"
                placeholderTextColor="#555D68"
                style={styles.codeInput}
              />

              <Pressable
                style={[styles.button, carregando && styles.disabled]}
                onPress={confirmarCodigo}
                disabled={carregando}
              >
                {carregando ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>CONFIRMAR CÓDIGO</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.secondaryButton}
                onPress={enviarCodigo}
                disabled={carregando}
              >
                <Text style={styles.secondaryText}>REENVIAR CÓDIGO</Text>
              </Pressable>
            </>
          ) : null}

          {etapa === "senha" ? (
            <>
              <Text style={styles.label}>Nova senha</Text>

              <TextInput
                value={senha}
                onChangeText={setSenha}
                secureTextEntry
                placeholder="Mínimo de 8 caracteres"
                placeholderTextColor="#555D68"
                style={styles.input}
              />

              <Text style={styles.label}>Confirmar nova senha</Text>

              <TextInput
                value={confirmacao}
                onChangeText={setConfirmacao}
                secureTextEntry
                placeholder="Digite novamente"
                placeholderTextColor="#555D68"
                style={styles.input}
              />

              <Pressable
                style={[styles.button, carregando && styles.disabled]}
                onPress={salvarSenha}
                disabled={carregando}
              >
                {carregando ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>SALVAR NOVA SENHA</Text>
                )}
              </Pressable>
            </>
          ) : null}

          {erro ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{erro}</Text>
            </View>
          ) : null}

          {mensagem ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{mensagem}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B0C10",
  },

  page: {
    width: "100%",
    maxWidth: 650,
    alignSelf: "center",
    padding: 16,
  },

  header: {
    flexDirection: "row",
    gap: 13,
    alignItems: "flex-start",
    marginTop: 6,
    marginBottom: 18,
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

  eyebrow: {
    color: "#7C5CFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.3,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 4,
  },

  subtitle: {
    color: "#7D848F",
    fontSize: 10,
    lineHeight: 16,
    marginTop: 4,
  },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#292E37",
    backgroundColor: "#12151B",
    padding: 16,
  },

  label: {
    color: "#A4AAB3",
    fontSize: 9,
    fontWeight: "800",
    marginBottom: 6,
    marginTop: 12,
  },

  input: {
    minHeight: 50,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#2A3039",
    backgroundColor: "#0D1015",
    color: "#FFFFFF",
    paddingHorizontal: 13,
    fontSize: 12,
  },

  codeInput: {
    minHeight: 58,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#4C3E7F",
    backgroundColor: "#0D1015",
    color: "#FFFFFF",
    paddingHorizontal: 13,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 4,
    textAlign: "center",
  },

  emailInfo: {
    color: "#C6BDFA",
    fontSize: 10,
    lineHeight: 15,
    marginBottom: 5,
  },

  button: {
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },

  secondaryButton: {
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#383E48",
    backgroundColor: "#171A20",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 9,
  },

  secondaryText: {
    color: "#C9CDD3",
    fontSize: 8,
    fontWeight: "900",
  },

  errorBox: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#552C35",
    backgroundColor: "#211217",
    padding: 11,
    marginTop: 14,
  },

  errorText: {
    color: "#FF8A93",
    fontSize: 10,
  },

  successBox: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#285D43",
    backgroundColor: "#102019",
    padding: 11,
    marginTop: 14,
  },

  successText: {
    color: "#78DCA8",
    fontSize: 10,
  },

  disabled: {
    opacity: 0.6,
  },
});
