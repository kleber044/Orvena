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
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { verificarAcessoPro } from "../../lib/pro-access";
import { supabase } from "../../lib/supabase";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

type Servico = {
  id: string;
  user_id: string;
  nome: string;
  descricao: string | null;
  unidade: string;
  valor_unitario: number;
  ativo: boolean;
  created_at: string;
};

type FormServico = {
  nome: string;
  descricao: string;
  unidade: string;
  valor_unitario: string;
  ativo: boolean;
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
};

const FORM_VAZIO: FormServico = {
  nome: "",
  descricao: "",
  unidade: "un",
  valor_unitario: "",
  ativo: true,
};

const UNIDADES = ["un", "m", "m²", "m³", "kg", "h", "dia", "serviço"];

function formatarMoedaDigitada(valor: string) {
  const numeros = valor.replace(/\D/g, "").slice(0, 12);

  if (!numeros) return "";

  return (Number(numeros) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function moedaParaNumero(valor: string) {
  if (!valor.trim()) return 0;

  const normalizado = valor
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  const numero = Number(normalizado);

  return Number.isFinite(numero) ? numero : 0;
}

function formatarReal(valor: number) {
  const numero = Number(valor || 0);

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(numero) ? numero : 0);
}

function normalizarBusca(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function ServicosScreen() {
  const { width } = useWindowDimensions();
  const mobile = width < 650;

  const [servicos, setServicos] = useState<Servico[]>([]);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "ativos" | "inativos">(
    "todos"
  );

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  const [redirecionandoLogin, setRedirecionandoLogin] = useState(false);
  const [acessoProNegado, setAcessoProNegado] = useState(false);

  const [modalAberto, setModalAberto] = useState(false);
  const [servicoEditando, setServicoEditando] = useState<Servico | null>(
    null
  );
  const [form, setForm] = useState<FormServico>(FORM_VAZIO);
  const [unidadesAbertas, setUnidadesAbertas] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void carregarServicos();
    }, [])
  );

  const totalAtivos = useMemo(
    () => servicos.filter((servico) => servico.ativo).length,
    [servicos]
  );

  const totalInativos = servicos.length - totalAtivos;

  const servicosFiltrados = useMemo(() => {
    const termo = normalizarBusca(busca.trim());

    return servicos.filter((servico) => {
      if (filtro === "ativos" && !servico.ativo) return false;
      if (filtro === "inativos" && servico.ativo) return false;

      if (!termo) return true;

      return [servico.nome, servico.descricao, servico.unidade]
        .filter(Boolean)
        .some((valor) =>
          normalizarBusca(String(valor)).includes(termo)
        );
    });
  }, [busca, filtro, servicos]);

  async function carregarServicos() {
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

      const { data, error } = await supabase
        .from("servicos")
        .select(
          "id, user_id, nome, descricao, unidade, valor_unitario, ativo, created_at"
        )
        .eq("user_id", user.id)
        .order("nome", { ascending: true });

      if (error) {
        console.log("Erro ao carregar serviços:", error.message);
        setErro("Não foi possível carregar seus serviços.");
        return;
      }

      setServicos((data ?? []) as Servico[]);
    } catch (error) {
      console.log("Erro inesperado ao carregar serviços:", error);
      setErro("Não foi possível carregar seus serviços.");
    } finally {
      setCarregando(false);
    }
  }

  function abrirNovoServico() {
    setServicoEditando(null);
    setForm({ ...FORM_VAZIO });
    setErro("");
    setUnidadesAbertas(false);
    setModalAberto(true);
  }

  function abrirEdicao(servico: Servico) {
    setServicoEditando(servico);

    setForm({
      nome: servico.nome || "",
      descricao: servico.descricao || "",
      unidade: servico.unidade || "un",
      valor_unitario: formatarMoedaDigitada(
        Math.round(Number(servico.valor_unitario || 0) * 100).toString()
      ),
      ativo: Boolean(servico.ativo),
    });

    setErro("");
    setUnidadesAbertas(false);
    setModalAberto(true);
  }

  function fecharModal() {
    if (salvando) return;

    setModalAberto(false);
    setServicoEditando(null);
    setForm({ ...FORM_VAZIO });
    setUnidadesAbertas(false);
    setErro("");
  }

  function atualizarCampo(
    campo: keyof FormServico,
    valor: string | boolean
  ) {
    setForm((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  }

  async function salvarServico() {
    if (salvando) return;

    const nome = form.nome.trim();
    const valor = moedaParaNumero(form.valor_unitario);

    if (!nome) {
      setErro("Informe o nome do serviço.");
      return;
    }

    if (!Number.isFinite(valor) || valor < 0) {
      setErro("Informe um valor unitário válido.");
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

      const payload = {
        user_id: user.id,
        nome,
        descricao: form.descricao.trim() || null,
        unidade: form.unidade.trim() || "un",
        valor_unitario: valor,
        ativo: form.ativo,
      };

      const resposta = servicoEditando
        ? await supabase
            .from("servicos")
            .update(payload)
            .eq("id", servicoEditando.id)
            .eq("user_id", user.id)
        : await supabase.from("servicos").insert(payload);

      if (resposta.error) {
        console.log("Erro ao salvar serviço:", resposta.error.message);
        setErro("Não foi possível salvar o serviço.");
        return;
      }

      setModalAberto(false);
      setServicoEditando(null);
      setForm({ ...FORM_VAZIO });
      setUnidadesAbertas(false);

      await carregarServicos();
    } catch (error) {
      console.log("Erro inesperado ao salvar serviço:", error);
      setErro("Não foi possível salvar o serviço.");
    } finally {
      setSalvando(false);
    }
  }

  function confirmarExclusao(servico: Servico) {
    if (excluindoId) return;

    const executar = () => void excluirServico(servico);

    if (Platform.OS === "web") {
      const confirmou =
        typeof window !== "undefined"
          ? window.confirm(`Excluir o serviço "${servico.nome}"?`)
          : false;

      if (confirmou) executar();
      return;
    }

    Alert.alert(
      "Excluir serviço",
      `Deseja realmente excluir "${servico.nome}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: executar,
        },
      ]
    );
  }

  async function excluirServico(servico: Servico) {
    if (excluindoId) return;

    try {
      setExcluindoId(servico.id);
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
        .from("servicos")
        .delete()
        .eq("id", servico.id)
        .eq("user_id", user.id);

      if (error) {
        console.log("Erro ao excluir serviço:", error.message);
        setErro("Não foi possível excluir o serviço.");
        return;
      }

      setServicos((atual) =>
        atual.filter((item) => item.id !== servico.id)
      );
    } catch (error) {
      console.log("Erro inesperado ao excluir serviço:", error);
      setErro("Não foi possível excluir o serviço.");
    } finally {
      setExcluindoId(null);
    }
  }

  if (carregando || redirecionandoLogin) {
    return (
      <SafeAreaView
        style={styles.safe}
        edges={["top", "left", "right"]}
      >
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={C.purple} />
          <Text style={styles.loadingText}>
            Carregando serviços...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (acessoProNegado) {
    return (
      <SafeAreaView
        style={styles.safe}
        edges={["top", "left", "right"]}
      >
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
              Serviços no Orvena Pro
            </Text>

            <Text style={styles.guardText}>
              Monte seu catálogo, cadastre valores e reutilize
              serviços nos seus orçamentos. Este recurso requer
              o plano Pro ou um período de teste ativo.
            </Text>

            <Pressable
              style={styles.primaryButton}
              onPress={() => router.replace("/plano" as any)}
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
              onPress={() => router.replace("/(tabs)" as any)}
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
    <SafeAreaView
      style={styles.safe}
      edges={["top", "left", "right"]}
    >
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
                onPress={() => router.replace("/(tabs)" as any)}
              >
                <Ionicons
                  name="arrow-back"
                  size={19}
                  color={C.text}
                />
              </Pressable>

              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>
                  GERENCIAMENTO
                </Text>

                <Text style={styles.pageTitle}>
                  Serviços
                </Text>

                <Text style={styles.subtitle}>
                  Seu catálogo de serviços e preços, organizado.
                </Text>
              </View>
            </View>

            <Pressable
              style={[
                styles.primaryButton,
                mobile && styles.primaryButtonMobile,
              ]}
              onPress={abrirNovoServico}
            >
              <Ionicons
                name="add"
                size={19}
                color="#FFFFFF"
              />

              <Text style={styles.primaryText}>
                NOVO SERVIÇO
              </Text>
            </Pressable>
          </View>

          {/* INDICADORES */}
          <View
            style={[
              styles.stats,
              mobile && styles.statsMobile,
            ]}
          >
            <StatCard
              icon="construct-outline"
              label="TOTAL DE SERVIÇOS"
              value={servicos.length}
              subtitle="Itens no catálogo"
            />

            <StatCard
              icon="checkmark-circle-outline"
              label="SERVIÇOS ATIVOS"
              value={totalAtivos}
              subtitle="Disponíveis para uso"
              tone="green"
            />

            <StatCard
              icon="pause-circle-outline"
              label="SERVIÇOS INATIVOS"
              value={totalInativos}
              subtitle="Mantidos no catálogo"
              tone="red"
            />
          </View>

          {/* TÍTULO DA LISTAGEM */}
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>
                SEU CATÁLOGO
              </Text>

              <Text style={styles.sectionTitle}>
                Lista de serviços
              </Text>
            </View>

            <Text style={styles.resultsText}>
              {servicosFiltrados.length}{" "}
              {servicosFiltrados.length === 1
                ? "resultado"
                : "resultados"}
            </Text>
          </View>

          {/* PAINEL */}
          <View style={styles.listPanel}>
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
                  placeholder="Buscar serviço, descrição ou unidade..."
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
                onPress={() => void carregarServicos()}
              >
                <Ionicons
                  name="refresh-outline"
                  size={19}
                  color={C.purpleLight}
                />
              </Pressable>
            </View>

            {/* FILTROS */}
            <View style={styles.filters}>
              <FilterButton
                label="Todos"
                count={servicos.length}
                selected={filtro === "todos"}
                onPress={() => setFiltro("todos")}
              />

              <FilterButton
                label="Ativos"
                count={totalAtivos}
                selected={filtro === "ativos"}
                onPress={() => setFiltro("ativos")}
              />

              <FilterButton
                label="Inativos"
                count={totalInativos}
                selected={filtro === "inativos"}
                onPress={() => setFiltro("inativos")}
              />
            </View>

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

            {servicosFiltrados.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name={
                      busca.trim()
                        ? "search-outline"
                        : "construct-outline"
                    }
                    size={28}
                    color={C.purpleLight}
                  />
                </View>

                <Text style={styles.emptyTitle}>
                  {busca.trim()
                    ? "Nenhum serviço encontrado"
                    : filtro === "ativos"
                    ? "Nenhum serviço ativo"
                    : filtro === "inativos"
                    ? "Nenhum serviço inativo"
                    : "Seu catálogo está vazio"}
                </Text>

                <Text style={styles.emptyText}>
                  {busca.trim()
                    ? "Tente pesquisar por outro nome, descrição ou unidade."
                    : filtro !== "todos"
                    ? "Selecione outro filtro para consultar os serviços cadastrados."
                    : "Cadastre serviços e valores para agilizar seus próximos orçamentos."}
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
                    onPress={abrirNovoServico}
                  >
                    <Ionicons
                      name="add"
                      size={18}
                      color="#FFFFFF"
                    />

                    <Text style={styles.emptyActionText}>
                      CADASTRAR SERVIÇO
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <View style={styles.serviceList}>
                {servicosFiltrados.map((servico) => (
                  <View
                    key={servico.id}
                    style={[
                      styles.serviceRow,
                      mobile && styles.serviceRowMobile,
                    ]}
                  >
                    <View style={styles.serviceIcon}>
                      <Ionicons
                        name="construct-outline"
                        size={22}
                        color={C.purpleLight}
                      />
                    </View>

                    <View style={styles.serviceContent}>
                      <View style={styles.serviceTop}>
                        <Text
                          style={styles.serviceName}
                          numberOfLines={2}
                        >
                          {servico.nome}
                        </Text>

                        <View
                          style={[
                            styles.statusBadge,
                            !servico.ativo &&
                              styles.statusBadgeInactive,
                          ]}
                        >
                          <View
                            style={[
                              styles.statusDot,
                              !servico.ativo &&
                                styles.statusDotInactive,
                            ]}
                          />

                          <Text
                            style={[
                              styles.statusText,
                              !servico.ativo &&
                                styles.statusTextInactive,
                            ]}
                          >
                            {servico.ativo ? "ATIVO" : "INATIVO"}
                          </Text>
                        </View>
                      </View>

                      {servico.descricao ? (
                        <Text
                          style={styles.serviceDescription}
                          numberOfLines={2}
                        >
                          {servico.descricao}
                        </Text>
                      ) : null}

                      <View style={styles.priceRow}>
                        <Text style={styles.servicePrice}>
                          {formatarReal(
                            Number(servico.valor_unitario)
                          )}
                        </Text>

                        <Text style={styles.serviceUnit}>
                          / {servico.unidade}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.rowActions,
                        mobile && styles.rowActionsMobile,
                      ]}
                    >
                      <Pressable
                        style={styles.editButton}
                        onPress={() => abrirEdicao(servico)}
                        disabled={excluindoId !== null}
                      >
                        <Ionicons
                          name="create-outline"
                          size={16}
                          color={C.purpleLight}
                        />

                        <Text style={styles.editText}>
                          Editar
                        </Text>
                      </Pressable>

                      <Pressable
                        style={styles.deleteButton}
                        onPress={() => confirmarExclusao(servico)}
                        disabled={excluindoId !== null}
                      >
                        {excluindoId === servico.id ? (
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
                    </View>
                  </View>
                ))}
              </View>
            )}

            {servicosFiltrados.length > 0 ? (
              <View style={styles.listFooter}>
                <Ionicons
                  name="checkmark-circle"
                  size={15}
                  color={C.green}
                />

                <Text style={styles.footerText}>
                  Exibindo {servicosFiltrados.length} de{" "}
                  {servicos.length}{" "}
                  {servicos.length === 1
                    ? "serviço"
                    : "serviços"}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.pageFooter}>
            ORVENA · SEU NEGÓCIO, ORGANIZADO
          </Text>
        </View>
      </ScrollView>

      {/* MODAL DE CADASTRO E EDIÇÃO */}
      <Modal
        visible={modalAberto}
        transparent
        animationType="fade"
        onRequestClose={fecharModal}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={
            Platform.OS === "ios" ? "padding" : undefined
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
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* CABEÇALHO DO MODAL */}
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderIcon}>
                  <Ionicons
                    name={
                      servicoEditando
                        ? "create-outline"
                        : "construct-outline"
                    }
                    size={22}
                    color={C.purpleLight}
                  />
                </View>

                <View style={styles.modalHeaderContent}>
                  <Text style={styles.modalEyebrow}>
                    {servicoEditando
                      ? "EDITAR CADASTRO"
                      : "NOVO CADASTRO"}
                  </Text>

                  <Text style={styles.modalTitle}>
                    {servicoEditando
                      ? "Editar serviço"
                      : "Novo serviço"}
                  </Text>

                  <Text style={styles.modalSubtitle}>
                    {servicoEditando
                      ? "Atualize as informações do serviço."
                      : "Adicione um serviço ao seu catálogo."}
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

              {/* DADOS PRINCIPAIS */}
              <View style={styles.formSection}>
                <SectionTitle
                  icon="construct-outline"
                  title="Informações do serviço"
                />

                <View style={styles.formGrid}>
                  <View style={styles.fieldFull}>
                    <Text style={styles.fieldLabel}>
                      Nome do serviço *
                    </Text>

                    <TextInput
                      value={form.nome}
                      onChangeText={(valor) =>
                        atualizarCampo("nome", valor)
                      }
                      placeholder="Ex.: Assentamento de porcelanato"
                      placeholderTextColor={C.subtle}
                      style={styles.input}
                    />
                  </View>

                  {/* UNIDADE */}
                  <View
                    style={
                      mobile
                        ? styles.fieldFull
                        : styles.fieldHalf
                    }
                  >
                    <Text style={styles.fieldLabel}>
                      Unidade
                    </Text>

                    <Pressable
                      style={styles.selectBox}
                      onPress={() =>
                        setUnidadesAbertas((atual) => !atual)
                      }
                    >
                      <View style={styles.selectContent}>
                        <Ionicons
                          name="layers-outline"
                          size={17}
                          color={C.purpleLight}
                        />

                        <Text style={styles.selectText}>
                          {form.unidade}
                        </Text>
                      </View>

                      <Ionicons
                        name={
                          unidadesAbertas
                            ? "chevron-up"
                            : "chevron-down"
                        }
                        size={17}
                        color={C.muted}
                      />
                    </Pressable>

                    {unidadesAbertas ? (
                      <View style={styles.dropdown}>
                        <ScrollView
                          style={styles.dropdownScroll}
                          nestedScrollEnabled
                          keyboardShouldPersistTaps="handled"
                        >
                          {UNIDADES.map((unidade) => (
                            <Pressable
                              key={unidade}
                              style={styles.dropdownItem}
                              onPress={() => {
                                atualizarCampo(
                                  "unidade",
                                  unidade
                                );
                                setUnidadesAbertas(false);
                              }}
                            >
                              <Text
                                style={styles.dropdownItemText}
                              >
                                {unidade}
                              </Text>

                              {form.unidade === unidade ? (
                                <Ionicons
                                  name="checkmark"
                                  size={17}
                                  color={C.purpleLight}
                                />
                              ) : null}
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    ) : null}
                  </View>

                  {/* VALOR */}
                  <View
                    style={
                      mobile
                        ? styles.fieldFull
                        : styles.fieldHalf
                    }
                  >
                    <Text style={styles.fieldLabel}>
                      Valor unitário
                    </Text>

                    <View style={styles.moneyInputBox}>
                      <Text style={styles.moneyPrefix}>
                        R$
                      </Text>

                      <TextInput
                        value={form.valor_unitario}
                        onChangeText={(valor) =>
                          atualizarCampo(
                            "valor_unitario",
                            formatarMoedaDigitada(valor)
                          )
                        }
                        placeholder="0,00"
                        placeholderTextColor={C.subtle}
                        keyboardType="number-pad"
                        style={styles.moneyInput}
                      />
                    </View>
                  </View>

                  {/* DESCRIÇÃO */}
                  <View style={styles.fieldFull}>
                    <Text style={styles.fieldLabel}>
                      Descrição
                    </Text>

                    <TextInput
                      value={form.descricao}
                      onChangeText={(valor) =>
                        atualizarCampo("descricao", valor)
                      }
                      placeholder="Descreva o que está incluído neste serviço..."
                      placeholderTextColor={C.subtle}
                      multiline
                      textAlignVertical="top"
                      style={[styles.input, styles.textArea]}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.formDivider} />

              {/* DISPONIBILIDADE */}
              <View style={styles.formSection}>
                <SectionTitle
                  icon="options-outline"
                  title="Disponibilidade"
                />

                <View style={styles.activeRow}>
                  <View style={styles.activeIcon}>
                    <Ionicons
                      name={
                        form.ativo
                          ? "checkmark-circle-outline"
                          : "pause-circle-outline"
                      }
                      size={22}
                      color={
                        form.ativo ? C.green : C.muted
                      }
                    />
                  </View>

                  <View style={styles.activeTextArea}>
                    <Text style={styles.activeTitle}>
                      Serviço ativo
                    </Text>

                    <Text style={styles.activeText}>
                      {form.ativo
                        ? "Este serviço está disponível para utilização."
                        : "O serviço continuará salvo no catálogo, mas ficará marcado como inativo."}
                    </Text>
                  </View>

                  <Switch
                    value={form.ativo}
                    onValueChange={(ativo) =>
                      atualizarCampo("ativo", ativo)
                    }
                    trackColor={{
                      false: "#343A44",
                      true: "#5A43C7",
                    }}
                    thumbColor={
                      form.ativo ? "#FFFFFF" : "#A0A5AD"
                    }
                  />
                </View>
              </View>

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
                  mobile && styles.modalActionsMobile,
                ]}
              >
                <Pressable
                  style={[
                    styles.cancelButton,
                    mobile && styles.modalActionMobile,
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
                    mobile && styles.modalActionMobile,
                    salvando && styles.disabled,
                  ]}
                  onPress={() => void salvarServico()}
                  disabled={salvando}
                >
                  {salvando ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark"
                        size={19}
                        color="#FFFFFF"
                      />

                      <Text style={styles.saveText}>
                        {servicoEditando
                          ? "SALVAR ALTERAÇÕES"
                          : "CADASTRAR SERVIÇO"}
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
}: {
  icon: IconName;
  label: string;
  value: number;
  subtitle: string;
  tone?: "purple" | "green" | "red";
}) {
  const color =
    tone === "green"
      ? C.green
      : tone === "red"
      ? C.red
      : C.purpleLight;

  const background =
    tone === "green"
      ? C.greenBg
      : tone === "red"
      ? C.redBg
      : C.purpleBg;

  return (
    <View style={styles.statCard}>
      <View
        style={[
          styles.statIcon,
          { backgroundColor: background },
        ]}
      >
        <Ionicons
          name={icon}
          size={19}
          color={color}
        />
      </View>

      <Text style={styles.statLabel}>
        {label}
      </Text>

      <Text style={styles.statValue}>
        {value}
      </Text>

      <Text style={styles.statSubtitle}>
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
      onPress={onPress}
      style={[
        styles.filterButton,
        selected && styles.filterButtonSelected,
      ]}
    >
      <Text
        style={[
          styles.filterText,
          selected && styles.filterTextSelected,
        ]}
      >
        {label}
      </Text>

      <View
        style={[
          styles.filterCount,
          selected && styles.filterCountSelected,
        ]}
      >
        <Text
          style={[
            styles.filterCountText,
            selected && styles.filterCountTextSelected,
          ]}
        >
          {count}
        </Text>
      </View>
    </Pressable>
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
    <View style={styles.formSectionHeading}>
      <Ionicons
        name={icon}
        size={17}
        color={C.purpleLight}
      />

      <Text style={styles.formSectionTitle}>
        {title}
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
    gap: 13,
    marginBottom: 30,
  },

  statsMobile: {
    flexWrap: "wrap",
  },

  statCard: {
    flex: 1,
    minWidth: 105,
    minHeight: 156,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    padding: 18,
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

  statLabel: {
    color: C.muted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.6,
  },

  statValue: {
    color: C.text,
    fontSize: 27,
    fontWeight: "900",
    marginTop: 5,
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
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 4,
  },

  filterButton: {
    minHeight: 35,
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

  filterButtonSelected: {
    borderColor: "#624BD3",
    backgroundColor: C.purpleBg,
  },

  filterText: {
    color: C.muted,
    fontSize: 11,
    fontWeight: "800",
  },

  filterTextSelected: {
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

  filterCountSelected: {
    backgroundColor: "#42346A",
  },

  filterCountText: {
    color: C.muted,
    fontSize: 10,
    fontWeight: "900",
  },

  filterCountTextSelected: {
    color: "#FFFFFF",
  },

  serviceList: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 17,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },

  serviceRowMobile: {
    flexWrap: "wrap",
    alignItems: "flex-start",
  },

  serviceIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: C.purpleBg,
    borderWidth: 1,
    borderColor: "#4E3C80",
    alignItems: "center",
    justifyContent: "center",
  },

  serviceContent: {
    flex: 1,
    minWidth: 100,
    gap: 6,
  },

  serviceTop: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },

  serviceName: {
    color: C.text,
    fontSize: 14,
    fontWeight: "900",
  },

  serviceDescription: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 17,
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 2,
  },

  servicePrice: {
    color: C.green,
    fontSize: 16,
    fontWeight: "900",
  },

  serviceUnit: {
    color: C.muted,
    fontSize: 11,
  },

  statusBadge: {
    minHeight: 23,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#315A48",
    backgroundColor: C.greenBg,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },

  statusBadgeInactive: {
    borderColor: "#53303B",
    backgroundColor: C.redBg,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.green,
  },

  statusDotInactive: {
    backgroundColor: C.red,
  },

  statusText: {
    color: C.green,
    fontSize: 9,
    fontWeight: "900",
  },

  statusTextInactive: {
    color: C.red,
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

  editButton: {
    minHeight: 37,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: C.purpleBg,
    borderWidth: 1,
    borderColor: "#453765",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  editText: {
    color: C.purpleLight,
    fontSize: 11,
    fontWeight: "800",
  },

  deleteButton: {
    width: 37,
    height: 37,
    borderRadius: 10,
    backgroundColor: C.redBg,
    borderWidth: 1,
    borderColor: "#53303B",
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
    maxWidth: 380,
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

  formSection: {
    gap: 15,
  },

  formSectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  formSectionTitle: {
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

  textArea: {
    minHeight: 105,
    paddingTop: 13,
  },

  selectBox: {
    width: "100%",
    minHeight: 47,
    borderRadius: 12,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  selectContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  selectText: {
    color: C.text,
    fontSize: 12,
  },

  dropdown: {
    width: "100%",
    maxHeight: 235,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.surface2,
    overflow: "hidden",
    marginTop: 2,
  },

  dropdownScroll: {
    maxHeight: 230,
  },

  dropdownItem: {
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  dropdownItemText: {
    color: C.text,
    fontSize: 12,
  },

  moneyInputBox: {
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

  activeRow: {
    width: "100%",
    minHeight: 78,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  activeIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.surface2,
    alignItems: "center",
    justifyContent: "center",
  },

  activeTextArea: {
    flex: 1,
  },

  activeTitle: {
    color: C.text,
    fontSize: 12,
    fontWeight: "900",
  },

  activeText: {
    color: C.muted,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 4,
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