import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { mensagemSegura } from "../lib/security";
import { supabase } from "../lib/supabase";

type Plano = "free" | "trialing" | "pro";

type PerfilPlano = {
  plano: Plano;
  trial_utilizado: boolean;
  trial_iniciado_em: string | null;
  trial_termina_em: string | null;
  pro_ate: string | null;
  mercadopago_subscription_status: string | null;
  mercadopago_subscription_id: string | null;
};

type Pagamento = {
  metodo: string | null;
  status: string | null;
  valor: number | null;
  aprovado_em: string | null;
};

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const C = {
  bg: "#09090F",
  card: "#14131D",
  cardAlt: "#191525",
  purple: "#7C5CFF",
  purpleLight: "#AC99FF",
  border: "#302B3E",
  white: "#FFFFFF",
  muted: "#9995A8",
  green: "#54DDA0",
  red: "#FF8999",
};

function Icon({
  name,
  size = 20,
  color = C.white,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}

function diasAte(valor: string) {
  const fim = new Date(valor).getTime();

  if (!Number.isFinite(fim)) return 0;

  const diferenca = fim - Date.now();

  if (diferenca <= 0) return 0;

  return Math.ceil(diferenca / (1000 * 60 * 60 * 24));
}

function formatarData(valor?: string | null) {
  if (!valor) return "—";

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) return "—";

  return data.toLocaleDateString("pt-BR");
}

function formatarDataHora(valor?: string | null) {
  if (!valor) return "—";

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) return "—";

  return data.toLocaleString("pt-BR");
}

function formatarMetodo(valor: string) {
  const metodo = valor.trim().toLowerCase();

  if (metodo === "pix") return "Pix";

  if (metodo.includes("card") || metodo.includes("credit")) {
    return "Cartão de crédito";
  }

  return valor;
}

function traduzirStatus(valor: string) {
  const status = valor.trim().toLowerCase();

  if (status === "authorized" || status === "active") {
    return "Ativa";
  }

  if (status === "pending") return "Em processamento";
  if (status === "paused") return "Pausada";

  if (status === "cancelled" || status === "canceled") {
    return "Cancelada";
  }

  if (status === "approved") return "Aprovado";
  if (status === "rejected") return "Recusado";

  return "Em análise";
}

function DetailRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: IconName;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.detailRow,
        last && styles.detailRowLast,
      ]}
    >
      <View style={styles.detailIcon}>
        <Icon name={icon} size={18} color={C.purpleLight} />
      </View>

      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

function Feature({
  icon,
  title,
  text,
  last = false,
}: {
  icon: IconName;
  title: string;
  text: string;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.featureRow,
        last && styles.featureRowLast,
      ]}
    >
      <View style={styles.featureIcon}>
        <Icon name={icon} size={20} color={C.purpleLight} />
      </View>

      <View style={styles.featureContent}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureText}>{text}</Text>
      </View>

      <Icon
        name="checkmark-circle"
        size={19}
        color={C.green}
      />
    </View>
  );
}

export default function PlanoScreen() {
  const { width } = useWindowDimensions();

  const isDesktop = width >= 1050;
  const isSmall = width < 390;

  const [perfil, setPerfil] = useState<PerfilPlano | null>(null);
  const [pagamento, setPagamento] = useState<Pagamento | null>(null);

  const [carregando, setCarregando] = useState(true);
  const [cancelando, setCancelando] = useState(false);

  const [redirecionandoLogin, setRedirecionandoLogin] =
    useState(false);

  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const [mostrarRecursos, setMostrarRecursos] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void carregarPlano();
    }, [])
  );

  async function carregarPlano() {
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
          syncError.message
        );
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "plano, trial_utilizado, trial_iniciado_em, trial_termina_em, pro_ate, mercadopago_subscription_status, mercadopago_subscription_id"
        )
        .eq("id", user.id)
        .single();

      if (error || !data) {
        console.log("Erro ao carregar plano:", error);

        setErro(
          "Não foi possível carregar seu plano. Tente novamente."
        );

        return;
      }

      setPerfil({
        plano:
          data.plano === "trialing" || data.plano === "pro"
            ? data.plano
            : "free",

        trial_utilizado: Boolean(data.trial_utilizado),

        trial_iniciado_em: data.trial_iniciado_em || null,
        trial_termina_em: data.trial_termina_em || null,
        pro_ate: data.pro_ate || null,

        mercadopago_subscription_status:
          data.mercadopago_subscription_status || null,

        mercadopago_subscription_id:
          data.mercadopago_subscription_id || null,
      });

      const {
        data: ultimoPagamento,
        error: pagamentoError,
      } = await supabase
        .from("pagamentos_orvena")
        .select("metodo, status, valor, aprovado_em")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .order("aprovado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pagamentoError) {
        console.log(
          "Erro ao carregar último pagamento:",
          pagamentoError.message
        );

        setPagamento(null);
      } else {
        setPagamento(
          ultimoPagamento
            ? {
                metodo: ultimoPagamento.metodo || null,
                status: ultimoPagamento.status || null,

                valor:
                  typeof ultimoPagamento.valor === "number"
                    ? ultimoPagamento.valor
                    : ultimoPagamento.valor
                      ? Number(ultimoPagamento.valor)
                      : null,

                aprovado_em:
                  ultimoPagamento.aprovado_em || null,
              }
            : null
        );
      }
    } catch (error) {
      console.log(
        "Erro ao carregar tela de plano:",
        error
      );

      setErro(
        "Não foi possível carregar seu plano. Tente novamente."
      );
    } finally {
      setCarregando(false);
    }
  }

  const plano = perfil?.plano || "free";

  const trialDisponivel =
    plano === "free" && !perfil?.trial_utilizado;

  const diasTrial = useMemo(() => {
    if (
      plano !== "trialing" ||
      !perfil?.trial_termina_em
    ) {
      return null;
    }

    return diasAte(perfil.trial_termina_em);
  }, [plano, perfil?.trial_termina_em]);

  const diasPro = useMemo(() => {
    if (plano !== "pro" || !perfil?.pro_ate) {
      return null;
    }

    return diasAte(perfil.pro_ate);
  }, [plano, perfil?.pro_ate]);

  const statusAssinatura = String(
    perfil?.mercadopago_subscription_status || ""
  ).toLowerCase();

  const assinaturaCartaoAtiva =
    statusAssinatura === "authorized" ||
    statusAssinatura === "active";

  const temAssinaturaRecorrente =
    Boolean(perfil?.mercadopago_subscription_id) &&
    statusAssinatura !== "canceled" &&
    statusAssinatura !== "cancelled";

  const metodoPagamento = useMemo(() => {
    if (assinaturaCartaoAtiva) {
      return "Cartão de crédito";
    }

    if (pagamento?.metodo?.toLowerCase() === "pix") {
      return "Pix";
    }

    if (pagamento?.metodo) {
      return formatarMetodo(pagamento.metodo);
    }

    return null;
  }, [assinaturaCartaoAtiva, pagamento?.metodo]);

  const nomePlano =
    plano === "free"
      ? "Orvena Grátis"
      : plano === "trialing"
        ? "Orvena Pro — Teste"
        : "Orvena Pro";

  const statusPlano =
    plano === "free"
      ? "GRÁTIS"
      : plano === "trialing"
        ? "TESTE PRO"
        : "PRO ATIVO";

  function abrirCheckout() {
    router.push("/assinar-pro" as any);
  }

  function confirmarCancelamento() {
    if (cancelando) return;

    const titulo = "Cancelar renovação automática";

    const mensagem =
      "Você quer cancelar a renovação automática do Orvena Pro? O acesso já liberado continuará funcionando até o fim do período atual.";

    if (Platform.OS === "web") {
      const confirmado =
        typeof globalThis.confirm === "function"
          ? globalThis.confirm(`${titulo}\n\n${mensagem}`)
          : false;

      if (confirmado) {
        void cancelarAssinatura();
      }

      return;
    }

    Alert.alert(titulo, mensagem, [
      {
        text: "Voltar",
        style: "cancel",
      },
      {
        text: "Cancelar assinatura",
        style: "destructive",
        onPress: () => {
          void cancelarAssinatura();
        },
      },
    ]);
  }

  async function cancelarAssinatura() {
    if (cancelando) return;

    try {
      setCancelando(true);
      setErro("");
      setSucesso("");

      const { data, error } = await supabase.functions.invoke(
        "mercadopago-cancelar-assinatura",
        {
          body: {},
        }
      );

      if (error) {
        console.log(
          "Erro ao cancelar assinatura:",
          error
        );

        setErro(
          "Não foi possível cancelar a assinatura agora. Tente novamente."
        );

        return;
      }

      if (!data?.success) {
        setErro(
          mensagemSegura(
            data?.error,
            "Não foi possível cancelar a assinatura agora. Tente novamente."
          )
        );

        return;
      }

      setSucesso(
        data?.message ||
          "Renovação automática cancelada com sucesso."
      );

      await carregarPlano();
    } catch (error) {
      console.log(
        "Erro ao cancelar assinatura:",
        error
      );

      setErro(
        "Não foi possível cancelar a assinatura agora. Tente novamente."
      );
    } finally {
      setCancelando(false);
    }
  }

  function voltar() {
    router.replace("/(tabs)" as any);
  }

  if (carregando || redirecionandoLogin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          <View style={styles.loadingIcon}>
            <Icon
              name="diamond-outline"
              size={30}
              color={C.purpleLight}
            />
          </View>

          <ActivityIndicator
            size="large"
            color={C.purple}
          />

          <Text style={styles.loadingText}>
            Carregando sua assinatura...
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
          styles.scrollContent,
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
              onPress={voltar}
              accessibilityRole="button"
              accessibilityLabel="Voltar para o início"
            >
              <Icon name="arrow-back" size={22} />
            </Pressable>

            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>
                ORVENA
              </Text>

              <Text style={styles.title}>
                Minha assinatura
              </Text>

              <Text style={styles.subtitle}>
                Gerencie seu plano, validade e pagamentos.
              </Text>
            </View>
          </View>

          {/* ERROS */}

          {erro ? (
            <View style={styles.errorBox}>
              <Icon
                name="alert-circle-outline"
                size={22}
                color={C.red}
              />

              <View style={styles.messageContent}>
                <Text style={styles.errorText}>
                  {erro}
                </Text>

                <Pressable
                  style={styles.retryButton}
                  onPress={() => void carregarPlano()}
                >
                  <Icon
                    name="refresh"
                    size={15}
                    color={C.red}
                  />

                  <Text style={styles.retryButtonText}>
                    Tentar novamente
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* SUCESSO */}

          {sucesso ? (
            <View style={styles.successBox}>
              <Icon
                name="checkmark-circle-outline"
                size={22}
                color={C.green}
              />

              <Text style={styles.successText}>
                {sucesso}
              </Text>

              <Pressable
                onPress={() => setSucesso("")}
                hitSlop={10}
              >
                <Icon
                  name="close"
                  size={19}
                  color={C.green}
                />
              </Pressable>
            </View>
          ) : null}

          {/* COLUNAS */}

          <View
            style={[
              styles.columns,
              isDesktop && styles.columnsDesktop,
            ]}
          >
            <View style={styles.mainColumn}>
              {/* PLANO ATUAL */}

              <View style={styles.heroCard}>
                <View style={styles.heroTop}>
                  <View style={styles.heroIcon}>
                    <Icon
                      name={
                        plano === "free"
                          ? "person-outline"
                          : "diamond-outline"
                      }
                      size={29}
                      color={C.purpleLight}
                    />
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      plano !== "free" &&
                        styles.statusBadgePro,
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        plano !== "free" &&
                          styles.statusDotPro,
                      ]}
                    />

                    <Text
                      style={[
                        styles.statusBadgeText,
                        plano !== "free" &&
                          styles.statusBadgeTextPro,
                      ]}
                    >
                      {statusPlano}
                    </Text>
                  </View>
                </View>

                <Text style={styles.heroEyebrow}>
                  SEU PLANO ATUAL
                </Text>

                <Text style={styles.heroTitle}>
                  {nomePlano}
                </Text>

                <Text style={styles.heroDescription}>
                  {plano === "free"
                    ? "Você está utilizando o plano gratuito do Orvena."
                    : plano === "trialing"
                      ? "Seus recursos Pro estão liberados durante o período de teste."
                      : "Seu acesso aos recursos Pro está liberado."}
                </Text>

                {plano === "trialing" ? (
                  <View style={styles.validityBox}>
                    <View style={styles.validityHeader}>
                      <Icon
                        name="time-outline"
                        size={18}
                        color={C.purpleLight}
                      />

                      <Text style={styles.validityHeading}>
                        PERÍODO DE TESTE
                      </Text>
                    </View>

                    <View style={styles.validityContent}>
                      <View style={styles.validityItem}>
                        <Text style={styles.validityLabel}>
                          TEMPO RESTANTE
                        </Text>

                        <Text style={styles.validityBig}>
                          {diasTrial ?? "—"}{" "}
                          {diasTrial === 1 ? "dia" : "dias"}
                        </Text>
                      </View>

                      <View style={styles.validityItem}>
                        <Text style={styles.validityLabel}>
                          TERMINA EM
                        </Text>

                        <Text style={styles.validityValue}>
                          {formatarData(
                            perfil?.trial_termina_em
                          )}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : null}

                {plano === "pro" ? (
                  <View style={styles.validityBox}>
                    <View style={styles.validityHeader}>
                      <Icon
                        name="calendar-outline"
                        size={18}
                        color={C.purpleLight}
                      />

                      <Text style={styles.validityHeading}>
                        VALIDADE DO ACESSO
                      </Text>
                    </View>

                    <View style={styles.validityContent}>
                      <View style={styles.validityItem}>
                        <Text style={styles.validityLabel}>
                          ACESSO PRO
                        </Text>

                        <Text style={styles.validityBig}>
                          {diasPro === null
                            ? "Ativo"
                            : `${diasPro} ${
                                diasPro === 1
                                  ? "dia"
                                  : "dias"
                              }`}
                        </Text>
                      </View>

                      <View style={styles.validityItem}>
                        <Text style={styles.validityLabel}>
                          VÁLIDO ATÉ
                        </Text>

                        <Text style={styles.validityValue}>
                          {formatarData(perfil?.pro_ate)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : null}

                {plano === "free" ? (
                  <View style={styles.freeNotice}>
                    <Icon
                      name="information-circle-outline"
                      size={20}
                      color={C.purpleLight}
                    />

                    <Text style={styles.freeNoticeText}>
                      Conheça os benefícios do plano Pro
                      e escolha uma forma de pagamento.
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* DETALHES */}

              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIcon}>
                    <Icon
                      name="receipt-outline"
                      size={21}
                      color={C.purpleLight}
                    />
                  </View>

                  <View style={styles.sectionText}>
                    <Text style={styles.sectionTitle}>
                      Detalhes da assinatura
                    </Text>

                    <Text style={styles.sectionSubtitle}>
                      Informações do seu plano e cobrança.
                    </Text>
                  </View>
                </View>

                <View style={styles.detailsList}>
                  <DetailRow
                    icon="diamond-outline"
                    label="Plano"
                    value={nomePlano}
                  />

                  <DetailRow
                    icon="cash-outline"
                    label="Preço"
                    value={
                      plano === "free"
                        ? "R$ 0,00"
                        : "R$ 14,99"
                    }
                  />

                  <DetailRow
                    icon="card-outline"
                    label="Forma de pagamento"
                    value={
                      metodoPagamento ||
                      (plano === "free"
                        ? "Nenhuma"
                        : "Não identificada")
                    }
                  />

                  {assinaturaCartaoAtiva ? (
                    <>
                      <DetailRow
                        icon="refresh-outline"
                        label="Renovação"
                        value="Automática no cartão"
                      />

                      <DetailRow
                        icon="checkmark-circle-outline"
                        label="Cobrança automática"
                        value="Sim"
                      />
                    </>
                  ) : pagamento?.metodo?.toLowerCase() ===
                    "pix" ? (
                    <>
                      <DetailRow
                        icon="refresh-outline"
                        label="Renovação"
                        value="Manual pelo Pix"
                      />

                      <DetailRow
                        icon="close-circle-outline"
                        label="Cobrança automática"
                        value="Não"
                      />
                    </>
                  ) : null}

                  {pagamento?.aprovado_em ? (
                    <DetailRow
                      icon="calendar-outline"
                      label="Último pagamento"
                      value={formatarDataHora(
                        pagamento.aprovado_em
                      )}
                    />
                  ) : null}

                  {statusAssinatura ? (
                    <DetailRow
                      icon="pulse-outline"
                      label="Status da assinatura"
                      value={traduzirStatus(
                        statusAssinatura
                      )}
                      last
                    />
                  ) : (
                    <DetailRow
                      icon="pulse-outline"
                      label="Status"
                      value={
                        plano === "free"
                          ? "Sem assinatura ativa"
                          : "Acesso ativo"
                      }
                      last
                    />
                  )}
                </View>
              </View>

              {/* RECURSOS */}

              <View style={styles.card}>
                <Pressable
                  style={styles.featuresHeader}
                  onPress={() =>
                    setMostrarRecursos(!mostrarRecursos)
                  }
                  accessibilityRole="button"
                  accessibilityState={{
                    expanded: mostrarRecursos,
                  }}
                >
                  <View style={styles.sectionIcon}>
                    <Icon
                      name="sparkles-outline"
                      size={21}
                      color={C.purpleLight}
                    />
                  </View>

                  <View style={styles.sectionText}>
                    <Text style={styles.sectionTitle}>
                      Recursos do Orvena Pro
                    </Text>

                    <Text style={styles.sectionSubtitle}>
                      Veja os benefícios disponíveis.
                    </Text>
                  </View>

                  <Icon
                    name={
                      mostrarRecursos
                        ? "chevron-up"
                        : "chevron-down"
                    }
                    size={20}
                    color={C.muted}
                  />
                </Pressable>

                {mostrarRecursos ? (
                  <View style={styles.featuresList}>
                    <Feature
                      icon="people-outline"
                      title="Clientes e obras"
                      text="Cadastre clientes e acompanhe seus trabalhos."
                    />

                    <Feature
                      icon="construct-outline"
                      title="Serviços"
                      text="Organize seu catálogo de serviços e valores."
                    />

                    <Feature
                      icon="wallet-outline"
                      title="Financeiro"
                      text="Controle entradas, saídas e resultados."
                    />

                    <Feature
                      icon="calendar-outline"
                      title="Agenda"
                      text="Organize compromissos e atendimentos."
                    />

                    <Feature
                      icon="stats-chart-outline"
                      title="Relatórios"
                      text="Acompanhe indicadores e desempenho."
                    />

                    <Feature
                      icon="business-outline"
                      title="Identidade da empresa"
                      text="Use os dados da sua empresa nos documentos e PDFs."
                      last
                    />
                  </View>
                ) : null}
              </View>
            </View>

            {/* COLUNA DE ASSINATURA */}

            <View
              style={[
                styles.sideColumn,
                isDesktop && styles.sideColumnDesktop,
              ]}
            >
              {/* PLANO FREE */}

              {plano === "free" ? (
                <View style={styles.actionCard}>
                  <View style={styles.actionIcon}>
                    <Icon
                      name="diamond-outline"
                      size={27}
                      color={C.purpleLight}
                    />
                  </View>

                  <Text style={styles.actionEyebrow}>
                    {trialDisponivel
                      ? "ORVENA PRO"
                      : "ASSINATURA PRO"}
                  </Text>

                  <Text style={styles.actionTitle}>
                    {trialDisponivel
                      ? "Experimente todos os recursos"
                      : "Volte para o Orvena Pro"}
                  </Text>

                  <Text style={styles.actionText}>
                    {trialDisponivel
                      ? "No cartão, sua conta pode iniciar com o período gratuito disponível. No Pix, o pagamento libera 30 dias de Pro."
                      : "Escolha cartão para renovação automática ou Pix para liberar 30 dias de Pro."}
                  </Text>

                  <View style={styles.priceBox}>
                    <Text style={styles.priceEyebrow}>
                      PLANO PRO
                    </Text>

                    <View style={styles.priceRow}>
                      <Text style={styles.priceCurrency}>
                        R$
                      </Text>

                      <Text style={styles.priceBig}>
                        14,99
                      </Text>

                      <Text style={styles.pricePeriod}>
                        /mês
                      </Text>
                    </View>

                    <Text style={styles.priceSmall}>
                      Cartão mensal ou Pix por 30 dias.
                    </Text>
                  </View>

                  <Pressable
                    style={styles.primaryButton}
                    onPress={abrirCheckout}
                  >
                    <Icon
                      name="card-outline"
                      size={20}
                    />

                    <Text style={styles.primaryButtonText}>
                      Escolher forma de pagamento
                    </Text>

                    <Icon
                      name="arrow-forward"
                      size={18}
                    />
                  </Pressable>
                </View>
              ) : null}

              {/* TESTE */}

              {plano === "trialing" ? (
                <View style={styles.actionCard}>
                  <View style={styles.actionIcon}>
                    <Icon
                      name="time-outline"
                      size={27}
                      color={C.purpleLight}
                    />
                  </View>

                  <Text style={styles.actionEyebrow}>
                    TESTE EM ANDAMENTO
                  </Text>

                  <Text style={styles.actionTitle}>
                    Seu Pro está liberado
                  </Text>

                  <Text style={styles.actionText}>
                    Aproveite os recursos até{" "}
                    {formatarData(
                      perfil?.trial_termina_em
                    )}.
                  </Text>

                  {assinaturaCartaoAtiva ? (
                    <>
                      <View style={styles.infoBox}>
                        <Icon
                          name="checkmark-circle-outline"
                          size={21}
                          color={C.green}
                        />

                        <View style={styles.infoContent}>
                          <Text style={styles.infoTitle}>
                            Renovação automática ativa
                          </Text>

                          <Text style={styles.infoText}>
                            Sua assinatura no cartão está
                            autorizada no Mercado Pago.
                          </Text>
                        </View>
                      </View>

                      <Pressable
                        style={[
                          styles.cancelButton,
                          cancelando &&
                            styles.disabled,
                        ]}
                        onPress={confirmarCancelamento}
                        disabled={cancelando}
                      >
                        {cancelando ? (
                          <ActivityIndicator
                            color={C.red}
                          />
                        ) : (
                          <>
                            <Icon
                              name="close-circle-outline"
                              size={19}
                              color={C.red}
                            />

                            <Text
                              style={styles.cancelButtonText}
                            >
                              Cancelar renovação automática
                            </Text>
                          </>
                        )}
                      </Pressable>

                      <Text style={styles.cancelHint}>
                        Seu acesso atual continua até o fim
                        do período já liberado.
                      </Text>
                    </>
                  ) : (
                    <Pressable
                      style={styles.primaryButton}
                      onPress={abrirCheckout}
                    >
                      <Icon
                        name="card-outline"
                        size={20}
                      />

                      <Text style={styles.primaryButtonText}>
                        Ver formas de pagamento
                      </Text>

                      <Icon
                        name="arrow-forward"
                        size={18}
                      />
                    </Pressable>
                  )}
                </View>
              ) : null}

              {/* PLANO PRO */}

              {plano === "pro" ? (
                <View style={styles.actionCard}>
                  <View style={styles.actionIcon}>
                    <Icon
                      name="checkmark-done-outline"
                      size={27}
                      color={C.purpleLight}
                    />
                  </View>

                  <Text style={styles.actionEyebrow}>
                    ORVENA PRO
                  </Text>

                  <Text style={styles.actionTitle}>
                    Sua assinatura está ativa
                  </Text>

                  <Text style={styles.actionText}>
                    {temAssinaturaRecorrente
                      ? "O pagamento está configurado para renovação automática no cartão."
                      : pagamento?.metodo?.toLowerCase() ===
                          "pix"
                        ? "Seu acesso foi liberado por Pix. A renovação é manual."
                        : "Seu acesso Pro está ativo."}
                  </Text>

                  <View style={styles.priceBox}>
                    <Text style={styles.priceEyebrow}>
                      VALOR DO PLANO
                    </Text>

                    <View style={styles.priceRow}>
                      <Text style={styles.priceCurrency}>
                        R$
                      </Text>

                      <Text style={styles.priceBig}>
                        14,99
                      </Text>
                    </View>

                    <Text style={styles.priceSmall}>
                      {temAssinaturaRecorrente
                        ? "Renovação automática"
                        : pagamento?.metodo?.toLowerCase() ===
                            "pix"
                          ? "Pix • renovação manual"
                          : "30 dias de Orvena Pro"}
                    </Text>
                  </View>

                  {!temAssinaturaRecorrente &&
                  pagamento?.metodo?.toLowerCase() ===
                    "pix" ? (
                    <View style={styles.infoBox}>
                      <Icon
                        name="qr-code-outline"
                        size={22}
                        color={C.green}
                      />

                      <View style={styles.infoContent}>
                        <Text style={styles.infoTitle}>
                          Pagamento via Pix
                        </Text>

                        <Text style={styles.infoText}>
                          Seu Orvena Pro foi liberado por
                          30 dias. Não haverá cobrança
                          automática. Para continuar após
                          o vencimento, faça uma nova
                          renovação.
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {!temAssinaturaRecorrente ? (
                    <Pressable
                      style={styles.primaryButton}
                      onPress={abrirCheckout}
                    >
                      <Icon
                        name="refresh-outline"
                        size={20}
                      />

                      <Text style={styles.primaryButtonText}>
                        Renovar Orvena Pro
                      </Text>

                      <Icon
                        name="arrow-forward"
                        size={18}
                      />
                    </Pressable>
                  ) : (
                    <>
                      <Pressable
                        style={[
                          styles.cancelButton,
                          cancelando &&
                            styles.disabled,
                        ]}
                        onPress={confirmarCancelamento}
                        disabled={cancelando}
                      >
                        {cancelando ? (
                          <ActivityIndicator
                            color={C.red}
                          />
                        ) : (
                          <>
                            <Icon
                              name="close-circle-outline"
                              size={19}
                              color={C.red}
                            />

                            <Text
                              style={styles.cancelButtonText}
                            >
                              Cancelar renovação automática
                            </Text>
                          </>
                        )}
                      </Pressable>

                      <Text style={styles.cancelHint}>
                        Ao cancelar, novas cobranças
                        recorrentes são interrompidas.
                        O período Pro já liberado não
                        é removido imediatamente.
                      </Text>
                    </>
                  )}
                </View>
              ) : null}

              {/* HISTÓRICO */}

              <Pressable
                style={styles.historyButton}
                onPress={() =>
                  router.push(
                    "/historico-pagamentos" as any
                  )
                }
              >
                <View style={styles.historyIcon}>
                  <Icon
                    name="receipt-outline"
                    size={22}
                    color={C.purpleLight}
                  />
                </View>

                <View style={styles.historyText}>
                  <Text style={styles.historyTitle}>
                    Histórico de pagamentos
                  </Text>

                  <Text style={styles.historySubtitle}>
                    Consulte Pix e pagamentos registrados.
                  </Text>
                </View>

                <Icon
                  name="chevron-forward"
                  size={20}
                  color={C.muted}
                />
              </Pressable>

              {/* SEGURANÇA */}

              <View style={styles.securityCard}>
                <View style={styles.securityIcon}>
                  <Icon
                    name="shield-checkmark-outline"
                    size={23}
                    color={C.green}
                  />
                </View>

                <View style={styles.securityContent}>
                  <Text style={styles.securityTitle}>
                    Pagamento seguro
                  </Text>

                  <Text style={styles.securityText}>
                    Os pagamentos são processados pelo
                    Mercado Pago. Os dados completos do
                    cartão não são armazenados pelo Orvena.
                  </Text>
                </View>
              </View>
            </View>
          </View>
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

  scrollContent: {
    flexGrow: 1,
    paddingTop: 20,
    paddingBottom: 45,
  },

  page: {
    width: "100%",
    maxWidth: 1250,
    alignSelf: "center",
  },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 17,
    padding: 24,
  },

  loadingIcon: {
    width: 70,
    height: 70,
    borderRadius: 22,
    backgroundColor: "#241B3C",
    borderWidth: 1,
    borderColor: "#46366F",
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
    marginBottom: 22,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
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
    letterSpacing: -0.6,
  },

  subtitle: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },

  columns: {
    gap: 17,
  },

  columnsDesktop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  mainColumn: {
    flex: 1,
    minWidth: 0,
    gap: 17,
  },

  sideColumn: {
    width: "100%",
    gap: 15,
  },

  sideColumnDesktop: {
    width: 355,
    flexShrink: 0,
  },

  heroCard: {
    backgroundColor: "#1B152C",
    borderWidth: 1,
    borderColor: "#47366B",
    borderRadius: 22,
    padding: 19,
    overflow: "hidden",
  },

  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 23,
  },

  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 17,
    backgroundColor: "#2C2248",
    borderWidth: 1,
    borderColor: "#564381",
    alignItems: "center",
    justifyContent: "center",
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#292835",
    borderWidth: 1,
    borderColor: "#484453",
    borderRadius: 30,
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexShrink: 0,
  },

  statusBadgePro: {
    backgroundColor: "#302346",
    borderColor: "#5B448C",
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 7,
    backgroundColor: C.muted,
  },

  statusDotPro: {
    backgroundColor: C.green,
  },

  statusBadgeText: {
    color: "#C5C0CD",
    fontSize: 10,
    fontWeight: "800",
  },

  statusBadgeTextPro: {
    color: "#C7B9FF",
  },

  heroEyebrow: {
    color: C.purpleLight,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: "800",
  },

  heroTitle: {
    color: C.white,
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 33,
    marginTop: 7,
  },

  heroDescription: {
    color: "#B2A8C4",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 9,
  },

  validityBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#49395D",
    backgroundColor: "#120F1C",
    padding: 15,
    marginTop: 22,
  },

  validityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 17,
  },

  validityHeading: {
    color: C.purpleLight,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
  },

  validityContent: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
  },

  validityItem: {
    flexGrow: 1,
    flexBasis: 105,
    minWidth: 0,
  },

  validityLabel: {
    color: "#92899E",
    fontSize: 10,
    fontWeight: "700",
  },

  validityBig: {
    color: C.white,
    fontSize: 21,
    fontWeight: "800",
    marginTop: 6,
  },

  validityValue: {
    color: "#D3C8E8",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 9,
  },

  freeNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#241C38",
    borderRadius: 12,
    padding: 12,
    marginTop: 20,
  },

  freeNoticeText: {
    flex: 1,
    color: "#BDB0D4",
    fontSize: 12,
    lineHeight: 19,
  },

  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    padding: 18,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  sectionIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: "#261E3A",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },

  sectionText: {
    flex: 1,
    minWidth: 0,
  },

  sectionTitle: {
    color: C.white,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
  },

  sectionSubtitle: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },

  detailsList: {
    marginTop: 18,
  },

  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2736",
  },

  detailRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },

  detailIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#221C32",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },

  detailContent: {
    flex: 1,
    minWidth: 0,
  },

  detailLabel: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 17,
  },

  detailValue: {
    color: C.white,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 19,
  },

  featuresHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 46,
  },

  featuresList: {
    marginTop: 17,
  },

  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2736",
  },

  featureRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },

  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#241D38",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },

  featureContent: {
    flex: 1,
    minWidth: 0,
  },

  featureTitle: {
    color: C.white,
    fontSize: 13,
    fontWeight: "800",
  },

  featureText: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  actionCard: {
    backgroundColor: "#191525",
    borderWidth: 1,
    borderColor: "#45345F",
    borderRadius: 21,
    padding: 19,
  },

  actionIcon: {
    width: 53,
    height: 53,
    borderRadius: 16,
    backgroundColor: "#2C2146",
    borderWidth: 1,
    borderColor: "#4D3B77",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 17,
  },

  actionEyebrow: {
    color: C.purpleLight,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  actionTitle: {
    color: C.white,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "800",
    marginTop: 8,
  },

  actionText: {
    color: "#ABA3B9",
    fontSize: 13,
    lineHeight: 21,
    marginTop: 10,
  },

  priceBox: {
    backgroundColor: "#100E1A",
    borderWidth: 1,
    borderColor: "#3C304F",
    borderRadius: 15,
    padding: 16,
    marginTop: 20,
  },

  priceEyebrow: {
    color: C.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 8,
  },

  priceCurrency: {
    color: C.white,
    fontSize: 17,
    fontWeight: "800",
  },

  priceBig: {
    color: C.white,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1,
  },

  pricePeriod: {
    color: C.muted,
    fontSize: 13,
    fontWeight: "600",
  },

  priceSmall: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },

  primaryButton: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: C.purple,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginTop: 19,
  },

  primaryButtonText: {
    color: C.white,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
    flexShrink: 1,
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    borderWidth: 1,
    borderColor: "#285A42",
    backgroundColor: "#11231B",
    borderRadius: 14,
    padding: 13,
    marginTop: 17,
  },

  infoContent: {
    flex: 1,
    minWidth: 0,
  },

  infoTitle: {
    color: C.green,
    fontSize: 13,
    fontWeight: "800",
  },

  infoText: {
    color: "#9BBEAA",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 6,
  },

  cancelButton: {
    minHeight: 51,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#633640",
    backgroundColor: "#28161E",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginTop: 16,
  },

  cancelButtonText: {
    color: C.red,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
    flexShrink: 1,
  },

  cancelHint: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 11,
  },

  historyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    borderRadius: 17,
    padding: 15,
    minHeight: 77,
  },

  historyIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: "#261E3A",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },

  historyText: {
    flex: 1,
    minWidth: 0,
  },

  historyTitle: {
    color: C.white,
    fontSize: 13,
    fontWeight: "800",
  },

  historySubtitle: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },

  securityCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#111A17",
    borderWidth: 1,
    borderColor: "#294336",
    borderRadius: 17,
    padding: 15,
  },

  securityIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#1D3025",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },

  securityContent: {
    flex: 1,
    minWidth: 0,
  },

  securityTitle: {
    color: C.white,
    fontSize: 13,
    fontWeight: "800",
  },

  securityText: {
    color: "#94B09F",
    fontSize: 11,
    lineHeight: 18,
    marginTop: 6,
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    backgroundColor: "#28161D",
    borderWidth: 1,
    borderColor: "#603541",
    borderRadius: 15,
    padding: 14,
    marginBottom: 17,
  },

  messageContent: {
    flex: 1,
    minWidth: 0,
  },

  errorText: {
    color: C.red,
    fontSize: 13,
    lineHeight: 20,
  },

  retryButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#3A232E",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 11,
  },

  retryButtonText: {
    color: C.red,
    fontSize: 12,
    fontWeight: "800",
  },

  successBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#12251C",
    borderWidth: 1,
    borderColor: "#2C5C43",
    borderRadius: 15,
    padding: 14,
    marginBottom: 17,
  },

  successText: {
    flex: 1,
    minWidth: 0,
    color: C.green,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },

  disabled: {
    opacity: 0.6,
  },
});