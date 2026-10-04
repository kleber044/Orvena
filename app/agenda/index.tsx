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
type StatusEvento = "pendente" | "concluido" | "cancelado";
type Filtro = "proximos" | "todos" | "concluidos";

type Evento = {
  id: string;
  titulo: string;
  descricao: string | null;
  data_evento: string;
  hora_evento: string | null;
  tipo: string;
  status: StatusEvento;
  cliente_id: string | null;
  obra_id: string | null;
  orcamento_id: string | null;
  origem: "manual" | "obra_inicio" | "obra_previsao";
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

type FormEvento = {
  titulo: string;
  descricao: string;
  data_evento: string;
  hora_evento: string;
  tipo: string;
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
  yellow: "#F3C77E",
  yellowBg: "#34291B",
  red: "#FF8897",
  redBg: "#311D27",
  blue: "#88B8FF",
  blueBg: "#1B2A43",
};

const FORM_VAZIO: FormEvento = {
  titulo: "",
  descricao: "",
  data_evento: "",
  hora_evento: "",
  tipo: "compromisso",
  cliente_id: null,
  obra_id: null,
};

const TIPOS = [
  { value: "compromisso", label: "Compromisso", icon: "calendar-outline" },
  { value: "visita", label: "Visita", icon: "location-outline" },
  { value: "reuniao", label: "Reunião", icon: "people-outline" },
] as const;

function hojeISO() {
  const data = new Date();

  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function isoParaBr(valor: string) {
  if (!valor) return "";

  const [ano, mes, dia] = valor.slice(0, 10).split("-");

  return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor;
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

function formatarDataDigitada(valor: string) {
  const numeros = valor.replace(/\D/g, "").slice(0, 8);

  if (numeros.length <= 2) return numeros;

  if (numeros.length <= 4) {
    return `${numeros.slice(0, 2)}/${numeros.slice(2)}`;
  }

  return `${numeros.slice(0, 2)}/${numeros.slice(2, 4)}/${numeros.slice(4)}`;
}

function formatarHoraDigitada(valor: string) {
  const numeros = valor.replace(/\D/g, "").slice(0, 4);

  if (numeros.length <= 2) return numeros;

  return `${numeros.slice(0, 2)}:${numeros.slice(2)}`;
}

function formatarDataExibicao(valor: string) {
  const data = new Date(`${valor}T12:00:00`);

  if (Number.isNaN(data.getTime())) return valor;

  return data.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function obterDia(valor: string) {
  return valor.slice(8, 10) || "--";
}

function obterMes(valor: string) {
  const data = new Date(`${valor}T12:00:00`);

  if (Number.isNaN(data.getTime())) return "---";

  return data
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "")
    .toUpperCase();
}

function coresStatus(status: StatusEvento) {
  if (status === "concluido") {
    return {
      color: C.green,
      background: C.greenBg,
      border: "#315A48",
      label: "CONCLUÍDO",
    };
  }

  if (status === "cancelado") {
    return {
      color: C.red,
      background: C.redBg,
      border: "#53303B",
      label: "CANCELADO",
    };
  }

  return {
    color: C.yellow,
    background: C.yellowBg,
    border: "#665035",
    label: "PENDENTE",
  };
}

function tipoEvento(tipo: string) {
  if (tipo === "visita") {
    return {
      label: "VISITA",
      icon: "location-outline" as IconName,
    };
  }

  if (tipo === "reuniao") {
    return {
      label: "REUNIÃO",
      icon: "people-outline" as IconName,
    };
  }

  if (tipo === "obra_inicio") {
    return {
      label: "INÍCIO DE OBRA",
      icon: "business-outline" as IconName,
    };
  }

  if (tipo === "obra_previsao") {
    return {
      label: "PREVISÃO DE OBRA",
      icon: "construct-outline" as IconName,
    };
  }

  return {
    label: tipo === "compromisso"
      ? "COMPROMISSO"
      : tipo.replace(/_/g, " ").toUpperCase(),
    icon: "calendar-outline" as IconName,
  };
}

export default function AgendaScreen() {
  const { width } = useWindowDimensions();
  const mobile = width < 650;

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [alterandoId, setAlterandoId] = useState<string | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  const [erro, setErro] = useState("");
  const [redirecionandoLogin, setRedirecionandoLogin] = useState(false);
  const [acessoProNegado, setAcessoProNegado] = useState(false);

  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState<FormEvento>(FORM_VAZIO);

  const [filtro, setFiltro] = useState<Filtro>("proximos");

  const hoje = hojeISO();

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

      const [agendaResult, clientesResult, obrasResult] =
        await Promise.all([
          supabase
            .from("agenda_eventos")
            .select(
              "id, titulo, descricao, data_evento, hora_evento, tipo, status, cliente_id, obra_id, orcamento_id, origem, clientes(nome), obras(nome)"
            )
            .eq("user_id", user.id)
            .order("data_evento", { ascending: true })
            .order("hora_evento", { ascending: true }),

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

      if (agendaResult.error) {
        console.log(
          "Erro ao carregar agenda:",
          agendaResult.error.message
        );

        setErro("Não foi possível carregar sua agenda.");
        return;
      }

      setEventos(
        (agendaResult.data ?? []) as unknown as Evento[]
      );

      if (clientesResult.error) {
        console.log(
          "Erro ao carregar clientes:",
          clientesResult.error.message
        );
      } else {
        setClientes((clientesResult.data ?? []) as Cliente[]);
      }

      if (obrasResult.error) {
        console.log(
          "Erro ao carregar obras:",
          obrasResult.error.message
        );
      } else {
        setObras((obrasResult.data ?? []) as Obra[]);
      }
    } catch (error) {
      console.log("Erro inesperado na agenda:", error);
      setErro("Não foi possível carregar sua agenda.");
    } finally {
      setCarregando(false);
    }
  }

  const resumo = useMemo(() => {
    return {
      hoje: eventos.filter(
        (evento) =>
          evento.data_evento === hoje &&
          evento.status === "pendente"
      ).length,

      proximos: eventos.filter(
        (evento) =>
          evento.data_evento > hoje &&
          evento.status === "pendente"
      ).length,

      concluidos: eventos.filter(
        (evento) => evento.status === "concluido"
      ).length,

      atrasados: eventos.filter(
        (evento) =>
          evento.data_evento < hoje &&
          evento.status === "pendente"
      ).length,
    };
  }, [eventos, hoje]);

  const eventosFiltrados = useMemo(() => {
    if (filtro === "concluidos") {
      return eventos.filter(
        (evento) => evento.status === "concluido"
      );
    }

    if (filtro === "proximos") {
      return eventos.filter(
        (evento) =>
          evento.status === "pendente" &&
          evento.data_evento >= hoje
      );
    }

    return eventos;
  }, [eventos, filtro, hoje]);

  const obrasDisponiveis = useMemo(() => {
    if (!form.cliente_id) return obras;

    return obras.filter(
      (obra) =>
        !obra.cliente_id ||
        obra.cliente_id === form.cliente_id
    );
  }, [obras, form.cliente_id]);

  function atualizarCampo(
    campo: keyof FormEvento,
    valor: string | null
  ) {
    setForm((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  }

  function abrirNovo() {
    setForm({
      ...FORM_VAZIO,
      data_evento: isoParaBr(hojeISO()),
    });

    setErro("");
    setModalAberto(true);
  }

  function fecharModal() {
    if (salvando) return;

    setModalAberto(false);
    setForm({ ...FORM_VAZIO });
    setErro("");
  }

  async function salvarEvento() {
    if (salvando) return;

    const titulo = form.titulo.trim();

    if (!titulo) {
      setErro("Informe o título do compromisso.");
      return;
    }

    const dataISO = dataBrParaIso(form.data_evento.trim());

    if (!dataISO) {
      setErro(
        "Informe uma data válida no formato DD/MM/AAAA."
      );
      return;
    }

    const hora = form.hora_evento.trim();

    if (
      hora &&
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)
    ) {
      setErro("Informe a hora no formato HH:MM.");
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
        .from("agenda_eventos")
        .insert({
          user_id: user.id,
          titulo,
          descricao: form.descricao.trim() || null,
          data_evento: dataISO,
          hora_evento: hora || null,
          tipo: form.tipo,
          status: "pendente",
          cliente_id: form.cliente_id,
          obra_id: form.obra_id,
          origem: "manual",
        });

      if (error) {
        console.log(
          "Erro ao salvar compromisso:",
          error.message
        );

        setErro("Não foi possível salvar o compromisso.");
        return;
      }

      setModalAberto(false);
      setForm({ ...FORM_VAZIO });

      await carregarDados();
    } catch (error) {
      console.log(
        "Erro inesperado ao salvar compromisso:",
        error
      );

      setErro("Não foi possível salvar o compromisso.");
    } finally {
      setSalvando(false);
    }
  }

  async function alterarStatus(
    evento: Evento,
    status: StatusEvento
  ) {
    if (alterandoId || excluindoId) return;

    try {
      setAlterandoId(evento.id);
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
        .from("agenda_eventos")
        .update({ status })
        .eq("id", evento.id)
        .eq("user_id", user.id);

      if (error) {
        console.log(
          "Erro ao alterar compromisso:",
          error.message
        );

        setErro("Não foi possível atualizar o compromisso.");
        return;
      }

      setEventos((atual) =>
        atual.map((item) =>
          item.id === evento.id
            ? { ...item, status }
            : item
        )
      );
    } catch (error) {
      console.log("Erro ao alterar compromisso:", error);
      setErro("Não foi possível atualizar o compromisso.");
    } finally {
      setAlterandoId(null);
    }
  }

  function confirmarExclusao(evento: Evento) {
    if (excluindoId || alterandoId) return;

    if (evento.origem !== "manual") {
      setErro(
        "Este evento é sincronizado com uma obra. Altere a data na própria obra."
      );
      return;
    }

    const executar = () => void excluirEvento(evento);

    if (Platform.OS === "web") {
      const confirmou =
        typeof window !== "undefined"
          ? window.confirm(
              `Excluir permanentemente "${evento.titulo}"?`
            )
          : false;

      if (confirmou) executar();
      return;
    }

    Alert.alert(
      "Excluir compromisso",
      `Deseja excluir "${evento.titulo}"?`,
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

  async function excluirEvento(evento: Evento) {
    if (
      excluindoId ||
      alterandoId ||
      evento.origem !== "manual"
    ) {
      return;
    }

    try {
      setExcluindoId(evento.id);
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
        .from("agenda_eventos")
        .delete()
        .eq("id", evento.id)
        .eq("user_id", user.id)
        .eq("origem", "manual");

      if (error) {
        console.log(
          "Erro ao excluir compromisso:",
          error.message
        );

        setErro("Não foi possível excluir o compromisso.");
        return;
      }

      setEventos((atual) =>
        atual.filter((item) => item.id !== evento.id)
      );
    } catch (error) {
      console.log("Erro ao excluir compromisso:", error);
      setErro("Não foi possível excluir o compromisso.");
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
            Carregando sua agenda...
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
              Agenda no Orvena Pro
            </Text>

            <Text style={styles.guardText}>
              Organize visitas, reuniões e compromissos
              ligados aos seus clientes e obras. Este recurso
              requer o plano Pro ou um período de teste ativo.
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
        keyboardShouldPersistTaps="handled"
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
                  ORGANIZAÇÃO
                </Text>

                <Text style={styles.pageTitle}>
                  Agenda
                </Text>

                <Text style={styles.subtitle}>
                  Seus compromissos e datas das obras,
                  sempre à mão.
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
                NOVO COMPROMISSO
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
              icon="today-outline"
              label="PARA HOJE"
              value={resumo.hoje}
              subtitle="Compromissos pendentes"
              tone="purple"
            />

            <StatCard
              icon="calendar-outline"
              label="PRÓXIMOS"
              value={resumo.proximos}
              subtitle="Datas futuras"
              tone="blue"
            />

            <StatCard
              icon="checkmark-circle-outline"
              label="CONCLUÍDOS"
              value={resumo.concluidos}
              subtitle="Atividades finalizadas"
              tone="green"
            />

            <StatCard
              icon="alert-circle-outline"
              label="ATRASADOS"
              value={resumo.atrasados}
              subtitle="Pendências anteriores"
              tone="yellow"
            />
          </View>

          {/* LISTAGEM */}
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>
                SEUS COMPROMISSOS
              </Text>

              <Text style={styles.sectionTitle}>
                Programação
              </Text>
            </View>

            <Text style={styles.resultsText}>
              {eventosFiltrados.length}{" "}
              {eventosFiltrados.length === 1
                ? "evento"
                : "eventos"}
            </Text>
          </View>

          <View style={styles.listPanel}>
            {/* FILTROS */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
            >
              <FilterButton
                label="Próximos"
                count={resumo.hoje + resumo.proximos}
                selected={filtro === "proximos"}
                onPress={() =>
                  setFiltro("proximos")
                }
              />

              <FilterButton
                label="Todos"
                count={eventos.length}
                selected={filtro === "todos"}
                onPress={() =>
                  setFiltro("todos")
                }
              />

              <FilterButton
                label="Concluídos"
                count={resumo.concluidos}
                selected={filtro === "concluidos"}
                onPress={() =>
                  setFiltro("concluidos")
                }
              />

              <Pressable
                style={styles.refreshButton}
                onPress={() =>
                  void carregarDados()
                }
              >
                <Ionicons
                  name="refresh-outline"
                  size={18}
                  color={C.purpleLight}
                />
              </Pressable>
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

            {eventosFiltrados.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name="calendar-outline"
                    size={28}
                    color={C.purpleLight}
                  />
                </View>

                <Text style={styles.emptyTitle}>
                  {filtro === "concluidos"
                    ? "Nenhum compromisso concluído"
                    : filtro === "proximos"
                    ? "Nenhum compromisso próximo"
                    : "Sua agenda está vazia"}
                </Text>

                <Text style={styles.emptyText}>
                  {filtro === "todos"
                    ? "As datas cadastradas nas obras aparecem automaticamente na agenda. Você também pode adicionar compromissos manualmente."
                    : "Selecione Todos para consultar os outros compromissos ou cadastre um novo evento."}
                </Text>

                <Pressable
                  style={styles.emptyAction}
                  onPress={
                    filtro === "todos"
                      ? abrirNovo
                      : () => setFiltro("todos")
                  }
                >
                  <Ionicons
                    name={
                      filtro === "todos"
                        ? "add"
                        : "list-outline"
                    }
                    size={18}
                    color="#FFFFFF"
                  />

                  <Text style={styles.emptyActionText}>
                    {filtro === "todos"
                      ? "NOVO COMPROMISSO"
                      : "VER TODOS"}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.eventList}>
                {eventosFiltrados.map((evento) => {
                  const visual = coresStatus(
                    evento.status
                  );

                  const tipo = tipoEvento(
                    evento.tipo
                  );

                  const automatico =
                    evento.origem !== "manual";

                  return (
                    <View
                      key={evento.id}
                      style={[
                        styles.eventRow,
                        mobile && styles.eventRowMobile,
                      ]}
                    >
                      {/* DATA */}
                      <View style={styles.dateBox}>
                        <Text style={styles.dateDay}>
                          {obterDia(
                            evento.data_evento
                          )}
                        </Text>

                        <Text style={styles.dateMonth}>
                          {obterMes(
                            evento.data_evento
                          )}
                        </Text>

                        <View style={styles.dateDivider} />

                        <Text style={styles.dateTime}>
                          {evento.hora_evento
                            ? evento.hora_evento.slice(
                                0,
                                5
                              )
                            : "DIA TODO"}
                        </Text>
                      </View>

                      {/* INFORMAÇÕES */}
                      <View style={styles.eventContent}>
                        <View style={styles.eventTop}>
                          <Text
                            style={styles.eventTitle}
                            numberOfLines={2}
                          >
                            {evento.titulo}
                          </Text>

                          <View
                            style={[
                              styles.statusBadge,
                              {
                                borderColor:
                                  visual.border,
                                backgroundColor:
                                  visual.background,
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.statusDot,
                                {
                                  backgroundColor:
                                    visual.color,
                                },
                              ]}
                            />

                            <Text
                              style={[
                                styles.statusText,
                                {
                                  color:
                                    visual.color,
                                },
                              ]}
                            >
                              {visual.label}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.eventTypeRow}>
                          <Ionicons
                            name={tipo.icon}
                            size={13}
                            color={C.purpleLight}
                          />

                          <Text style={styles.eventTypeText}>
                            {tipo.label}
                          </Text>
                        </View>

                        {evento.descricao ? (
                          <Text
                            style={styles.description}
                            numberOfLines={3}
                          >
                            {evento.descricao}
                          </Text>
                        ) : null}

                        <DetailLine
                          icon="calendar-outline"
                          value={formatarDataExibicao(
                            evento.data_evento
                          )}
                        />

                        {evento.clientes?.nome ? (
                          <DetailLine
                            icon="person-outline"
                            value={
                              evento.clientes.nome
                            }
                          />
                        ) : null}

                        {evento.obras?.nome ? (
                          <DetailLine
                            icon="business-outline"
                            value={
                              evento.obras.nome
                            }
                          />
                        ) : null}

                        {automatico ? (
                          <View style={styles.autoBadge}>
                            <Ionicons
                              name="sync-outline"
                              size={12}
                              color={C.blue}
                            />

                            <Text style={styles.autoText}>
                              SINCRONIZADO COM OBRA
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {/* AÇÕES */}
                      <View
                        style={[
                          styles.rowActions,
                          mobile &&
                            styles.rowActionsMobile,
                        ]}
                      >
                        {evento.status === "pendente" ? (
                          <Pressable
                            style={styles.completeButton}
                            disabled={
                              alterandoId !== null ||
                              excluindoId !== null
                            }
                            onPress={() =>
                              void alterarStatus(
                                evento,
                                "concluido"
                              )
                            }
                          >
                            {alterandoId === evento.id ? (
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

                                <Text
                                  style={
                                    styles.completeText
                                  }
                                >
                                  CONCLUIR
                                </Text>
                              </>
                            )}
                          </Pressable>
                        ) : null}

                        {evento.status === "concluido" &&
                        !automatico ? (
                          <Pressable
                            style={styles.reopenButton}
                            disabled={
                              alterandoId !== null ||
                              excluindoId !== null
                            }
                            onPress={() =>
                              void alterarStatus(
                                evento,
                                "pendente"
                              )
                            }
                          >
                            {alterandoId === evento.id ? (
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

                                <Text
                                  style={
                                    styles.reopenText
                                  }
                                >
                                  Reabrir
                                </Text>
                              </>
                            )}
                          </Pressable>
                        ) : null}

                        {!automatico ? (
                          <Pressable
                            style={styles.deleteButton}
                            disabled={
                              alterandoId !== null ||
                              excluindoId !== null
                            }
                            onPress={() =>
                              confirmarExclusao(evento)
                            }
                          >
                            {excluindoId === evento.id ? (
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

            {eventosFiltrados.length > 0 ? (
              <View style={styles.listFooter}>
                <Ionicons
                  name="checkmark-circle"
                  size={15}
                  color={C.green}
                />

                <Text style={styles.footerText}>
                  Exibindo {eventosFiltrados.length} de{" "}
                  {eventos.length}{" "}
                  {eventos.length === 1
                    ? "evento"
                    : "eventos"}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.pageFooter}>
            ORVENA · SEU NEGÓCIO, ORGANIZADO
          </Text>
        </View>
      </ScrollView>

      {/* NOVO COMPROMISSO */}
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
              {/* CABEÇALHO DO FORMULÁRIO */}
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderIcon}>
                  <Ionicons
                    name="calendar-outline"
                    size={22}
                    color={C.purpleLight}
                  />
                </View>

                <View style={styles.modalHeaderContent}>
                  <Text style={styles.modalEyebrow}>
                    AGENDA
                  </Text>

                  <Text style={styles.modalTitle}>
                    Novo compromisso
                  </Text>

                  <Text style={styles.modalSubtitle}>
                    Organize uma visita, reunião ou
                    compromisso.
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
                icon="grid-outline"
                title="Tipo de compromisso"
              />

              <View style={styles.typeSelector}>
                {TIPOS.map((item) => {
                  const ativo =
                    form.tipo === item.value;

                  return (
                    <Pressable
                      key={item.value}
                      style={[
                        styles.typeButton,
                        ativo &&
                          styles.typeButtonActive,
                      ]}
                      onPress={() =>
                        atualizarCampo(
                          "tipo",
                          item.value
                        )
                      }
                    >
                      <Ionicons
                        name={item.icon}
                        size={17}
                        color={
                          ativo
                            ? C.purpleLight
                            : C.muted
                        }
                      />

                      <Text
                        style={[
                          styles.typeText,
                          ativo &&
                            styles.typeTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.formDivider} />

              {/* INFORMAÇÕES */}
              <SectionTitle
                icon="document-text-outline"
                title="Informações do evento"
              />

              <View style={styles.formGrid}>
                <View style={styles.fieldFull}>
                  <Text style={styles.fieldLabel}>
                    Título *
                  </Text>

                  <TextInput
                    value={form.titulo}
                    onChangeText={(valor) =>
                      atualizarCampo(
                        "titulo",
                        valor
                      )
                    }
                    placeholder="Ex.: Visita técnica"
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
                    Data *
                  </Text>

                  <View style={styles.inputIconBox}>
                    <Ionicons
                      name="calendar-outline"
                      size={17}
                      color={C.purpleLight}
                    />

                    <TextInput
                      value={form.data_evento}
                      onChangeText={(valor) =>
                        atualizarCampo(
                          "data_evento",
                          formatarDataDigitada(valor)
                        )
                      }
                      placeholder="DD/MM/AAAA"
                      placeholderTextColor={C.subtle}
                      keyboardType="number-pad"
                      maxLength={10}
                      style={styles.inputInside}
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
                    Hora
                  </Text>

                  <View style={styles.inputIconBox}>
                    <Ionicons
                      name="time-outline"
                      size={17}
                      color={C.purpleLight}
                    />

                    <TextInput
                      value={form.hora_evento}
                      onChangeText={(valor) =>
                        atualizarCampo(
                          "hora_evento",
                          formatarHoraDigitada(valor)
                        )
                      }
                      placeholder="HH:MM"
                      placeholderTextColor={C.subtle}
                      keyboardType="number-pad"
                      maxLength={5}
                      style={styles.inputInside}
                    />
                  </View>
                </View>

                <View style={styles.fieldFull}>
                  <Text style={styles.fieldLabel}>
                    Descrição
                  </Text>

                  <TextInput
                    value={form.descricao}
                    onChangeText={(valor) =>
                      atualizarCampo(
                        "descricao",
                        valor
                      )
                    }
                    multiline
                    textAlignVertical="top"
                    placeholder="Observações sobre o compromisso..."
                    placeholderTextColor={C.subtle}
                    style={[
                      styles.input,
                      styles.textArea,
                    ]}
                  />
                </View>
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
                          obra_id: null,
                        }))
                      }
                    />

                    {clientes.map((cliente) => (
                      <Chip
                        key={cliente.id}
                        label={cliente.nome}
                        active={
                          form.cliente_id ===
                          cliente.id
                        }
                        onPress={() =>
                          setForm((atual) => ({
                            ...atual,
                            cliente_id: cliente.id,
                            obra_id:
                              atual.obra_id &&
                              obras.some(
                                (obra) =>
                                  obra.id ===
                                    atual.obra_id &&
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
                    void salvarEvento()
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
                        SALVAR COMPROMISSO
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
  tone,
}: {
  icon: IconName;
  label: string;
  value: number;
  subtitle: string;
  tone: "purple" | "green" | "yellow" | "blue";
}) {
  const color =
    tone === "green"
      ? C.green
      : tone === "yellow"
      ? C.yellow
      : tone === "blue"
      ? C.blue
      : C.purpleLight;

  const background =
    tone === "green"
      ? C.greenBg
      : tone === "yellow"
      ? C.yellowBg
      : tone === "blue"
      ? C.blueBg
      : C.purpleBg;

  return (
    <View style={styles.statCard}>
      <View
        style={[
          styles.statIcon,
          {
            backgroundColor: background,
          },
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
      style={[
        styles.filterButton,
        selected && styles.filterButtonActive,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.filterText,
          selected && styles.filterTextActive,
        ]}
      >
        {label}
      </Text>

      <View
        style={[
          styles.filterCount,
          selected && styles.filterCountActive,
        ]}
      >
        <Text
          style={[
            styles.filterCountText,
            selected && styles.filterCountTextActive,
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
  },

  statCard: {
    flexGrow: 1,
    flexBasis: 195,
    minWidth: 140,
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

  filters: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    alignItems: "center",
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

  refreshButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    backgroundColor: C.surface2,
    alignItems: "center",
    justifyContent: "center",
  },

  eventList: {
    paddingHorizontal: 16,
  },

  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },

  eventRowMobile: {
    flexWrap: "wrap",
    alignItems: "flex-start",
  },

  dateBox: {
    width: 76,
    minHeight: 96,
    borderRadius: 15,
    backgroundColor: C.purpleBg,
    borderWidth: 1,
    borderColor: "#4E3C80",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },

  dateDay: {
    color: C.text,
    fontSize: 25,
    fontWeight: "900",
  },

  dateMonth: {
    color: C.purpleLight,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: 1,
  },

  dateDivider: {
    height: 1,
    width: 42,
    backgroundColor: "#514171",
    marginVertical: 7,
  },

  dateTime: {
    color: C.purpleLight,
    fontSize: 9,
    fontWeight: "900",
  },

  eventContent: {
    flex: 1,
    minWidth: 120,
    gap: 6,
  },

  eventTop: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },

  eventTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: "900",
  },

  eventTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  eventTypeText: {
    color: C.purpleLight,
    fontSize: 10,
    fontWeight: "900",
  },

  description: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 17,
  },

  detailLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },

  detailText: {
    color: C.muted,
    fontSize: 10,
    lineHeight: 16,
    flexShrink: 1,
  },

  autoBadge: {
    alignSelf: "flex-start",
    borderRadius: 7,
    backgroundColor: C.blueBg,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },

  autoText: {
    color: C.blue,
    fontSize: 9,
    fontWeight: "900",
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

  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  rowActionsMobile: {
    width: "100%",
    justifyContent: "flex-end",
    paddingLeft: 89,
  },

  completeButton: {
    minHeight: 37,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#27583F",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },

  completeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },

  reopenButton: {
    minHeight: 37,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#453765",
    backgroundColor: C.purpleBg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },

  reopenText: {
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

  inputIconBox: {
    width: "100%",
    minHeight: 47,
    borderRadius: 12,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 13,
  },

  inputInside: {
    flex: 1,
    minHeight: 45,
    minWidth: 0,
    color: C.text,
    fontSize: 12,
    outlineStyle: "none" as any,
  },

  textArea: {
    minHeight: 105,
    paddingTop: 13,
  },

  typeSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },

  typeButton: {
    flexGrow: 1,
    minWidth: 115,
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  typeButtonActive: {
    borderColor: "#624BD3",
    backgroundColor: C.purpleBg,
  },

  typeText: {
    color: C.muted,
    fontSize: 10,
    fontWeight: "900",
  },

  typeTextActive: {
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