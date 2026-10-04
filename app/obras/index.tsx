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

type ClienteOption = {
  id: string;
  nome: string;
};

type Obra = {
  id: string;
  user_id: string;
  cliente_id: string | null;
  nome: string;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  status: string;
  data_inicio: string | null;
  data_previsao: string | null;
  observacoes: string | null;
  created_at: string;
  clientes?: { nome: string | null } | null;
};

type FormObra = {
  nome: string;
  cliente_id: string;
  endereco: string;
  cidade: string;
  estado: string;
  status: string;
  data_inicio: string;
  data_previsao: string;
  observacoes: string;
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
  orange: "#FFCA82",
  orangeBg: "#392C1C",
  red: "#FF8897",
  redBg: "#311D27",
  blue: "#88B8FF",
  blueBg: "#1B2A43",
};

const FORM_VAZIO: FormObra = {
  nome: "",
  cliente_id: "",
  endereco: "",
  cidade: "",
  estado: "",
  status: "planejada",
  data_inicio: "",
  data_previsao: "",
  observacoes: "",
};

const STATUS = [
  { value: "planejada", label: "Planejada" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "pausada", label: "Pausada" },
  { value: "concluida", label: "Concluída" },
];

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

  if (partes.length !== 3) return null;

  const [diaTexto, mesTexto, anoTexto] = partes;

  if (
    diaTexto.length !== 2 ||
    mesTexto.length !== 2 ||
    anoTexto.length !== 4
  ) {
    return null;
  }

  const dia = Number(diaTexto);
  const mes = Number(mesTexto);
  const ano = Number(anoTexto);

  if (
    !Number.isInteger(dia) ||
    !Number.isInteger(mes) ||
    !Number.isInteger(ano) ||
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

  const [ano, mes, dia] = valor.split("-");

  return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor;
}

function statusLabel(valor: string) {
  return STATUS.find((item) => item.value === valor)?.label || valor;
}

function corStatus(valor: string) {
  switch (valor) {
    case "em_andamento":
      return {
        color: C.blue,
        background: C.blueBg,
        border: "#344F75",
        icon: "construct-outline" as IconName,
      };

    case "concluida":
      return {
        color: C.green,
        background: C.greenBg,
        border: "#315A48",
        icon: "checkmark-circle-outline" as IconName,
      };

    case "pausada":
      return {
        color: C.orange,
        background: C.orangeBg,
        border: "#665035",
        icon: "pause-circle-outline" as IconName,
      };

    default:
      return {
        color: C.purpleLight,
        background: C.purpleBg,
        border: "#493B71",
        icon: "calendar-outline" as IconName,
      };
  }
}

function normalizarBusca(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function ObrasScreen() {
  const { width } = useWindowDimensions();

  const mobile = width < 650;

  const [obras, setObras] = useState<Obra[]>([]);
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [busca, setBusca] = useState("");

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  const [erro, setErro] = useState("");
  const [redirecionandoLogin, setRedirecionandoLogin] = useState(false);
  const [acessoProNegado, setAcessoProNegado] = useState(false);

  const [modalAberto, setModalAberto] = useState(false);
  const [obraEditando, setObraEditando] = useState<Obra | null>(null);
  const [form, setForm] = useState<FormObra>(FORM_VAZIO);

  const [statusAberto, setStatusAberto] = useState(false);
  const [clienteAberto, setClienteAberto] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void carregarTudo();
    }, [])
  );

  const obrasFiltradas = useMemo(() => {
    const termo = normalizarBusca(busca.trim());

    if (!termo) return obras;

    return obras.filter((obra) =>
      [
        obra.nome,
        obra.endereco,
        obra.cidade,
        obra.estado,
        obra.clientes?.nome,
        statusLabel(obra.status),
      ]
        .filter(Boolean)
        .some((valor) =>
          normalizarBusca(String(valor)).includes(termo)
        )
    );
  }, [busca, obras]);

  const totalAndamento = useMemo(
    () =>
      obras.filter(
        (obra) => obra.status === "em_andamento"
      ).length,
    [obras]
  );

  const totalConcluidas = useMemo(
    () =>
      obras.filter(
        (obra) => obra.status === "concluida"
      ).length,
    [obras]
  );

  const totalPlanejadas = useMemo(
    () =>
      obras.filter(
        (obra) => obra.status === "planejada"
      ).length,
    [obras]
  );

  async function carregarTudo() {
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

      const [obrasResult, clientesResult] = await Promise.all([
        supabase
          .from("obras")
          .select(
            "id, user_id, cliente_id, nome, endereco, cidade, estado, status, data_inicio, data_previsao, observacoes, created_at, clientes(nome)"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("clientes")
          .select("id, nome")
          .eq("user_id", user.id)
          .order("nome", { ascending: true }),
      ]);

      if (obrasResult.error) {
        console.log(
          "Erro ao carregar obras:",
          obrasResult.error.message
        );

        setErro("Não foi possível carregar suas obras.");
      } else {
        setObras(
          (obrasResult.data ?? []) as unknown as Obra[]
        );
      }

      if (clientesResult.error) {
        console.log(
          "Erro ao carregar clientes das obras:",
          clientesResult.error.message
        );

        setErro(
          "Não foi possível carregar a lista de clientes. Tente atualizar."
        );
      } else {
        setClientes(
          (clientesResult.data ?? []) as ClienteOption[]
        );
      }
    } catch (error) {
      console.log("Erro ao carregar obras:", error);
      setErro("Não foi possível carregar suas obras.");
    } finally {
      setCarregando(false);
    }
  }

  function atualizarCampo(
    campo: keyof FormObra,
    valor: string
  ) {
    setForm((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  }

  function abrirNovaObra() {
    setObraEditando(null);
    setForm({ ...FORM_VAZIO });
    setErro("");
    setStatusAberto(false);
    setClienteAberto(false);
    setModalAberto(true);
  }

  function abrirEdicao(obra: Obra) {
    setObraEditando(obra);

    setForm({
      nome: obra.nome || "",
      cliente_id: obra.cliente_id || "",
      endereco: obra.endereco || "",
      cidade: obra.cidade || "",
      estado: obra.estado || "",
      status: obra.status || "planejada",
      data_inicio: isoParaBr(obra.data_inicio),
      data_previsao: isoParaBr(obra.data_previsao),
      observacoes: obra.observacoes || "",
    });

    setErro("");
    setStatusAberto(false);
    setClienteAberto(false);
    setModalAberto(true);
  }

  function fecharModal() {
    if (salvando) return;

    setModalAberto(false);
    setObraEditando(null);
    setForm({ ...FORM_VAZIO });
    setStatusAberto(false);
    setClienteAberto(false);
    setErro("");
  }

  async function salvarObra() {
    if (salvando) return;

    if (!form.nome.trim()) {
      setErro("Informe o nome da obra.");
      return;
    }

    const inicioIso = form.data_inicio.trim()
      ? dataBrParaIso(form.data_inicio.trim())
      : null;

    const previsaoIso = form.data_previsao.trim()
      ? dataBrParaIso(form.data_previsao.trim())
      : null;

    if (form.data_inicio.trim() && !inicioIso) {
      setErro(
        "Informe uma data de início válida no formato DD/MM/AAAA."
      );
      return;
    }

    if (form.data_previsao.trim() && !previsaoIso) {
      setErro(
        "Informe uma previsão válida no formato DD/MM/AAAA."
      );
      return;
    }

    if (
      inicioIso &&
      previsaoIso &&
      previsaoIso < inicioIso
    ) {
      setErro(
        "A previsão de conclusão não pode ser anterior à data de início."
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

      const payload = {
        user_id: user.id,
        cliente_id: form.cliente_id || null,
        nome: form.nome.trim(),
        endereco: form.endereco.trim() || null,
        cidade: form.cidade.trim() || null,
        estado: form.estado.trim().toUpperCase() || null,
        status: form.status,
        data_inicio: inicioIso,
        data_previsao: previsaoIso,
        observacoes: form.observacoes.trim() || null,
      };

      const resposta = obraEditando
        ? await supabase
            .from("obras")
            .update(payload)
            .eq("id", obraEditando.id)
            .eq("user_id", user.id)
        : await supabase
            .from("obras")
            .insert(payload);

      if (resposta.error) {
        console.log(
          "Erro ao salvar obra:",
          resposta.error.message
        );

        setErro("Não foi possível salvar a obra.");
        return;
      }

      setModalAberto(false);
      setObraEditando(null);
      setForm({ ...FORM_VAZIO });

      await carregarTudo();
    } catch (error) {
      console.log("Erro ao salvar obra:", error);
      setErro("Não foi possível salvar a obra.");
    } finally {
      setSalvando(false);
    }
  }

  function confirmarExclusao(obra: Obra) {
    if (excluindoId) return;

    const executar = () => void excluirObra(obra);

    if (Platform.OS === "web") {
      const confirmou =
        typeof window !== "undefined"
          ? window.confirm(
              `Excluir permanentemente a obra "${obra.nome}"?`
            )
          : false;

      if (confirmou) executar();

      return;
    }

    Alert.alert(
      "Excluir obra",
      `Deseja realmente excluir "${obra.nome}"?`,
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

  async function excluirObra(obra: Obra) {
    if (excluindoId) return;

    try {
      setExcluindoId(obra.id);
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
        .from("obras")
        .delete()
        .eq("id", obra.id)
        .eq("user_id", user.id);

      if (error) {
        console.log(
          "Erro ao excluir obra:",
          error.message
        );

        setErro("Não foi possível excluir a obra.");
        return;
      }

      setObras((atual) =>
        atual.filter((item) => item.id !== obra.id)
      );
    } catch (error) {
      console.log("Erro inesperado ao excluir obra:", error);
      setErro("Não foi possível excluir a obra.");
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
          <ActivityIndicator
            size="large"
            color={C.purple}
          />

          <Text style={styles.loadingText}>
            Carregando suas obras...
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
              Obras no Orvena Pro
            </Text>

            <Text style={styles.guardText}>
              Organize suas obras, vincule clientes e acompanhe
              cada projeto. Este recurso requer o plano Pro
              ou um período de teste ativo.
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
                  GERENCIAMENTO
                </Text>

                <Text style={styles.pageTitle}>
                  Obras
                </Text>

                <Text style={styles.subtitle}>
                  Seus projetos, do planejamento à entrega.
                </Text>
              </View>
            </View>

            <Pressable
              style={[
                styles.primaryButton,
                mobile && styles.primaryButtonMobile,
              ]}
              onPress={abrirNovaObra}
            >
              <Ionicons
                name="add"
                size={19}
                color="#FFFFFF"
              />

              <Text style={styles.primaryText}>
                NOVA OBRA
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
              icon="business-outline"
              label="TOTAL DE OBRAS"
              value={obras.length}
              subtitle="Projetos cadastrados"
            />

            <StatCard
              icon="construct-outline"
              label="EM ANDAMENTO"
              value={totalAndamento}
              subtitle="Obras em execução"
            />

            <StatCard
              icon="checkmark-circle-outline"
              label="CONCLUÍDAS"
              value={totalConcluidas}
              subtitle="Projetos finalizados"
            />

            <StatCard
              icon="calendar-outline"
              label="PLANEJADAS"
              value={totalPlanejadas}
              subtitle="Aguardando início"
            />
          </View>

          {/* CABEÇALHO DA LISTA */}

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>
                SEUS PROJETOS
              </Text>

              <Text style={styles.sectionTitle}>
                Lista de obras
              </Text>
            </View>

            <Text style={styles.resultsText}>
              {obrasFiltradas.length}{" "}
              {obrasFiltradas.length === 1
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
                  placeholder="Buscar obra, cliente, cidade ou status..."
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
                onPress={() => void carregarTudo()}
              >
                <Ionicons
                  name="refresh-outline"
                  size={19}
                  color={C.purpleLight}
                />
              </Pressable>
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

            {obrasFiltradas.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name={
                      busca.trim()
                        ? "search-outline"
                        : "business-outline"
                    }
                    size={28}
                    color={C.purpleLight}
                  />
                </View>

                <Text style={styles.emptyTitle}>
                  {busca.trim()
                    ? "Nenhuma obra encontrada"
                    : "Sua lista de obras está vazia"}
                </Text>

                <Text style={styles.emptyText}>
                  {busca.trim()
                    ? "Tente pesquisar por outro nome, cliente, cidade ou status."
                    : "Cadastre sua primeira obra para acompanhar o andamento dos seus projetos."}
                </Text>

                {busca.trim() ? (
                  <Pressable
                    style={styles.emptyAction}
                    onPress={() => setBusca("")}
                  >
                    <Text style={styles.emptyActionText}>
                      LIMPAR BUSCA
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={styles.emptyAction}
                    onPress={abrirNovaObra}
                  >
                    <Ionicons
                      name="add"
                      size={18}
                      color="#FFFFFF"
                    />

                    <Text style={styles.emptyActionText}>
                      CADASTRAR OBRA
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <View style={styles.obrasList}>
                {obrasFiltradas.map((obra) => {
                  const statusVisual = corStatus(
                    obra.status
                  );

                  return (
                    <View
                      key={obra.id}
                      style={[
                        styles.obraRow,
                        mobile && styles.obraRowMobile,
                      ]}
                    >
                      <View style={styles.obraIcon}>
                        <Ionicons
                          name="business-outline"
                          size={22}
                          color={C.purpleLight}
                        />
                      </View>

                      <View style={styles.obraContent}>
                        <View style={styles.obraTop}>
                          <Text
                            style={styles.obraName}
                            numberOfLines={2}
                          >
                            {obra.nome}
                          </Text>

                          <View
                            style={[
                              styles.statusBadge,
                              {
                                backgroundColor:
                                  statusVisual.background,
                                borderColor:
                                  statusVisual.border,
                              },
                            ]}
                          >
                            <Ionicons
                              name={statusVisual.icon}
                              size={12}
                              color={statusVisual.color}
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
                              {statusLabel(
                                obra.status
                              ).toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        {obra.clientes?.nome ? (
                          <DetailLine
                            icon="person-outline"
                            value={
                              obra.clientes.nome
                            }
                          />
                        ) : null}

                        {obra.endereco ? (
                          <DetailLine
                            icon="location-outline"
                            value={obra.endereco}
                          />
                        ) : null}

                        {obra.cidade ||
                        obra.estado ? (
                          <DetailLine
                            icon="navigate-outline"
                            value={[
                              obra.cidade,
                              obra.estado,
                            ]
                              .filter(Boolean)
                              .join(" - ")}
                          />
                        ) : null}

                        {obra.data_inicio ? (
                          <DetailLine
                            icon="calendar-outline"
                            value={`Início: ${isoParaBr(
                              obra.data_inicio
                            )}`}
                          />
                        ) : null}

                        {obra.data_previsao ? (
                          <DetailLine
                            icon="time-outline"
                            value={`Previsão: ${isoParaBr(
                              obra.data_previsao
                            )}`}
                          />
                        ) : null}

                        {!obra.clientes?.nome &&
                        !obra.endereco &&
                        !obra.cidade &&
                        !obra.estado &&
                        !obra.data_inicio &&
                        !obra.data_previsao ? (
                          <Text
                            style={styles.noDetails}
                          >
                            Sem informações adicionais
                          </Text>
                        ) : null}
                      </View>

                      <View
                        style={[
                          styles.rowActions,
                          mobile &&
                            styles.rowActionsMobile,
                        ]}
                      >
                        <Pressable
                          style={styles.editButton}
                          onPress={() =>
                            abrirEdicao(obra)
                          }
                          disabled={
                            excluindoId !== null
                          }
                        >
                          <Ionicons
                            name="create-outline"
                            size={16}
                            color={C.purpleLight}
                          />

                          <Text
                            style={styles.editText}
                          >
                            Editar
                          </Text>
                        </Pressable>

                        <Pressable
                          style={styles.deleteButton}
                          onPress={() =>
                            confirmarExclusao(obra)
                          }
                          disabled={
                            excluindoId !== null
                          }
                        >
                          {excluindoId ===
                          obra.id ? (
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
                  );
                })}
              </View>
            )}

            {obrasFiltradas.length > 0 ? (
              <View style={styles.listFooter}>
                <Ionicons
                  name="checkmark-circle"
                  size={15}
                  color={C.green}
                />

                <Text
                  style={styles.footerText}
                >
                  Exibindo{" "}
                  {obrasFiltradas.length} de{" "}
                  {obras.length}{" "}
                  {obras.length === 1
                    ? "obra"
                    : "obras"}
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
              contentContainerStyle={
                styles.modalScroll
              }
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalHeader}>
                <View
                  style={styles.modalHeaderIcon}
                >
                  <Ionicons
                    name={
                      obraEditando
                        ? "create-outline"
                        : "business-outline"
                    }
                    size={22}
                    color={C.purpleLight}
                  />
                </View>

                <View
                  style={
                    styles.modalHeaderContent
                  }
                >
                  <Text
                    style={
                      styles.modalEyebrow
                    }
                  >
                    {obraEditando
                      ? "EDITAR PROJETO"
                      : "NOVO PROJETO"}
                  </Text>

                  <Text
                    style={styles.modalTitle}
                  >
                    {obraEditando
                      ? "Editar obra"
                      : "Nova obra"}
                  </Text>

                  <Text
                    style={
                      styles.modalSubtitle
                    }
                  >
                    {obraEditando
                      ? "Atualize as informações do projeto."
                      : "Preencha os dados para cadastrar uma obra."}
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

              {/* INFORMAÇÕES PRINCIPAIS */}

              <View
                style={styles.formSection}
              >
                <SectionTitle
                  icon="business-outline"
                  title="Informações principais"
                />

                <View style={styles.formGrid}>
                  <Campo
                    label="Nome da obra *"
                    value={form.nome}
                    onChangeText={(valor) =>
                      atualizarCampo(
                        "nome",
                        valor
                      )
                    }
                    placeholder="Ex.: Reforma apartamento 302"
                    full
                  />

                  {/* CLIENTE */}

                  <View
                    style={
                      styles.fieldFull
                    }
                  >
                    <Text
                      style={
                        styles.fieldLabel
                      }
                    >
                      Cliente vinculado
                    </Text>

                    <Pressable
                      style={
                        styles.selectBox
                      }
                      onPress={() => {
                        setClienteAberto(
                          (atual) => !atual
                        );
                        setStatusAberto(false);
                      }}
                    >
                      <View
                        style={
                          styles.selectContent
                        }
                      >
                        <Ionicons
                          name="person-outline"
                          size={17}
                          color={
                            C.purpleLight
                          }
                        />

                        <Text
                          style={[
                            styles.selectText,
                            !form.cliente_id &&
                              styles.selectPlaceholder,
                          ]}
                          numberOfLines={1}
                        >
                          {clientes.find(
                            (cliente) =>
                              cliente.id ===
                              form.cliente_id
                          )?.nome ||
                            "Selecionar cliente"}
                        </Text>
                      </View>

                      <Ionicons
                        name={
                          clienteAberto
                            ? "chevron-up"
                            : "chevron-down"
                        }
                        size={17}
                        color={C.muted}
                      />
                    </Pressable>

                    {clienteAberto ? (
                      <View
                        style={
                          styles.dropdown
                        }
                      >
                        <ScrollView
                          nestedScrollEnabled
                          style={
                            styles.dropdownScroll
                          }
                          keyboardShouldPersistTaps="handled"
                        >
                          <Pressable
                            style={
                              styles.dropdownItem
                            }
                            onPress={() => {
                              atualizarCampo(
                                "cliente_id",
                                ""
                              );
                              setClienteAberto(
                                false
                              );
                            }}
                          >
                            <Text
                              style={
                                styles.dropdownItemText
                              }
                            >
                              Sem cliente
                            </Text>
                          </Pressable>

                          {clientes.map(
                            (cliente) => (
                              <Pressable
                                key={
                                  cliente.id
                                }
                                style={
                                  styles.dropdownItem
                                }
                                onPress={() => {
                                  atualizarCampo(
                                    "cliente_id",
                                    cliente.id
                                  );
                                  setClienteAberto(
                                    false
                                  );
                                }}
                              >
                                <Text
                                  style={
                                    styles.dropdownItemText
                                  }
                                >
                                  {
                                    cliente.nome
                                  }
                                </Text>

                                {form.cliente_id ===
                                cliente.id ? (
                                  <Ionicons
                                    name="checkmark"
                                    size={17}
                                    color={
                                      C.purpleLight
                                    }
                                  />
                                ) : null}
                              </Pressable>
                            )
                          )}
                        </ScrollView>
                      </View>
                    ) : null}
                  </View>

                  {/* STATUS */}

                  <View
                    style={
                      styles.fieldFull
                    }
                  >
                    <Text
                      style={
                        styles.fieldLabel
                      }
                    >
                      Status da obra
                    </Text>

                    <Pressable
                      style={
                        styles.selectBox
                      }
                      onPress={() => {
                        setStatusAberto(
                          (atual) => !atual
                        );
                        setClienteAberto(false);
                      }}
                    >
                      <View
                        style={
                          styles.selectContent
                        }
                      >
                        <Ionicons
                          name={
                            corStatus(
                              form.status
                            ).icon
                          }
                          size={17}
                          color={
                            corStatus(
                              form.status
                            ).color
                          }
                        />

                        <Text
                          style={
                            styles.selectText
                          }
                        >
                          {statusLabel(
                            form.status
                          )}
                        </Text>
                      </View>

                      <Ionicons
                        name={
                          statusAberto
                            ? "chevron-up"
                            : "chevron-down"
                        }
                        size={17}
                        color={C.muted}
                      />
                    </Pressable>

                    {statusAberto ? (
                      <View
                        style={
                          styles.dropdown
                        }
                      >
                        {STATUS.map(
                          (item) => (
                            <Pressable
                              key={
                                item.value
                              }
                              style={
                                styles.dropdownItem
                              }
                              onPress={() => {
                                atualizarCampo(
                                  "status",
                                  item.value
                                );
                                setStatusAberto(
                                  false
                                );
                              }}
                            >
                              <View
                                style={
                                  styles.selectContent
                                }
                              >
                                <Ionicons
                                  name={
                                    corStatus(
                                      item.value
                                    ).icon
                                  }
                                  size={16}
                                  color={
                                    corStatus(
                                      item.value
                                    ).color
                                  }
                                />

                                <Text
                                  style={
                                    styles.dropdownItemText
                                  }
                                >
                                  {
                                    item.label
                                  }
                                </Text>
                              </View>

                              {form.status ===
                              item.value ? (
                                <Ionicons
                                  name="checkmark"
                                  size={17}
                                  color={
                                    C.purpleLight
                                  }
                                />
                              ) : null}
                            </Pressable>
                          )
                        )}
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>

              <View
                style={styles.formDivider}
              />

              {/* LOCALIZAÇÃO */}

              <View
                style={styles.formSection}
              >
                <SectionTitle
                  icon="location-outline"
                  title="Localização da obra"
                />

                <View style={styles.formGrid}>
                  <Campo
                    label="Endereço"
                    value={form.endereco}
                    onChangeText={(valor) =>
                      atualizarCampo(
                        "endereco",
                        valor
                      )
                    }
                    placeholder="Rua, número e bairro"
                    full
                  />

                  <Campo
                    label="Cidade"
                    value={form.cidade}
                    onChangeText={(valor) =>
                      atualizarCampo(
                        "cidade",
                        valor
                      )
                    }
                    placeholder="Cidade"
                    full={mobile}
                  />

                  <Campo
                    label="UF"
                    value={form.estado}
                    onChangeText={(valor) =>
                      atualizarCampo(
                        "estado",
                        valor
                          .replace(
                            /[^a-zA-Z]/g,
                            ""
                          )
                          .slice(0, 2)
                          .toUpperCase()
                      )
                    }
                    placeholder="PE"
                    maxLength={2}
                    full={mobile}
                  />
                </View>
              </View>

              <View
                style={styles.formDivider}
              />

              {/* PRAZOS */}

              <View
                style={styles.formSection}
              >
                <SectionTitle
                  icon="calendar-outline"
                  title="Prazos e datas"
                />

                <View style={styles.formGrid}>
                  <Campo
                    label="Data de início"
                    value={
                      form.data_inicio
                    }
                    onChangeText={(valor) =>
                      atualizarCampo(
                        "data_inicio",
                        formatarDataDigitada(
                          valor
                        )
                      )
                    }
                    placeholder="DD/MM/AAAA"
                    keyboardType="number-pad"
                    maxLength={10}
                    full={mobile}
                  />

                  <Campo
                    label="Previsão de conclusão"
                    value={
                      form.data_previsao
                    }
                    onChangeText={(valor) =>
                      atualizarCampo(
                        "data_previsao",
                        formatarDataDigitada(
                          valor
                        )
                      )
                    }
                    placeholder="DD/MM/AAAA"
                    keyboardType="number-pad"
                    maxLength={10}
                    full={mobile}
                  />
                </View>
              </View>

              <View
                style={styles.formDivider}
              />

              {/* OBSERVAÇÕES */}

              <View
                style={styles.formSection}
              >
                <SectionTitle
                  icon="document-text-outline"
                  title="Informações adicionais"
                />

                <View
                  style={styles.fieldFull}
                >
                  <Text
                    style={styles.fieldLabel}
                  >
                    Observações
                  </Text>

                  <TextInput
                    value={
                      form.observacoes
                    }
                    onChangeText={(valor) =>
                      atualizarCampo(
                        "observacoes",
                        valor
                      )
                    }
                    placeholder="Anotações importantes sobre a obra..."
                    placeholderTextColor={
                      C.subtle
                    }
                    multiline
                    textAlignVertical="top"
                    style={[
                      styles.input,
                      styles.textArea,
                    ]}
                  />
                </View>
              </View>

              {erro ? (
                <View
                  style={styles.modalError}
                >
                  <Ionicons
                    name="alert-circle-outline"
                    size={18}
                    color={C.red}
                  />

                  <Text
                    style={styles.errorText}
                  >
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
                  <Text
                    style={styles.cancelText}
                  >
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
                    void salvarObra()
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

                      <Text
                        style={styles.saveText}
                      >
                        {obraEditando
                          ? "SALVAR ALTERAÇÕES"
                          : "CADASTRAR OBRA"}
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
}: {
  icon: IconName;
  label: string;
  value: number;
  subtitle: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <Ionicons
          name={icon}
          size={19}
          color={C.purpleLight}
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
    <View style={styles.formSectionHeading}>
      <Ionicons
        name={icon}
        size={17}
        color={C.purpleLight}
      />

      <Text
        style={styles.formSectionTitle}
      >
        {title}
      </Text>
    </View>
  );
}

function Campo({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  maxLength,
  full,
}: {
  label: string;
  value: string;
  onChangeText: (valor: string) => void;
  placeholder: string;
  keyboardType?:
    | "default"
    | "number-pad";
  maxLength?: number;
  full?: boolean;
}) {
  return (
    <View
      style={
        full
          ? styles.fieldFull
          : styles.fieldHalf
      }
    >
      <Text style={styles.fieldLabel}>
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={
          C.subtle
        }
        keyboardType={keyboardType}
        maxLength={maxLength}
        style={styles.input}
      />
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

  obrasList: {
    paddingHorizontal: 16,
  },

  obraRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 17,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },

  obraRowMobile: {
    flexWrap: "wrap",
    alignItems: "flex-start",
  },

  obraIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: C.purpleBg,
    borderWidth: 1,
    borderColor: "#4E3C80",
    alignItems: "center",
    justifyContent: "center",
  },

  obraContent: {
    flex: 1,
    minWidth: 100,
    gap: 5,
  },

  obraTop: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 3,
  },

  obraName: {
    color: C.text,
    fontSize: 14,
    fontWeight: "900",
  },

  statusBadge: {
    minHeight: 24,
    paddingHorizontal: 9,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
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

  noDetails: {
    color: C.subtle,
    fontSize: 11,
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
    minWidth: 0,
  },

  selectText: {
    color: C.text,
    fontSize: 12,
    flexShrink: 1,
  },

  selectPlaceholder: {
    color: C.subtle,
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
    flexShrink: 1,
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