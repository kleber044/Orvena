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

type Cliente = {
  id: string;
  user_id: string;
  nome: string;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  observacoes: string | null;
  created_at: string;
};

type FormCliente = {
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  endereco: string;
  cidade: string;
  estado: string;
  observacoes: string;
};

type IconName = React.ComponentProps<typeof Ionicons>["name"];

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
  red: "#FF8897",
  redBg: "#311D27",
  green: "#66DBAE",
};

const EMPTY_FORM: FormCliente = {
  nome: "",
  documento: "",
  telefone: "",
  email: "",
  endereco: "",
  cidade: "",
  estado: "",
  observacoes: "",
};

function apenasNumeros(value: string) {
  return value.replace(/\D/g, "");
}

function formatarDocumento(value: string) {
  const v = apenasNumeros(value).slice(0, 14);

  if (v.length <= 11) {
    if (v.length <= 3) return v;
    if (v.length <= 6) return v.replace(/(\d{3})(\d+)/, "$1.$2");
    if (v.length <= 9) {
      return v.replace(/(\d{3})(\d{3})(\d+)/, "$1.$2.$3");
    }

    return v.replace(
      /(\d{3})(\d{3})(\d{3})(\d{1,2})/,
      "$1.$2.$3-$4"
    );
  }

  return v.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/,
    "$1.$2.$3/$4-$5"
  );
}

function formatarTelefone(value: string) {
  const v = apenasNumeros(value).slice(0, 11);

  if (!v) return "";
  if (v.length <= 2) return `(${v}`;
  if (v.length <= 6) return `(${v.slice(0, 2)}) ${v.slice(2)}`;

  if (v.length <= 10) {
    return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
  }

  return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "C";

  return (
    partes[0].charAt(0) +
    (partes.length > 1 ? partes[partes.length - 1].charAt(0) : "")
  ).toUpperCase();
}

function letraBusca(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function ClientesScreen() {
  const { width } = useWindowDimensions();
  const desktop = width >= 960;
  const mobile = width < 650;

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [redirecionando, setRedirecionando] = useState(false);
  const [proNegado, setProNegado] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState<FormCliente>(EMPTY_FORM);

  useFocusEffect(
    useCallback(() => {
      void carregarClientes();
    }, [])
  );

  const filtrados = useMemo(() => {
    const termo = letraBusca(busca.trim());

    if (!termo) return clientes;

    return clientes.filter((cliente) =>
      [
        cliente.nome,
        cliente.documento,
        cliente.telefone,
        cliente.email,
        cliente.cidade,
        cliente.estado,
      ]
        .filter(Boolean)
        .some((valor) => letraBusca(String(valor)).includes(termo))
    );
  }, [clientes, busca]);

  const comTelefone = useMemo(
    () => clientes.filter((c) => Boolean(c.telefone)).length,
    [clientes]
  );

  const comEmail = useMemo(
    () => clientes.filter((c) => Boolean(c.email)).length,
    [clientes]
  );

  async function carregarClientes() {
    try {
      setCarregando(true);
      setErro("");
      setProNegado(false);

      const acesso = await verificarAcessoPro();

      if (!acesso.autenticado) {
        setRedirecionando(true);
        router.replace("/login" as any);
        return;
      }

      if (!acesso.temPro) {
        setProNegado(true);
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setRedirecionando(true);
        router.replace("/login" as any);
        return;
      }

      const { data, error } = await supabase
        .from("clientes")
        .select(
          "id, user_id, nome, documento, telefone, email, endereco, cidade, estado, observacoes, created_at"
        )
        .eq("user_id", user.id)
        .order("nome", { ascending: true });

      if (error) {
        console.log("Erro ao carregar clientes:", error.message);
        setErro("Não foi possível carregar seus clientes.");
        return;
      }

      setClientes((data ?? []) as Cliente[]);
    } catch (error) {
      console.log("Erro inesperado ao carregar clientes:", error);
      setErro("Não foi possível carregar seus clientes.");
    } finally {
      setCarregando(false);
    }
  }

  function novoCliente() {
    setEditando(null);
    setForm({ ...EMPTY_FORM });
    setErro("");
    setModalAberto(true);
  }

  function editarCliente(cliente: Cliente) {
    setEditando(cliente);
    setForm({
      nome: cliente.nome || "",
      documento: cliente.documento || "",
      telefone: cliente.telefone || "",
      email: cliente.email || "",
      endereco: cliente.endereco || "",
      cidade: cliente.cidade || "",
      estado: cliente.estado || "",
      observacoes: cliente.observacoes || "",
    });
    setErro("");
    setModalAberto(true);
  }

  function fecharModal() {
    if (salvando) return;
    setModalAberto(false);
    setEditando(null);
    setForm({ ...EMPTY_FORM });
    setErro("");
  }

  function atualizarCampo(campo: keyof FormCliente, valor: string) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  async function salvarCliente() {
    if (salvando) return;

    const nome = form.nome.trim();

    if (!nome) {
      setErro("Informe o nome do cliente.");
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
        documento: form.documento.trim() || null,
        telefone: form.telefone.trim() || null,
        email: form.email.trim().toLowerCase() || null,
        endereco: form.endereco.trim() || null,
        cidade: form.cidade.trim() || null,
        estado: form.estado.trim().toUpperCase() || null,
        observacoes: form.observacoes.trim() || null,
      };

      if (editando) {
        const { error } = await supabase
          .from("clientes")
          .update(payload)
          .eq("id", editando.id)
          .eq("user_id", user.id);

        if (error) {
          console.log("Erro ao atualizar cliente:", error.message);
          setErro("Não foi possível atualizar o cliente.");
          return;
        }
      } else {
        const { error } = await supabase
          .from("clientes")
          .insert(payload);

        if (error) {
          console.log("Erro ao cadastrar cliente:", error.message);
          setErro("Não foi possível cadastrar o cliente.");
          return;
        }
      }

      setModalAberto(false);
      setEditando(null);
      setForm({ ...EMPTY_FORM });

      await carregarClientes();
    } catch (error) {
      console.log("Erro ao salvar cliente:", error);
      setErro("Não foi possível salvar o cliente.");
    } finally {
      setSalvando(false);
    }
  }

  function confirmarExclusao(cliente: Cliente) {
    if (excluindoId) return;

    const executar = () => void excluirCliente(cliente);

    if (Platform.OS === "web") {
      const confirmou =
        typeof window !== "undefined"
          ? window.confirm(`Excluir o cliente "${cliente.nome}"?`)
          : false;

      if (confirmou) executar();
      return;
    }

    Alert.alert(
      "Excluir cliente",
      `Deseja realmente excluir "${cliente.nome}"?`,
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

  async function excluirCliente(cliente: Cliente) {
    if (excluindoId) return;

    try {
      setExcluindoId(cliente.id);
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
        .from("clientes")
        .delete()
        .eq("id", cliente.id)
        .eq("user_id", user.id);

      if (error) {
        console.log("Erro ao excluir cliente:", error.message);
        setErro("Não foi possível excluir o cliente.");
        return;
      }

      setClientes((atual) =>
        atual.filter((item) => item.id !== cliente.id)
      );
    } catch (error) {
      console.log("Erro inesperado ao excluir cliente:", error);
      setErro("Não foi possível excluir o cliente.");
    } finally {
      setExcluindoId(null);
    }
  }

  if (carregando || redirecionando) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={C.purple} />
          <Text style={styles.loadingText}>Carregando clientes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (proNegado) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.guardPage}>
          <View style={styles.guardCard}>
            <View style={styles.guardIcon}>
              <Ionicons
                name="diamond-outline"
                size={28}
                color={C.purpleLight}
              />
            </View>

            <Text style={styles.guardEyebrow}>RECURSO EXCLUSIVO</Text>
            <Text style={styles.guardTitle}>Clientes no Orvena Pro</Text>
            <Text style={styles.guardText}>
              Gerencie seus clientes e mantenha todas as informações
              organizadas em um só lugar. Este recurso requer o plano
              Pro ou um período de teste ativo.
            </Text>

            <Pressable
              style={styles.primaryButton}
              onPress={() => router.replace("/plano" as any)}
            >
              <Ionicons name="diamond-outline" size={16} color="#FFF" />
              <Text style={styles.primaryText}>CONHECER O PLANO PRO</Text>
            </Pressable>

            <Pressable
              style={styles.guardBack}
              onPress={() => router.replace("/(tabs)" as any)}
            >
              <Text style={styles.guardBackText}>Voltar ao início</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.page}>
          {/* CABEÇALHO */}
          <View style={[styles.header, mobile && styles.headerMobile]}>
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
                <Text style={styles.eyebrow}>GERENCIAMENTO</Text>
                <Text style={styles.pageTitle}>Clientes</Text>
                <Text style={styles.subtitle}>
                  Seus contatos, sempre organizados.
                </Text>
              </View>
            </View>

            <Pressable
              style={[
                styles.primaryButton,
                mobile && styles.primaryButtonMobile,
              ]}
              onPress={novoCliente}
            >
              <Ionicons
                name="add"
                size={19}
                color="#FFFFFF"
              />
              <Text style={styles.primaryText}>NOVO CLIENTE</Text>
            </Pressable>
          </View>

          {/* INDICADORES */}
          <View style={[styles.stats, mobile && styles.statsMobile]}>
            <StatCard
              icon="people-outline"
              label="TOTAL DE CLIENTES"
              value={clientes.length}
              subtitle="Contatos cadastrados"
            />
            <StatCard
              icon="call-outline"
              label="COM TELEFONE"
              value={comTelefone}
              subtitle="Contatos telefônicos"
            />
            <StatCard
              icon="mail-outline"
              label="COM E-MAIL"
              value={comEmail}
              subtitle="Endereços cadastrados"
            />
          </View>

          {/* LISTAGEM */}
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>SUA CARTEIRA</Text>
              <Text style={styles.sectionTitle}>Lista de clientes</Text>
            </View>

            <Text style={styles.resultsText}>
              {filtrados.length}{" "}
              {filtrados.length === 1 ? "resultado" : "resultados"}
            </Text>
          </View>

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
                  placeholder="Buscar nome, documento, telefone ou e-mail..."
                  placeholderTextColor={C.subtle}
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                {busca.length > 0 ? (
                  <Pressable
                    onPress={() => setBusca("")}
                    hitSlop={10}
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
                onPress={() => void carregarClientes()}
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
                <Text style={styles.errorText}>{erro}</Text>
              </View>
            ) : null}

            {filtrados.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name={busca.trim() ? "search-outline" : "people-outline"}
                    size={28}
                    color={C.purpleLight}
                  />
                </View>

                <Text style={styles.emptyTitle}>
                  {busca.trim()
                    ? "Nenhum cliente encontrado"
                    : "Sua lista está vazia"}
                </Text>

                <Text style={styles.emptyText}>
                  {busca.trim()
                    ? "Tente pesquisar por outro nome, documento ou contato."
                    : "Cadastre seu primeiro cliente e mantenha os dados disponíveis para seus orçamentos e obras."}
                </Text>

                {busca.trim() ? (
                  <Pressable
                    style={styles.emptyAction}
                    onPress={() => setBusca("")}
                  >
                    <Text style={styles.emptyActionText}>LIMPAR BUSCA</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={styles.emptyAction}
                    onPress={novoCliente}
                  >
                    <Ionicons
                      name="add"
                      size={17}
                      color="#FFFFFF"
                    />
                    <Text style={styles.emptyActionText}>
                      CADASTRAR CLIENTE
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <View style={styles.clientList}>
                {filtrados.map((cliente) => (
                  <View
                    key={cliente.id}
                    style={[
                      styles.clientRow,
                      mobile && styles.clientRowMobile,
                    ]}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {iniciais(cliente.nome)}
                      </Text>
                    </View>

                    <View style={styles.clientContent}>
                      <Text
                        style={styles.clientName}
                        numberOfLines={2}
                      >
                        {cliente.nome}
                      </Text>

                      {cliente.documento ? (
                        <DetailLine
                          icon="card-outline"
                          value={cliente.documento}
                        />
                      ) : null}

                      {cliente.telefone ? (
                        <DetailLine
                          icon="call-outline"
                          value={cliente.telefone}
                        />
                      ) : null}

                      {cliente.email ? (
                        <DetailLine
                          icon="mail-outline"
                          value={cliente.email}
                        />
                      ) : null}

                      {cliente.cidade || cliente.estado ? (
                        <DetailLine
                          icon="location-outline"
                          value={[
                            cliente.cidade,
                            cliente.estado,
                          ]
                            .filter(Boolean)
                            .join(" - ")}
                        />
                      ) : null}

                      {!cliente.documento &&
                      !cliente.telefone &&
                      !cliente.email &&
                      !cliente.cidade &&
                      !cliente.estado ? (
                        <Text style={styles.noDetails}>
                          Nenhum contato adicional informado
                        </Text>
                      ) : null}
                    </View>

                    <View
                      style={[
                        styles.rowActions,
                        mobile && styles.rowActionsMobile,
                      ]}
                    >
                      <Pressable
                        style={styles.editButton}
                        onPress={() => editarCliente(cliente)}
                        disabled={excluindoId !== null}
                      >
                        <Ionicons
                          name="create-outline"
                          size={16}
                          color={C.purpleLight}
                        />
                        <Text style={styles.editText}>Editar</Text>
                      </Pressable>

                      <Pressable
                        style={styles.deleteButton}
                        onPress={() => confirmarExclusao(cliente)}
                        disabled={excluindoId !== null}
                      >
                        {excluindoId === cliente.id ? (
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

            {filtrados.length > 0 ? (
              <View style={styles.listFooter}>
                <Ionicons
                  name="checkmark-circle"
                  size={15}
                  color={C.green}
                />
                <Text style={styles.footerText}>
                  Exibindo {filtrados.length} de {clientes.length}{" "}
                  {clientes.length === 1 ? "cliente" : "clientes"}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.pageFooter}>
            ORVENA · SEU NEGÓCIO, ORGANIZADO
          </Text>
        </View>
      </ScrollView>

      {/* MODAL DE CADASTRO / EDIÇÃO */}
      <Modal
        visible={modalAberto}
        transparent
        animationType="fade"
        onRequestClose={fecharModal}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
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
                    name={
                      editando
                        ? "create-outline"
                        : "person-add-outline"
                    }
                    size={22}
                    color={C.purpleLight}
                  />
                </View>

                <View style={styles.modalHeaderContent}>
                  <Text style={styles.modalEyebrow}>
                    {editando ? "EDITAR CADASTRO" : "NOVO CADASTRO"}
                  </Text>

                  <Text style={styles.modalTitle}>
                    {editando ? "Editar cliente" : "Novo cliente"}
                  </Text>

                  <Text style={styles.modalSubtitle}>
                    {editando
                      ? "Atualize as informações do cliente."
                      : "Preencha os dados para adicionar um contato."}
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

              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>
                  <Ionicons
                    name="person-outline"
                    size={15}
                    color={C.purpleLight}
                  />{" "}
                  Dados principais
                </Text>

                <View style={styles.formGrid}>
                  <Campo
                    label="Nome completo *"
                    value={form.nome}
                    onChangeText={(v) => atualizarCampo("nome", v)}
                    placeholder="Nome do cliente"
                    full
                  />

                  <Campo
                    label="CPF / CNPJ"
                    value={form.documento}
                    onChangeText={(v) =>
                      atualizarCampo("documento", formatarDocumento(v))
                    }
                    placeholder="000.000.000-00"
                    keyboardType="number-pad"
                    full={mobile}
                  />

                  <Campo
                    label="Telefone"
                    value={form.telefone}
                    onChangeText={(v) =>
                      atualizarCampo("telefone", formatarTelefone(v))
                    }
                    placeholder="(00) 00000-0000"
                    keyboardType="phone-pad"
                    full={mobile}
                  />

                  <Campo
                    label="E-mail"
                    value={form.email}
                    onChangeText={(v) => atualizarCampo("email", v)}
                    placeholder="cliente@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    full
                  />
                </View>
              </View>

              <View style={styles.formDivider} />

              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>
                  <Ionicons
                    name="location-outline"
                    size={15}
                    color={C.purpleLight}
                  />{" "}
                  Localização
                </Text>

                <View style={styles.formGrid}>
                  <Campo
                    label="Endereço"
                    value={form.endereco}
                    onChangeText={(v) => atualizarCampo("endereco", v)}
                    placeholder="Rua, número e bairro"
                    full
                  />

                  <Campo
                    label="Cidade"
                    value={form.cidade}
                    onChangeText={(v) => atualizarCampo("cidade", v)}
                    placeholder="Cidade"
                    full={mobile}
                  />

                  <Campo
                    label="UF"
                    value={form.estado}
                    onChangeText={(v) =>
                      atualizarCampo(
                        "estado",
                        v
                          .replace(/[^a-zA-Z]/g, "")
                          .slice(0, 2)
                          .toUpperCase()
                      )
                    }
                    placeholder="PE"
                    autoCapitalize="characters"
                    maxLength={2}
                    full={mobile}
                  />
                </View>
              </View>

              <View style={styles.formDivider} />

              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>
                  <Ionicons
                    name="document-text-outline"
                    size={15}
                    color={C.purpleLight}
                  />{" "}
                  Informações adicionais
                </Text>

                <View style={styles.fieldFull}>
                  <Text style={styles.fieldLabel}>Observações</Text>
                  <TextInput
                    value={form.observacoes}
                    onChangeText={(v) =>
                      atualizarCampo("observacoes", v)
                    }
                    placeholder="Anotações importantes sobre o cliente..."
                    placeholderTextColor={C.subtle}
                    multiline
                    textAlignVertical="top"
                    style={[styles.input, styles.textArea]}
                  />
                </View>
              </View>

              {erro ? (
                <View style={styles.modalError}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={17}
                    color={C.red}
                  />
                  <Text style={styles.errorText}>{erro}</Text>
                </View>
              ) : null}

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
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.saveButton,
                    mobile && styles.modalActionMobile,
                    salvando && styles.disabled,
                  ]}
                  onPress={() => void salvarCliente()}
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
                        {editando
                          ? "SALVAR ALTERAÇÕES"
                          : "CADASTRAR CLIENTE"}
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

      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statSubtitle}>{subtitle}</Text>
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

function Campo({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  maxLength,
  full,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "email-address" | "number-pad" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  maxLength?: number;
  full?: boolean;
}) {
  return (
    <View style={full ? styles.fieldFull : styles.fieldHalf}>
      <Text style={styles.fieldLabel}>{label}</Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.subtle}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
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

  clientList: {
    paddingHorizontal: 16,
  },

  clientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 17,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },

  clientRowMobile: {
    flexWrap: "wrap",
    alignItems: "flex-start",
  },

  avatar: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: C.purpleBg,
    borderWidth: 1,
    borderColor: "#4E3C80",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    color: C.purpleLight,
    fontSize: 15,
    fontWeight: "900",
  },

  clientContent: {
    flex: 1,
    minWidth: 100,
    gap: 5,
  },

  clientName: {
    color: C.text,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 2,
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
    width: Platform.OS === "web" ? ("calc(50% - 6px)" as any) : "100%",
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