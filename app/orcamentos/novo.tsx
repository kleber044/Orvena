import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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

import { supabase } from "../../lib/supabase";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

type ItemOrcamento = {
  id: string;
  descricao: string;
  quantidade: string;
  valorUnitario: string;
  servicoId: string | null;
};

type ClienteCadastrado = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
};

type ObraCadastrada = {
  id: string;
  nome: string;
  cliente_id: string | null;
  status: string;
};

type ServicoCadastrado = {
  id: string;
  nome: string;
  unidade: string;
  valor_unitario: number | string;
  ativo: boolean;
};

const C = {
  bg: "#090A10",
  surface: "#141722",
  surface2: "#191C29",
  input: "#0E1018",
  border: "#292D3B",
  purple: "#7C5CFF",
  purpleLight: "#A997FF",
  text: "#F7F7FC",
  muted: "#9399AA",
  faint: "#676D7D",
  green: "#5DDEAB",
  red: "#FF8997",
  white: "#FFFFFF",
};

function criarIdLocal() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function novoItem(): ItemOrcamento {
  return {
    id: criarIdLocal(),
    descricao: "",
    quantidade: "1",
    valorUnitario: "",
    servicoId: null,
  };
}

function normalizarNumero(valor: string) {
  const limpo = valor
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const numero = Number(limpo);

  return Number.isFinite(numero) ? numero : 0;
}

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(valor) ? valor : 0);
}

function formatarCep(valor: string) {
  const numeros = valor.replace(/\D/g, "").slice(0, 8);

  return numeros.length <= 5
    ? numeros
    : `${numeros.slice(0, 5)}-${numeros.slice(5)}`;
}

export default function NovoOrcamentoScreen() {
  const { width } = useWindowDimensions();

  const isDesktop = width >= 980;
  const duasColunas = width >= 650;

  const scrollRef = useRef<ScrollView>(null);
  const salvandoRef = useRef(false);
  const consultaCepRef = useRef(0);

  const [clientesCadastrados, setClientesCadastrados] = useState<
    ClienteCadastrado[]
  >([]);

  const [obrasCadastradas, setObrasCadastradas] = useState<
    ObraCadastrada[]
  >([]);

  const [servicosCadastrados, setServicosCadastrados] = useState<
    ServicoCadastrado[]
  >([]);

  const [clienteSelecionadoId, setClienteSelecionadoId] =
    useState<string | null>(null);

  const [obraSelecionadaId, setObraSelecionadaId] =
    useState<string | null>(null);

  const [carregandoCadastros, setCarregandoCadastros] = useState(true);
  const [validandoSessao, setValidandoSessao] = useState(true);
  const [redirecionandoLogin, setRedirecionandoLogin] = useState(false);

  const [clienteNome, setClienteNome] = useState("");
  const [clienteTelefone, setClienteTelefone] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");

  const [clienteCep, setClienteCep] = useState("");
  const [clienteLogradouro, setClienteLogradouro] = useState("");
  const [clienteNumero, setClienteNumero] = useState("");
  const [clienteComplemento, setClienteComplemento] = useState("");
  const [clienteBairro, setClienteBairro] = useState("");
  const [clienteCidade, setClienteCidade] = useState("");
  const [clienteUf, setClienteUf] = useState("");
  const [clienteEstado, setClienteEstado] = useState("");

  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erroCep, setErroCep] = useState("");

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [validadeDias, setValidadeDias] = useState("15");
  const [desconto, setDesconto] = useState("0");
  const [acrescimo, setAcrescimo] = useState("0");

  const [formaPagamento, setFormaPagamento] = useState("");
  const [condicoesPagamento, setCondicoesPagamento] = useState("");

  const [itens, setItens] = useState<ItemOrcamento[]>([novoItem()]);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  useEffect(() => {
    void carregarCadastros();
  }, []);

  async function carregarCadastros() {
    try {
      setCarregandoCadastros(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setRedirecionandoLogin(true);
        router.replace("/login" as any);
        return;
      }

      setValidandoSessao(false);

      const [clientesResult, obrasResult, servicosResult] =
        await Promise.all([
          supabase
            .from("clientes")
            .select("id, nome, telefone, email, endereco, cidade, estado")
            .eq("user_id", user.id)
            .order("nome", { ascending: true }),

          supabase
            .from("obras")
            .select("id, nome, cliente_id, status")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),

          supabase
            .from("servicos")
            .select("id, nome, unidade, valor_unitario, ativo")
            .eq("user_id", user.id)
            .eq("ativo", true)
            .order("nome", { ascending: true }),
        ]);

      if (!clientesResult.error) {
        setClientesCadastrados(
          (clientesResult.data ?? []) as ClienteCadastrado[]
        );
      } else {
        console.log("Erro ao consultar clientes:", clientesResult.error.message);
      }

      if (!obrasResult.error) {
        setObrasCadastradas(
          (obrasResult.data ?? []) as ObraCadastrada[]
        );
      } else {
        console.log("Erro ao consultar obras:", obrasResult.error.message);
      }

      if (!servicosResult.error) {
        setServicosCadastrados(
          (servicosResult.data ?? []) as ServicoCadastrado[]
        );
      } else {
        console.log("Erro ao consultar serviços:", servicosResult.error.message);
      }
    } catch (error) {
      console.log("Erro ao carregar os cadastros:", error);
    } finally {
      setCarregandoCadastros(false);
      setValidandoSessao(false);
    }
  }

  function selecionarCliente(cliente: ClienteCadastrado) {
    consultaCepRef.current += 1;
    setBuscandoCep(false);

    setClienteSelecionadoId(cliente.id);
    setClienteNome(cliente.nome || "");
    setClienteTelefone(cliente.telefone || "");
    setClienteEmail(cliente.email || "");

    setClienteCep("");
    setClienteLogradouro("");
    setClienteNumero("");
    setClienteComplemento("");
    setClienteBairro("");
    setClienteCidade(cliente.cidade || "");
    setClienteUf(
      cliente.estado && cliente.estado.length === 2
        ? cliente.estado.toUpperCase()
        : ""
    );
    setClienteEstado(cliente.estado || "");
    setErroCep("");
  }

  function selecionarObra(obra: ObraCadastrada) {
    setObraSelecionadaId(obra.id);

    if (obra.cliente_id && obra.cliente_id !== clienteSelecionadoId) {
      const cliente = clientesCadastrados.find(
        (item) => item.id === obra.cliente_id
      );

      if (cliente) {
        selecionarCliente(cliente);
      }
    }
  }

  function selecionarServico(
    itemId: string,
    servico: ServicoCadastrado
  ) {
    const valor = Number(servico.valor_unitario || 0);

    setItens((atuais) =>
      atuais.map((item) =>
        item.id === itemId
          ? {
              ...item,
              servicoId: servico.id,
              descricao: servico.nome,
              valorUnitario: Number.isFinite(valor)
                ? valor.toFixed(2).replace(".", ",")
                : "",
            }
          : item
      )
    );
  }

  const subtotal = useMemo(() => {
    return itens.reduce((acc, item) => {
      const quantidade = normalizarNumero(item.quantidade);
      const unitario = normalizarNumero(item.valorUnitario);

      return acc + quantidade * unitario;
    }, 0);
  }, [itens]);

  const descontoNumero = useMemo(
    () => Math.max(normalizarNumero(desconto), 0),
    [desconto]
  );

  const acrescimoNumero = useMemo(
    () => Math.max(normalizarNumero(acrescimo), 0),
    [acrescimo]
  );

  const total = Math.max(
    subtotal + acrescimoNumero - descontoNumero,
    0
  );

  const itensPreenchidos = itens.filter(
    (item) => item.descricao.trim().length > 0
  ).length;

  function limparEnderecoCep() {
    setClienteLogradouro("");
    setClienteBairro("");
    setClienteCidade("");
    setClienteUf("");
    setClienteEstado("");
  }

  async function buscarCep(valor: string) {
    const cep = valor.replace(/\D/g, "");

    if (cep.length !== 8) {
      setErroCep("Informe um CEP com 8 dígitos.");
      return;
    }

    const consultaAtual = ++consultaCepRef.current;

    try {
      setBuscandoCep(true);
      setErroCep("");

      const resposta = await fetch(
        `https://viacep.com.br/ws/${cep}/json/`
      );

      if (consultaAtual !== consultaCepRef.current) return;

      if (!resposta.ok) {
        limparEnderecoCep();
        setErroCep("Não foi possível consultar este CEP.");
        return;
      }

      const dados = await resposta.json();

      if (consultaAtual !== consultaCepRef.current) return;

      if (dados.erro) {
        limparEnderecoCep();
        setErroCep("CEP não encontrado.");
        return;
      }

      setClienteCep(formatarCep(dados.cep || cep));
      setClienteLogradouro(dados.logradouro || "");
      setClienteBairro(dados.bairro || "");
      setClienteCidade(dados.localidade || "");
      setClienteUf(dados.uf || "");
      setClienteEstado(dados.estado || "");
    } catch {
      if (consultaAtual === consultaCepRef.current) {
        limparEnderecoCep();
        setErroCep(
          "Não foi possível consultar o CEP. Verifique sua conexão."
        );
      }
    } finally {
      if (consultaAtual === consultaCepRef.current) {
        setBuscandoCep(false);
      }
    }
  }

  function alterarCep(valor: string) {
    const formatado = formatarCep(valor);

    consultaCepRef.current += 1;
    setClienteCep(formatado);
    setErroCep("");
    setBuscandoCep(false);

    if (formatado.replace(/\D/g, "").length === 8) {
      void buscarCep(formatado);
    } else {
      limparEnderecoCep();
    }
  }

  function atualizarItem(
    id: string,
    campo: "descricao" | "quantidade" | "valorUnitario",
    valor: string
  ) {
    setItens((atuais) =>
      atuais.map((item) =>
        item.id === id
          ? {
              ...item,
              [campo]: valor,
              ...(campo === "descricao" || campo === "valorUnitario"
                ? { servicoId: null }
                : {}),
            }
          : item
      )
    );
  }

  function adicionarItem() {
    setItens((atuais) => [...atuais, novoItem()]);
  }

  function removerItem(id: string) {
    setItens((atuais) => {
      if (atuais.length <= 1) return atuais;
      return atuais.filter((item) => item.id !== id);
    });
  }

  function exibirErro(mensagem: string) {
    setSucesso("");
    setErro(mensagem);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    return false;
  }

  function validar() {
    if (!clienteNome.trim()) {
      return exibirErro("Informe o nome do cliente.");
    }

    if (clienteCep.replace(/\D/g, "").length !== 8) {
      return exibirErro("Informe um CEP válido com 8 dígitos.");
    }

    if (!clienteLogradouro && !clienteCidade) {
      return exibirErro("Consulte o CEP antes de salvar o orçamento.");
    }

    if (!clienteNumero.trim()) {
      return exibirErro("Informe o número do endereço do cliente.");
    }

    if (!titulo.trim()) {
      return exibirErro("Informe um título para o orçamento.");
    }

    const validade = Number(validadeDias);

    if (!Number.isInteger(validade) || validade <= 0) {
      return exibirErro("Informe uma validade em dias válida.");
    }

    if (itens.length === 0) {
      return exibirErro("Adicione pelo menos um item ao orçamento.");
    }

    for (let i = 0; i < itens.length; i += 1) {
      const item = itens[i];
      const quantidade = normalizarNumero(item.quantidade);
      const valorUnitario = normalizarNumero(item.valorUnitario);

      if (!item.descricao.trim()) {
        return exibirErro(`Informe a descrição do item ${i + 1}.`);
      }

      if (quantidade <= 0) {
        return exibirErro(
          `A quantidade do item ${i + 1} precisa ser maior que zero.`
        );
      }

      if (valorUnitario < 0) {
        return exibirErro(
          `O valor do item ${i + 1} não pode ser negativo.`
        );
      }
    }

    if (subtotal <= 0) {
      return exibirErro(
        "Informe pelo menos um item ou serviço com valor maior que zero."
      );
    }

    if (descontoNumero > subtotal + acrescimoNumero) {
      return exibirErro(
        "O desconto não pode ser maior que o valor dos itens somado ao acréscimo."
      );
    }

    setErro("");
    return true;
  }

  async function salvarOrcamento() {
    if (salvandoRef.current) return;
    if (!validar()) return;

    salvandoRef.current = true;
    let orcamentoCriadoId: string | null = null;

    try {
      setSalvando(true);
      setErro("");
      setSucesso("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErro("Sua sessão expirou. Entre novamente.");
        return;
      }

      const { data: orcamento, error: orcamentoError } =
        await supabase
          .from("orcamentos")
          .insert({
            user_id: user.id,
            cliente_id: clienteSelecionadoId,
            obra_id: obraSelecionadaId,

            cliente_nome: clienteNome.trim(),
            cliente_telefone: clienteTelefone.trim() || null,
            cliente_email: clienteEmail.trim().toLowerCase() || null,

            cliente_cep: clienteCep.replace(/\D/g, "") || null,
            cliente_logradouro: clienteLogradouro.trim() || null,
            cliente_numero: clienteNumero.trim() || null,
            cliente_complemento:
              clienteComplemento.trim() || null,
            cliente_bairro: clienteBairro.trim() || null,
            cliente_cidade: clienteCidade.trim() || null,
            cliente_uf: clienteUf.trim() || null,
            cliente_estado: clienteEstado.trim() || null,

            cliente_endereco:
              [
                clienteLogradouro.trim(),
                clienteNumero.trim(),
                clienteComplemento.trim(),
                clienteBairro.trim(),
                clienteCidade.trim(),
                clienteUf.trim(),
              ]
                .filter(Boolean)
                .join(", ") || null,

            titulo: titulo.trim(),
            descricao: descricao.trim() || null,
            observacoes: observacoes.trim() || null,
            validade_dias: Number(validadeDias),

            desconto: descontoNumero,
            acrescimo: acrescimoNumero,

            forma_pagamento: formaPagamento.trim() || null,
            condicoes_pagamento:
              condicoesPagamento.trim() || null,

            subtotal,
            total,
            status: "rascunho",
          })
          .select("id, numero")
          .single();

      if (orcamentoError || !orcamento) {
        setErro(
          orcamentoError?.message ||
            "Não foi possível salvar o orçamento."
        );
        return;
      }

      orcamentoCriadoId = orcamento.id;

      const itensParaSalvar = itens.map((item, index) => {
        const quantidade = normalizarNumero(item.quantidade);
        const valorUnitario = normalizarNumero(item.valorUnitario);

        return {
          orcamento_id: orcamento.id,
          user_id: user.id,
          servico_id: item.servicoId,
          descricao: item.descricao.trim(),
          quantidade,
          valor_unitario: valorUnitario,
          total: quantidade * valorUnitario,
          ordem: index,
        };
      });

      const { error: itensError } = await supabase
        .from("orcamento_itens")
        .insert(itensParaSalvar);

      if (itensError) {
        const { error: limpezaError } = await supabase
          .from("orcamentos")
          .delete()
          .eq("id", orcamento.id)
          .eq("user_id", user.id);

        if (limpezaError) {
          console.log(
            "Erro ao remover orçamento incompleto:",
            limpezaError.message
          );
        }

        setErro(
          `Não foi possível salvar os itens: ${itensError.message}`
        );
        return;
      }

      setSucesso(
        `Orçamento #${orcamento.numero} salvo com sucesso!`
      );

      router.replace("/orcamentos" as any);
    } catch (error) {
      console.log("Erro ao salvar orçamento:", error);

      if (orcamentoCriadoId) {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { error: limpezaError } = await supabase
            .from("orcamentos")
            .delete()
            .eq("id", orcamentoCriadoId)
            .eq("user_id", user.id);

          if (limpezaError) {
            console.log(
              "Erro ao remover orçamento após falha:",
              limpezaError.message
            );
          }
        }
      }

      setErro(
        "Ocorreu um erro ao salvar o orçamento. Tente novamente."
      );
    } finally {
      salvandoRef.current = false;
      setSalvando(false);
    }
  }

  if (validandoSessao || redirecionandoLogin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          <ActivityIndicator
            size="large"
            color={C.purple}
          />
          <Text style={styles.loadingText}>
            Preparando seu orçamento...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.page,
              isDesktop && styles.pageDesktop,
            ]}
          >
            {/* CABEÇALHO */}

            <View style={styles.header}>
              <Pressable
                style={styles.backButton}
                onPress={() =>
                  router.replace("/orcamentos" as any)
                }
                disabled={salvando}
              >
                <Ionicons
                  name="arrow-back"
                  size={21}
                  color={C.text}
                />
              </Pressable>

              <View style={styles.headerInfo}>
                <Text style={styles.eyebrow}>
                  ORVENA / ORÇAMENTOS
                </Text>

                <Text
                  style={[
                    styles.headerTitle,
                    isDesktop && styles.headerTitleDesktop,
                  ]}
                >
                  Novo orçamento
                </Text>

                <Text style={styles.headerSubtitle}>
                  Preencha as informações para criar uma proposta
                  profissional.
                </Text>
              </View>

              {isDesktop && (
                <View style={styles.headerBadge}>
                  <Ionicons
                    name="document-text-outline"
                    size={18}
                    color={C.purpleLight}
                  />
                  <Text style={styles.headerBadgeText}>
                    NOVA PROPOSTA
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.headerDivider} />

            {/* APRESENTAÇÃO */}

            <View style={styles.hero}>
              <View style={styles.heroGlow} />

              <View style={styles.heroContent}>
                <View style={styles.heroTag}>
                  <Ionicons
                    name="sparkles"
                    size={13}
                    color={C.white}
                  />
                  <Text style={styles.heroTagText}>
                    CRIAÇÃO DE ORÇAMENTO
                  </Text>
                </View>

                <Text style={styles.heroTitle}>
                  Sua próxima proposta começa aqui.
                </Text>

                <Text style={styles.heroSubtitle}>
                  Informe o cliente, descreva os serviços e acompanhe
                  o valor total automaticamente.
                </Text>
              </View>

              {isDesktop && (
                <Ionicons
                  name="documents-outline"
                  size={93}
                  color="rgba(255,255,255,0.22)"
                  style={styles.heroArt}
                />
              )}
            </View>

            {/* ERROS */}

            {erro ? (
              <View style={styles.pageError}>
                <Ionicons
                  name="alert-circle-outline"
                  size={23}
                  color={C.red}
                />
                <Text style={styles.pageErrorText}>
                  {erro}
                </Text>
              </View>
            ) : null}

            {sucesso ? (
              <View style={styles.pageSuccess}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={23}
                  color={C.green}
                />
                <Text style={styles.pageSuccessText}>
                  {sucesso}
                </Text>
              </View>
            ) : null}

            {/* CONTEÚDO */}

            <View
              style={[
                styles.columns,
                isDesktop && styles.columnsDesktop,
              ]}
            >
              <View style={styles.mainColumn}>
                {/* CLIENTE */}

                <SectionCard
                  number="01"
                  icon="person-outline"
                  title="Dados do cliente"
                  subtitle="Identifique quem receberá a proposta."
                >
                  {carregandoCadastros ? (
                    <View style={styles.loadingCatalog}>
                      <ActivityIndicator
                        color={C.purpleLight}
                        size="small"
                      />
                      <Text style={styles.catalogHint}>
                        Carregando seus cadastros...
                      </Text>
                    </View>
                  ) : clientesCadastrados.length > 0 ? (
                    <View style={styles.catalogArea}>
                      <Text style={styles.catalogLabel}>
                        SELECIONAR CLIENTE CADASTRADO
                      </Text>

                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.chips}
                      >
                        {clientesCadastrados.map((cliente) => (
                          <Chip
                            key={cliente.id}
                            label={cliente.nome}
                            active={
                              clienteSelecionadoId === cliente.id
                            }
                            onPress={() =>
                              selecionarCliente(cliente)
                            }
                          />
                        ))}

                        {clienteSelecionadoId && (
                          <Chip
                            label="Digitar outro"
                            icon="add"
                            onPress={() => {
                              setClienteSelecionadoId(null);
                              setObraSelecionadaId(null);
                            }}
                          />
                        )}
                      </ScrollView>

                      <Text style={styles.catalogHint}>
                        Os dados disponíveis serão preenchidos
                        automaticamente.
                      </Text>
                    </View>
                  ) : null}

                  <Field
                    label="Nome do cliente"
                    required
                  >
                    <TextInput
                      value={clienteNome}
                      onChangeText={(valor) => {
                        setClienteNome(valor);
                        setClienteSelecionadoId(null);
                      }}
                      placeholder="Ex.: João da Silva"
                      placeholderTextColor={C.faint}
                      style={styles.input}
                    />
                  </Field>

                  <View
                    style={[
                      styles.fieldsRow,
                      duasColunas && styles.fieldsRowDesktop,
                    ]}
                  >
                    <View style={styles.fieldFlex}>
                      <Field label="Telefone">
                        <TextInput
                          value={clienteTelefone}
                          onChangeText={setClienteTelefone}
                          placeholder="(81) 99999-9999"
                          placeholderTextColor={C.faint}
                          keyboardType="phone-pad"
                          style={styles.input}
                        />
                      </Field>
                    </View>

                    <View style={styles.fieldFlex}>
                      <Field label="E-mail">
                        <TextInput
                          value={clienteEmail}
                          onChangeText={setClienteEmail}
                          placeholder="cliente@email.com"
                          placeholderTextColor={C.faint}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          style={styles.input}
                        />
                      </Field>
                    </View>
                  </View>

                  <View style={styles.subsectionHeader}>
                    <Ionicons
                      name="location-outline"
                      size={18}
                      color={C.purpleLight}
                    />
                    <Text style={styles.subsectionTitle}>
                      Endereço do cliente
                    </Text>
                  </View>

                  <Field label="CEP" required>
                    <View style={styles.cepRow}>
                      <TextInput
                        value={clienteCep}
                        onChangeText={alterarCep}
                        placeholder="00000-000"
                        placeholderTextColor={C.faint}
                        keyboardType="number-pad"
                        maxLength={9}
                        style={[
                          styles.input,
                          styles.cepInput,
                        ]}
                      />

                      <Pressable
                        style={[
                          styles.cepButton,
                          buscandoCep && styles.disabled,
                        ]}
                        onPress={() =>
                          void buscarCep(clienteCep)
                        }
                        disabled={buscandoCep}
                      >
                        {buscandoCep ? (
                          <ActivityIndicator
                            color={C.white}
                            size="small"
                          />
                        ) : (
                          <>
                            <Ionicons
                              name="search-outline"
                              size={17}
                              color={C.white}
                            />
                            <Text style={styles.cepButtonText}>
                              Buscar
                            </Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </Field>

                  {erroCep ? (
                    <Text style={styles.cepError}>
                      {erroCep}
                    </Text>
                  ) : null}

                  {clienteLogradouro ||
                  clienteBairro ||
                  clienteCidade ||
                  clienteUf ? (
                    <View style={styles.addressBox}>
                      <View style={styles.addressHeader}>
                        <Ionicons
                          name="checkmark-circle"
                          size={19}
                          color={C.green}
                        />
                        <Text style={styles.addressTitle}>
                          Endereço encontrado
                        </Text>
                      </View>

                      <Text style={styles.addressText}>
                        {[
                          clienteLogradouro,
                          clienteBairro,
                          clienteCidade,
                          clienteUf,
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                      </Text>

                      {clienteEstado ? (
                        <Text style={styles.addressState}>
                          {clienteEstado}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  <View
                    style={[
                      styles.fieldsRow,
                      duasColunas && styles.fieldsRowDesktop,
                    ]}
                  >
                    <View style={styles.fieldFlex}>
                      <Field label="Número" required>
                        <TextInput
                          value={clienteNumero}
                          onChangeText={setClienteNumero}
                          placeholder="Ex.: 125"
                          placeholderTextColor={C.faint}
                          style={styles.input}
                        />
                      </Field>
                    </View>

                    <View style={styles.fieldFlex}>
                      <Field label="Complemento">
                        <TextInput
                          value={clienteComplemento}
                          onChangeText={setClienteComplemento}
                          placeholder="Apto, casa, bloco..."
                          placeholderTextColor={C.faint}
                          style={styles.input}
                        />
                      </Field>
                    </View>
                  </View>
                </SectionCard>

                {/* ORÇAMENTO */}

                <SectionCard
                  number="02"
                  icon="document-text-outline"
                  title="Informações da proposta"
                  subtitle="Defina o trabalho e a validade do orçamento."
                >
                  {obrasCadastradas.length > 0 ? (
                    <View style={styles.catalogArea}>
                      <Text style={styles.catalogLabel}>
                        VINCULAR A UMA OBRA
                      </Text>

                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.chips}
                      >
                        <Chip
                          label="Sem obra"
                          active={!obraSelecionadaId}
                          onPress={() =>
                            setObraSelecionadaId(null)
                          }
                        />

                        {obrasCadastradas.map((obra) => (
                          <Chip
                            key={obra.id}
                            label={obra.nome}
                            active={
                              obraSelecionadaId === obra.id
                            }
                            onPress={() => selecionarObra(obra)}
                          />
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}

                  <Field label="Título do orçamento" required>
                    <TextInput
                      value={titulo}
                      onChangeText={setTitulo}
                      placeholder="Ex.: Reforma de cozinha"
                      placeholderTextColor={C.faint}
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Descrição">
                    <TextInput
                      value={descricao}
                      onChangeText={setDescricao}
                      placeholder="Descreva brevemente o serviço..."
                      placeholderTextColor={C.faint}
                      multiline
                      textAlignVertical="top"
                      style={[
                        styles.input,
                        styles.textArea,
                      ]}
                    />
                  </Field>

                  <Field label="Validade da proposta (dias)" required>
                    <TextInput
                      value={validadeDias}
                      onChangeText={(valor) =>
                        setValidadeDias(
                          valor.replace(/\D/g, "")
                        )
                      }
                      placeholder="15"
                      placeholderTextColor={C.faint}
                      keyboardType="number-pad"
                      style={styles.input}
                    />
                  </Field>
                </SectionCard>

                {/* ITENS */}

                <SectionCard
                  number="03"
                  icon="construct-outline"
                  title="Itens e serviços"
                  subtitle="Monte sua proposta com os valores detalhados."
                  accessory={`${itens.length} item(ns)`}
                >
                  <View style={styles.itemsList}>
                    {itens.map((item, index) => {
                      const quantidade = normalizarNumero(
                        item.quantidade
                      );

                      const valorUnitario = normalizarNumero(
                        item.valorUnitario
                      );

                      const itemTotal =
                        quantidade * valorUnitario;

                      return (
                        <View
                          key={item.id}
                          style={styles.itemCard}
                        >
                          <View style={styles.itemHeader}>
                            <View style={styles.itemHeading}>
                              <View style={styles.itemNumber}>
                                <Text style={styles.itemNumberText}>
                                  {String(index + 1).padStart(2, "0")}
                                </Text>
                              </View>

                              <View>
                                <Text style={styles.itemTitle}>
                                  Item {index + 1}
                                </Text>

                                <Text style={styles.itemSubtitle}>
                                  Detalhes do serviço
                                </Text>
                              </View>
                            </View>

                            {itens.length > 1 && (
                              <Pressable
                                style={styles.removeButton}
                                onPress={() =>
                                  removerItem(item.id)
                                }
                                disabled={salvando}
                              >
                                <Ionicons
                                  name="trash-outline"
                                  size={17}
                                  color={C.red}
                                />
                                <Text style={styles.removeText}>
                                  Remover
                                </Text>
                              </Pressable>
                            )}
                          </View>

                          {servicosCadastrados.length > 0 && (
                            <View style={styles.catalogArea}>
                              <Text style={styles.catalogLabel}>
                                USAR SERVIÇO CADASTRADO
                              </Text>

                              <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.chips}
                              >
                                {servicosCadastrados.map(
                                  (servico) => (
                                    <Chip
                                      key={servico.id}
                                      label={`${servico.nome} • ${formatarMoeda(
                                        Number(
                                          servico.valor_unitario || 0
                                        )
                                      )}`}
                                      active={
                                        item.servicoId ===
                                        servico.id
                                      }
                                      onPress={() =>
                                        selecionarServico(
                                          item.id,
                                          servico
                                        )
                                      }
                                    />
                                  )
                                )}
                              </ScrollView>
                            </View>
                          )}

                          <Field label="Descrição" required>
                            <TextInput
                              value={item.descricao}
                              onChangeText={(valor) =>
                                atualizarItem(
                                  item.id,
                                  "descricao",
                                  valor
                                )
                              }
                              placeholder="Ex.: Instalação elétrica"
                              placeholderTextColor={C.faint}
                              style={styles.input}
                            />
                          </Field>

                          <View
                            style={[
                              styles.fieldsRow,
                              duasColunas &&
                                styles.fieldsRowDesktop,
                            ]}
                          >
                            <View style={styles.fieldFlex}>
                              <Field label="Quantidade" required>
                                <TextInput
                                  value={item.quantidade}
                                  onChangeText={(valor) =>
                                    atualizarItem(
                                      item.id,
                                      "quantidade",
                                      valor
                                    )
                                  }
                                  placeholder="1"
                                  placeholderTextColor={C.faint}
                                  keyboardType="decimal-pad"
                                  style={styles.input}
                                />
                              </Field>
                            </View>

                            <View style={styles.fieldFlex}>
                              <Field
                                label="Valor unitário (R$)"
                                required
                              >
                                <TextInput
                                  value={item.valorUnitario}
                                  onChangeText={(valor) =>
                                    atualizarItem(
                                      item.id,
                                      "valorUnitario",
                                      valor
                                    )
                                  }
                                  placeholder="0,00"
                                  placeholderTextColor={C.faint}
                                  keyboardType="decimal-pad"
                                  style={styles.input}
                                />
                              </Field>
                            </View>
                          </View>

                          <View style={styles.itemTotalRow}>
                            <Text style={styles.itemTotalLabel}>
                              Total deste item
                            </Text>

                            <Text style={styles.itemTotal}>
                              {formatarMoeda(itemTotal)}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  <Pressable
                    style={styles.addItemButton}
                    onPress={adicionarItem}
                    disabled={salvando}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={20}
                      color={C.purpleLight}
                    />

                    <Text style={styles.addItemText}>
                      Adicionar outro item
                    </Text>
                  </Pressable>
                </SectionCard>

                {/* VALORES */}

                <SectionCard
                  number="04"
                  icon="wallet-outline"
                  title="Valores e pagamento"
                  subtitle="Ajuste o preço final e as condições comerciais."
                >
                  <View
                    style={[
                      styles.fieldsRow,
                      duasColunas &&
                        styles.fieldsRowDesktop,
                    ]}
                  >
                    <View style={styles.fieldFlex}>
                      <Field label="Acréscimo / taxa extra (R$)">
                        <TextInput
                          value={acrescimo}
                          onChangeText={setAcrescimo}
                          placeholder="0,00"
                          placeholderTextColor={C.faint}
                          keyboardType="decimal-pad"
                          style={styles.input}
                        />
                      </Field>
                    </View>

                    <View style={styles.fieldFlex}>
                      <Field label="Desconto (R$)">
                        <TextInput
                          value={desconto}
                          onChangeText={setDesconto}
                          placeholder="0,00"
                          placeholderTextColor={C.faint}
                          keyboardType="decimal-pad"
                          style={styles.input}
                        />
                      </Field>
                    </View>
                  </View>

                  <Field label="Forma de pagamento">
                    <TextInput
                      value={formaPagamento}
                      onChangeText={setFormaPagamento}
                      placeholder="Ex.: Pix, dinheiro, cartão..."
                      placeholderTextColor={C.faint}
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Condições de pagamento">
                    <TextInput
                      value={condicoesPagamento}
                      onChangeText={setCondicoesPagamento}
                      placeholder="Ex.: 50% de entrada e restante na entrega..."
                      placeholderTextColor={C.faint}
                      multiline
                      textAlignVertical="top"
                      style={[
                        styles.input,
                        styles.textArea,
                      ]}
                    />
                  </Field>
                </SectionCard>

                {/* OBSERVAÇÕES */}

                <SectionCard
                  number="05"
                  icon="chatbox-ellipses-outline"
                  title="Observações"
                  subtitle="Adicione instruções e detalhes complementares."
                >
                  <Field label="Informações adicionais">
                    <TextInput
                      value={observacoes}
                      onChangeText={setObservacoes}
                      placeholder="Ex.: Materiais inclusos, prazo de execução, condições especiais..."
                      placeholderTextColor={C.faint}
                      multiline
                      textAlignVertical="top"
                      style={[
                        styles.input,
                        styles.textAreaLarge,
                      ]}
                    />
                  </Field>
                </SectionCard>
              </View>

{/* RESUMO */}

<View
  style={[
    styles.sideColumn,
    isDesktop && styles.sideColumnDesktop,
  ]}
>
  <View style={styles.summaryCard}>
    <View style={styles.summaryTop}>
                    <View style={styles.summaryIcon}>
                      <Ionicons
                        name="calculator-outline"
                        size={23}
                        color={C.purpleLight}
                      />
                    </View>

                    <View style={styles.summaryHeading}>
                      <Text style={styles.summaryEyebrow}>
                        VISÃO FINANCEIRA
                      </Text>

                      <Text style={styles.summaryTitle}>
                        Resumo da proposta
                      </Text>
                    </View>
                  </View>

                  <View style={styles.summaryDivider} />

                  <SummaryRow
                    label="Itens / serviços"
                    value={String(itens.length)}
                  />

                  <SummaryRow
                    label="Itens preenchidos"
                    value={String(itensPreenchidos)}
                  />

                  <View style={styles.summaryDivider} />

                  <SummaryRow
                    label="Subtotal"
                    value={formatarMoeda(subtotal)}
                  />

                  {acrescimoNumero > 0 && (
                    <SummaryRow
                      label="Acréscimo"
                      value={`+ ${formatarMoeda(
                        acrescimoNumero
                      )}`}
                    />
                  )}

                  {descontoNumero > 0 && (
                    <SummaryRow
                      label="Desconto"
                      value={`- ${formatarMoeda(
                        descontoNumero
                      )}`}
                    />
                  )}

                  <View style={styles.summaryDivider} />

                  <View style={styles.totalBox}>
                    <Text style={styles.totalLabel}>
                      TOTAL DO ORÇAMENTO
                    </Text>

                    <Text
                      style={styles.totalValue}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.65}
                    >
                      {formatarMoeda(total)}
                    </Text>

                    <Text style={styles.totalFormula}>
                      Subtotal + acréscimos − descontos
                    </Text>
                  </View>

{Boolean(
  formaPagamento.trim() || condicoesPagamento.trim()
) && (
                    <View style={styles.paymentBox}>
                      <View style={styles.paymentHeader}>
                        <Ionicons
                          name="card-outline"
                          size={17}
                          color={C.purpleLight}
                        />

                        <Text style={styles.paymentTitle}>
                          PAGAMENTO
                        </Text>
                      </View>

                      {formaPagamento.trim() ? (
                        <Text style={styles.paymentText}>
                          {formaPagamento.trim()}
                        </Text>
                      ) : null}

                      {condicoesPagamento.trim() ? (
                        <Text style={styles.paymentConditions}>
                          {condicoesPagamento.trim()}
                        </Text>
                      ) : null}
                    </View>
                  )}

                  <View style={styles.summaryNotice}>
                    <Ionicons
                      name="information-circle-outline"
                      size={19}
                      color={C.purpleLight}
                    />

                    <Text style={styles.summaryNoticeText}>
                      Confira os dados antes de salvar. O
                      orçamento será criado como rascunho.
                    </Text>
                  </View>

                  <Pressable
                    style={[
                      styles.saveButton,
                      salvando && styles.disabled,
                    ]}
                    onPress={() =>
                      void salvarOrcamento()
                    }
                    disabled={salvando}
                  >
                    {salvando ? (
                      <>
                        <ActivityIndicator
                          color={C.white}
                          size="small"
                        />

                        <Text style={styles.saveText}>
                          Salvando...
                        </Text>
                      </>
                    ) : (
                      <>
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={20}
                          color={C.white}
                        />

                        <Text style={styles.saveText}>
                          Salvar orçamento
                        </Text>
                      </>
                    )}
                  </Pressable>

                  <Pressable
                    style={styles.cancelButton}
                    onPress={() =>
                      router.replace("/orcamentos" as any)
                    }
                    disabled={salvando}
                  >
                    <Text style={styles.cancelText}>
                      Cancelar
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.helpCard}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={21}
                    color={C.green}
                  />

                  <View style={styles.helpContent}>
                    <Text style={styles.helpTitle}>
                      Cálculo automático
                    </Text>

                    <Text style={styles.helpText}>
                      O total é atualizado enquanto você preenche
                      os itens e os valores.
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <Text style={styles.footer}>
              ORVENA · SEU NEGÓCIO, ORGANIZADO
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SectionCard({
  number,
  icon,
  title,
  subtitle,
  accessory,
  children,
}: {
  number: string;
  icon: IconName;
  title: string;
  subtitle: string;
  accessory?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons
            name={icon}
            size={22}
            color={C.purpleLight}
          />
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionNumber}>
            ETAPA {number}
          </Text>

          <Text style={styles.sectionTitle}>
            {title}
          </Text>

          <Text style={styles.sectionSubtitle}>
            {subtitle}
          </Text>
        </View>

        {accessory ? (
          <View style={styles.sectionAccessory}>
            <Text style={styles.sectionAccessoryText}>
              {accessory}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.sectionDivider} />

      {children}
    </View>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? (
          <Text style={styles.required}> *</Text>
        ) : null}
      </Text>

      {children}
    </View>
  );
}

function Chip({
  label,
  active = false,
  icon,
  onPress,
}: {
  label: string;
  active?: boolean;
  icon?: IconName;
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
      {icon ? (
        <Ionicons
          name={icon}
          size={15}
          color={
            active ? C.white : C.purpleLight
          }
        />
      ) : null}

      <Text
        style={[
          styles.chipText,
          active && styles.chipTextActive,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryRowLabel}>
        {label}
      </Text>

      <Text style={styles.summaryRowValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: C.bg,
  },

  flex: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
  },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 15,
    padding: 25,
  },

  loadingText: {
    color: C.muted,
    fontSize: 13,
  },

  page: {
    width: "100%",
    maxWidth: 1400,
    alignSelf: "center",
    paddingHorizontal: 17,
    paddingTop: 20,
    paddingBottom: 55,
  },

  pageDesktop: {
    paddingHorizontal: 36,
    paddingTop: 29,
    paddingBottom: 65,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  headerInfo: {
    flex: 1,
  },

  eyebrow: {
    color: C.purpleLight,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.3,
  },

  headerTitle: {
    color: C.text,
    fontSize: 25,
    fontWeight: "900",
    marginTop: 5,
  },

  headerTitleDesktop: {
    fontSize: 31,
  },

  headerSubtitle: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },

  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: "#42365E",
    backgroundColor: "#1A1729",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },

  headerBadgeText: {
    color: C.purpleLight,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  headerDivider: {
    height: 1,
    backgroundColor: C.border,
    marginTop: 23,
    marginBottom: 25,
  },

  hero: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#6449D4",
    backgroundColor: "#4F36BD",
    minHeight: 180,
    padding: 23,
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 23,
  },

  heroGlow: {
    position: "absolute",
    right: -100,
    top: -170,
    width: 410,
    height: 410,
    borderRadius: 205,
    backgroundColor: "#7558F5",
    opacity: 0.54,
  },

  heroContent: {
    maxWidth: 660,
    zIndex: 1,
  },

  heroTag: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 11,
  },

  heroTagText: {
    color: C.white,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  heroTitle: {
    color: C.white,
    fontSize: 23,
    fontWeight: "900",
    lineHeight: 30,
    marginTop: 14,
  },

  heroSubtitle: {
    color: "#E6DFFF",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 7,
    maxWidth: 490,
  },

  heroArt: {
    position: "absolute",
    right: 80,
    top: 38,
    transform: [{ rotate: "11deg" }],
  },

  pageError: {
    borderWidth: 1,
    borderColor: "#65343D",
    backgroundColor: "#29171C",
    padding: 16,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },

  pageErrorText: {
    color: C.red,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 19,
    flex: 1,
  },

  pageSuccess: {
    borderWidth: 1,
    borderColor: "#285A42",
    backgroundColor: "#102019",
    padding: 16,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },

  pageSuccessText: {
    color: C.green,
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },

  columns: {
    gap: 18,
  },

  columnsDesktop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  mainColumn: {
    flex: 1,
    gap: 17,
    minWidth: 0,
  },

  sideColumn: {
    width: "100%",
    gap: 14,
  },

  sideColumnDesktop: {
    width: 355,
  },

  sectionCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 21,
    padding: 19,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  sectionIcon: {
    width: 45,
    height: 45,
    borderRadius: 13,
    backgroundColor: "#251F3B",
    alignItems: "center",
    justifyContent: "center",
  },

  sectionHeading: {
    flex: 1,
  },

  sectionNumber: {
    color: C.purpleLight,
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: "900",
    marginBottom: 4,
  },

  sectionTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: "900",
  },

  sectionSubtitle: {
    color: C.muted,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 4,
  },

  sectionAccessory: {
    backgroundColor: "#251F3B",
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 9,
  },

  sectionAccessoryText: {
    color: C.purpleLight,
    fontSize: 9,
    fontWeight: "900",
  },

  sectionDivider: {
    height: 1,
    backgroundColor: C.border,
    marginTop: 18,
    marginBottom: 8,
  },

  field: {
    marginTop: 13,
  },

  fieldLabel: {
    color: "#C5C8D3",
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 8,
  },

  required: {
    color: C.purpleLight,
    fontWeight: "900",
  },

  input: {
    minHeight: 49,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.input,
    color: C.text,
    fontSize: 13,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },

  textArea: {
    minHeight: 98,
    paddingTop: 13,
    paddingBottom: 13,
  },

  textAreaLarge: {
    minHeight: 125,
    paddingTop: 13,
    paddingBottom: 13,
  },

  fieldsRow: {
    gap: 0,
  },

  fieldsRowDesktop: {
    flexDirection: "row",
    gap: 12,
  },

  fieldFlex: {
    flex: 1,
    minWidth: 0,
  },

  subsectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 24,
    marginBottom: 3,
  },

  subsectionTitle: {
    color: C.text,
    fontSize: 13,
    fontWeight: "900",
  },

  catalogArea: {
    marginTop: 13,
    marginBottom: 7,
  },

  catalogLabel: {
    color: C.purpleLight,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  chips: {
    gap: 8,
    paddingRight: 12,
  },

  chip: {
    minHeight: 36,
    maxWidth: 280,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#363B49",
    backgroundColor: C.input,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
  },

  chipActive: {
    borderColor: "#6E57D9",
    backgroundColor: "#261F40",
  },

  chipText: {
    color: C.muted,
    fontSize: 10,
    fontWeight: "800",
  },

  chipTextActive: {
    color: "#E0D9FF",
  },

  catalogHint: {
    color: C.faint,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 8,
  },

  loadingCatalog: {
    minHeight: 49,
    backgroundColor: C.input,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 13,
    marginBottom: 12,
  },

  cepRow: {
    flexDirection: "row",
    gap: 9,
  },

  cepInput: {
    flex: 1,
    minWidth: 0,
  },

  cepButton: {
    minWidth: 105,
    borderRadius: 12,
    backgroundColor: C.purple,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 13,
    gap: 6,
  },

  cepButtonText: {
    color: C.white,
    fontSize: 11,
    fontWeight: "900",
  },

  disabled: {
    opacity: 0.62,
  },

  cepError: {
    color: C.red,
    fontSize: 11,
    marginTop: 8,
  },

  addressBox: {
    backgroundColor: "#102019",
    borderColor: "#285A42",
    borderWidth: 1,
    borderRadius: 13,
    padding: 13,
    marginTop: 13,
  },

  addressHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  addressTitle: {
    color: "#C6F9DE",
    fontSize: 12,
    fontWeight: "900",
  },

  addressText: {
    color: "#A8CBB8",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 8,
  },

  addressState: {
    color: "#749B83",
    fontSize: 10,
    marginTop: 4,
  },

  itemsList: {
    gap: 13,
    marginTop: 10,
  },

  itemCard: {
    backgroundColor: C.input,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 15,
  },

  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 5,
  },

  itemHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },

  itemNumber: {
    width: 37,
    height: 37,
    borderRadius: 11,
    backgroundColor: "#251F3B",
    alignItems: "center",
    justifyContent: "center",
  },

  itemNumberText: {
    color: C.purpleLight,
    fontSize: 12,
    fontWeight: "900",
  },

  itemTitle: {
    color: C.text,
    fontSize: 13,
    fontWeight: "900",
  },

  itemSubtitle: {
    color: C.faint,
    fontSize: 10,
    marginTop: 3,
  },

  removeButton: {
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#54303A",
    backgroundColor: "#29191F",
    paddingHorizontal: 9,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  removeText: {
    color: C.red,
    fontSize: 10,
    fontWeight: "900",
  },

  itemTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 15,
    marginTop: 18,
  },

  itemTotalLabel: {
    color: C.muted,
    fontSize: 11,
  },

  itemTotal: {
    color: C.purpleLight,
    fontSize: 16,
    fontWeight: "900",
  },

  addItemButton: {
    minHeight: 49,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#493B77",
    backgroundColor: "#201A33",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 16,
  },

  addItemText: {
    color: C.purpleLight,
    fontSize: 12,
    fontWeight: "900",
  },

  summaryCard: {
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#3D3357",
    backgroundColor: "#181524",
    padding: 19,
  },

  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },

  summaryIcon: {
    width: 47,
    height: 47,
    borderRadius: 14,
    backgroundColor: "#2B2242",
    alignItems: "center",
    justifyContent: "center",
  },

  summaryHeading: {
    flex: 1,
  },

  summaryEyebrow: {
    color: C.purpleLight,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
  },

  summaryTitle: {
    color: C.text,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 4,
  },

  summaryDivider: {
    height: 1,
    backgroundColor: "#343047",
    marginVertical: 17,
  },

  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginVertical: 6,
  },

  summaryRowLabel: {
    color: C.muted,
    fontSize: 11,
    flex: 1,
  },

  summaryRowValue: {
    color: C.text,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
  },

  totalBox: {
    backgroundColor: "#2A2047",
    borderRadius: 15,
    padding: 17,
  },

  totalLabel: {
    color: "#D1C8FF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },

  totalValue: {
    color: C.white,
    fontSize: 29,
    fontWeight: "900",
    marginTop: 8,
  },

  totalFormula: {
    color: "#A99ACC",
    fontSize: 10,
    lineHeight: 16,
    marginTop: 6,
  },

  paymentBox: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.input,
    borderRadius: 13,
    padding: 13,
    marginTop: 16,
  },

  paymentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  paymentTitle: {
    color: C.purpleLight,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  paymentText: {
    color: C.text,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 9,
  },

  paymentConditions: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 8,
  },

  summaryNotice: {
    flexDirection: "row",
    gap: 10,
    borderWidth: 1,
    borderColor: "#3F355B",
    backgroundColor: "#211C32",
    borderRadius: 13,
    padding: 13,
    marginTop: 17,
  },

  summaryNoticeText: {
    color: "#B7B1C8",
    fontSize: 11,
    lineHeight: 17,
    flex: 1,
  },

  saveButton: {
    minHeight: 53,
    borderRadius: 13,
    backgroundColor: C.purple,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 19,
  },

  saveText: {
    color: C.white,
    fontSize: 12,
    fontWeight: "900",
  },

  cancelButton: {
    minHeight: 45,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },

  cancelText: {
    color: C.muted,
    fontSize: 12,
    fontWeight: "800",
  },

  helpCard: {
    backgroundColor: "#101B17",
    borderColor: "#285A42",
    borderWidth: 1,
    borderRadius: 15,
    padding: 16,
    flexDirection: "row",
    gap: 11,
  },

  helpContent: {
    flex: 1,
  },

  helpTitle: {
    color: "#D4FDE7",
    fontSize: 12,
    fontWeight: "900",
  },

  helpText: {
    color: "#93B7A2",
    fontSize: 10,
    lineHeight: 17,
    marginTop: 4,
  },

  footer: {
    textAlign: "center",
    color: C.faint,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginTop: 37,
  },
});