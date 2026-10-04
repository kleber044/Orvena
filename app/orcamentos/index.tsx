import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
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

type Orcamento = {
  id: string;
  numero: number;
  cliente_nome: string;
  titulo: string | null;
  total: number | string;
  status: "rascunho" | "enviado" | "aprovado" | "recusado" | "cancelado";
  criado_em: string;
};

type StatusFiltro = "todos" | Orcamento["status"];
type IconName = React.ComponentProps<typeof Ionicons>["name"];

const COLORS = {
  background: "#090A10",
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

const STATUS: {
  value: StatusFiltro;
  label: string;
}[] = [
  { value: "todos", label: "Todos" },
  { value: "rascunho", label: "Rascunhos" },
  { value: "enviado", label: "Enviados" },
  { value: "aprovado", label: "Aprovados" },
  { value: "recusado", label: "Recusados" },
  { value: "cancelado", label: "Cancelados" },
];

const STATUS_LABELS: Record<Orcamento["status"], string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
  cancelado: "Cancelado",
};

function formatarMoeda(valor: number | string) {
  const numero = Number(valor || 0);

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(numero) ? numero : 0);
}

function formatarData(valor: string) {
  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(data);
}

function valorNumerico(valor: number | string) {
  const numero = Number(valor || 0);
  return Number.isFinite(numero) ? numero : 0;
}

export default function OrcamentosScreen() {
  const { width } = useWindowDimensions();

  const isDesktop = width >= 900;
  const isTablet = width >= 650;

  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [busca, setBusca] = useState("");
  const [statusSelecionado, setStatusSelecionado] =
    useState<StatusFiltro>("todos");

  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [redirecionandoLogin, setRedirecionandoLogin] = useState(false);
  const [erro, setErro] = useState("");

  const carregarOrcamentos = useCallback(async (silencioso = false) => {
    try {
      if (silencioso) {
        setAtualizando(true);
      } else {
        setCarregando(true);
      }

      setErro("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setRedirecionandoLogin(true);
        setOrcamentos([]);
        router.replace("/login" as any);
        return;
      }

      const { data, error } = await supabase
        .from("orcamentos")
        .select("id, numero, cliente_nome, titulo, total, status, criado_em")
        .eq("user_id", user.id)
        .order("criado_em", { ascending: false });

      if (error) {
        console.log("Erro ao carregar orçamentos:", error.message);
        setErro("Não foi possível consultar seus orçamentos. Tente novamente.");
        setOrcamentos([]);
        return;
      }

      setOrcamentos((data || []) as Orcamento[]);
    } catch (error) {
      console.log("Erro inesperado ao carregar orçamentos:", error);
      setErro("Não foi possível carregar seus orçamentos.");
      setOrcamentos([]);
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregarOrcamentos();
    }, [carregarOrcamentos])
  );

  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return orcamentos.filter((orcamento) => {
      const statusOk =
        statusSelecionado === "todos" ||
        orcamento.status === statusSelecionado;

      if (!statusOk) return false;
      if (!termo) return true;

      const numero = String(orcamento.numero || "");
      const cliente = orcamento.cliente_nome?.toLowerCase() || "";
      const titulo = orcamento.titulo?.toLowerCase() || "";

      return (
        numero.includes(termo) ||
        cliente.includes(termo) ||
        titulo.includes(termo)
      );
    });
  }, [orcamentos, busca, statusSelecionado]);

  const resumo = useMemo(() => {
    const aprovados = orcamentos.filter(
      (item) => item.status === "aprovado"
    );

    const pendentes = orcamentos.filter(
      (item) =>
        item.status === "rascunho" ||
        item.status === "enviado"
    );

    const totalGeral = orcamentos.reduce(
      (acc, item) => acc + valorNumerico(item.total),
      0
    );

    return {
      total: orcamentos.length,
      aprovados: aprovados.length,
      pendentes: pendentes.length,
      valor: totalGeral,
    };
  }, [orcamentos]);

  const contadoresStatus = useMemo(() => {
    const contadores: Record<StatusFiltro, number> = {
      todos: orcamentos.length,
      rascunho: 0,
      enviado: 0,
      aprovado: 0,
      recusado: 0,
      cancelado: 0,
    };

    orcamentos.forEach((item) => {
      if (item.status in contadores) {
        contadores[item.status] += 1;
      }
    });

    return contadores;
  }, [orcamentos]);

  function abrirOrcamento(id: string) {
    router.push({
      pathname: "/orcamentos/[id]",
      params: { id },
    });
  }

  function novoOrcamento() {
    router.push("/orcamentos/novo");
  }

  if (carregando || redirecionandoLogin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingScreen}>
          <View style={styles.loadingLogo}>
            <Ionicons
              name="document-text-outline"
              size={31}
              color="#FFFFFF"
            />
          </View>

          <ActivityIndicator size="large" color={COLORS.primary} />

          <Text style={styles.loadingText}>
            Carregando seus orçamentos...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.page,
            isDesktop && styles.pageDesktop,
          ]}
        >
          {/* CABEÇALHO */}

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Pressable
                style={styles.backButton}
                onPress={() => router.replace("/(tabs)" as any)}
              >
                <Ionicons
                  name="arrow-back"
                  size={21}
                  color={COLORS.text}
                />
              </Pressable>

              <View style={styles.headerIdentity}>
                <Text style={styles.headerEyebrow}>
                  ORVENA / GERENCIAMENTO
                </Text>

                <Text
                  style={[
                    styles.headerTitle,
                    isDesktop && styles.headerTitleDesktop,
                  ]}
                >
                  Orçamentos
                </Text>

                <Text style={styles.headerSubtitle}>
                  Organize suas propostas e acompanhe os resultados.
                </Text>
              </View>
            </View>

            {isDesktop && (
              <View style={styles.headerActions}>
                <Pressable
                  style={styles.refreshButton}
                  onPress={() => void carregarOrcamentos(true)}
                  disabled={atualizando}
                >
                  {atualizando ? (
                    <ActivityIndicator
                      size="small"
                      color={COLORS.primaryLight}
                    />
                  ) : (
                    <Ionicons
                      name="refresh-outline"
                      size={19}
                      color={COLORS.primaryLight}
                    />
                  )}

                  <Text style={styles.refreshText}>
                    Atualizar
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.newButton}
                  onPress={novoOrcamento}
                >
                  <Ionicons
                    name="add"
                    size={19}
                    color="#FFFFFF"
                  />

                  <Text style={styles.newButtonText}>
                    Novo orçamento
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          <View style={styles.headerDivider} />

          {/* DESTAQUE */}

          <View
            style={[
              styles.heroCard,
              isDesktop && styles.heroCardDesktop,
            ]}
          >
            <View style={styles.heroGlow} />

            <View style={styles.heroContent}>
              <View style={styles.heroTag}>
                <Ionicons
                  name="sparkles"
                  size={13}
                  color="#FFFFFF"
                />

                <Text style={styles.heroTagText}>
                  SUA ÁREA DE ORÇAMENTOS
                </Text>
              </View>

              <Text
                style={[
                  styles.heroTitle,
                  isDesktop && styles.heroTitleDesktop,
                ]}
              >
                Propostas organizadas, negócios em movimento.
              </Text>

              <Text style={styles.heroSubtitle}>
                Crie orçamentos profissionais, acompanhe os
                status e encontre tudo em um só lugar.
              </Text>

              {!isDesktop && (
                <Pressable
                  style={styles.heroAction}
                  onPress={novoOrcamento}
                >
                  <Ionicons
                    name="add"
                    size={19}
                    color={COLORS.primary}
                  />

                  <Text style={styles.heroActionText}>
                    Novo orçamento
                  </Text>

                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={COLORS.primary}
                  />
                </Pressable>
              )}
            </View>

            {isDesktop && (
              <View style={styles.heroIllustration}>
                <Ionicons
                  name="document-text-outline"
                  size={69}
                  color="#FFFFFF"
                />

                <View style={styles.heroCheck}>
                  <Ionicons
                    name="checkmark"
                    size={24}
                    color={COLORS.primary}
                  />
                </View>
              </View>
            )}
          </View>

          {/* RESUMO */}

          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionEyebrow}>
                INDICADORES
              </Text>

              <Text style={styles.sectionTitle}>
                Resumo dos orçamentos
              </Text>
            </View>

            {isDesktop && (
              <View style={styles.sectionTag}>
                <View style={styles.greenDot} />

                <Text style={styles.sectionTagText}>
                  Dados da sua conta
                </Text>
              </View>
            )}
          </View>

          <View
            style={[
              styles.summaryGrid,
              isTablet && styles.summaryGridTablet,
            ]}
          >
            <SummaryCard
              icon="document-text-outline"
              label="Total de orçamentos"
              value={String(resumo.total)}
              description="Propostas cadastradas"
              wide={isTablet}
            />

            <SummaryCard
              icon="checkmark-circle-outline"
              label="Aprovados"
              value={String(resumo.aprovados)}
              description="Propostas aprovadas"
              wide={isTablet}
            />

            <SummaryCard
              icon="time-outline"
              label="Em andamento"
              value={String(resumo.pendentes)}
              description="Rascunhos e enviados"
              wide={isTablet}
            />

            <SummaryCard
              icon="wallet-outline"
              label="Valor total"
              value={formatarMoeda(resumo.valor)}
              description="Soma de todos os orçamentos"
              compact
              wide={isTablet}
            />
          </View>

          {/* LISTAGEM */}

          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionEyebrow}>
                SUAS PROPOSTAS
              </Text>

              <Text style={styles.sectionTitle}>
                Todos os orçamentos
              </Text>
            </View>

            <Text style={styles.resultCount}>
              {listaFiltrada.length} resultado(s)
            </Text>
          </View>

          <View style={styles.listPanel}>
            <View
              style={[
                styles.toolbar,
                !isDesktop && styles.toolbarMobile,
              ]}
            >
              <View style={styles.searchBox}>
                <Ionicons
                  name="search-outline"
                  size={20}
                  color={COLORS.muted}
                />

                <TextInput
                  value={busca}
                  onChangeText={setBusca}
                  placeholder={
                    isDesktop
                      ? "Buscar por cliente, título ou número..."
                      : "Buscar orçamentos..."
                  }
                  placeholderTextColor={COLORS.faint}
                  style={styles.searchInput}
                />

                {busca.length > 0 && (
                  <Pressable onPress={() => setBusca("")}>
                    <Ionicons
                      name="close-circle"
                      size={19}
                      color={COLORS.faint}
                    />
                  </Pressable>
                )}
              </View>

              {!isDesktop && (
                <View style={styles.mobileActions}>
                  <Pressable
                    style={styles.refreshButtonMobile}
                    onPress={() => void carregarOrcamentos(true)}
                    disabled={atualizando}
                  >
                    {atualizando ? (
                      <ActivityIndicator
                        size="small"
                        color={COLORS.primaryLight}
                      />
                    ) : (
                      <Ionicons
                        name="refresh-outline"
                        size={20}
                        color={COLORS.primaryLight}
                      />
                    )}
                  </Pressable>

                  <Pressable
                    style={styles.newButtonMobile}
                    onPress={novoOrcamento}
                  >
                    <Ionicons
                      name="add"
                      size={20}
                      color="#FFFFFF"
                    />

                    <Text style={styles.newButtonText}>
                      Novo
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersRow}
            >
              {STATUS.map((status) => (
                <FilterButton
                  key={status.value}
                  label={status.label}
                  count={contadoresStatus[status.value]}
                  active={statusSelecionado === status.value}
                  onPress={() =>
                    setStatusSelecionado(status.value)
                  }
                />
              ))}
            </ScrollView>

            <View style={styles.listDivider} />

            {erro ? (
              <View style={styles.stateBox}>
                <View style={styles.errorIcon}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={32}
                    color={COLORS.danger}
                  />
                </View>

                <Text style={styles.stateTitle}>
                  Não foi possível carregar
                </Text>

                <Text style={styles.stateDescription}>
                  {erro}
                </Text>

                <Pressable
                  style={styles.retryButton}
                  onPress={() => void carregarOrcamentos()}
                >
                  <Ionicons
                    name="refresh-outline"
                    size={17}
                    color="#FFFFFF"
                  />

                  <Text style={styles.retryButtonText}>
                    Tentar novamente
                  </Text>
                </Pressable>
              </View>
            ) : listaFiltrada.length === 0 ? (
              <View style={styles.stateBox}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name={
                      orcamentos.length === 0
                        ? "document-text-outline"
                        : "search-outline"
                    }
                    size={32}
                    color={COLORS.primaryLight}
                  />
                </View>

                <Text style={styles.stateTitle}>
                  {orcamentos.length === 0
                    ? "Nenhum orçamento ainda"
                    : "Nenhum resultado encontrado"}
                </Text>

                <Text style={styles.stateDescription}>
                  {orcamentos.length === 0
                    ? "Crie seu primeiro orçamento e comece a organizar suas propostas."
                    : "Tente modificar sua busca ou selecionar outro status."}
                </Text>

                {orcamentos.length === 0 ? (
                  <Pressable
                    style={styles.retryButton}
                    onPress={novoOrcamento}
                  >
                    <Ionicons
                      name="add"
                      size={18}
                      color="#FFFFFF"
                    />

                    <Text style={styles.retryButtonText}>
                      Criar primeiro orçamento
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={styles.clearFilters}
                    onPress={() => {
                      setBusca("");
                      setStatusSelecionado("todos");
                    }}
                  >
                    <Text style={styles.clearFiltersText}>
                      Limpar filtros
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <View style={styles.list}>
                {listaFiltrada.map((orcamento, index) => (
                  <Pressable
                    key={orcamento.id}
                    style={({ pressed }) => [
                      styles.budgetCard,
                      isDesktop && styles.budgetCardDesktop,
                      index === listaFiltrada.length - 1 &&
                        styles.budgetCardLast,
                      pressed && styles.budgetCardPressed,
                    ]}
                    onPress={() => abrirOrcamento(orcamento.id)}
                  >
                    <View style={styles.budgetMain}>
                      <View style={styles.numberBox}>
                        <Ionicons
                          name="document-text-outline"
                          size={17}
                          color={COLORS.primaryLight}
                        />

                        <Text style={styles.numberText}>
                          #{orcamento.numero}
                        </Text>
                      </View>

                      <View style={styles.budgetInfo}>
                        <Text
                          numberOfLines={1}
                          style={styles.budgetClient}
                        >
                          {orcamento.cliente_nome ||
                            "Cliente não informado"}
                        </Text>

                        <Text
                          numberOfLines={1}
                          style={styles.budgetTitle}
                        >
                          {orcamento.titulo ||
                            "Orçamento sem título"}
                        </Text>

                        <View style={styles.budgetMeta}>
                          <Ionicons
                            name="calendar-outline"
                            size={13}
                            color={COLORS.faint}
                          />

                          <Text style={styles.budgetDate}>
                            {formatarData(orcamento.criado_em)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.budgetRight,
                        isDesktop && styles.budgetRightDesktop,
                      ]}
                    >
                      <StatusBadge status={orcamento.status} />

                      <View style={styles.budgetPriceRow}>
                        <Text style={styles.budgetTotal}>
                          {formatarMoeda(orcamento.total)}
                        </Text>

                        <View style={styles.openIcon}>
                          <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={COLORS.primaryLight}
                          />
                        </View>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}

            {!erro && listaFiltrada.length > 0 && (
              <View style={styles.listFooter}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={15}
                  color={COLORS.faint}
                />

                <Text style={styles.listFooterText}>
                  Exibindo {listaFiltrada.length} de{" "}
                  {orcamentos.length} orçamentos
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.footer}>
            ORVENA · SEU NEGÓCIO, ORGANIZADO
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  description,
  compact = false,
  wide = false,
}: {
  icon: IconName;
  label: string;
  value: string;
  description: string;
  compact?: boolean;
  wide?: boolean;
}) {
  return (
    <View
      style={[
        styles.summaryCard,
        wide && styles.summaryCardWide,
      ]}
    >
      <View style={styles.summaryIcon}>
        <Ionicons
          name={icon}
          size={21}
          color={COLORS.primaryLight}
        />
      </View>

      <Text style={styles.summaryLabel}>
        {label}
      </Text>

      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.65}
        style={[
          styles.summaryValue,
          compact && styles.summaryValueCompact,
        ]}
      >
        {value}
      </Text>

      <Text style={styles.summaryDescription}>
        {description}
      </Text>
    </View>
  );
}

function FilterButton({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.filterButton,
        active && styles.filterButtonActive,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.filterText,
          active && styles.filterTextActive,
        ]}
      >
        {label}
      </Text>

      <View
        style={[
          styles.filterCount,
          active && styles.filterCountActive,
        ]}
      >
        <Text
          style={[
            styles.filterCountText,
            active && styles.filterCountTextActive,
          ]}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

function StatusBadge({
  status,
}: {
  status: Orcamento["status"];
}) {
  const statusStyles = {
    aprovado: {
      backgroundColor: "#11251D",
      borderColor: "#285A42",
      color: "#71DFAA",
    },
    enviado: {
      backgroundColor: "#122132",
      borderColor: "#35506B",
      color: "#80BCE8",
    },
    rascunho: {
      backgroundColor: "#23212B",
      borderColor: "#474052",
      color: "#B7ADC7",
    },
    recusado: {
      backgroundColor: "#2A171E",
      borderColor: "#63313A",
      color: "#FF8790",
    },
    cancelado: {
      backgroundColor: "#222226",
      borderColor: "#484852",
      color: "#A0A0AA",
    },
  }[status];

  return (
    <View
      style={[
        styles.statusBadge,
        {
          backgroundColor: statusStyles.backgroundColor,
          borderColor: statusStyles.borderColor,
        },
      ]}
    >
      <View
        style={[
          styles.statusDot,
          { backgroundColor: statusStyles.color },
        ]}
      />

      <Text
        style={[
          styles.statusText,
          { color: statusStyles.color },
        ]}
      >
        {STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
  },

  page: {
    width: "100%",
    maxWidth: 1320,
    alignSelf: "center",
    paddingHorizontal: 17,
    paddingTop: 19,
    paddingBottom: 50,
  },

  pageDesktop: {
    paddingHorizontal: 36,
    paddingTop: 28,
    paddingBottom: 65,
  },

  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    padding: 24,
  },

  loadingLogo: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: COLORS.muted,
    fontSize: 13,
    textAlign: "center",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 15,
  },

  headerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  headerIdentity: {
    flex: 1,
  },

  headerEyebrow: {
    color: COLORS.primaryLight,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.3,
  },

  headerTitle: {
    color: COLORS.text,
    fontSize: 25,
    fontWeight: "900",
    marginTop: 4,
  },

  headerTitleDesktop: {
    fontSize: 31,
  },

  headerSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },

  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  refreshButton: {
    height: 46,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#42365E",
    backgroundColor: "#1A1729",
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  refreshText: {
    color: COLORS.primaryLight,
    fontSize: 12,
    fontWeight: "800",
  },

  newButton: {
    height: 46,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  newButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  headerDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginTop: 23,
    marginBottom: 25,
  },

  heroCard: {
    minHeight: 235,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#6449D4",
    backgroundColor: "#4F36BD",
    padding: 23,
    justifyContent: "center",
    overflow: "hidden",
  },

  heroCardDesktop: {
    minHeight: 235,
    paddingHorizontal: 32,
  },

  heroGlow: {
    position: "absolute",
    right: -110,
    top: -170,
    width: 440,
    height: 440,
    borderRadius: 220,
    backgroundColor: "#7558F5",
    opacity: 0.55,
  },

  heroContent: {
    maxWidth: 720,
    zIndex: 1,
  },

  heroTag: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.14)",
  },

  heroTagText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },

  heroTitle: {
    color: "#FFFFFF",
    fontSize: 23,
    lineHeight: 30,
    fontWeight: "900",
    marginTop: 15,
  },

  heroTitleDesktop: {
    fontSize: 29,
    lineHeight: 36,
  },

  heroSubtitle: {
    color: "#E6DFFF",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 10,
    maxWidth: 540,
  },

  heroAction: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 9,
    marginTop: 19,
    borderRadius: 12,
    minHeight: 43,
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
  },

  heroActionText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "900",
  },

  heroIllustration: {
    position: "absolute",
    right: 88,
    top: 38,
    width: 156,
    height: 156,
    borderRadius: 37,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "9deg" }],
  },

  heroCheck: {
    position: "absolute",
    right: -7,
    bottom: -7,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  sectionHeading: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 33,
    marginBottom: 17,
  },

  sectionEyebrow: {
    color: COLORS.primaryLight,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
    marginBottom: 6,
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "900",
  },

  sectionTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingBottom: 3,
  },

  greenDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },

  sectionTagText: {
    color: COLORS.faint,
    fontSize: 10,
  },

  resultCount: {
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
    width: "47%",
    flexGrow: 1,
    minHeight: 156,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: 15,
    justifyContent: "space-between",
  },

  summaryCardWide: {
    width: "22%",
    minHeight: 165,
    padding: 18,
  },

  summaryIcon: {
    width: 39,
    height: 39,
    borderRadius: 12,
    backgroundColor: "#251F3B",
    alignItems: "center",
    justifyContent: "center",
  },

  summaryLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 9,
  },

  summaryValue: {
    color: COLORS.text,
    fontSize: 27,
    fontWeight: "900",
    marginTop: 4,
  },

  summaryValueCompact: {
    fontSize: 20,
  },

  summaryDescription: {
    color: COLORS.faint,
    fontSize: 10,
    marginTop: 4,
  },

  listPanel: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    overflow: "hidden",
  },

  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 16,
  },

  toolbarMobile: {
    flexWrap: "wrap",
  },

  searchBox: {
    flex: 1,
    minWidth: 200,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 13,
  },

  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    color: COLORS.text,
    fontSize: 12,
  },

  mobileActions: {
    flexDirection: "row",
    gap: 8,
    flexGrow: 1,
  },

  refreshButtonMobile: {
    height: 46,
    width: 47,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#42365E",
    backgroundColor: "#1A1729",
    alignItems: "center",
    justifyContent: "center",
  },

  newButtonMobile: {
    height: 46,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 17,
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  filtersRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 17,
  },

  filterButton: {
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
  },

  filterButtonActive: {
    borderColor: "#5947A9",
    backgroundColor: "#251D40",
  },

  filterText: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: "800",
  },

  filterTextActive: {
    color: COLORS.primaryLight,
  },

  filterCount: {
    minWidth: 19,
    height: 19,
    borderRadius: 7,
    backgroundColor: COLORS.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },

  filterCountActive: {
    backgroundColor: "#3F316E",
  },

  filterCountText: {
    color: COLORS.faint,
    fontSize: 9,
    fontWeight: "900",
  },

  filterCountTextActive: {
    color: "#FFFFFF",
  },

  listDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },

  stateBox: {
    minHeight: 330,
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
  },

  emptyIcon: {
    width: 65,
    height: 65,
    borderRadius: 20,
    backgroundColor: "#251F3B",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 17,
  },

  errorIcon: {
    width: 65,
    height: 65,
    borderRadius: 20,
    backgroundColor: "#301B24",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 17,
  },

  stateTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },

  stateDescription: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 440,
    marginTop: 9,
  },

  retryButton: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
  },

  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  clearFilters: {
    marginTop: 19,
    padding: 10,
  },

  clearFiltersText: {
    color: COLORS.primaryLight,
    fontSize: 12,
    fontWeight: "900",
  },

  list: {
    width: "100%",
  },

  budgetCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 15,
  },

  budgetCardDesktop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 19,
    minHeight: 113,
  },

  budgetCardLast: {
    borderBottomWidth: 0,
  },

  budgetCardPressed: {
    backgroundColor: COLORS.surfaceSoft,
  },

  budgetMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },

  numberBox: {
    minWidth: 64,
    minHeight: 63,
    borderRadius: 14,
    backgroundColor: "#251F3B",
    borderWidth: 1,
    borderColor: "#403459",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
    gap: 4,
  },

  numberText: {
    color: COLORS.primaryLight,
    fontSize: 12,
    fontWeight: "900",
  },

  budgetInfo: {
    flex: 1,
    minWidth: 0,
  },

  budgetClient: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900",
  },

  budgetTitle: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 5,
  },

  budgetMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 9,
  },

  budgetDate: {
    color: COLORS.faint,
    fontSize: 10,
  },

  budgetRight: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },

  budgetRightDesktop: {
    alignItems: "flex-end",
    flexDirection: "column",
    minWidth: 160,
  },

  budgetPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  budgetTotal: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
  },

  openIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#26203B",
    alignItems: "center",
    justifyContent: "center",
  },

  statusBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    minHeight: 25,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  statusText: {
    fontSize: 10,
    fontWeight: "900",
  },

  listFooter: {
    minHeight: 53,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  listFooterText: {
    color: COLORS.faint,
    fontSize: 10,
  },

  footer: {
    color: COLORS.faint,
    textAlign: "center",
    fontWeight: "900",
    fontSize: 10,
    letterSpacing: 1.3,
    marginTop: 34,
  },
});