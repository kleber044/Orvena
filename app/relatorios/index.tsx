import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
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

import { verificarAcessoPro } from "../../lib/pro-access";
import { supabase } from "../../lib/supabase";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

type Orcamento = {
  id: string;
  status: string;
  total: number | string;
  criado_em: string;
  cliente_id: string | null;
  obra_id: string | null;
};

type Financeiro = {
  id: string;
  tipo: "entrada" | "saida";
  status: "previsto" | "pendente" | "pago" | "cancelado";
  valor: number | string;
  created_at: string;
  pago_em: string | null;
  cliente_id: string | null;
  obra_id: string | null;
};

type Obra = {
  id: string;
  status: string;
};

type Cliente = {
  id: string;
  nome: string;
};

type MesResumo = {
  chave: string;
  label: string;
  entradas: number;
  saidas: number;
  saldo: number;
  orcamentos: number;
};

type ClienteResumo = {
  id: string;
  nome: string;
  valor: number;
  quantidade: number;
};

type Tom = "purple" | "green" | "red" | "yellow" | "blue";

const C = {
  bg: "#0D0E13",
  surface: "#171920",
  surface2: "#1D2029",
  border: "#2C303B",
  text: "#F6F5FA",
  muted: "#989BAA",
  subtle: "#707584",
  purple: "#7C5CFF",
  purpleLight: "#B8A9FF",
  purpleBg: "#29223F",
  green: "#66DBAE",
  greenBg: "#173328",
  red: "#FF8897",
  redBg: "#311D27",
  yellow: "#F3C77E",
  yellowBg: "#34291B",
  blue: "#88B8FF",
  blueBg: "#1B2A43",
};

function formatarReal(valor: number) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function numero(valor: number | string | null | undefined) {
  const convertido = Number(valor || 0);
  return Number.isFinite(convertido) ? convertido : 0;
}

function chaveMes(data: Date) {
  return `${data.getFullYear()}-${String(
    data.getMonth() + 1
  ).padStart(2, "0")}`;
}

function rotuloMes(data: Date) {
  return data
    .toLocaleDateString("pt-BR", {
      month: "short",
      year: "2-digit",
    })
    .replace(".", "")
    .toUpperCase();
}

function corTom(tom: Tom) {
  if (tom === "green") {
    return { cor: C.green, fundo: C.greenBg };
  }

  if (tom === "red") {
    return { cor: C.red, fundo: C.redBg };
  }

  if (tom === "yellow") {
    return { cor: C.yellow, fundo: C.yellowBg };
  }

  if (tom === "blue") {
    return { cor: C.blue, fundo: C.blueBg };
  }

  return { cor: C.purpleLight, fundo: C.purpleBg };
}

export default function RelatoriosScreen() {
  const { width } = useWindowDimensions();

  const mobile = width < 650;

  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [financeiro, setFinanceiro] = useState<Financeiro[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState("");
  const [redirecionandoLogin, setRedirecionandoLogin] =
    useState(false);
  const [acessoProNegado, setAcessoProNegado] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void carregarRelatorios();
    }, [])
  );

  async function carregarRelatorios(silencioso = false) {
    try {
      if (silencioso) {
        setAtualizando(true);
      } else {
        setCarregando(true);
      }

      setErro("");
      setAcessoProNegado(false);

      const acesso = await verificarAcessoPro();

      if (!acesso.autenticado) {
        setRedirecionandoLogin(true);
        router.replace("/login" as any);
        return;
      }

      if (!acesso.temPro) {
        setAcessoProNegado(true);
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setRedirecionandoLogin(true);
        router.replace("/login" as any);
        return;
      }

      const [
        orcamentosResult,
        financeiroResult,
        obrasResult,
        clientesResult,
      ] = await Promise.all([
        supabase
          .from("orcamentos")
          .select(
            "id, status, total, criado_em, cliente_id, obra_id"
          )
          .eq("user_id", user.id),

        supabase
          .from("financeiro_lancamentos")
          .select(
            "id, tipo, status, valor, created_at, pago_em, cliente_id, obra_id"
          )
          .eq("user_id", user.id),

        supabase
          .from("obras")
          .select("id, status")
          .eq("user_id", user.id),

        supabase
          .from("clientes")
          .select("id, nome")
          .eq("user_id", user.id),
      ]);

      if (orcamentosResult.error) {
        throw orcamentosResult.error;
      }

      if (financeiroResult.error) {
        throw financeiroResult.error;
      }

      if (obrasResult.error) {
        throw obrasResult.error;
      }

      if (clientesResult.error) {
        throw clientesResult.error;
      }

      setOrcamentos(
        (orcamentosResult.data ?? []) as Orcamento[]
      );

      setFinanceiro(
        (financeiroResult.data ?? []) as Financeiro[]
      );

      setObras((obrasResult.data ?? []) as Obra[]);

      setClientes(
        (clientesResult.data ?? []) as Cliente[]
      );
    } catch (error: any) {
      console.log("Erro ao carregar relatórios:", error);

      setErro(
        error?.message
          ? `Não foi possível carregar os relatórios: ${error.message}`
          : "Não foi possível carregar os relatórios."
      );
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }

  // Mantém exatamente os critérios do relatório original.
  const indicadores = useMemo(() => {
    const totalOrcamentos = orcamentos.length;

    const aprovados = orcamentos.filter(
      (item) =>
        String(item.status).toLowerCase() === "aprovado"
    ).length;

    const recusados = orcamentos.filter((item) =>
      ["recusado", "cancelado"].includes(
        String(item.status).toLowerCase()
      )
    ).length;

    const taxaAprovacao =
      totalOrcamentos > 0
        ? (aprovados / totalOrcamentos) * 100
        : 0;

    let recebido = 0;
    let aReceber = 0;
    let despesas = 0;
    let previsto = 0;

    for (const item of financeiro) {
      if (item.status === "cancelado") continue;

      const valor = numero(item.valor);

      if (item.tipo === "entrada") {
        if (item.status === "pago") recebido += valor;
        if (item.status === "pendente") aReceber += valor;
        if (item.status === "previsto") previsto += valor;
      }

      if (
        item.tipo === "saida" &&
        item.status === "pago"
      ) {
        despesas += valor;
      }
    }

    const obrasAtivas = obras.filter((obra) =>
      ["planejada", "em_andamento", "pausada"].includes(
        String(obra.status).toLowerCase()
      )
    ).length;

    const obrasConcluidas = obras.filter(
      (obra) =>
        String(obra.status).toLowerCase() === "concluida"
    ).length;

    return {
      totalOrcamentos,
      aprovados,
      recusados,
      taxaAprovacao,
      recebido,
      aReceber,
      despesas,
      previsto,
      saldo: recebido - despesas,
      obrasAtivas,
      obrasConcluidas,
      totalClientes: clientes.length,
    };
  }, [orcamentos, financeiro, obras, clientes]);

  // Mantém o período original: mês atual + cinco anteriores.
  const meses = useMemo<MesResumo[]>(() => {
    const agora = new Date();
    const lista: MesResumo[] = [];

    for (
      let deslocamento = 5;
      deslocamento >= 0;
      deslocamento -= 1
    ) {
      const data = new Date(
        agora.getFullYear(),
        agora.getMonth() - deslocamento,
        1
      );

      lista.push({
        chave: chaveMes(data),
        label: rotuloMes(data),
        entradas: 0,
        saidas: 0,
        saldo: 0,
        orcamentos: 0,
      });
    }

    const porMes = new Map(
      lista.map((item) => [item.chave, item])
    );

    for (const item of financeiro) {
      if (item.status !== "pago") continue;

      const origemData = item.pago_em || item.created_at;
      const data = new Date(origemData);

      if (Number.isNaN(data.getTime())) continue;

      const resumo = porMes.get(chaveMes(data));

      if (!resumo) continue;

      if (item.tipo === "entrada") {
        resumo.entradas += numero(item.valor);
      } else {
        resumo.saidas += numero(item.valor);
      }
    }

    for (const item of orcamentos) {
      const data = new Date(item.criado_em);

      if (Number.isNaN(data.getTime())) continue;

      const resumo = porMes.get(chaveMes(data));

      if (resumo) {
        resumo.orcamentos += 1;
      }
    }

    for (const item of lista) {
      item.saldo = item.entradas - item.saidas;
    }

    return lista;
  }, [financeiro, orcamentos]);

  // Mantém a classificação original por valor total dos orçamentos.
  const clientesRanking = useMemo<ClienteResumo[]>(() => {
    const nomes = new Map(
      clientes.map((cliente) => [
        cliente.id,
        cliente.nome,
      ])
    );

    const mapa = new Map<string, ClienteResumo>();

    for (const item of orcamentos) {
      if (!item.cliente_id) continue;

      const atual = mapa.get(item.cliente_id) ?? {
        id: item.cliente_id,
        nome:
          nomes.get(item.cliente_id) || "Cliente",
        valor: 0,
        quantidade: 0,
      };

      atual.valor += numero(item.total);
      atual.quantidade += 1;

      mapa.set(item.cliente_id, atual);
    }

    return Array.from(mapa.values())
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);
  }, [orcamentos, clientes]);

  const maiorMovimentoMes = useMemo(
    () =>
      Math.max(
        1,
        ...meses.map((mes) =>
          Math.max(mes.entradas, mes.saidas)
        )
      ),
    [meses]
  );

  const maiorCliente = useMemo(
    () =>
      Math.max(
        1,
        ...clientesRanking.map(
          (cliente) => cliente.valor
        )
      ),
    [clientesRanking]
  );

  if (carregando || redirecionandoLogin) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}>
          <ActivityIndicator
            size="large"
            color={C.purple}
          />

          <Text style={styles.loadingText}>
            Carregando relatórios...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (acessoProNegado) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.guardPage}>
          <View style={styles.guardCard}>
            <View style={styles.guardIcon}>
              <Ionicons
                name="diamond-outline"
                size={28}
                color={C.purpleLight}
              />
            </View>

            <Text style={styles.guardEyebrow}>
              RECURSO EXCLUSIVO
            </Text>

            <Text style={styles.guardTitle}>
              Relatórios no Orvena Pro
            </Text>

            <Text style={styles.guardText}>
              Acompanhe os indicadores financeiros,
              resultados dos orçamentos, obras e clientes
              em um só lugar. Este recurso requer o
              plano Pro ou um período de teste ativo.
            </Text>

            <Pressable
              style={styles.guardPrimary}
              onPress={() =>
                router.replace("/plano" as any)
              }
            >
              <Ionicons
                name="diamond-outline"
                size={17}
                color="#FFFFFF"
              />

              <Text style={styles.guardPrimaryText}>
                CONHECER O PLANO PRO
              </Text>
            </Pressable>

            <Pressable
              style={styles.guardBack}
              onPress={() =>
                router.replace("/(tabs)" as any)
              }
            >
              <Text style={styles.guardBackText}>
                Voltar ao início
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.page}>
          {/* CABEÇALHO */}
          <View
            style={[
              styles.header,
              mobile && styles.headerMobile,
            ]}
          >
            <View style={styles.headerLeft}>
              <Pressable
                style={styles.backButton}
                onPress={() =>
                  router.replace("/(tabs)" as any)
                }
              >
                <Ionicons
                  name="arrow-back"
                  size={19}
                  color={C.text}
                />
              </Pressable>

              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>
                  ANÁLISE DO NEGÓCIO
                </Text>

                <Text style={styles.pageTitle}>
                  Relatórios
                </Text>

                <Text style={styles.subtitle}>
                  Resultados calculados com os dados
                  dos seus orçamentos, obras, clientes
                  e financeiro.
                </Text>
              </View>
            </View>

            <Pressable
              style={[
                styles.refreshButton,
                mobile && styles.refreshButtonMobile,
                atualizando && styles.disabled,
              ]}
              onPress={() =>
                void carregarRelatorios(true)
              }
              disabled={atualizando}
            >
              {atualizando ? (
                <ActivityIndicator
                  size="small"
                  color={C.purpleLight}
                />
              ) : (
                <Ionicons
                  name="refresh-outline"
                  size={18}
                  color={C.purpleLight}
                />
              )}

              <Text style={styles.refreshText}>
                {atualizando
                  ? "ATUALIZANDO..."
                  : "ATUALIZAR DADOS"}
              </Text>
            </Pressable>
          </View>

          {erro ? (
            <View style={styles.errorBox}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={C.red}
              />

              <Text style={styles.errorText}>
                {erro}
              </Text>
            </View>
          ) : null}

          {/* RESUMO FINANCEIRO */}
          <SectionHeader
            eyebrow="SEUS RESULTADOS"
            title="Resumo financeiro"
            description="Valores realizados e previstos."
            icon="wallet-outline"
          />

          <View style={styles.metricsGrid}>
            <MetricCard
              icon="arrow-down-circle-outline"
              label="RECEBIDO"
              value={formatarReal(indicadores.recebido)}
              detail="Entradas já recebidas"
              tone="green"
            />

            <MetricCard
              icon="time-outline"
              label="A RECEBER"
              value={formatarReal(indicadores.aReceber)}
              detail="Entradas pendentes"
              tone="yellow"
            />

            <MetricCard
              icon="arrow-up-circle-outline"
              label="DESPESAS PAGAS"
              value={formatarReal(indicadores.despesas)}
              detail="Saídas realizadas"
              tone="red"
            />

            <MetricCard
              icon="wallet-outline"
              label="SALDO REALIZADO"
              value={formatarReal(indicadores.saldo)}
              detail="Recebido menos despesas"
              tone={
                indicadores.saldo < 0
                  ? "red"
                  : "purple"
              }
            />

            <MetricCard
              icon="document-text-outline"
              label="PREVISTO"
              value={formatarReal(indicadores.previsto)}
              detail="Orçamentos ainda em previsão"
              tone="blue"
            />
          </View>

          {/* ORÇAMENTOS E OPERAÇÃO */}
          <SectionHeader
            eyebrow="DESEMPENHO"
            title="Orçamentos e operação"
            description="Indicadores da sua atividade."
            icon="stats-chart-outline"
          />

          <View style={styles.metricsGrid}>
            <MetricCard
              icon="document-text-outline"
              label="ORÇAMENTOS"
              value={String(
                indicadores.totalOrcamentos
              )}
              detail="Total cadastrado"
            />

            <MetricCard
              icon="checkmark-circle-outline"
              label="APROVADOS"
              value={String(
                indicadores.aprovados
              )}
              detail={`Taxa de ${indicadores.taxaAprovacao.toFixed(
                0
              )}%`}
              tone="green"
            />

            <MetricCard
              icon="close-circle-outline"
              label="RECUSADOS/CANCELADOS"
              value={String(
                indicadores.recusados
              )}
              detail="Não convertidos"
              tone="red"
            />

            <MetricCard
              icon="business-outline"
              label="OBRAS ATIVAS"
              value={String(
                indicadores.obrasAtivas
              )}
              detail={`${indicadores.obrasConcluidas} concluídas`}
              tone="blue"
            />

            <MetricCard
              icon="people-outline"
              label="CLIENTES"
              value={String(
                indicadores.totalClientes
              )}
              detail="Total cadastrado"
            />
          </View>

          {/* COMPARATIVO MENSAL */}
          <SectionHeader
            eyebrow="EVOLUÇÃO FINANCEIRA"
            title="Últimos 6 meses"
            description="Entradas e despesas efetivamente pagas em cada mês."
            icon="bar-chart-outline"
          />

          <View style={styles.chartCard}>
            <View
              style={[
                styles.chartHeader,
                mobile && styles.chartHeaderMobile,
              ]}
            >
              <View>
                <Text style={styles.chartTitle}>
                  Fluxo financeiro
                </Text>

                <Text style={styles.chartSubtitle}>
                  Comparativo de movimentações
                </Text>
              </View>

              <View style={styles.chartLegend}>
                <LegendItem
                  color={C.green}
                  label="Recebido"
                />

                <LegendItem
                  color={C.red}
                  label="Despesas"
                />
              </View>
            </View>

            <View style={styles.chartDivider} />

            <View style={styles.monthList}>
              {meses.map((mes) => {
                const larguraEntrada =
                  mes.entradas > 0
                    ? Math.max(
                        2,
                        (mes.entradas /
                          maiorMovimentoMes) *
                          100
                      )
                    : 0;

                const larguraSaida =
                  mes.saidas > 0
                    ? Math.max(
                        2,
                        (mes.saidas /
                          maiorMovimentoMes) *
                          100
                      )
                    : 0;

                return (
                  <View
                    key={mes.chave}
                    style={[
                      styles.monthRow,
                      mobile && styles.monthRowMobile,
                    ]}
                  >
                    <View style={styles.monthLabelArea}>
                      <Text style={styles.monthLabel}>
                        {mes.label}
                      </Text>

                      <Text style={styles.monthBudgets}>
                        {mes.orcamentos}{" "}
                        {mes.orcamentos === 1
                          ? "orçamento"
                          : "orçamentos"}
                      </Text>
                    </View>

                    <View style={styles.monthBars}>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barEntrada,
                            {
                              width: `${larguraEntrada}%`,
                            },
                          ]}
                        />
                      </View>

                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barSaida,
                            {
                              width: `${larguraSaida}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>

                    <View
                      style={[
                        styles.monthValues,
                        mobile && styles.monthValuesMobile,
                      ]}
                    >
                      <Text style={styles.monthEntry}>
                        + {formatarReal(mes.entradas)}
                      </Text>

                      <Text style={styles.monthExpense}>
                        - {formatarReal(mes.saidas)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.chartNote}>
              <Ionicons
                name="information-circle-outline"
                size={15}
                color={C.subtle}
              />

              <Text style={styles.chartNoteText}>
                O gráfico considera lançamentos com status
                pago, agrupados pelo mês de pagamento
                registrado ou pela data de criação quando
                não há data de pagamento.
              </Text>
            </View>
          </View>

          {/* CLIENTES */}
          <SectionHeader
            eyebrow="RELACIONAMENTO"
            title="Principais clientes"
            description="Até cinco clientes, ordenados pelo valor total dos orçamentos vinculados."
            icon="people-outline"
          />

          <View style={styles.rankingCard}>
            {clientesRanking.length === 0 ? (
              <View style={styles.rankingEmpty}>
                <View style={styles.rankingEmptyIcon}>
                  <Ionicons
                    name="people-outline"
                    size={27}
                    color={C.purpleLight}
                  />
                </View>

                <Text style={styles.rankingEmptyTitle}>
                  Ainda não há dados suficientes
                </Text>

                <Text style={styles.rankingEmptyText}>
                  Conforme os orçamentos forem vinculados
                  aos clientes, os resultados aparecerão aqui.
                </Text>
              </View>
            ) : (
              clientesRanking.map((cliente, index) => {
                const largura =
                  cliente.valor > 0
                    ? Math.max(
                        4,
                        (cliente.valor /
                          maiorCliente) *
                          100
                      )
                    : 0;

                return (
                  <View
                    key={cliente.id}
                    style={[
                      styles.rankingRow,
                      mobile && styles.rankingRowMobile,
                    ]}
                  >
                    <View style={styles.rankingPosition}>
                      <Text
                        style={styles.rankingPositionText}
                      >
                        {index + 1}
                      </Text>
                    </View>

                    <View style={styles.rankingMain}>
                      <View
                        style={[
                          styles.rankingTop,
                          mobile && styles.rankingTopMobile,
                        ]}
                      >
                        <Text
                          style={styles.rankingName}
                          numberOfLines={2}
                        >
                          {cliente.nome}
                        </Text>

                        <Text
                          style={styles.rankingValue}
                        >
                          {formatarReal(cliente.valor)}
                        </Text>
                      </View>

                      <View style={styles.rankingTrack}>
                        <View
                          style={[
                            styles.rankingBar,
                            {
                              width: `${largura}%`,
                            },
                          ]}
                        />
                      </View>

                      <Text
                        style={styles.rankingDetail}
                      >
                        {cliente.quantidade}{" "}
                        {cliente.quantidade === 1
                          ? "orçamento vinculado"
                          : "orçamentos vinculados"}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          <Text style={styles.pageFooter}>
            ORVENA · SEU NEGÓCIO, ORGANIZADO
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: IconName;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons
          name={icon}
          size={20}
          color={C.purpleLight}
        />
      </View>

      <View style={styles.sectionCopy}>
        <Text style={styles.sectionEyebrow}>
          {eyebrow}
        </Text>

        <Text style={styles.sectionTitle}>
          {title}
        </Text>

        <Text style={styles.sectionDescription}>
          {description}
        </Text>
      </View>
    </View>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone = "purple",
}: {
  icon: IconName;
  label: string;
  value: string;
  detail: string;
  tone?: Tom;
}) {
  const visual = corTom(tone);

  return (
    <View style={styles.metricCard}>
      <View
        style={[
          styles.metricIcon,
          {
            backgroundColor: visual.fundo,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={visual.cor}
        />
      </View>

      <Text style={styles.metricLabel}>
        {label}
      </Text>

      <Text
        style={styles.metricValue}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>

      <Text style={styles.metricDetail}>
        {detail}
      </Text>
    </View>
  );
}

function LegendItem({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendDot,
          {
            backgroundColor: color,
          },
        ]}
      />

      <Text style={styles.legendText}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },

  scroll: {
    flexGrow: 1,
  },

  page: {
    width: "100%",
    maxWidth: 1250,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 48,
  },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },

  loadingText: {
    color: C.muted,
    fontSize: 13,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 30,
  },

  headerMobile: {
    flexDirection: "column",
    alignItems: "stretch",
  },

  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 14,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  headerCopy: {
    flex: 1,
  },

  eyebrow: {
    color: C.purpleLight,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.7,
  },

  pageTitle: {
    color: C.text,
    fontSize: 30,
    fontWeight: "900",
    marginTop: 4,
    letterSpacing: -0.8,
  },

  subtitle: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    maxWidth: 610,
  },

  refreshButton: {
    minHeight: 47,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#514083",
    backgroundColor: C.purpleBg,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  refreshButtonMobile: {
    width: "100%",
  },

  refreshText: {
    color: C.purpleLight,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.3,
  },

  disabled: {
    opacity: 0.6,
  },

  errorBox: {
    padding: 13,
    borderWidth: 1,
    borderColor: "#573440",
    backgroundColor: C.redBg,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 23,
  },

  errorText: {
    color: C.red,
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 15,
    marginTop: 9,
  },

  sectionIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: C.purpleBg,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionCopy: {
    flex: 1,
  },

  sectionEyebrow: {
    color: C.purpleLight,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.3,
  },

  sectionTitle: {
    color: C.text,
    fontSize: 19,
    fontWeight: "900",
    marginTop: 3,
  },

  sectionDescription: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },

  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 13,
    marginBottom: 28,
  },

  metricCard: {
    flexGrow: 1,
    flexBasis: 190,
    minWidth: 150,
    minHeight: 160,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    padding: 18,
  },

  metricIcon: {
    width: 39,
    height: 39,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },

  metricLabel: {
    color: C.muted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.6,
  },

  metricValue: {
    color: C.text,
    fontSize: 23,
    fontWeight: "900",
    marginTop: 7,
  },

  metricDetail: {
    color: C.subtle,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 5,
  },

  chartCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    padding: 20,
    marginBottom: 28,
  },

  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
  },

  chartHeaderMobile: {
    flexDirection: "column",
    alignItems: "flex-start",
  },

  chartTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: "900",
  },

  chartSubtitle: {
    color: C.subtle,
    fontSize: 11,
    marginTop: 4,
  },

  chartLegend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },

  legendText: {
    color: C.muted,
    fontSize: 10,
    fontWeight: "800",
  },

  chartDivider: {
    height: 1,
    backgroundColor: C.border,
    marginTop: 18,
    marginBottom: 18,
  },

  monthList: {
    gap: 17,
  },

  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },

  monthRowMobile: {
    flexWrap: "wrap",
    alignItems: "center",
  },

  monthLabelArea: {
    width: 76,
  },

  monthLabel: {
    color: C.text,
    fontSize: 11,
    fontWeight: "900",
  },

  monthBudgets: {
    color: C.subtle,
    fontSize: 9,
    marginTop: 4,
  },

  monthBars: {
    flex: 1,
    minWidth: 75,
    gap: 8,
  },

  barTrack: {
    width: "100%",
    height: 10,
    borderRadius: 999,
    backgroundColor: C.surface2,
    overflow: "hidden",
  },

  barEntrada: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: C.green,
  },

  barSaida: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: C.red,
  },

  monthValues: {
    width: 154,
    alignItems: "flex-end",
    gap: 4,
  },

  monthValuesMobile: {
    width: "100%",
    alignItems: "flex-start",
    paddingLeft: 89,
  },

  monthEntry: {
    color: C.green,
    fontSize: 10,
    fontWeight: "900",
  },

  monthExpense: {
    color: C.red,
    fontSize: 10,
    fontWeight: "900",
  },

  chartNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 11,
    backgroundColor: C.bg,
    marginTop: 20,
  },

  chartNoteText: {
    color: C.subtle,
    fontSize: 10,
    lineHeight: 16,
    flex: 1,
  },

  rankingCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 19,
    paddingVertical: 8,
  },

  rankingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 17,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },

  rankingRowMobile: {
    alignItems: "flex-start",
  },

  rankingPosition: {
    width: 37,
    height: 37,
    borderRadius: 12,
    backgroundColor: C.purpleBg,
    borderWidth: 1,
    borderColor: "#4D3C8A",
    alignItems: "center",
    justifyContent: "center",
  },

  rankingPositionText: {
    color: C.purpleLight,
    fontSize: 13,
    fontWeight: "900",
  },

  rankingMain: {
    flex: 1,
    minWidth: 0,
  },

  rankingTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  rankingTopMobile: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 4,
  },

  rankingName: {
    color: C.text,
    fontSize: 12,
    fontWeight: "900",
    flexShrink: 1,
  },

  rankingValue: {
    color: C.green,
    fontSize: 12,
    fontWeight: "900",
  },

  rankingTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    backgroundColor: C.surface2,
    overflow: "hidden",
    marginTop: 11,
  },

  rankingBar: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: C.purple,
  },

  rankingDetail: {
    color: C.subtle,
    fontSize: 10,
    marginTop: 7,
  },

  rankingEmpty: {
    minHeight: 230,
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
  },

  rankingEmptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: C.purpleBg,
    alignItems: "center",
    justifyContent: "center",
  },

  rankingEmptyTitle: {
    color: C.text,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 16,
    textAlign: "center",
  },

  rankingEmptyText: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 8,
    textAlign: "center",
    maxWidth: 400,
  },

  pageFooter: {
    color: C.subtle,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.8,
    textAlign: "center",
    marginTop: 32,
  },

  guardPage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  guardCard: {
    width: "100%",
    maxWidth: 480,
    alignItems: "center",
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: "#473966",
    borderRadius: 24,
    padding: 28,
    gap: 14,
  },

  guardIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: C.purpleBg,
    alignItems: "center",
    justifyContent: "center",
  },

  guardEyebrow: {
    color: C.purpleLight,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },

  guardTitle: {
    color: C.text,
    fontSize: 25,
    fontWeight: "900",
    textAlign: "center",
  },

  guardText: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 6,
  },

  guardPrimary: {
    width: "100%",
    minHeight: 47,
    borderRadius: 14,
    backgroundColor: C.purple,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  guardPrimaryText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },

  guardBack: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  guardBackText: {
    color: C.purpleLight,
    fontSize: 12,
    fontWeight: "800",
  },
});