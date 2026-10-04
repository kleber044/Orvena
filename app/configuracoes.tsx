import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";

type ContaResumo = {
  email: string;
  plano: "free" | "trialing" | "pro";
  pro_ate: string | null;
  trial_termina_em: string | null;
  empresa: string | null;
};

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const C = {
  bg: "#09090F",
  card: "#14131D",
  purple: "#7C5CFF",
  purpleLight: "#B4A3FF",
  border: "#302B3E",
  white: "#FFFFFF",
  muted: "#9995A8",
  red: "#FF8999",
  green: "#54DDA0",
};

function formatarData(valor: string | null) {
  if (!valor) return null;

  const data = new Date(valor);

  return Number.isNaN(data.getTime())
    ? null
    : data.toLocaleDateString("pt-BR");
}

function SettingRow({
  icon,
  title,
  subtitle,
  onPress,
  danger = false,
  last = false,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      style={[
        styles.settingRow,
        !last && styles.settingDivider,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View
        style={[
          styles.settingIcon,
          danger && styles.dangerIcon,
        ]}
      >
        <Ionicons
          name={icon}
          size={21}
          color={danger ? C.red : C.purpleLight}
        />
      </View>

      <View style={styles.settingMain}>
        <Text
          style={[
            styles.settingTitle,
            danger && styles.dangerText,
          ]}
        >
          {title}
        </Text>

        <Text style={styles.settingSubtitle}>
          {subtitle}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={19}
        color={C.muted}
      />
    </Pressable>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: IconName;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons
          name={icon}
          size={18}
          color={C.purpleLight}
        />

        <Text style={styles.sectionTitle}>
          {title}
        </Text>
      </View>

      <View style={styles.sectionCard}>
        {children}
      </View>
    </View>
  );
}

export default function ConfiguracoesScreen() {
  const { width } = useWindowDimensions();

  const isDesktop = width >= 950;
  const isSmall = width < 390;

  const [conta, setConta] = useState<ContaResumo | null>(
    null
  );

  const [carregando, setCarregando] = useState(true);
  const [saindo, setSaindo] = useState(false);

  const [
    redirecionandoLogin,
    setRedirecionandoLogin,
  ] = useState(false);

  const [erro, setErro] = useState("");

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
        setRedirecionandoLogin(true);
        router.replace("/login" as any);
        return;
      }

      const { error: syncError } = await supabase.rpc(
        "sincronizar_plano_orvena"
      );

      if (syncError) {
        console.log(
          "Erro ao sincronizar plano:",
          syncError
        );
      }

      const [perfilResult, empresaResult] =
        await Promise.all([
          supabase
            .from("profiles")
            .select(
              "plano, pro_ate, trial_termina_em"
            )
            .eq("id", user.id)
            .maybeSingle(),

          supabase
            .from("empresas")
            .select("nome_fantasia")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

      if (perfilResult.error) {
        throw perfilResult.error;
      }

      if (empresaResult.error) {
        console.log(
          "Erro ao carregar empresa:",
          empresaResult.error
        );
      }

      const planoRaw = String(
        perfilResult.data?.plano || "free"
      );

      setConta({
        email: user.email || "",

        plano:
          planoRaw === "pro" ||
          planoRaw === "trialing"
            ? planoRaw
            : "free",

        pro_ate:
          perfilResult.data?.pro_ate || null,

        trial_termina_em:
          perfilResult.data?.trial_termina_em ||
          null,

        empresa:
          empresaResult.data?.nome_fantasia ||
          null,
      });
    } catch (error) {
      console.log("Erro configurações:", error);

      setErro(
        "Não foi possível carregar sua conta."
      );
    } finally {
      setCarregando(false);
    }
  }

  async function sair() {
    if (saindo) return;

    try {
      setSaindo(true);
      setErro("");

      const { error } =
        await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      router.replace("/login" as any);
    } catch (error) {
      console.log("Erro ao sair:", error);

      setErro(
        "Não foi possível sair da conta. Tente novamente."
      );
    } finally {
      setSaindo(false);
    }
  }

  const nomePlano =
    conta?.plano === "pro"
      ? "Orvena Pro"
      : conta?.plano === "trialing"
        ? "Teste Pro"
        : "Plano gratuito";

  const descricaoPlano =
    conta?.plano === "pro"
      ? `Orvena Pro${
          formatarData(conta.pro_ate)
            ? ` • válido até ${formatarData(
                conta.pro_ate
              )}`
            : ""
        }`
      : conta?.plano === "trialing"
        ? `Teste Pro${
            formatarData(
              conta.trial_termina_em
            )
              ? ` • até ${formatarData(
                  conta.trial_termina_em
                )}`
              : ""
          }`
        : "Plano Free • conhecer Orvena Pro";

  if (carregando || redirecionandoLogin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          <View style={styles.loadingIcon}>
            <Ionicons
              name="settings-outline"
              size={30}
              color={C.purpleLight}
            />
          </View>

          <ActivityIndicator
            size="large"
            color={C.purple}
          />

          <Text style={styles.loadingText}>
            Carregando configurações...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingHorizontal: isSmall
              ? 12
              : isDesktop
                ? 28
                : 16,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.page}>
          {/* CABEÇALHO */}

          <View style={styles.header}>
            <Pressable
              style={styles.backButton}
              onPress={() =>
                router.replace("/(tabs)" as any)
              }
              accessibilityRole="button"
              accessibilityLabel="Voltar para o início"
            >
              <Ionicons
                name="arrow-back"
                size={22}
                color={C.white}
              />
            </Pressable>

            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>
                ORVENA
              </Text>

              <Text style={styles.title}>
                Configurações
              </Text>

              <Text style={styles.subtitle}>
                Gerencie sua conta, plano e privacidade.
              </Text>
            </View>
          </View>

          {/* ERRO */}

          {erro ? (
            <View style={styles.errorBox}>
              <Ionicons
                name="alert-circle-outline"
                size={21}
                color={C.red}
              />

              <View style={styles.errorContent}>
                <Text style={styles.errorText}>
                  {erro}
                </Text>

                <Pressable
                  style={styles.retryButton}
                  onPress={() => void carregar()}
                >
                  <Ionicons
                    name="refresh"
                    size={15}
                    color={C.red}
                  />

                  <Text style={styles.retryText}>
                    Tentar novamente
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* CONTA */}

          <View style={styles.accountCard}>
            <View style={styles.accountTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(conta?.email?.[0] || "O")
                    .toUpperCase()}
                </Text>
              </View>

              <View style={styles.accountMain}>
                <Text
                  style={styles.accountEmail}
                  numberOfLines={2}
                >
                  {conta?.email || "Minha conta"}
                </Text>

                <Text
                  style={styles.accountCompany}
                  numberOfLines={2}
                >
                  {conta?.empresa ||
                    "Empresa ainda não configurada"}
                </Text>
              </View>
            </View>

            <View style={styles.accountDivider} />

            <View style={styles.accountBottom}>
              <View style={styles.planIcon}>
                <Ionicons
                  name={
                    conta?.plano === "free"
                      ? "person-outline"
                      : "diamond-outline"
                  }
                  size={19}
                  color={C.purpleLight}
                />
              </View>

              <View style={styles.planInfo}>
                <Text style={styles.planLabel}>
                  PLANO ATUAL
                </Text>

                <Text style={styles.planName}>
                  {nomePlano}
                </Text>
              </View>

              <Pressable
                style={styles.planButton}
                onPress={() =>
                  router.push("/plano" as any)
                }
              >
                <Text style={styles.planButtonText}>
                  Ver plano
                </Text>

                <Ionicons
                  name="arrow-forward"
                  size={15}
                  color={C.purpleLight}
                />
              </Pressable>
            </View>
          </View>

          {/* LAYOUT RESPONSIVO */}

          <View
            style={[
              styles.columns,
              isDesktop && styles.columnsDesktop,
            ]}
          >
            {/* PRIMEIRA COLUNA */}

            <View style={styles.column}>
              <Section
                title="SUA CONTA"
                icon="person-circle-outline"
              >
                <SettingRow
                  icon="business-outline"
                  title="Empresa"
                  subtitle="Logo, nome, documento e endereço"
                  onPress={() =>
                    router.push("/empresa" as any)
                  }
                />

                <SettingRow
                  icon="diamond-outline"
                  title="Plano"
                  subtitle={descricaoPlano}
                  onPress={() =>
                    router.push("/plano" as any)
                  }
                />

                <SettingRow
                  icon="lock-closed-outline"
                  title="Segurança da conta"
                  subtitle="Alterar senha da sua conta"
                  onPress={() =>
                    router.push(
                      "/alterar-senha" as any
                    )
                  }
                />

                <SettingRow
                  icon="download-outline"
                  title="Exportar meus dados"
                  subtitle="Baixar uma cópia dos dados da sua conta"
                  onPress={() =>
                    router.push(
                      "/exportar-dados" as any
                    )
                  }
                />

                <SettingRow
                  icon="trash-outline"
                  title="Solicitar exclusão da conta"
                  subtitle="Enviar um pedido de exclusão para análise"
                  danger
                  last
                  onPress={() =>
                    router.push(
                      "/solicitar-exclusao-conta" as any
                    )
                  }
                />
              </Section>
            </View>

            {/* SEGUNDA COLUNA */}

            <View style={styles.column}>
              <Section
                title="LEGAL E SUPORTE"
                icon="shield-checkmark-outline"
              >
                <SettingRow
                  icon="document-text-outline"
                  title="Termos de Uso"
                  subtitle="Condições de utilização do Orvena"
                  onPress={() =>
                    router.push("/termos" as any)
                  }
                />

                <SettingRow
                  icon="shield-outline"
                  title="Política de Privacidade"
                  subtitle="Como seus dados são tratados"
                  onPress={() =>
                    router.push(
                      "/privacidade" as any
                    )
                  }
                />

                <SettingRow
                  icon="chatbubbles-outline"
                  title="Ajuda e suporte"
                  subtitle="Dúvidas frequentes e orientações de atendimento"
                  onPress={() =>
                    router.push("/suporte" as any)
                  }
                />

                <SettingRow
                  icon="information-circle-outline"
                  title="Sobre o Orvena"
                  subtitle="Versão, informações do app e documentos"
                  last
                  onPress={() =>
                    router.replace("/sobre" as any)
                  }
                />
              </Section>

              {/* INFORMAÇÕES */}

              <View style={styles.infoCard}>
                <View style={styles.infoIcon}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={24}
                    color={C.purpleLight}
                  />
                </View>

                <View style={styles.infoContent}>
                  <Text style={styles.infoTitle}>
                    Conta conectada
                  </Text>

                  <Text style={styles.infoText}>
                    Seus clientes, obras, serviços,
                    orçamentos, agenda, financeiro e
                    relatórios ficam vinculados à sua
                    conta.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* SAIR */}

          <Pressable
            style={[
              styles.logoutButton,
              saindo && styles.disabled,
            ]}
            onPress={sair}
            disabled={saindo}
            accessibilityRole="button"
          >
            {saindo ? (
              <ActivityIndicator color={C.red} />
            ) : (
              <>
                <Ionicons
                  name="log-out-outline"
                  size={21}
                  color={C.red}
                />

                <Text style={styles.logoutText}>
                  Sair da conta
                </Text>
              </>
            )}
          </Pressable>

          <Text style={styles.footer}>
            ORVENA • GESTÃO INTELIGENTE
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  safeArea: {
    flex: 1,
    backgroundColor: C.bg,
  },

  scroll: {
    flexGrow: 1,
    paddingTop: 20,
    paddingBottom: 45,
  },

  page: {
    width: "100%",
    maxWidth: 1160,
    alignSelf: "center",
  },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    padding: 24,
  },

  loadingIcon: {
    width: 70,
    height: 70,
    borderRadius: 22,
    backgroundColor: "#241C3B",
    borderWidth: 1,
    borderColor: "#47376D",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: C.muted,
    fontSize: 13,
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 23,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },

  headerText: {
    flex: 1,
    minWidth: 0,
  },

  eyebrow: {
    color: C.purpleLight,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.3,
    marginBottom: 5,
  },

  title: {
    color: C.white,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.7,
  },

  subtitle: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    borderRadius: 15,
    backgroundColor: "#28161D",
    borderWidth: 1,
    borderColor: "#633743",
    padding: 14,
    marginBottom: 17,
  },

  errorContent: {
    flex: 1,
    minWidth: 0,
  },

  errorText: {
    color: C.red,
    fontSize: 13,
    lineHeight: 19,
  },

  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: "#3A222C",
  },

  retryText: {
    color: C.red,
    fontSize: 12,
    fontWeight: "800",
  },

  accountCard: {
    backgroundColor: "#1A1529",
    borderWidth: 1,
    borderColor: "#49376C",
    borderRadius: 21,
    padding: 18,
    marginBottom: 24,
  },

  accountTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },

  avatar: {
    width: 59,
    height: 59,
    borderRadius: 18,
    backgroundColor: "#30234D",
    borderWidth: 1,
    borderColor: "#5A438A",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },

  avatarText: {
    color: C.purpleLight,
    fontSize: 24,
    fontWeight: "800",
  },

  accountMain: {
    flex: 1,
    minWidth: 0,
  },

  accountEmail: {
    color: C.white,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 21,
  },

  accountCompany: {
    color: "#ABA3BA",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },

  accountDivider: {
    height: 1,
    backgroundColor: "#443654",
    marginVertical: 17,
  },

  accountBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  planIcon: {
    width: 37,
    height: 37,
    borderRadius: 12,
    backgroundColor: "#302348",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  planInfo: {
    flex: 1,
    minWidth: 0,
  },

  planLabel: {
    color: "#988BB0",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.7,
  },

  planName: {
    color: C.white,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 3,
  },

  planButton: {
    minHeight: 39,
    paddingHorizontal: 11,
    borderRadius: 11,
    backgroundColor: "#302348",
    borderWidth: 1,
    borderColor: "#55417B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    flexShrink: 0,
  },

  planButtonText: {
    color: C.purpleLight,
    fontSize: 11,
    fontWeight: "800",
  },

  columns: {
    gap: 0,
  },

  columnsDesktop: {
    flexDirection: "row",
    gap: 20,
    alignItems: "flex-start",
  },

  column: {
    flex: 1,
    minWidth: 0,
  },

  section: {
    marginBottom: 23,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 12,
    paddingHorizontal: 2,
  },

  sectionTitle: {
    color: "#B5A4FF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
  },

  sectionCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 19,
    paddingHorizontal: 13,
  },

  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 15,
    minHeight: 75,
  },

  settingDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#292535",
  },

  settingIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: "#261E3A",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  dangerIcon: {
    backgroundColor: "#301C27",
  },

  settingMain: {
    flex: 1,
    minWidth: 0,
  },

  settingTitle: {
    color: C.white,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },

  settingSubtitle: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },

  dangerText: {
    color: C.red,
  },

  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 17,
    backgroundColor: "#1B1629",
    borderWidth: 1,
    borderColor: "#3B3053",
    marginBottom: 20,
  },

  infoIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#2B2143",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  infoContent: {
    flex: 1,
    minWidth: 0,
  },

  infoTitle: {
    color: C.white,
    fontSize: 13,
    fontWeight: "800",
  },

  infoText: {
    color: "#AAA1BA",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 6,
  },

  logoutButton: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#633540",
    backgroundColor: "#28161D",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 5,
  },

  logoutText: {
    color: C.red,
    fontSize: 14,
    fontWeight: "800",
  },

  footer: {
    color: "#646071",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textAlign: "center",
    marginTop: 27,
  },

  disabled: {
    opacity: 0.6,
  },
});