import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { contarNotificacoesNaoLidas } from "../../lib/notificacoes";
import { supabase } from "../../lib/supabase";

type Plano = "free" | "trialing" | "pro";

type Perfil = {
  id: string;
  nome: string;
  plano: Plano;
  trial_termina_em: string | null;
  pro_ate: string | null;
};

type IconName = React.ComponentProps<typeof Ionicons>["name"];

type GerenciamentoItem = {
  title: string;
  subtitle: string;
  icon: IconName;
  route: string;
  pro?: boolean;
};

const NOME_STORAGE_KEY = "@orvena:usuario_nome";

const COLORS = {
  background: "#090A10",
  sidebar: "#0F111A",
  surface: "#141722",
  surfaceSoft: "#191C29",
  border: "#292D3B",
  primary: "#7C5CFF",
  primaryLight: "#A997FF",
  text: "#F7F7FC",
  muted: "#9399AA",
  faint: "#676D7D",
  success: "#5DDEAB",
  danger: "#FF8997",
};

const GERENCIAMENTO: GerenciamentoItem[] = [
  {
    title: "Clientes",
    subtitle: "Cadastros e contatos",
    icon: "people-outline",
    route: "/clientes",
    pro: true,
  },
  {
    title: "Orçamentos",
    subtitle: "Propostas e documentos",
    icon: "document-text-outline",
    route: "/orcamentos",
  },
  {
    title: "Obras",
    subtitle: "Acompanhe seus projetos",
    icon: "business-outline",
    route: "/obras",
    pro: true,
  },
  {
    title: "Serviços",
    subtitle: "Serviços e valores",
    icon: "construct-outline",
    route: "/servicos",
    pro: true,
  },
  {
    title: "Financeiro",
    subtitle: "Entradas e saídas",
    icon: "wallet-outline",
    route: "/financeiro",
    pro: true,
  },
  {
    title: "Agenda",
    subtitle: "Prazos e compromissos",
    icon: "calendar-outline",
    route: "/agenda",
    pro: true,
  },
  {
    title: "Relatórios",
    subtitle: "Indicadores do negócio",
    icon: "bar-chart-outline",
    route: "/relatorios",
    pro: true,
  },
  {
    title: "Empresa",
    subtitle: "Identidade da sua marca",
    icon: "storefront-outline",
    route: "/empresa",
    pro: true,
  },
  {
    title: "Plano",
    subtitle: "Assinatura Orvena",
    icon: "diamond-outline",
    route: "/plano",
  },
  {
    title: "Configurações",
    subtitle: "Preferências e segurança",
    icon: "settings-outline",
    route: "/configuracoes",
  },
];

export default function HomeScreen() {
  const { width } = useWindowDimensions();

  const isDesktop = width >= 980;
  const isTablet = width >= 650;

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [logoEmpresa, setLogoEmpresa] = useState("");
  const [carregandoPerfil, setCarregandoPerfil] = useState(true);
  const [redirecionandoLogin, setRedirecionandoLogin] = useState(false);

  const [recursoBloqueado, setRecursoBloqueado] =
    useState<string | null>(null);

  const [menuContaAberto, setMenuContaAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);

  const [totalOrcamentos, setTotalOrcamentos] = useState(0);
  const [totalClientes, setTotalClientes] = useState(0);
  const [totalObras, setTotalObras] = useState(0);
  const [totalServicos, setTotalServicos] = useState(0);

  const [mostrarCadastroEmpresa, setMostrarCadastroEmpresa] =
    useState(false);

  const [notificacoesNaoLidas, setNotificacoesNaoLidas] = useState(0);

  const planoAtivo = perfil?.plano ?? "free";
  const temPro = planoAtivo === "trialing" || planoAtivo === "pro";

  const nomeExibicao = useMemo(() => {
    const nome = perfil?.nome?.trim();
    return nome ? nome.split(" ")[0] : "Usuário";
  }, [perfil?.nome]);

  const textoPlano =
    planoAtivo === "trialing"
      ? "Teste Pro"
      : planoAtivo === "pro"
        ? "Orvena Pro"
        : "Plano Grátis";

  useFocusEffect(
    useCallback(() => {
      void carregarPerfil();
      void carregarContadores();
      void carregarContadorNotificacoes();
    }, [])
  );

  async function carregarContadorNotificacoes() {
    try {
      const total = await contarNotificacoesNaoLidas();
      setNotificacoesNaoLidas(total);
    } catch (error) {
      console.log("Erro ao carregar notificações:", error);
      setNotificacoesNaoLidas(0);
    }
  }

  async function carregarContadores() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setTotalOrcamentos(0);
        setTotalClientes(0);
        setTotalObras(0);
        setTotalServicos(0);
        return;
      }

      const [orcamentos, clientes, obras, servicos] = await Promise.all([
        supabase
          .from("orcamentos")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),

        supabase
          .from("clientes")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),

        supabase
          .from("obras")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),

        supabase
          .from("servicos")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);

      if (!orcamentos.error) setTotalOrcamentos(orcamentos.count ?? 0);
      if (!clientes.error) setTotalClientes(clientes.count ?? 0);
      if (!obras.error) setTotalObras(obras.count ?? 0);
      if (!servicos.error) setTotalServicos(servicos.count ?? 0);

      if (orcamentos.error) {
        console.log("Erro no resumo de orçamentos:", orcamentos.error.message);
      }

      if (clientes.error) {
        console.log("Erro no resumo de clientes:", clientes.error.message);
      }

      if (obras.error) {
        console.log("Erro no resumo de obras:", obras.error.message);
      }

      if (servicos.error) {
        console.log("Erro no resumo de serviços:", servicos.error.message);
      }
    } catch (error) {
      console.log("Erro ao carregar indicadores:", error);
    }
  }

  async function carregarPerfil() {
    try {
      if (!perfil) {
        setCarregandoPerfil(true);
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setRedirecionandoLogin(true);
        router.replace("/login");
        return;
      }

      const { error: syncError } = await supabase.rpc(
        "sincronizar_plano_orvena"
      );

      if (syncError) {
        console.log("Erro ao sincronizar plano:", syncError.message);
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, plano, trial_termina_em, pro_ate")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.log("Erro ao carregar perfil:", error.message);
      }

      const nomeMetadata =
        typeof user.user_metadata?.nome === "string"
          ? user.user_metadata.nome
          : "";

      const nomeLocal = await AsyncStorage.getItem(NOME_STORAGE_KEY);

      const perfilFinal: Perfil = {
        id: user.id,
        nome:
          data?.nome?.trim() ||
          nomeMetadata.trim() ||
          nomeLocal?.trim() ||
          "Usuário",
        plano:
          data?.plano === "trialing" || data?.plano === "pro"
            ? data.plano
            : "free",
        trial_termina_em: data?.trial_termina_em ?? null,
        pro_ate: data?.pro_ate ?? null,
      };

      setPerfil(perfilFinal);

      await AsyncStorage.setItem(
        NOME_STORAGE_KEY,
        perfilFinal.nome
      );

      const perfilTemPro =
        perfilFinal.plano === "trialing" ||
        perfilFinal.plano === "pro";

      // Atualiza a imagem sempre que a Home recebe foco, inclusive após
      // salvar uma nova logo na tela Empresa.
      const { data: empresaData, error: empresaError } = await supabase
        .from("empresas")
        .select("nome_fantasia, logo_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (empresaError) {
        console.log("Erro ao carregar empresa:", empresaError.message);
        setLogoEmpresa("");
        setMostrarCadastroEmpresa(false);
      } else {
        setLogoEmpresa(empresaData?.logo_url?.trim() || "");
        setMostrarCadastroEmpresa(
          perfilTemPro && !empresaData?.nome_fantasia?.trim()
        );
      }
    } catch (error) {
      console.log("Erro ao carregar conta:", error);
    } finally {
      setCarregandoPerfil(false);
    }
  }

  function recursoEstaBloqueado(item: GerenciamentoItem) {
    return Boolean(item.pro && perfil && !temPro);
  }

  function abrirItem(item: GerenciamentoItem) {
    if (recursoEstaBloqueado(item)) {
      setRecursoBloqueado(item.title);
      return;
    }

    router.push(item.route as any);
  }

  function abrirResumo(
    nome: string,
    rota: string,
    precisaPro = false
  ) {
    if (precisaPro && !temPro) {
      setRecursoBloqueado(nome);
      return;
    }

    router.push(rota as any);
  }

  async function sair() {
    try {
      setSaindo(true);
      await supabase.auth.signOut();
      setMenuContaAberto(false);
      router.replace("/login");
    } catch (error) {
      console.log("Erro ao sair:", error);
    } finally {
      setSaindo(false);
    }
  }

  if ((!perfil && carregandoPerfil) || redirecionandoLogin) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "left", "right"]}
      >
        <View style={styles.loadingScreen}>
          <View style={styles.loadingLogo}>
            <Text style={styles.loadingLogoText}>O</Text>
          </View>
          <ActivityIndicator color={COLORS.primary} size="large" />
          <Text style={styles.loadingText}>
            Preparando seu espaço de trabalho...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "left", "right"]}
    >
      <View style={styles.screen}>
        {isDesktop && (
          <View style={styles.sidebar}>
            <View style={styles.sidebarBrand}>
              <View style={styles.brandLogo}>
                <Text style={styles.brandLogoText}>O</Text>
              </View>

              <View>
                <Text style={styles.brandTitle}>ORVENA</Text>
                <Text style={styles.brandSubtitle}>
                  GESTÃO INTELIGENTE
                </Text>
              </View>
            </View>

            <View style={styles.sidebarDivider} />

            <Text style={styles.sidebarSectionLabel}>MENU PRINCIPAL</Text>

            <SidebarButton
              icon="grid-outline"
              label="Visão geral"
              active
            />

            <Text style={styles.sidebarSectionLabel}>
              GERENCIAMENTO
            </Text>

            <ScrollView
              style={styles.sidebarMenuScroll}
              showsVerticalScrollIndicator={false}
            >
              {GERENCIAMENTO.map((item) => (
                <SidebarButton
                  key={item.title}
                  icon={item.icon}
                  label={item.title}
                  locked={recursoEstaBloqueado(item)}
                  onPress={() => abrirItem(item)}
                />
              ))}

              <SidebarButton
                icon="chatbubble-ellipses-outline"
                label="Suporte"
                onPress={() => router.push("/suporte" as any)}
              />
            </ScrollView>

            <Pressable
              style={styles.sidebarPlanCard}
              onPress={() => router.push("/plano" as any)}
            >
              <View style={styles.sidebarPlanTop}>
                <Ionicons
                  name="diamond-outline"
                  size={19}
                  color={COLORS.primaryLight}
                />

                <Text style={styles.sidebarPlanTag}>
                  {temPro ? "ATIVO" : "DISPONÍVEL"}
                </Text>
              </View>

              <Text style={styles.sidebarPlanTitle}>
                {textoPlano}
              </Text>

              <Text style={styles.sidebarPlanDescription}>
                {temPro
                  ? "Seus recursos avançados estão liberados."
                  : "Desbloqueie ferramentas para sua empresa."}
              </Text>

              <View style={styles.sidebarPlanLink}>
                <Text style={styles.sidebarPlanLinkText}>
                  Gerenciar plano
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={15}
                  color={COLORS.primaryLight}
                />
              </View>
            </Pressable>

            <Text style={styles.sidebarBottomText}>
              ORVENA · GESTÃO INTELIGENTE
            </Text>
          </View>
        )}

        <ScrollView
          style={styles.contentScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            isDesktop && styles.contentDesktop,
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerIdentity}>
              {!isDesktop && (
                <View style={styles.mobileLogo}>
                  <Text style={styles.mobileLogoText}>O</Text>
                </View>
              )}

              <View style={styles.headerText}>
                <Text style={styles.headerEyebrow}>
                  {isDesktop ? "PAINEL DE CONTROLE" : "ORVENA"}
                </Text>

                <Text style={styles.headerTitle}>
                  {isDesktop ? "Visão geral" : "Meu painel"}
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <Pressable
                style={styles.headerIconButton}
                onPress={() =>
                  router.push("/notificacoes" as any)
                }
              >
                <Ionicons
                  name="notifications-outline"
                  size={21}
                  color={COLORS.text}
                />

                {notificacoesNaoLidas > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {notificacoesNaoLidas > 9
                        ? "9+"
                        : notificacoesNaoLidas}
                    </Text>
                  </View>
                )}
              </Pressable>

              <Pressable
                style={styles.avatarButton}
                onPress={() => setMenuContaAberto(true)}
              >
                {logoEmpresa ? (
                  <Image
                    source={{ uri: logoEmpresa }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.avatarButtonText}>
                    {nomeExibicao.charAt(0).toUpperCase()}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.headerDivider} />

          <View style={styles.welcomeRow}>
            <View style={styles.welcomeContent}>
              <Text style={styles.welcomeEyebrow}>
                SEU ESPAÇO DE TRABALHO
              </Text>

              <Text
                style={[
                  styles.welcomeTitle,
                  isDesktop && styles.welcomeTitleDesktop,
                ]}
              >
                Olá, {nomeExibicao}!
              </Text>

              <Text style={styles.welcomeSubtitle}>
                Gerencie seu negócio com tudo em um só lugar.
              </Text>
            </View>

            {isDesktop && (
              <View style={styles.welcomePlanBadge}>
                <Ionicons
                  name={temPro ? "diamond" : "sparkles-outline"}
                  size={17}
                  color={COLORS.primaryLight}
                />
                <Text style={styles.welcomePlanText}>
                  {textoPlano}
                </Text>
              </View>
            )}
          </View>

          <Pressable
            style={[
              styles.heroCard,
              isDesktop && styles.heroCardDesktop,
            ]}
            onPress={() => router.push("/orcamentos/novo")}
          >
            <View style={styles.heroGlow} />

            <View style={styles.heroContent}>
              <View style={styles.heroTag}>
                <Ionicons
                  name="flash"
                  size={12}
                  color="#FFFFFF"
                />
                <Text style={styles.heroTagText}>ACESSO RÁPIDO</Text>
              </View>

              <Text style={styles.heroTitle}>
                Crie um novo orçamento
              </Text>

              <Text style={styles.heroSubtitle}>
                Prepare uma proposta profissional para seu cliente
                em poucos passos.
              </Text>

              <View style={styles.heroAction}>
                <Ionicons
                  name="add"
                  size={20}
                  color={COLORS.primary}
                />

                <Text style={styles.heroActionText}>
                  Novo orçamento
                </Text>

                <Ionicons
                  name="arrow-forward"
                  size={17}
                  color={COLORS.primary}
                />
              </View>
            </View>

            {isDesktop && (
              <View style={styles.heroIllustration}>
                <View style={styles.heroIllustrationInner}>
                  <Ionicons
                    name="document-text-outline"
                    size={62}
                    color="#FFFFFF"
                  />
                  <View style={styles.heroIllustrationCheck}>
                    <Ionicons
                      name="checkmark"
                      size={22}
                      color={COLORS.primary}
                    />
                  </View>
                </View>
              </View>
            )}
          </Pressable>

          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionEyebrow}>
                SEUS NÚMEROS
              </Text>
              <Text style={styles.sectionTitle}>
                Resumo do negócio
              </Text>
            </View>

            <View style={styles.sectionIndicator}>
              <View style={styles.greenDot} />
              <Text style={styles.sectionIndicatorText}>
                Dados da sua conta
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.summaryGrid,
              isTablet && styles.summaryGridTablet,
            ]}
          >
            <SummaryCard
              icon="document-text-outline"
              value={totalOrcamentos}
              label="Orçamentos"
              description="Propostas cadastradas"
              onPress={() =>
                abrirResumo("Orçamentos", "/orcamentos")
              }
              wide={isTablet}
            />

            <SummaryCard
              icon="people-outline"
              value={totalClientes}
              label="Clientes"
              description="Contatos cadastrados"
              locked={!temPro}
              onPress={() =>
                abrirResumo("Clientes", "/clientes", true)
              }
              wide={isTablet}
            />

            <SummaryCard
              icon="business-outline"
              value={totalObras}
              label="Obras"
              description="Projetos cadastrados"
              locked={!temPro}
              onPress={() =>
                abrirResumo("Obras", "/obras", true)
              }
              wide={isTablet}
            />

            <SummaryCard
              icon="construct-outline"
              value={totalServicos}
              label="Serviços"
              description="Itens cadastrados"
              locked={!temPro}
              onPress={() =>
                abrirResumo("Serviços", "/servicos", true)
              }
              wide={isTablet}
            />
          </View>

          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionEyebrow}>
                FERRAMENTAS
              </Text>
              <Text style={styles.sectionTitle}>
                Gerenciamento
              </Text>
            </View>

            <Text style={styles.sectionCount}>
              {GERENCIAMENTO.length} módulos
            </Text>
          </View>

          <View
            style={[
              styles.modulesGrid,
              isTablet && styles.modulesGridTablet,
            ]}
          >
            {GERENCIAMENTO.map((item) => {
              const locked = recursoEstaBloqueado(item);

              return (
                <Pressable
                  key={item.title}
                  style={[
                    styles.moduleCard,
                    isTablet && styles.moduleCardTablet,
                  ]}
                  onPress={() => abrirItem(item)}
                >
                  <View style={styles.moduleTop}>
                    <View
                      style={[
                        styles.moduleIconBox,
                        locked && styles.moduleIconBoxLocked,
                      ]}
                    >
                      <Ionicons
                        name={item.icon}
                        size={22}
                        color={
                          locked
                            ? COLORS.faint
                            : COLORS.primaryLight
                        }
                      />
                    </View>

                    <Ionicons
                      name={locked ? "lock-closed" : "arrow-up-outline"}
                      size={17}
                      color={
                        locked
                          ? COLORS.faint
                          : COLORS.muted
                      }
                      style={
                        locked
                          ? undefined
                          : { transform: [{ rotate: "45deg" }] }
                      }
                    />
                  </View>

                  <Text
                    style={[
                      styles.moduleTitle,
                      locked && styles.moduleTitleLocked,
                    ]}
                  >
                    {item.title}
                  </Text>

                  <Text style={styles.moduleSubtitle}>
                    {item.subtitle}
                  </Text>

                  <View style={styles.moduleBottom}>
                    <Text
                      style={[
                        styles.moduleActionText,
                        locked && styles.moduleActionTextLocked,
                      ]}
                    >
                      {locked ? "Recurso Pro" : "Acessar módulo"}
                    </Text>

                    {!locked && (
                      <Ionicons
                        name="arrow-forward"
                        size={14}
                        color={COLORS.primaryLight}
                      />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {!temPro && (
            <Pressable
              style={styles.proBanner}
              onPress={() => router.push("/plano" as any)}
            >
              <View style={styles.proBannerIcon}>
                <Ionicons
                  name="diamond"
                  size={26}
                  color={COLORS.primaryLight}
                />
              </View>

              <View style={styles.proBannerText}>
                <Text style={styles.proBannerTitle}>
                  Mais possibilidades com Orvena Pro
                </Text>

                <Text style={styles.proBannerSubtitle}>
                  Desbloqueie clientes, obras, serviços e muito mais.
                </Text>
              </View>

              <Ionicons
                name="arrow-forward"
                size={21}
                color={COLORS.primaryLight}
              />
            </Pressable>
          )}

          <Text style={styles.footer}>
            ORVENA · SEU NEGÓCIO, ORGANIZADO
          </Text>
        </ScrollView>

        {/* MODAL: CADASTRO DA EMPRESA */}

        <Modal
          visible={mostrarCadastroEmpresa}
          transparent
          animationType="fade"
          onRequestClose={() => {}}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalIcon}>
                <Ionicons
                  name="diamond"
                  size={29}
                  color={COLORS.primaryLight}
                />
              </View>

              <Text style={styles.modalEyebrow}>
                ORVENA PRO ATIVADO
              </Text>

              <Text style={styles.modalTitle}>
                Seu plano Pro está pronto!
              </Text>

              <Text style={styles.modalText}>
                Agora cadastre os dados da sua empresa para usar
                nome, logo, telefone e endereço nos documentos e PDFs.
              </Text>

              <View style={styles.modalInfoBox}>
                <Ionicons
                  name="business-outline"
                  size={22}
                  color={COLORS.primaryLight}
                />

                <View style={{ flex: 1 }}>
                  <Text style={styles.modalInfoTitle}>
                    Complete sua identidade
                  </Text>

                  <Text style={styles.modalInfoText}>
                    A identidade da sua empresa será usada nos
                    recursos Pro compatíveis.
                  </Text>
                </View>
              </View>

              <Pressable
                style={styles.modalPrimaryButton}
                onPress={() => {
                  setMostrarCadastroEmpresa(false);
                  router.push("/empresa" as any);
                }}
              >
                <Text style={styles.modalPrimaryButtonText}>
                  IR PARA EMPRESA
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={17}
                  color="#FFFFFF"
                />
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* MODAL: RECURSO PRO */}

        <Modal
          visible={Boolean(recursoBloqueado)}
          transparent
          animationType="fade"
          onRequestClose={() => setRecursoBloqueado(null)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setRecursoBloqueado(null)}
          >
            <Pressable
              style={styles.modalCard}
              onPress={(event) => event.stopPropagation()}
            >
              <View style={styles.modalIcon}>
                <Ionicons
                  name="lock-closed-outline"
                  size={29}
                  color={COLORS.primaryLight}
                />
              </View>

              <Text style={styles.modalEyebrow}>
                RECURSO EXCLUSIVO
              </Text>

              <Text style={styles.modalTitle}>
                {recursoBloqueado} está disponível no Orvena Pro
              </Text>

              <Text style={styles.modalText}>
                Ative o plano Pro para liberar esta ferramenta e
                os outros recursos avançados do Orvena.
              </Text>

              <View style={styles.trialBox}>
                <View>
                  <Text style={styles.trialTitle}>
                    30 dias grátis
                  </Text>

                  <Text style={styles.trialSubtitle}>
                    Depois, R$ 14,99 por mês
                  </Text>
                </View>

                <Ionicons
                  name="diamond"
                  size={28}
                  color={COLORS.primaryLight}
                />
              </View>

              <Text style={styles.modalSmallText}>
                Durante o teste Pro, você também poderá utilizar
                o nome e a logo da empresa nos PDFs compatíveis.
              </Text>

              <Pressable
                style={styles.modalPrimaryButton}
                onPress={() => {
                  setRecursoBloqueado(null);
                  router.push("/plano" as any);
                }}
              >
                <Text style={styles.modalPrimaryButtonText}>
                  VER ORVENA PRO
                </Text>

                <Ionicons
                  name="arrow-forward"
                  size={17}
                  color="#FFFFFF"
                />
              </Pressable>

              <Pressable
                style={styles.modalSecondaryButton}
                onPress={() => setRecursoBloqueado(null)}
              >
                <Text style={styles.modalSecondaryButtonText}>
                  CONTINUAR NO GRÁTIS
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {/* MODAL: CONTA */}

        <Modal
          visible={menuContaAberto}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuContaAberto(false)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setMenuContaAberto(false)}
          >
            <Pressable
              style={styles.accountCard}
              onPress={(event) => event.stopPropagation()}
            >
              <View style={styles.accountHeader}>
                <View style={styles.accountAvatar}>
                  {logoEmpresa ? (
                    <Image
                      source={{ uri: logoEmpresa }}
                      style={styles.avatarImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={styles.accountAvatarText}>
                      {nomeExibicao.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.accountName}>
                    {perfil?.nome || "Usuário"}
                  </Text>

                  <Text style={styles.accountPlan}>
                    {textoPlano}
                  </Text>
                </View>

                <Pressable
                  style={styles.accountClose}
                  onPress={() => setMenuContaAberto(false)}
                >
                  <Ionicons
                    name="close"
                    size={21}
                    color={COLORS.muted}
                  />
                </Pressable>
              </View>

              <View style={styles.accountDivider} />

              <AccountOption
                icon="person-outline"
                title="Minha conta"
                onPress={() => {
                  setMenuContaAberto(false);
                  router.push("/minha-conta" as any);
                }}
              />

              <AccountOption
                icon="diamond-outline"
                title="Minha assinatura"
                onPress={() => {
                  setMenuContaAberto(false);
                  router.push("/plano" as any);
                }}
              />

              <AccountOption
                icon="business-outline"
                title="Minha empresa"
                onPress={() => {
                  setMenuContaAberto(false);
                  router.push("/empresa" as any);
                }}
              />

              <AccountOption
                icon="shield-checkmark-outline"
                title="Segurança"
                onPress={() => {
                  setMenuContaAberto(false);
                  router.push("/alterar-senha" as any);
                }}
              />

              <AccountOption
                icon="chatbubble-ellipses-outline"
                title="Suporte"
                onPress={() => {
                  setMenuContaAberto(false);
                  router.push("/suporte" as any);
                }}
              />

              <Pressable
                style={styles.logoutButton}
                onPress={sair}
                disabled={saindo}
              >
                {saindo ? (
                  <ActivityIndicator color={COLORS.danger} />
                ) : (
                  <>
                    <Ionicons
                      name="log-out-outline"
                      size={20}
                      color={COLORS.danger}
                    />

                    <Text style={styles.logoutText}>
                      Sair da conta
                    </Text>
                  </>
                )}
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

function SidebarButton({
  icon,
  label,
  active = false,
  locked = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  locked?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.sidebarButton,
        active && styles.sidebarButtonActive,
      ]}
    >
      <Ionicons
        name={icon}
        size={19}
        color={active ? "#FFFFFF" : COLORS.muted}
      />

      <Text
        style={[
          styles.sidebarButtonText,
          active && styles.sidebarButtonTextActive,
        ]}
      >
        {label}
      </Text>

      {locked && (
        <Ionicons
          name="lock-closed"
          size={13}
          color={COLORS.faint}
          style={{ marginLeft: "auto" }}
        />
      )}
    </Pressable>
  );
}

function SummaryCard({
  icon,
  value,
  label,
  description,
  locked = false,
  wide = false,
  onPress,
}: {
  icon: IconName;
  value: number;
  label: string;
  description: string;
  locked?: boolean;
  wide?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.summaryCard,
        wide && styles.summaryCardWide,
      ]}
      onPress={onPress}
    >
      <View style={styles.summaryTop}>
        <View style={styles.summaryIcon}>
          <Ionicons
            name={icon}
            size={21}
            color={locked ? COLORS.faint : COLORS.primaryLight}
          />
        </View>

        {locked && (
          <Ionicons
            name="lock-closed"
            size={14}
            color={COLORS.faint}
          />
        )}
      </View>

      <Text
        style={[
          styles.summaryValue,
          locked && styles.summaryValueLocked,
        ]}
      >
        {value}
      </Text>

      <Text style={styles.summaryLabel}>{label}</Text>

      <Text style={styles.summaryDescription}>
        {locked ? "Disponível no Pro" : description}
      </Text>
    </Pressable>
  );
}

function AccountOption({
  icon,
  title,
  onPress,
}: {
  icon: IconName;
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.accountOption} onPress={onPress}>
      <View style={styles.accountOptionIcon}>
        <Ionicons
          name={icon}
          size={20}
          color={COLORS.primaryLight}
        />
      </View>

      <Text style={styles.accountOptionText}>{title}</Text>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={COLORS.faint}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  screen: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: COLORS.background,
  },

  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    padding: 24,
  },

  loadingLogo: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingLogoText: {
    color: "#FFFFFF",
    fontSize: 38,
    fontWeight: "900",
  },

  loadingText: {
    color: COLORS.muted,
    fontSize: 13,
    textAlign: "center",
  },

  sidebar: {
    width: 266,
    backgroundColor: COLORS.sidebar,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    paddingHorizontal: 15,
    paddingTop: 24,
    paddingBottom: 17,
  },

  sidebarBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
  },

  brandLogo: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  brandLogoText: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "900",
  },

  brandTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: 2,
  },

  brandSubtitle: {
    color: COLORS.faint,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginTop: 3,
  },

  sidebarDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginTop: 26,
    marginBottom: 18,
  },

  sidebarSectionLabel: {
    color: COLORS.faint,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
    marginTop: 16,
    marginBottom: 9,
    marginLeft: 13,
  },

  sidebarMenuScroll: {
    flex: 1,
    marginTop: 1,
  },

  sidebarButton: {
    minHeight: 46,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    marginBottom: 3,
  },

  sidebarButtonActive: {
    backgroundColor: COLORS.primary,
  },

  sidebarButtonText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "700",
  },

  sidebarButtonTextActive: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  sidebarPlanCard: {
    borderWidth: 1,
    borderColor: "#42365E",
    backgroundColor: "#1B182B",
    borderRadius: 17,
    padding: 16,
    marginTop: 12,
  },

  sidebarPlanTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sidebarPlanTag: {
    color: COLORS.success,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },

  sidebarPlanTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 13,
  },

  sidebarPlanDescription: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },

  sidebarPlanLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 14,
  },

  sidebarPlanLinkText: {
    color: COLORS.primaryLight,
    fontSize: 11,
    fontWeight: "900",
  },

  sidebarBottomText: {
    color: COLORS.faint,
    fontSize: 9,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 17,
    letterSpacing: 0.5,
  },

  contentScroll: {
    flex: 1,
  },

  content: {
    width: "100%",
    paddingHorizontal: 17,
    paddingTop: 15,
    paddingBottom: 46,
  },

  contentDesktop: {
    maxWidth: 1300,
    alignSelf: "center",
    paddingHorizontal: 36,
    paddingTop: 27,
    paddingBottom: 60,
  },

  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  headerIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },

  mobileLogo: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  mobileLogoText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 23,
  },

  headerText: {
    flex: 1,
  },

  headerEyebrow: {
    color: COLORS.primaryLight,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },

  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 4,
  },

  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  headerIconButton: {
    width: 43,
    height: 43,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  notificationBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.background,
  },

  notificationBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },

  avatarButton: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: "#352851",
    borderWidth: 1,
    borderColor: "#65518D",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  avatarImage: {
    width: "100%",
    height: "100%",
  },

  avatarButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },

  headerDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginTop: 15,
    marginBottom: 26,
  },

  welcomeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
    marginBottom: 23,
  },

  welcomeContent: {
    flex: 1,
  },

  welcomeEyebrow: {
    color: COLORS.primaryLight,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 10,
  },

  welcomeTitle: {
    color: COLORS.text,
    fontSize: 27,
    lineHeight: 36,
    fontWeight: "900",
  },

  welcomeTitleDesktop: {
    fontSize: 34,
    lineHeight: 42,
  },

  welcomeSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
  },

  welcomePlanBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: "#42365E",
    backgroundColor: "#1A1729",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
  },

  welcomePlanText: {
    color: COLORS.primaryLight,
    fontSize: 12,
    fontWeight: "900",
  },

  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#6449D4",
    backgroundColor: "#4F36BD",
    overflow: "hidden",
    minHeight: 230,
    justifyContent: "center",
    padding: 23,
    position: "relative",
  },

  heroCardDesktop: {
    minHeight: 255,
    paddingHorizontal: 32,
  },

  heroGlow: {
    position: "absolute",
    top: -180,
    right: -80,
    width: 460,
    height: 460,
    borderRadius: 230,
    backgroundColor: "#7558F5",
    opacity: 0.56,
  },

  heroContent: {
    maxWidth: 620,
    zIndex: 2,
  },

  heroTag: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.15)",
  },

  heroTagText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },

  heroTitle: {
    color: "#FFFFFF",
    fontSize: 25,
    lineHeight: 32,
    fontWeight: "900",
    marginTop: 15,
  },

  heroSubtitle: {
    color: "#E5DEFF",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 8,
    maxWidth: 430,
  },

  heroAction: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 15,
    minHeight: 43,
    marginTop: 20,
  },

  heroActionText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "900",
  },

  heroIllustration: {
    position: "absolute",
    right: 65,
    top: 35,
    width: 172,
    height: 172,
    borderRadius: 42,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "10deg" }],
  },

  heroIllustrationInner: {
    width: 130,
    height: 130,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },

  heroIllustrationCheck: {
    position: "absolute",
    bottom: 4,
    right: 0,
    width: 39,
    height: 39,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  sectionHeading: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 33,
    marginBottom: 16,
  },

  sectionEyebrow: {
    color: COLORS.primaryLight,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginBottom: 5,
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
  },

  sectionIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingBottom: 4,
  },

  greenDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },

  sectionIndicatorText: {
    color: COLORS.faint,
    fontSize: 10,
  },

  sectionCount: {
    color: COLORS.faint,
    fontSize: 10,
    paddingBottom: 4,
  },

  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  summaryGridTablet: {
    gap: 14,
  },

  summaryCard: {
    width: "48%",
    flexGrow: 1,
    minHeight: 164,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: 15,
  },

  summaryCardWide: {
    width: "22%",
    flexGrow: 1,
    minHeight: 174,
    padding: 19,
  },

  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#251F3B",
    alignItems: "center",
    justifyContent: "center",
  },

  summaryValue: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 14,
  },

  summaryValueLocked: {
    color: COLORS.faint,
  },

  summaryLabel: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },

  summaryDescription: {
    color: COLORS.faint,
    fontSize: 10,
    marginTop: 5,
  },

  modulesGrid: {
    gap: 10,
  },

  modulesGridTablet: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },

  moduleCard: {
    width: "100%",
    minHeight: 154,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: 17,
    justifyContent: "space-between",
  },

  moduleCardTablet: {
    width: "30%",
    flexGrow: 1,
    minHeight: 168,
    maxWidth: "49%",
    padding: 19,
  },

  moduleTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  moduleIconBox: {
    width: 45,
    height: 45,
    borderRadius: 13,
    backgroundColor: "#251F3B",
    alignItems: "center",
    justifyContent: "center",
  },

  moduleIconBoxLocked: {
    backgroundColor: "#1C1E28",
  },

  moduleTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 14,
  },

  moduleTitleLocked: {
    color: "#9C9FAC",
  },

  moduleSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 4,
  },

  moduleBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 16,
  },

  moduleActionText: {
    color: COLORS.primaryLight,
    fontSize: 10,
    fontWeight: "900",
  },

  moduleActionTextLocked: {
    color: COLORS.faint,
  },

  proBanner: {
    marginTop: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#453B65",
    backgroundColor: "#1D192C",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
  },

  proBannerIcon: {
    width: 47,
    height: 47,
    borderRadius: 14,
    backgroundColor: "#302445",
    alignItems: "center",
    justifyContent: "center",
  },

  proBannerText: {
    flex: 1,
  },

  proBannerTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "900",
  },

  proBannerSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },

  footer: {
    color: COLORS.faint,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    textAlign: "center",
    marginTop: 40,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.79)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },

  modalCard: {
    width: "100%",
    maxWidth: 450,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#383148",
    backgroundColor: COLORS.surface,
    padding: 24,
  },

  modalIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: "#28213C",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  modalEyebrow: {
    color: COLORS.primaryLight,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
  },

  modalTitle: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "900",
    lineHeight: 30,
    marginTop: 10,
  },

  modalText: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 11,
  },

  modalInfoBox: {
    flexDirection: "row",
    gap: 13,
    borderWidth: 1,
    borderColor: "#363049",
    backgroundColor: "#1B1929",
    padding: 15,
    borderRadius: 15,
    marginTop: 21,
  },

  modalInfoTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 12,
  },

  modalInfoText: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },

  modalPrimaryButton: {
    minHeight: 52,
    backgroundColor: COLORS.primary,
    borderRadius: 13,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 22,
  },

  modalPrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  trialBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginTop: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.sidebar,
    padding: 17,
  },

  trialTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 17,
  },

  trialSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 5,
  },

  modalSmallText: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 16,
  },

  modalSecondaryButton: {
    minHeight: 47,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 5,
  },

  modalSecondaryButtonText: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
  },

  accountCard: {
    width: "100%",
    maxWidth: 410,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: 21,
  },

  accountHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },

  accountAvatar: {
    width: 53,
    height: 53,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  accountAvatarText: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
  },

  accountName: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900",
  },

  accountPlan: {
    color: COLORS.primaryLight,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 4,
  },

  accountClose: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },

  accountDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 20,
  },

  accountOption: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  accountOptionIcon: {
    width: 37,
    height: 37,
    borderRadius: 11,
    backgroundColor: "#211D32",
    alignItems: "center",
    justifyContent: "center",
  },

  accountOptionText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
  },

  logoutButton: {
    minHeight: 51,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#50313C",
    backgroundColor: "#261920",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 17,
  },

  logoutText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: "900",
  },
});