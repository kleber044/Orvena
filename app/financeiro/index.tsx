import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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

import { verificarAcessoPro } from "../../lib/pro-access";
import { supabase } from "../../lib/supabase";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
type Tipo = "entrada" | "saida";
type Status = "previsto" | "pendente" | "pago" | "cancelado";
type Filtro = "todos" | "entrada" | "saida" | "pendente";

type Lancamento = {
  id: string;
  user_id: string;
  tipo: Tipo;
  categoria: string;
  descricao: string;
  valor: number | string;
  status: Status;
  vencimento: string | null;
  pago_em: string | null;
  cliente_id: string | null;
  obra_id: string | null;
  orcamento_id: string | null;
  origem: "manual" | "orcamento";
  created_at: string;
  clientes?: { nome: string } | null;
  obras?: { nome: string } | null;
};

type Cliente = {
  id: string;
  nome: string;
};

type Obra = {
  id: string;
  nome: string;
  cliente_id: string | null;
};

type FormLancamento = {
  tipo: Tipo;
  categoria: string;
  descricao: string;
  valor: string;
  status: Status;
  vencimento: string;
  cliente_id: string | null;
  obra_id: string | null;
};

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

const FORM_VAZIO: FormLancamento = {
  tipo: "saida",
  categoria: "Materiais",
  descricao: "",
  valor: "",
  status: "pendente",
  vencimento: "",
  cliente_id: null,
  obra_id: null,
};

const CATEGORIAS_ENTRADA = [
  "Orçamento",
  "Serviço",
  "Adiantamento",
  "Outros",
];

const CATEGORIAS_SAIDA = [
  "Materiais",
  "Mão de obra",
  "Transporte",
  "Equipamentos",
  "Impostos",
  "Outros",
];

function formatarReal(valor: number) {
  const numero = Number(valor || 0);

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(numero) ? numero : 0);
}

function formatarMoedaDigitada(valor: string) {
  const numeros = valor.replace(/\D/g, "").slice(0, 12);

  if (!numeros) return "";

  return (Number(numeros) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function moedaParaNumero(valor: string) {
  const normalizado = valor
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  const numero = Number(normalizado);

  return Number.isFinite(numero) ? numero : 0;
}

function formatarData(valor: string | null) {
  if (!valor) return "Sem vencimento";

  const data = new Date(`${valor.slice(0, 10)}T12:00:00`);

  if (Number.isNaN(data.getTime())) return valor;

  return data.toLocaleDateString("pt-BR");
}

function formatarDataDigitada(valor: string) {
  const numeros = valor.replace(/\D/g, "").slice(0, 8);

  if (numeros.length <= 2) return numeros;

  if (numeros.length <= 4) {
    return `${numeros.slice(0, 2)}/${numeros.slice(2)}`;
  }

  return `${numeros.slice(0, 2)}/${numeros.slice(2, 4)}/${numeros.slice(4)}`;
}

function dataBrParaIso(valor: string): string | null {
  const partes = valor.split("/");

  if (
    partes.length !== 3 ||
    partes[0].length !== 2 ||
    partes[1].length !== 2 ||
    partes[2].length !== 4
  ) {
    return null;
  }

  const [diaTexto, mesTexto, anoTexto] = partes;
  const dia = Number(diaTexto);
  const mes = Number(mesTexto);
  const ano = Number(anoTexto);

  if (
    ano < 1900 ||
    ano > 9999 ||
    mes < 1 ||
    mes > 12 ||
    dia < 1
  ) {
    return null;
  }

  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();

  if (dia > diasNoMes) return null;

  return `${anoTexto}-${mesTexto}-${diaTexto}`;
}

function isoParaBr(valor: string | null) {
  if (!valor) return "";

  const [ano, mes, dia] = valor.slice(0, 10).split("-");

  return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor;
}

function normalizarBusca(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function statusTexto(status: Status) {
  switch (status) {
    case "previsto":
      return "PREVISTO";
    case "pendente":
      return "PENDENTE";
    case "pago":
      return "PAGO";
    default:
      return "CANCELADO";
  }
}

function coresStatus(status: Status) {
  switch (status) {
    case "pago":
      return {
        color: C.green,
        bg: C.greenBg,
        border: "#315A48",
      };

    case "previsto":
      return {
        color: C.blue,
        bg: C.blueBg,
        border: "#344F75",
      };

    case "cancelado":
      return {
        color: C.red,
        bg: C.redBg,
        border: "#53303B",
      };

    default:
      return {
        color: C.yellow,
        bg: C.yellowBg,
        border: "#665035",
      };
  }
}

export default function FinanceiroScreen() {
  const { width } = useWindowDimensions();
  const mobile = width < 650;

  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [alterandoId, setAlterandoId] = useState<string | null>(null);

  const [erro, setErro] = useState("");
  const [redirecionandoLogin, setRedirecionandoLogin] = useState(false);
  const [acessoProNegado, setAcessoProNegado] = useState(false);

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState<FormLancamento>(FORM_VAZIO);

  useFocusEffect(
    useCallback(() => {
      void carregarDados();
    }, [])
  );

  async function carregarDados() {
    try {
      setCarregando(true);
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
        financeiroResult,
        clientesResult,
        obrasResult,
      ] = await Promise.all([
        supabase
          .from("financeiro_lancamentos")
          .select(
            "id, user_id, tipo, categoria, descricao, valor, status, vencimento, pago_em, cliente_id, obra_id, orcamento_id, origem, created_at, clientes(nome), obras(nome)"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("clientes")
          .select("id, nome")
          .eq("user_id", user.id)
          .order("nome", { ascending: true }),

        supabase
          .from("obras")
          .select("id, nome, cliente_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (financeiroResult.error) {
        console.log(
          "Erro ao carregar financeiro:",
          financeiroResult.error.message
        );

        setErro("Não foi possível carregar o financeiro.");
        return;
      }

      setLancamentos(
        (financeiroResult.data ?? []) as unknown as Lancamento[]
      );

      if (clientesResult.error) {
        console.log(
          "Erro ao carregar clientes:",
          clientesResult.error.message
        );
      } else {
        setClientes(
          (clientesResult.data ?? []) as Cliente[]
        );
      }

      if (obrasResult.error) {
        console.log(
          "Erro ao carregar obras:",
          obrasResult.error.message
        );
      } else {
        setObras(
          (obrasResult.data ?? []) as Obra[]
        );
      }
    } catch (error) {
      console.log("Erro inesperado no financeiro:", error);
      setErro("Não foi possível carregar o financeiro.");
    } finally {
      setCarregando(false);
    }
  }

  const resumo = useMemo(() => {
    let recebido = 0;
    let aReceber = 0;
    let despesas = 0;
    let previsto = 0;

    for (const item of lancamentos) {
      const valor = Number(item.valor || 0);

      if (item.status === "cancelado") continue;

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

    return {
      recebido,
      aReceber,
      despesas,
      previsto,
      saldo: recebido - despesas,
    };
  }, [lancamentos]);

  const totalPendentes = useMemo(
    () =>
      lancamentos.filter(
        (item) =>
          item.status === "pendente" ||
          item.status === "previsto"
      ).length,
    [lancamentos]
  );

  const lancamentosFiltrados = useMemo(() => {
    const termo = normalizarBusca(busca.trim());

    return lancamentos.filter((item) => {
      const filtroOk =
        filtro === "todos" ||
        (filtro === "pendente"
          ? item.status === "pendente" ||
            item.status === "previsto"
          : item.tipo === filtro);

      if (!filtroOk) return false;

      if (!termo) return true;

      return normalizarBusca(
        [
          item.descricao,
          item.categoria,
          item.clientes?.nome,
          item.obras?.nome,
        ]
          .filter(Boolean)
          .join(" ")
      ).includes(termo);
    });
  }, [lancamentos, busca, filtro]);

  const categorias =
    form.tipo === "entrada"
      ? CATEGORIAS_ENTRADA
      : CATEGORIAS_SAIDA;

  const obrasDisponiveis = useMemo(() => {
    if (!form.cliente_id) return obras;

    return obras.filter(
      (obra) =>
        !obra.cliente_id ||
        obra.cliente_id === form.cliente_id
    );
  }, [obras, form.cliente_id]);

  function atualizarCampo(
    campo: keyof FormLancamento,
    valor: string | null
  ) {
    setForm((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  }

  function abrirNovo() {
    setForm({ ...FORM_VAZIO });
    setErro("");
    setModalAberto(true);
  }

  function fecharModal() {
    if (salvando) return;

    setModalAberto(false);
    setForm({ ...FORM_VAZIO });
    setErro("");
  }

  async function salvarLancamento() {
    if (salvando) return;

    const descricao = form.descricao.trim();
    const valor = moedaParaNumero(form.valor);

    if (!descricao) {
      setErro("Informe a descrição do lançamento.");
      return;
    }

    if (!Number.isFinite(valor) || valor <= 0) {
      setErro("Informe um valor maior que zero.");
      return;
    }

    const vencimentoIso = form.vencimento.trim()
      ? dataBrParaIso(form.vencimento.trim())
      : null;

    if (form.vencimento.trim() && !vencimentoIso) {
      setErro(
        "Informe uma data válida no formato DD/MM/AAAA."
      );
      return;
    }

    try {
      setSalvando(true);
      setErro("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErro("Sua sessão expirou. Entre novamente.");
        return;
      }

      const { error } = await supabase
        .from("financeiro_lancamentos")
        .insert({
          user_id: user.id,
          tipo: form.tipo,
          categoria: form.categoria,
          descricao,
          valor,
          status: form.status,
          vencimento: vencimentoIso,
          pago_em:
            form.status === "pago"
              ? new Date().toISOString()
              : null,
          cliente_id: form.cliente_id,
          obra_id: form.obra_id,
          orcamento_id: null,
          origem: "manual",
        });

      if (error) {
        console.log(
          "Erro ao salvar lançamento:",
          error.message
        );

        setErro("Não foi possível salvar o lançamento.");
        return;
      }

      setModalAberto(false);
      setForm({ ...FORM_VAZIO });

      await carregarDados();
    } catch (error) {
      console.log(
        "Erro inesperado ao salvar lançamento:",
        error
      );

      setErro("Não foi possível salvar o lançamento.");
    } finally {
      setSalvando(false);
    }
  }

  async function alterarStatus(
    item: Lancamento,
    novoStatus: Status
  ) {
    if (alterandoId) return;

    try {
      setAlterandoId(item.id);
      setErro("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErro("Sua sessão expirou. Entre novamente.");
        return;
      }

      const pagoEm =
        novoStatus === "pago"
          ? new Date().toISOString()
          : null;

      const { error } = await supabase
        .from("financeiro_lancamentos")
        .update({
          status: novoStatus,
          pago_em: pagoEm,
        })
        .eq("id", item.id)
        .eq("user_id", user.id);

      if (error) {
        console.log(
          "Erro ao alterar status financeiro:",
          error.message
        );

        setErro("Não foi possível atualizar o lançamento.");
        return;
      }

      setLancamentos((atual) =>
        atual.map((registro) =>
          registro.id === item.id
            ? {
                ...registro,
                status: novoStatus,
                pago_em: pagoEm,
              }
            : registro
        )
      );
    } catch (error) {
      console.log(
        "Erro ao atualizar lançamento:",
        error
      );

      setErro("Não foi possível atualizar o lançamento.");
    } finally {
      setAlterandoId(null);
    }
  }

  function confirmarAlteracaoStatus(
    item: Lancamento,
    novoStatus: Status
  ) {
    if (alterandoId) return;

    const marcarPago = novoStatus === "pago";

    const titulo = marcarPago
      ? item.tipo === "entrada"
        ? "Confirmar recebimento"
        : "Confirmar pagamento"
      : "Desfazer confirmação";

    const mensagem = marcarPago
      ? item.tipo === "entrada"
        ? `Confirmar que "${item.descricao}" foi recebido? Isso atualizará o financeiro e os relatórios.`
        : `Confirmar que "${item.descricao}" foi pago? Isso atualizará o financeiro e os relatórios.`
      : `Deseja desfazer a confirmação de "${item.descricao}" e voltar o lançamento para pendente?`;

    const confirmarTexto = marcarPago
      ? item.tipo === "entrada"
        ? "Confirmar recebimento"
        : "Confirmar pagamento"
      : "Desfazer";

    const executar = () =>
      void alterarStatus(item, novoStatus);

    if (Platform.OS === "web") {
      const confirmou =
        typeof window !== "undefined"
          ? window.confirm(mensagem)
          : false;

      if (confirmou) executar();

      return;
    }

    Alert.alert(titulo, mensagem, [
      {
        text: "Cancelar",
        style: "cancel",
      },
      {
        text: confirmarTexto,
        style: marcarPago ? "default" : "destructive",
        onPress: executar,
      },
    ]);
  }

  function confirmarExclusao(item: Lancamento) {
    if (excluindoId) return;

    if (item.origem === "orcamento") {
      setErro(
        "Este lançamento veio de um orçamento. Altere o orçamento em vez de excluir o vínculo financeiro."
      );
      return;
    }

    const executar = () =>
      void excluirLancamento(item);

    if (Platform.OS === "web") {
      const confirmou =
        typeof window !== "undefined"
          ? window.confirm(
              `Excluir permanentemente "${item.descricao}"?`
            )
          : false;

      if (confirmou) executar();

      return;
    }

    Alert.alert(
      "Excluir lançamento",
      `Deseja excluir "${item.descricao}"?`,
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Excluir",
          style: "destructive",
          onPress: executar,
        },
      ]
    );
  }

  async function excluirLancamento(item: Lancamento) {
    if (excluindoId || item.origem !== "manual") return;

    try {
      setExcluindoId(item.id);
      setErro("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErro("Sua sessão expirou. Entre novamente.");
        return;
      }

      const { error } = await supabase
        .from("financeiro_lancamentos")
        .delete()
        .eq("id", item.id)
        .eq("user_id", user.id)
        .eq("origem", "manual");

      if (error) {
        console.log(
          "Erro ao excluir lançamento:",
          error.message
        );

        setErro("Não foi possível excluir o lançamento.");
        return;
      }

      setLancamentos((atual) =>
        atual.filter(
          (registro) => registro.id !== item.id
        )
      );
    } catch (error) {
      console.log("Erro ao excluir lançamento:", error);
      setErro("Não foi possível excluir o lançamento.");
    } finally {
      setExcluindoId(null);
    }
  }

  if (carregando || redirecionandoLogin) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}>
          <ActivityIndicator
            size="large"
            color={C.purple}
          />
          <Text style={styles.loadingText}>
            Carregando financeiro...
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
            <View style={styles.guardIconBox}>
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
              Financeiro no Orvena Pro
            </Text>

            <Text style={styles.guardText}>
              Controle entradas, saídas, previsões e valores
              a receber, conectados aos seus orçamentos e obras.
              Este recurso requer o plano Pro ou um período
              de teste ativo.
            </Text>

            <Pressable
              style={styles.primaryButton}
              onPress={() =>
                router.replace("/plano" as any)
              }
            >
              <Ionicons
                name="diamond-outline"
                size={17}
                color="#FFFFFF"
              />
              <Text style={styles.primaryText}>
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
        keyboardShouldPersistTaps="handled"
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
                  GESTÃO FINANCEIRA
                </Text>

                <Text style={styles.pageTitle}>
                  Financeiro
                </Text>

                <Text style={styles.subtitle}>
                  Acompanhe seu dinheiro e tenha controle
                  sobre cada lançamento.
                </Text>
              </View>
            </View>

            <Pressable
              style={[
                styles.primaryButton,
                mobile && styles.primaryButtonMobile,
              ]}
              onPress={abrirNovo}
            >
              <Ionicons
                name="add"
                size={19}
                color="#FFFFFF"
              />

              <Text style={styles.primaryText}>
                NOVO LANÇAMENTO
              </Text>
            </Pressable>
          </View>

          {/* RESUMO FINANCEIRO */}
          <View
            style={[
              styles.stats,
              mobile && styles.statsMobile,
            ]}
          >
            <StatCard
              icon="arrow-down-circle-outline"
              label="RECEBIDO"
              value={formatarReal(resumo.recebido)}
              subtitle="Entradas confirmadas"
              tone="green"
              compact={mobile}
            />

            <StatCard
              icon="time-outline"
              label="A RECEBER"
              value={formatarReal(resumo.aReceber)}
              subtitle="Recebimentos pendentes"
              tone="yellow"
              compact={mobile}
            />

            <StatCard
              icon="arrow-up-circle-outline"
              label="DESPESAS PAGAS"
              value={formatarReal(resumo.despesas)}
              subtitle="Saídas confirmadas"
              tone="red"
              compact={mobile}
            />

            <StatCard
              icon="document-text-outline"
              label="PREVISTO EM ORÇAMENTOS"
              value={formatarReal(resumo.previsto)}
              subtitle="Entradas previstas"
              tone="blue"
              compact={mobile}
            />

            <StatCard
              icon="wallet-outline"
              label="SALDO REALIZADO"
              value={formatarReal(resumo.saldo)}
              subtitle="Recebido menos despesas pagas"
              tone={
                resumo.saldo < 0
                  ? "red"
                  : "purple"
              }
              compact={mobile}
              fullWidthMobile
            />
          </View>

          {/* LISTAGEM */}
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>
                MOVIMENTAÇÕES
              </Text>

              <Text style={styles.sectionTitle}>
                Lançamentos
              </Text>
            </View>

            <Text style={styles.resultsText}>
              {lancamentosFiltrados.length}{" "}
              {lancamentosFiltrados.length === 1
                ? "resultado"
                : "resultados"}
            </Text>
          </View>

          <View style={styles.listPanel}>
            {/* PESQUISA */}
            <View style={styles.toolbar}>
              <View style={styles.searchBox}>
                <Ionicons
                  name="search-outline"
                  size={19}
                  color={C.subtle}
                />

                <TextInput
                  value={busca}
                  onChangeText={setBusca}
                  placeholder="Buscar lançamento, cliente ou obra..."
                  placeholderTextColor={C.subtle}
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                {busca.length > 0 ? (
                  <Pressable
                    hitSlop={10}
                    onPress={() => setBusca("")}
                  >
                    <Ionicons
                      name="close-circle"
                      size={19}
                      color={C.subtle}
                    />
                  </Pressable>
                ) : null}
              </View>

              <Pressable
                style={styles.refreshButton}
                onPress={() =>
                  void carregarDados()
                }
              >
                <Ionicons
                  name="refresh-outline"
                  size={19}
                  color={C.purpleLight}
                />
              </Pressable>
            </View>

            {/* FILTROS */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
            >
              <FilterButton
                label="Todos"
                count={lancamentos.length}
                selected={filtro === "todos"}
                onPress={() => setFiltro("todos")}
              />

              <FilterButton
                label="Entradas"
                count={
                  lancamentos.filter(
                    (item) => item.tipo === "entrada"
                  ).length
                }
                selected={filtro === "entrada"}
                onPress={() => setFiltro("entrada")}
              />

              <FilterButton
                label="Saídas"
                count={
                  lancamentos.filter(
                    (item) => item.tipo === "saida"
                  ).length
                }
                selected={filtro === "saida"}
                onPress={() => setFiltro("saida")}
              />

              <FilterButton
                label="Pendentes"
                count={totalPendentes}
                selected={filtro === "pendente"}
                onPress={() => setFiltro("pendente")}
              />
            </ScrollView>

            {erro && !modalAberto ? (
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

            {lancamentosFiltrados.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name="wallet-outline"
                    size={28}
                    color={C.purpleLight}
                  />
                </View>

                <Text style={styles.emptyTitle}>
                  Nenhum lançamento encontrado
                </Text>

                <Text style={styles.emptyText}>
                  {busca.trim() || filtro !== "todos"
                    ? "Tente alterar a pesquisa ou selecionar outro filtro."
                    : "Seus orçamentos aparecerão aqui automaticamente. Você também pode registrar entradas e despesas manualmente."}
                </Text>

                {busca.trim() || filtro !== "todos" ? (
                  <Pressable
                    style={styles.emptyAction}
                    onPress={() => {
                      setBusca("");
                      setFiltro("todos");
                    }}
                  >
                    <Text style={styles.emptyActionText}>
                      LIMPAR FILTROS
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={styles.emptyAction}
                    onPress={abrirNovo}
                  >
                    <Ionicons
                      name="add"
                      size={18}
                      color="#FFFFFF"
                    />

                    <Text style={styles.emptyActionText}>
                      NOVO LANÇAMENTO
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <View style={styles.lancamentosList}>
                {lancamentosFiltrados.map((item) => {
                  const statusVisual = coresStatus(
                    item.status
                  );

                  const entrada =
                    item.tipo === "entrada";

                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.lancamentoRow,
                        mobile &&
                          styles.lancamentoRowMobile,
                      ]}
                    >
                      <View
                        style={[
                          styles.typeIcon,
                          entrada
                            ? styles.typeIconEntrada
                            : styles.typeIconSaida,
                        ]}
                      >
                        <Ionicons
                          name={
                            entrada
                              ? "arrow-down"
                              : "arrow-up"
                          }
                          size={22}
                          color={
                            entrada
                              ? C.green
                              : C.red
                          }
                        />
                      </View>

                      <View style={styles.lancamentoContent}>
                        <View style={styles.lancamentoTop}>
                          <Text
                            style={styles.lancamentoTitle}
                            numberOfLines={2}
                          >
                            {item.descricao}
                          </Text>

                          <View
                            style={[
                              styles.statusBadge,
                              {
                                backgroundColor:
                                  statusVisual.bg,
                                borderColor:
                                  statusVisual.border,
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.statusDot,
                                {
                                  backgroundColor:
                                    statusVisual.color,
                                },
                              ]}
                            />

                            <Text
                              style={[
                                styles.statusText,
                                {
                                  color:
                                    statusVisual.color,
                                },
                              ]}
                            >
                              {statusTexto(item.status)}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.lancamentoCategory}>
                          {item.categoria}
                        </Text>

                        {item.clientes?.nome ? (
                          <DetailLine
                            icon="person-outline"
                            value={item.clientes.nome}
                          />
                        ) : null}

                        {item.obras?.nome ? (
                          <DetailLine
                            icon="business-outline"
                            value={item.obras.nome}
                          />
                        ) : null}

                        <Text
                          style={[
                            styles.lancamentoValue,
                            !entrada &&
                              styles.lancamentoValueSaida,
                          ]}
                        >
                          {entrada ? "+" : "-"}{" "}
                          {formatarReal(
                            Number(item.valor || 0)
                          )}
                        </Text>

                        <View style={styles.metaRow}>
                          <Ionicons
                            name="calendar-outline"
                            size={13}
                            color={C.subtle}
                          />

                          <Text style={styles.metaText}>
                            Vencimento:{" "}
                            {formatarData(item.vencimento)}
                          </Text>
                        </View>

                        <View style={styles.metaRow}>
                          <Ionicons
                            name={
                              item.origem === "orcamento"
                                ? "link-outline"
                                : "create-outline"
                            }
                            size={13}
                            color={C.subtle}
                          />

                          <Text style={styles.metaText}>
                            {item.origem === "orcamento"
                              ? "Integrado ao orçamento"
                              : "Lançamento manual"}
                          </Text>
                        </View>
                      </View>

                      {/* AÇÕES */}
                      <View
                        style={[
                          styles.rowActions,
                          mobile &&
                            styles.rowActionsMobile,
                        ]}
                      >
                        {item.status !== "pago" &&
                        item.status !== "cancelado" ? (
                          <Pressable
                            style={styles.receiveButton}
                            onPress={() =>
                              confirmarAlteracaoStatus(
                                item,
                                "pago"
                              )
                            }
                            disabled={
                              alterandoId !== null ||
                              excluindoId !== null
                            }
                          >
                            {alterandoId === item.id ? (
                              <ActivityIndicator
                                size="small"
                                color="#FFFFFF"
                              />
                            ) : (
                              <>
                                <Ionicons
                                  name="checkmark"
                                  size={16}
                                  color="#FFFFFF"
                                />

                                <Text style={styles.receiveText}>
                                  {entrada
                                    ? "RECEBER"
                                    : "PAGAR"}
                                </Text>
                              </>
                            )}
                          </Pressable>
                        ) : null}

                        {item.status === "pago" ? (
                          <Pressable
                            style={styles.undoButton}
                            onPress={() =>
                              confirmarAlteracaoStatus(
                                item,
                                "pendente"
                              )
                            }
                            disabled={
                              alterandoId !== null ||
                              excluindoId !== null
                            }
                          >
                            {alterandoId === item.id ? (
                              <ActivityIndicator
                                size="small"
                                color={C.purpleLight}
                              />
                            ) : (
                              <>
                                <Ionicons
                                  name="arrow-undo-outline"
                                  size={15}
                                  color={C.purpleLight}
                                />

                                <Text style={styles.undoText}>
                                  Desfazer
                                </Text>
                              </>
                            )}
                          </Pressable>
                        ) : null}

                        {item.origem === "manual" ? (
                          <Pressable
                            style={styles.deleteButton}
                            onPress={() =>
                              confirmarExclusao(item)
                            }
                            disabled={
                              excluindoId !== null ||
                              alterandoId !== null
                            }
                          >
                            {excluindoId === item.id ? (
                              <ActivityIndicator
                                size="small"
                                color={C.red}
                              />
                            ) : (
                              <Ionicons
                                name="trash-outline"
                                size={17}
                                color={C.red}
                              />
                            )}
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {lancamentosFiltrados.length > 0 ? (
              <View style={styles.listFooter}>
                <Ionicons
                  name="checkmark-circle"
                  size={15}
                  color={C.green}
                />

                <Text style={styles.footerText}>
                  Exibindo{" "}
                  {lancamentosFiltrados.length} de{" "}
                  {lancamentos.length}{" "}
                  {lancamentos.length === 1
                    ? "lançamento"
                    : "lançamentos"}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.pageFooter}>
            ORVENA · SEU NEGÓCIO, ORGANIZADO
          </Text>
        </View>
      </ScrollView>

      {/* MODAL NOVO LANÇAMENTO */}
      <Modal
        visible={modalAberto}
        transparent
        animationType="fade"
        onRequestClose={fecharModal}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : undefined
          }
        >
          <View
            style={[
              styles.modalCard,
              mobile && styles.modalCardMobile,
            ]}
          >
            <ScrollView
              contentContainerStyle={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderIcon}>
                  <Ionicons
                    name="wallet-outline"
                    size={22}
                    color={C.purpleLight}
                  />
                </View>

                <View style={styles.modalHeaderContent}>
                  <Text style={styles.modalEyebrow}>
                    FINANCEIRO
                  </Text>

                  <Text style={styles.modalTitle}>
                    Novo lançamento
                  </Text>

                  <Text style={styles.modalSubtitle}>
                    Registre uma entrada ou despesa
                    manualmente.
                  </Text>
                </View>

                <Pressable
                  style={styles.closeButton}
                  onPress={fecharModal}
                  disabled={salvando}
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color={C.muted}
                  />
                </Pressable>
              </View>

              {/* TIPO */}
              <SectionTitle
                icon="swap-horizontal-outline"
                title="Tipo de movimentação"
              />

              <View style={styles.typeSelector}>
                {(["entrada", "saida"] as Tipo[]).map(
                  (tipo) => {
                    const selecionado =
                      form.tipo === tipo;

                    return (
                      <Pressable
                        key={tipo}
                        style={[
                          styles.typeButton,
                          selecionado &&
                            styles.typeButtonActive,
                        ]}
                        onPress={() =>
                          setForm((atual) => ({
                            ...atual,
                            tipo,
                            categoria:
                              tipo === "entrada"
                                ? CATEGORIAS_ENTRADA[0]
                                : CATEGORIAS_SAIDA[0],
                          }))
                        }
                      >
                        <Ionicons
                          name={
                            tipo === "entrada"
                              ? "arrow-down-circle-outline"
                              : "arrow-up-circle-outline"
                          }
                          size={19}
                          color={
                            selecionado
                              ? C.purpleLight
                              : C.muted
                          }
                        />

                        <Text
                          style={[
                            styles.typeButtonText,
                            selecionado &&
                              styles.typeButtonTextActive,
                          ]}
                        >
                          {tipo === "entrada"
                            ? "ENTRADA"
                            : "SAÍDA"}
                        </Text>
                      </Pressable>
                    );
                  }
                )}
              </View>

              <View style={styles.formDivider} />

              {/* CATEGORIA */}
              <SectionTitle
                icon="grid-outline"
                title="Categoria"
              />

              <View style={styles.chipWrap}>
                {categorias.map((categoria) => (
                  <Chip
                    key={categoria}
                    label={categoria}
                    active={
                      form.categoria === categoria
                    }
                    onPress={() =>
                      atualizarCampo(
                        "categoria",
                        categoria
                      )
                    }
                  />
                ))}
              </View>

              <View style={styles.formDivider} />

              {/* INFORMAÇÕES */}
              <SectionTitle
                icon="document-text-outline"
                title="Dados do lançamento"
              />

              <View style={styles.formGrid}>
                <View style={styles.fieldFull}>
                  <Text style={styles.fieldLabel}>
                    Descrição *
                  </Text>

                  <TextInput
                    value={form.descricao}
                    onChangeText={(valor) =>
                      atualizarCampo(
                        "descricao",
                        valor
                      )
                    }
                    placeholder="Ex.: Compra de cimento"
                    placeholderTextColor={C.subtle}
                    style={styles.input}
                  />
                </View>

                <View
                  style={
                    mobile
                      ? styles.fieldFull
                      : styles.fieldHalf
                  }
                >
                  <Text style={styles.fieldLabel}>
                    Valor *
                  </Text>

                  <View style={styles.moneyBox}>
                    <Text style={styles.moneyPrefix}>
                      R$
                    </Text>

                    <TextInput
                      value={form.valor}
                      onChangeText={(valor) =>
                        atualizarCampo(
                          "valor",
                          formatarMoedaDigitada(valor)
                        )
                      }
                      keyboardType="number-pad"
                      placeholder="0,00"
                      placeholderTextColor={C.subtle}
                      style={styles.moneyInput}
                    />
                  </View>
                </View>

                <View
                  style={
                    mobile
                      ? styles.fieldFull
                      : styles.fieldHalf
                  }
                >
                  <Text style={styles.fieldLabel}>
                    Vencimento
                  </Text>

                  <TextInput
                    value={form.vencimento}
                    onChangeText={(valor) =>
                      atualizarCampo(
                        "vencimento",
                        formatarDataDigitada(valor)
                      )
                    }
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor={C.subtle}
                    keyboardType="number-pad"
                    maxLength={10}
                    style={styles.input}
                  />
                </View>
              </View>

              <View style={styles.formDivider} />

              {/* STATUS */}
              <SectionTitle
                icon="checkmark-circle-outline"
                title="Status inicial"
              />

              <View style={styles.typeSelector}>
                {(["pendente", "pago"] as Status[]).map(
                  (status) => (
                    <Pressable
                      key={status}
                      style={[
                        styles.typeButton,
                        form.status === status &&
                          styles.typeButtonActive,
                      ]}
                      onPress={() =>
                        atualizarCampo(
                          "status",
                          status
                        )
                      }
                    >
                      <Ionicons
                        name={
                          status === "pago"
                            ? "checkmark-circle-outline"
                            : "time-outline"
                        }
                        size={18}
                        color={
                          form.status === status
                            ? C.purpleLight
                            : C.muted
                        }
                      />

                      <Text
                        style={[
                          styles.typeButtonText,
                          form.status === status &&
                            styles.typeButtonTextActive,
                        ]}
                      >
                        {status === "pago"
                          ? form.tipo === "entrada"
                            ? "JÁ RECEBIDO"
                            : "JÁ PAGO"
                          : "PENDENTE"}
                      </Text>
                    </Pressable>
                  )
                )}
              </View>

              {/* CLIENTE */}
              {clientes.length > 0 ? (
                <>
                  <View style={styles.formDivider} />

                  <SectionTitle
                    icon="person-outline"
                    title="Vincular cliente"
                  />

                  <View style={styles.chipWrap}>
                    <Chip
                      label="Sem cliente"
                      active={!form.cliente_id}
                      onPress={() =>
                        setForm((atual) => ({
                          ...atual,
                          cliente_id: null,
                          obra_id: atual.obra_id
                            ? obras.find(
                                (obra) =>
                                  obra.id === atual.obra_id
                              )?.cliente_id || null
                                ? atual.obra_id
                                : null
                            : null,
                        }))
                      }
                    />

                    {clientes.map((cliente) => (
                      <Chip
                        key={cliente.id}
                        label={cliente.nome}
                        active={
                          form.cliente_id === cliente.id
                        }
                        onPress={() =>
                          setForm((atual) => ({
                            ...atual,
                            cliente_id: cliente.id,
                            obra_id:
                              atual.obra_id &&
                              obras.some(
                                (obra) =>
                                  obra.id === atual.obra_id &&
                                  (!obra.cliente_id ||
                                    obra.cliente_id ===
                                      cliente.id)
                              )
                                ? atual.obra_id
                                : null,
                          }))
                        }
                      />
                    ))}
                  </View>
                </>
              ) : null}

              {/* OBRA */}
              {obrasDisponiveis.length > 0 ? (
                <>
                  <View style={styles.formDivider} />

                  <SectionTitle
                    icon="business-outline"
                    title="Vincular obra"
                  />

                  <View style={styles.chipWrap}>
                    <Chip
                      label="Sem obra"
                      active={!form.obra_id}
                      onPress={() =>
                        atualizarCampo(
                          "obra_id",
                          null
                        )
                      }
                    />

                    {obrasDisponiveis.map((obra) => (
                      <Chip
                        key={obra.id}
                        label={obra.nome}
                        active={
                          form.obra_id === obra.id
                        }
                        onPress={() =>
                          setForm((atual) => ({
                            ...atual,
                            obra_id: obra.id,
                            cliente_id:
                              obra.cliente_id ||
                              atual.cliente_id,
                          }))
                        }
                      />
                    ))}
                  </View>
                </>
              ) : null}

              {erro ? (
                <View style={styles.modalError}>
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

              {/* AÇÕES */}
              <View
                style={[
                  styles.modalActions,
                  mobile &&
                    styles.modalActionsMobile,
                ]}
              >
                <Pressable
                  style={[
                    styles.cancelButton,
                    mobile &&
                      styles.modalActionMobile,
                  ]}
                  onPress={fecharModal}
                  disabled={salvando}
                >
                  <Text style={styles.cancelText}>
                    Cancelar
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.saveButton,
                    mobile &&
                      styles.modalActionMobile,
                    salvando &&
                      styles.disabled,
                  ]}
                  onPress={() =>
                    void salvarLancamento()
                  }
                  disabled={salvando}
                >
                  {salvando ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark"
                        size={19}
                        color="#FFFFFF"
                      />

                      <Text style={styles.saveText}>
                        SALVAR LANÇAMENTO
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function StatCard({
  icon,
  label,
  value,
  subtitle,
  tone = "purple",
  compact = false,
  fullWidthMobile = false,
}: {
  icon: IconName;
  label: string;
  value: string;
  subtitle: string;
  tone?: "purple" | "green" | "red" | "yellow" | "blue";
  compact?: boolean;
  fullWidthMobile?: boolean;
}) {
  const color =
    tone === "green"
      ? C.green
      : tone === "red"
      ? C.red
      : tone === "yellow"
      ? C.yellow
      : tone === "blue"
      ? C.blue
      : C.purpleLight;

  const background =
    tone === "green"
      ? C.greenBg
      : tone === "red"
      ? C.redBg
      : tone === "yellow"
      ? C.yellowBg
      : tone === "blue"
      ? C.blueBg
      : C.purpleBg;

  return (
    <View style={[styles.statCard, compact && styles.statCardMobile, compact && fullWidthMobile && styles.statCardFullMobile]}>
      <View
        style={[
          styles.statIcon,
          compact && styles.statIconMobile,
          { backgroundColor: background },
        ]}
      >
        <Ionicons
          name={icon}
          size={compact ? 17 : 20}
          color={color}
        />
      </View>

      <Text style={[styles.statLabel, compact && styles.statLabelMobile]}>
        {label}
      </Text>

      <Text
        style={[
          styles.statValue,
          tone === "red" &&
            styles.statValueRed,
        ]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>

      <Text style={[styles.statSubtitle, compact && styles.statSubtitleMobile]}>
        {subtitle}
      </Text>
    </View>
  );
}

function FilterButton({
  label,
  count,
  selected,
  onPress,
}: {
  label: string;
  count: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.filterButton,
        selected &&
          styles.filterButtonActive,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.filterText,
          selected &&
            styles.filterTextActive,
        ]}
      >
        {label}
      </Text>

      <View
        style={[
          styles.filterCount,
          selected &&
            styles.filterCountActive,
        ]}
      >
        <Text
          style={[
            styles.filterCountText,
            selected &&
              styles.filterCountTextActive,
          ]}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

function DetailLine({
  icon,
  value,
}: {
  icon: IconName;
  value: string;
}) {
  return (
    <View style={styles.detailLine}>
      <Ionicons
        name={icon}
        size={13}
        color={C.subtle}
      />

      <Text
        style={styles.detailText}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

function SectionTitle({
  icon,
  title,
}: {
  icon: IconName;
  title: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Ionicons
        name={icon}
        size={17}
        color={C.purpleLight}
      />

      <Text style={styles.sectionHeadingText}>
        {title}
      </Text>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.chip,
        active && styles.chipActive,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.chipText,
          active && styles.chipTextActive,
        ]}
      >
        {label}
      </Text>

      {active ? (
        <Ionicons
          name="checkmark"
          size={13}
          color={C.purpleLight}
        />
      ) : null}
    </Pressable>
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
    marginBottom: 25,
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
    marginTop: 5,
    lineHeight: 18,
  },

  primaryButton: {
    minHeight: 47,
    paddingHorizontal: 19,
    borderRadius: 14,
    backgroundColor: C.purple,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  primaryButtonMobile: {
    width: "100%",
  },

  primaryText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.3,
  },

  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 13,
    marginBottom: 30,
  },

  statsMobile: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginBottom: 22,
  },

  statCard: {
    flexGrow: 1,
    flexBasis: 190,
    minWidth: 170,
    minHeight: 156,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    padding: 18,
  },

  statCardMobile: {
    width: "47%",
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: 0,
    minHeight: 116,
    padding: 11,
    borderRadius: 14,
  },

  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.purpleBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  statCardFullMobile: {
    width: "100%",
    flexBasis: "100%",
    minHeight: 102,
  },

  statIconMobile: {
    width: 29,
    height: 29,
    borderRadius: 9,
    marginBottom: 8,
  },

  statLabelMobile: {
    fontSize: 8,
    letterSpacing: 0.1,
  },

  statValueMobile: {
    fontSize: 17,
    marginTop: 5,
  },

  statSubtitleMobile: {
    fontSize: 9,
    marginTop: 3,
  },

  statLabel: {
    color: C.muted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.6,
  },

  statValue: {
    color: C.text,
    fontSize: 23,
    fontWeight: "900",
    marginTop: 7,
  },

  statValueRed: {
    color: C.red,
  },

  statSubtitle: {
    color: C.subtle,
    fontSize: 10,
    marginTop: 4,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },

  sectionEyebrow: {
    color: C.purpleLight,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  sectionTitle: {
    color: C.text,
    fontSize: 19,
    fontWeight: "900",
    marginTop: 5,
  },

  resultsText: {
    color: C.subtle,
    fontSize: 11,
    fontWeight: "700",
  },

  listPanel: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    backgroundColor: C.surface,
    overflow: "hidden",
  },

  toolbar: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },

  searchBox: {
    flex: 1,
    minWidth: 0,
    minHeight: 47,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 13,
  },

  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 45,
    color: C.text,
    fontSize: 12,
    outlineStyle: "none" as any,
  },

  refreshButton: {
    width: 47,
    height: 47,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
    alignItems: "center",
    justifyContent: "center",
  },

  filters: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 5,
  },

  filterButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  filterButtonActive: {
    borderColor: "#624BD3",
    backgroundColor: C.purpleBg,
  },

  filterText: {
    color: C.muted,
    fontSize: 11,
    fontWeight: "800",
  },

  filterTextActive: {
    color: C.purpleLight,
  },

  filterCount: {
    minWidth: 21,
    height: 21,
    paddingHorizontal: 5,
    borderRadius: 7,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },

  filterCountActive: {
    backgroundColor: "#42346A",
  },

  filterCountText: {
    color: C.muted,
    fontSize: 10,
    fontWeight: "900",
  },

  filterCountTextActive: {
    color: "#FFFFFF",
  },

  lancamentosList: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  lancamentoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },

  lancamentoRowMobile: {
    flexWrap: "wrap",
    alignItems: "flex-start",
  },

  typeIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  typeIconEntrada: {
    borderColor: "#315A48",
    backgroundColor: C.greenBg,
  },

  typeIconSaida: {
    borderColor: "#53303B",
    backgroundColor: C.redBg,
  },

  lancamentoContent: {
    flex: 1,
    minWidth: 120,
    gap: 5,
  },

  lancamentoTop: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },

  lancamentoTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: "900",
  },

  lancamentoCategory: {
    color: C.purpleLight,
    fontSize: 10,
    fontWeight: "800",
  },

  lancamentoValue: {
    color: C.green,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 3,
  },

  lancamentoValueSaida: {
    color: C.red,
  },

  statusBadge: {
    minHeight: 24,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  statusText: {
    fontSize: 9,
    fontWeight: "900",
  },

  detailLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },

  detailText: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 16,
    flexShrink: 1,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  metaText: {
    color: C.subtle,
    fontSize: 10,
    lineHeight: 15,
  },

  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  rowActionsMobile: {
    width: "100%",
    justifyContent: "flex-end",
    paddingLeft: 58,
  },

  receiveButton: {
    minHeight: 37,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#27583F",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },

  receiveText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },

  undoButton: {
    minHeight: 37,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#453765",
    backgroundColor: C.purpleBg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },

  undoText: {
    color: C.purpleLight,
    fontSize: 10,
    fontWeight: "800",
  },

  deleteButton: {
    width: 37,
    height: 37,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#53303B",
    backgroundColor: C.redBg,
    alignItems: "center",
    justifyContent: "center",
  },

  listFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 17,
    paddingVertical: 14,
  },

  footerText: {
    color: C.muted,
    fontSize: 10,
  },

  empty: {
    minHeight: 290,
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
  },

  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: C.purpleBg,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 16,
  },

  emptyText: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 400,
  },

  emptyAction: {
    minHeight: 43,
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: C.purple,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  emptyActionText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },

  errorBox: {
    margin: 16,
    padding: 13,
    borderWidth: 1,
    borderColor: "#573440",
    backgroundColor: C.redBg,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  errorText: {
    color: C.red,
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },

  pageFooter: {
    color: C.subtle,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.8,
    textAlign: "center",
    marginTop: 32,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },

  modalCard: {
    width: "100%",
    maxWidth: 760,
    maxHeight: "95%",
    backgroundColor: C.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#363041",
    overflow: "hidden",
  },

  modalCardMobile: {
    maxHeight: "98%",
  },

  modalScroll: {
    padding: 22,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginBottom: 24,
  },

  modalHeaderIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: C.purpleBg,
    alignItems: "center",
    justifyContent: "center",
  },

  modalHeaderContent: {
    flex: 1,
  },

  modalEyebrow: {
    color: C.purpleLight,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,
  },

  modalTitle: {
    color: C.text,
    fontSize: 21,
    fontWeight: "900",
    marginTop: 4,
  },

  modalSubtitle: {
    color: C.muted,
    fontSize: 11,
    marginTop: 5,
    lineHeight: 17,
  },

  closeButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 13,
  },

  sectionHeadingText: {
    color: C.text,
    fontSize: 13,
    fontWeight: "900",
  },

  formGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  formDivider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 23,
  },

  fieldHalf: {
    width:
      Platform.OS === "web"
        ? ("calc(50% - 6px)" as any)
        : "100%",
    gap: 7,
  },

  fieldFull: {
    width: "100%",
    gap: 7,
  },

  fieldLabel: {
    color: "#CBCBD4",
    fontSize: 11,
    fontWeight: "800",
  },

  input: {
    width: "100%",
    minHeight: 47,
    borderRadius: 12,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    fontSize: 12,
    paddingHorizontal: 13,
    outlineStyle: "none" as any,
  },

  moneyBox: {
    width: "100%",
    minHeight: 47,
    borderRadius: 12,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
  },

  moneyPrefix: {
    color: C.green,
    fontSize: 13,
    fontWeight: "900",
    marginRight: 9,
  },

  moneyInput: {
    flex: 1,
    minHeight: 45,
    color: C.text,
    fontSize: 13,
    outlineStyle: "none" as any,
  },

  typeSelector: {
    flexDirection: "row",
    gap: 10,
  },

  typeButton: {
    flex: 1,
    minHeight: 47,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  typeButtonActive: {
    borderColor: "#624BD3",
    backgroundColor: C.purpleBg,
  },

  typeButtonText: {
    color: C.muted,
    fontSize: 10,
    fontWeight: "900",
  },

  typeButtonTextActive: {
    color: C.purpleLight,
  },

  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  chip: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  chipActive: {
    borderColor: "#624BD3",
    backgroundColor: C.purpleBg,
  },

  chipText: {
    color: C.muted,
    fontSize: 11,
    fontWeight: "800",
  },

  chipTextActive: {
    color: C.purpleLight,
  },

  modalError: {
    padding: 12,
    marginTop: 18,
    backgroundColor: C.redBg,
    borderWidth: 1,
    borderColor: "#573440",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 26,
  },

  modalActionsMobile: {
    flexDirection: "column",
  },

  modalActionMobile: {
    width: "100%",
  },

  cancelButton: {
    minHeight: 47,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
    alignItems: "center",
    justifyContent: "center",
  },

  cancelText: {
    color: C.muted,
    fontSize: 11,
    fontWeight: "800",
  },

  saveButton: {
    minHeight: 47,
    paddingHorizontal: 19,
    borderRadius: 12,
    backgroundColor: C.purple,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  saveText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },

  disabled: {
    opacity: 0.6,
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

  guardIconBox: {
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