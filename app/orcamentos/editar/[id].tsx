import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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

import { supabase } from "../../../lib/supabase";

type ItemOrcamento = {
  id: string;
  descricao: string;
  quantidade: string;
  valorUnitario: string;
};

type ItemOrcamentoBanco = {
  id: string;
  descricao: string | null;
  quantidade: number | string | null;
  valor_unitario: number | string | null;
  ordem: number | null;
};

function criarIdLocal() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizarNumero(valor: string) {
  const limpo = valor
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const numero = Number(limpo);

  if (!Number.isFinite(numero)) {
    return 0;
  }

  return numero;
}

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

export default function EditarOrcamentoScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [clienteNome, setClienteNome] = useState("");
  const [clienteTelefone, setClienteTelefone] = useState("");
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
  const [clienteEmail, setClienteEmail] = useState("");

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [validadeDias, setValidadeDias] = useState("15");
  const [desconto, setDesconto] = useState("0");
  const [maoDeObra, setMaoDeObra] = useState("0");
  const [outrosGastos, setOutrosGastos] = useState("0");
  const [acrescimo, setAcrescimo] = useState("0");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [condicoesPagamento, setCondicoesPagamento] = useState("");

  const [itens, setItens] = useState<ItemOrcamento[]>([
    {
      id: criarIdLocal(),
      descricao: "",
      quantidade: "1",
      valorUnitario: "",
    },
  ]);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const subtotal = useMemo(() => {
    return itens.reduce((acc, item) => {
      const quantidade = normalizarNumero(item.quantidade);
      const valorUnitario = normalizarNumero(item.valorUnitario);

      return acc + quantidade * valorUnitario;
    }, 0);
  }, [itens]);

  const descontoNumero = useMemo(() => {
    const valor = normalizarNumero(desconto);
    return valor < 0 ? 0 : valor;
  }, [desconto]);

  const maoDeObraNumero = useMemo(() => {
    const valor = normalizarNumero(maoDeObra);
    return valor < 0 ? 0 : valor;
  }, [maoDeObra]);

  const outrosGastosNumero = useMemo(() => {
    const valor = normalizarNumero(outrosGastos);
    return valor < 0 ? 0 : valor;
  }, [outrosGastos]);

  const acrescimoNumero = useMemo(() => {
    const valor = normalizarNumero(acrescimo);
    return valor < 0 ? 0 : valor;
  }, [acrescimo]);

  const total = Math.max(
    subtotal +
      maoDeObraNumero +
      outrosGastosNumero +
      acrescimoNumero -
      descontoNumero,
    0
  );

  useEffect(() => {
    void carregarOrcamento();
  }, [id]);

  async function carregarOrcamento() {
    if (!id) {
      setErro("Orçamento não encontrado.");
      setCarregando(false);
      return;
    }

    try {
      setCarregando(true);
      setErro("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErro("Sua sessão expirou. Entre novamente.");
        return;
      }

      const { data: orcamento, error: orcamentoError } = await supabase
        .from("orcamentos")
        .select(
          "id, cliente_nome, cliente_telefone, cliente_email, cliente_cep, cliente_logradouro, cliente_numero, cliente_complemento, cliente_bairro, cliente_cidade, cliente_uf, cliente_estado, titulo, descricao, observacoes, validade_dias, desconto, mao_de_obra, outros_gastos, acrescimo, forma_pagamento, condicoes_pagamento"
        )
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (orcamentoError || !orcamento) {
        setErro(
          orcamentoError?.message || "Não foi possível carregar o orçamento."
        );
        return;
      }

      const { data: itensData, error: itensError } = await supabase
        .from("orcamento_itens")
        .select("id, descricao, quantidade, valor_unitario, ordem")
        .eq("orcamento_id", id)
        .eq("user_id", user.id)
        .order("ordem", { ascending: true });

      if (itensError) {
        setErro(itensError.message);
        return;
      }

      setClienteNome(orcamento.cliente_nome || "");
      setClienteTelefone(orcamento.cliente_telefone || "");
      setClienteEmail(orcamento.cliente_email || "");
      setClienteCep(
        orcamento.cliente_cep
          ? formatarCep(orcamento.cliente_cep)
          : ""
      );
      setClienteLogradouro(orcamento.cliente_logradouro || "");
      setClienteNumero(orcamento.cliente_numero || "");
      setClienteComplemento(orcamento.cliente_complemento || "");
      setClienteBairro(orcamento.cliente_bairro || "");
      setClienteCidade(orcamento.cliente_cidade || "");
      setClienteUf(orcamento.cliente_uf || "");
      setClienteEstado(orcamento.cliente_estado || "");

      setTitulo(orcamento.titulo || "");
      setDescricao(orcamento.descricao || "");
      setObservacoes(orcamento.observacoes || "");
      setValidadeDias(String(orcamento.validade_dias || 15));

      setDesconto(String(orcamento.desconto || 0));
      setMaoDeObra(String(orcamento.mao_de_obra || 0));
      setOutrosGastos(String(orcamento.outros_gastos || 0));
      setAcrescimo(String(orcamento.acrescimo || 0));
      setFormaPagamento(orcamento.forma_pagamento || "");
      setCondicoesPagamento(orcamento.condicoes_pagamento || "");

      if (itensData && itensData.length > 0) {
        setItens(
          (itensData as ItemOrcamentoBanco[]).map((item) => ({
            id: item.id,
            descricao: item.descricao || "",
            quantidade: String(item.quantidade ?? 1),
            valorUnitario: String(item.valor_unitario ?? 0),
          }))
        );
      }
    } catch {
      setErro("Não foi possível carregar este orçamento.");
    } finally {
      setCarregando(false);
    }
  }

  function formatarCep(valor: string) {
    const numeros = valor.replace(/\D/g, "").slice(0, 8);

    if (numeros.length <= 5) {
      return numeros;
    }

    return `${numeros.slice(0, 5)}-${numeros.slice(5)}`;
  }

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
      return;
    }

    try {
      setBuscandoCep(true);
      setErroCep("");

      const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);

      if (!resposta.ok) {
        limparEnderecoCep();
        setErroCep("Não foi possível consultar este CEP.");
        return;
      }

      const dados = await resposta.json();

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
      limparEnderecoCep();
      setErroCep("Não foi possível consultar o CEP. Verifique sua conexão.");
    } finally {
      setBuscandoCep(false);
    }
  }

  function voltar() {
    if (id) {
      router.replace({
        pathname: "/orcamentos/[id]" as any,
        params: { id },
      });
      return;
    }

    router.replace("/orcamentos" as any);
  }

  function atualizarItem(
    id: string,
    campo: keyof Omit<ItemOrcamento, "id">,
    valor: string
  ) {
    setItens((atuais) =>
      atuais.map((item) =>
        item.id === id
          ? {
              ...item,
              [campo]: valor,
            }
          : item
      )
    );
  }

  function adicionarItem() {
    setItens((atuais) => [
      ...atuais,
      {
        id: criarIdLocal(),
        descricao: "",
        quantidade: "1",
        valorUnitario: "",
      },
    ]);
  }

  function removerItem(id: string) {
    setItens((atuais) => {
      if (atuais.length === 1) {
        return atuais;
      }

      return atuais.filter((item) => item.id !== id);
    });
  }

  function validar() {
    if (!clienteNome.trim()) {
      setErro("Informe o nome do cliente.");
      return false;
    }

    if (clienteCep.replace(/\D/g, "").length !== 8) {
      setErro("Informe um CEP válido com 8 dígitos.");
      return false;
    }

    if (!clienteLogradouro && !clienteCidade) {
      setErro("Consulte o CEP antes de salvar o orçamento.");
      return false;
    }

    if (!clienteNumero.trim()) {
      setErro("Informe o número do endereço do cliente.");
      return false;
    }

    if (!titulo.trim()) {
      setErro("Informe um título para o orçamento.");
      return false;
    }

    const validade = Number(validadeDias);

    if (!Number.isInteger(validade) || validade <= 0) {
      setErro("Informe uma validade em dias válida.");
      return false;
    }

    if (itens.length === 0) {
      setErro("Adicione pelo menos um item ao orçamento.");
      return false;
    }

    for (let i = 0; i < itens.length; i += 1) {
      const item = itens[i];
      const quantidade = normalizarNumero(item.quantidade);
      const valorUnitario = normalizarNumero(item.valorUnitario);

      if (!item.descricao.trim()) {
        setErro(`Informe a descrição do item ${i + 1}.`);
        return false;
      }

      if (quantidade <= 0) {
        setErro(`A quantidade do item ${i + 1} precisa ser maior que zero.`);
        return false;
      }

      if (valorUnitario < 0) {
        setErro(`O valor do item ${i + 1} não pode ser negativo.`);
        return false;
      }
    }

    if (subtotal <= 0) {
      setErro(
        "Informe pelo menos um item ou serviço com valor maior que zero."
      );
      return false;
    }

    if (
      descontoNumero >
      subtotal + maoDeObraNumero + outrosGastosNumero + acrescimoNumero
    ) {
      setErro(
        "O desconto não pode ser maior que o valor total antes do desconto."
      );
      return false;
    }

    setErro("");
    return true;
  }

  async function salvarOrcamento() {
    if (!id || !validar()) {
      return;
    }

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

      const { error: updateError } = await supabase
        .from("orcamentos")
        .update({
          cliente_nome: clienteNome.trim(),
          cliente_telefone: clienteTelefone.trim() || null,
          cliente_cep: clienteCep.replace(/\D/g, "") || null,
          cliente_logradouro: clienteLogradouro.trim() || null,
          cliente_numero: clienteNumero.trim() || null,
          cliente_complemento: clienteComplemento.trim() || null,
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
          cliente_email: clienteEmail.trim().toLowerCase() || null,
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          observacoes: observacoes.trim() || null,
          validade_dias: Number(validadeDias),
          desconto: descontoNumero,
          mao_de_obra: maoDeObraNumero,
          outros_gastos: outrosGastosNumero,
          acrescimo: acrescimoNumero,
          forma_pagamento: formaPagamento.trim() || null,
          condicoes_pagamento: condicoesPagamento.trim() || null,
          subtotal,
          total,
        })
        .eq("id", id)
        .eq("user_id", user.id);

      if (updateError) {
        setErro(updateError.message);
        return;
      }

      const { error: deleteItensError } = await supabase
        .from("orcamento_itens")
        .delete()
        .eq("orcamento_id", id)
        .eq("user_id", user.id);

      if (deleteItensError) {
        setErro(
          `O orçamento foi atualizado, mas não foi possível atualizar os itens: ${deleteItensError.message}`
        );
        return;
      }

      const itensParaSalvar = itens.map((item, index) => {
        const quantidade = normalizarNumero(item.quantidade);
        const valorUnitario = normalizarNumero(item.valorUnitario);

        return {
          orcamento_id: id,
          user_id: user.id,
          descricao: item.descricao.trim(),
          quantidade,
          valor_unitario: valorUnitario,
          total: quantidade * valorUnitario,
          ordem: index,
        };
      });

      const { error: insertItensError } = await supabase
        .from("orcamento_itens")
        .insert(itensParaSalvar);

      if (insertItensError) {
        setErro(
          `Os dados principais foram atualizados, mas ocorreu um erro ao salvar os itens: ${insertItensError.message}`
        );
        return;
      }

      setSucesso("Orçamento atualizado com sucesso.");

      setTimeout(() => {
        router.replace({
          pathname: "/orcamentos/[id]" as any,
          params: { id },
        });
      }, 700);
    } catch {
      setErro("Não foi possível atualizar este orçamento. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color="#7C5CFF" />
          <Text style={styles.loadingText}>Carregando orçamento...</Text>
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
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.page}>
            <View style={styles.header}>
              <Pressable style={styles.backButton} onPress={voltar}>
                <Text style={styles.backButtonText}>←</Text>
              </Pressable>

              <View style={styles.headerTextArea}>
                <Text style={styles.headerEyebrow}>ORVENA</Text>
                <Text style={styles.headerTitle}>Editar orçamento</Text>
                <Text style={styles.headerSubtitle}>
                  Altere os dados necessários e salve as mudanças.
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.columns,
                isDesktop && styles.columnsDesktop,
              ]}
            >
              <View style={styles.mainColumn}>
                <SectionCard
                  title="Cliente"
                  subtitle="Informações de quem receberá o orçamento."
                >
                  <FieldLabel text="Nome do cliente *" />
                  <TextInput
                    value={clienteNome}
                    onChangeText={setClienteNome}
                    placeholder="Ex.: João da Silva"
                    placeholderTextColor="#545A65"
                    style={styles.input}
                  />

                  <View
                    style={[
                      styles.fieldGrid,
                      isDesktop && styles.fieldGridDesktop,
                    ]}
                  >
                    <View style={styles.fieldGridItem}>
                      <FieldLabel text="Telefone" />
                      <TextInput
                        value={clienteTelefone}
                        onChangeText={setClienteTelefone}
                        placeholder="(81) 99999-9999"
                        placeholderTextColor="#545A65"
                        keyboardType="phone-pad"
                        style={styles.input}
                      />
                    </View>

                    <View style={styles.fieldGridItem}>
                      <FieldLabel text="E-mail (opcional)" />
                      <TextInput
                        value={clienteEmail}
                        onChangeText={setClienteEmail}
                        placeholder="cliente@email.com"
                        placeholderTextColor="#545A65"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={styles.input}
                      />
                    </View>
                  </View>

                  <FieldLabel text="CEP" />
                  <View style={styles.cepRow}>
                    <TextInput
                      value={clienteCep}
                      onChangeText={(valor) => {
                        const formatado = formatarCep(valor);
                        setClienteCep(formatado);
                        setErroCep("");

                        if (formatado.replace(/\D/g, "").length === 8) {
                          void buscarCep(formatado);
                        } else {
                          limparEnderecoCep();
                        }
                      }}
                      placeholder="00000-000"
                      placeholderTextColor="#545A65"
                      keyboardType="number-pad"
                      maxLength={9}
                      style={[styles.input, styles.cepInput]}
                    />

                    <Pressable
                      style={[
                        styles.cepButton,
                        buscandoCep && styles.cepButtonDisabled,
                      ]}
                      onPress={() => buscarCep(clienteCep)}
                      disabled={buscandoCep}
                    >
                      {buscandoCep ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.cepButtonText}>BUSCAR</Text>
                      )}
                    </Pressable>
                  </View>

                  {erroCep ? (
                    <Text style={styles.cepError}>{erroCep}</Text>
                  ) : null}

                  {(clienteLogradouro ||
                    clienteBairro ||
                    clienteCidade ||
                    clienteUf) ? (
                    <View style={styles.addressResult}>
                      <View style={styles.addressResultHeader}>
                        <Text style={styles.addressResultTitle}>
                          Endereço encontrado
                        </Text>
                        <Text style={styles.addressResultCheck}>✓</Text>
                      </View>

                      <Text style={styles.addressResultText}>
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
                        <Text style={styles.addressResultState}>
                          {clienteEstado}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  {(clienteLogradouro ||
                    clienteBairro ||
                    clienteCidade ||
                    clienteUf) ? (
                    <View
                      style={[
                        styles.fieldGrid,
                        isDesktop && styles.fieldGridDesktop,
                      ]}
                    >
                      <View style={styles.fieldGridItem}>
                        <FieldLabel text="Número *" />
                        <TextInput
                          value={clienteNumero}
                          onChangeText={setClienteNumero}
                          placeholder="Ex.: 125"
                          placeholderTextColor="#545A65"
                          style={styles.input}
                        />
                      </View>

                      <View style={styles.fieldGridItem}>
                        <FieldLabel text="Complemento (opcional)" />
                        <TextInput
                          value={clienteComplemento}
                          onChangeText={setClienteComplemento}
                          placeholder="Apto, bloco, casa..."
                          placeholderTextColor="#545A65"
                          style={styles.input}
                        />
                      </View>
                    </View>
                  ) : null}
                </SectionCard>

                <SectionCard
                  title="Orçamento"
                  subtitle="Defina o serviço, validade e informações gerais."
                >
                  <FieldLabel text="Título do orçamento *" />
                  <TextInput
                    value={titulo}
                    onChangeText={setTitulo}
                    placeholder="Ex.: Reforma de cozinha"
                    placeholderTextColor="#545A65"
                    style={styles.input}
                  />

                  <FieldLabel text="Descrição" />
                  <TextInput
                    value={descricao}
                    onChangeText={setDescricao}
                    placeholder="Descreva brevemente o serviço..."
                    placeholderTextColor="#545A65"
                    multiline
                    textAlignVertical="top"
                    style={[styles.input, styles.textArea]}
                  />

                  <FieldLabel text="Validade (dias)" />
                  <TextInput
                    value={validadeDias}
                    onChangeText={(valor) =>
                      setValidadeDias(valor.replace(/\D/g, ""))
                    }
                    placeholder="15"
                    placeholderTextColor="#545A65"
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </SectionCard>

                <SectionCard
                  title="Itens"
                  subtitle="Adicione produtos ou serviços ao orçamento."
                >
                  <View style={styles.itemsList}>
                    {itens.map((item, index) => {
                      const itemTotal =
                        normalizarNumero(item.quantidade) *
                        normalizarNumero(item.valorUnitario);

                      return (
                        <View key={item.id} style={styles.itemCard}>
                          <View style={styles.itemHeader}>
                            <Text style={styles.itemTitle}>
                              Item {index + 1}
                            </Text>

                            {itens.length > 1 ? (
                              <Pressable
                                style={styles.removeButton}
                                onPress={() => removerItem(item.id)}
                              >
                                <Text style={styles.removeButtonText}>
                                  REMOVER
                                </Text>
                              </Pressable>
                            ) : null}
                          </View>

                          <FieldLabel text="Descrição *" />
                          <TextInput
                            value={item.descricao}
                            onChangeText={(valor) =>
                              atualizarItem(item.id, "descricao", valor)
                            }
                            placeholder="Ex.: Instalação elétrica"
                            placeholderTextColor="#545A65"
                            style={styles.input}
                          />

                          <View
                            style={[
                              styles.fieldGrid,
                              isDesktop && styles.fieldGridDesktop,
                            ]}
                          >
                            <View style={styles.fieldGridItem}>
                              <FieldLabel text="Quantidade *" />
                              <TextInput
                                value={item.quantidade}
                                onChangeText={(valor) =>
                                  atualizarItem(item.id, "quantidade", valor)
                                }
                                placeholder="1"
                                placeholderTextColor="#545A65"
                                keyboardType="decimal-pad"
                                style={styles.input}
                              />
                            </View>

                            <View style={styles.fieldGridItem}>
                              <FieldLabel text="Valor unitário (R$) *" />
                              <TextInput
                                value={item.valorUnitario}
                                onChangeText={(valor) =>
                                  atualizarItem(item.id, "valorUnitario", valor)
                                }
                                placeholder="0,00"
                                placeholderTextColor="#545A65"
                                keyboardType="decimal-pad"
                                style={styles.input}
                              />
                            </View>
                          </View>

                          <View style={styles.itemTotalRow}>
                            <Text style={styles.itemTotalLabel}>
                              Total do item
                            </Text>
                            <Text style={styles.itemTotalValue}>
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
                  >
                    <Text style={styles.addItemButtonText}>
                      + ADICIONAR ITEM
                    </Text>
                  </Pressable>
                </SectionCard>

                <SectionCard
                  title="Valores e pagamento"
                  subtitle="Organize todos os valores que compõem o orçamento."
                >
                  <View
                    style={[
                      styles.fieldGrid,
                      isDesktop && styles.fieldGridDesktop,
                    ]}
                  >
                    <View style={styles.fieldGridItem}>
                      <FieldLabel text="Mão de obra (R$)" />
                      <TextInput
                        value={maoDeObra}
                        onChangeText={setMaoDeObra}
                        placeholder="0,00"
                        placeholderTextColor="#545A65"
                        keyboardType="decimal-pad"
                        style={styles.input}
                      />
                    </View>

                    <View style={styles.fieldGridItem}>
                      <FieldLabel text="Outros gastos (R$)" />
                      <TextInput
                        value={outrosGastos}
                        onChangeText={setOutrosGastos}
                        placeholder="0,00"
                        placeholderTextColor="#545A65"
                        keyboardType="decimal-pad"
                        style={styles.input}
                      />
                    </View>
                  </View>

                  <View
                    style={[
                      styles.fieldGrid,
                      isDesktop && styles.fieldGridDesktop,
                    ]}
                  >
                    <View style={styles.fieldGridItem}>
                      <FieldLabel text="Desconto (R$)" />
                      <TextInput
                        value={desconto}
                        onChangeText={setDesconto}
                        placeholder="0,00"
                        placeholderTextColor="#545A65"
                        keyboardType="decimal-pad"
                        style={styles.input}
                      />
                    </View>

                    <View style={styles.fieldGridItem}>
                      <FieldLabel text="Acréscimo (R$)" />
                      <TextInput
                        value={acrescimo}
                        onChangeText={setAcrescimo}
                        placeholder="0,00"
                        placeholderTextColor="#545A65"
                        keyboardType="decimal-pad"
                        style={styles.input}
                      />
                    </View>
                  </View>

                  <FieldLabel text="Forma de pagamento" />
                  <TextInput
                    value={formaPagamento}
                    onChangeText={setFormaPagamento}
                    placeholder="Ex.: Pix, dinheiro, cartão..."
                    placeholderTextColor="#545A65"
                    style={styles.input}
                  />

                  <FieldLabel text="Condições de pagamento" />
                  <TextInput
                    value={condicoesPagamento}
                    onChangeText={setCondicoesPagamento}
                    placeholder="Ex.: 100% no Pix, 2x no cartão, pagamento na entrega..."
                    placeholderTextColor="#545A65"
                    multiline
                    textAlignVertical="top"
                    style={[styles.input, styles.paymentConditionsArea]}
                  />
                </SectionCard>

                <SectionCard
                  title="Observações"
                  subtitle="Informações extras que devem constar no orçamento."
                >
                  <TextInput
                    value={observacoes}
                    onChangeText={setObservacoes}
                    placeholder="Ex.: Materiais inclusos, condições, prazo de execução..."
                    placeholderTextColor="#545A65"
                    multiline
                    textAlignVertical="top"
                    style={[styles.input, styles.textAreaLarge]}
                  />
                </SectionCard>
              </View>

              <View
                style={[
                  styles.sideColumn,
                  isDesktop && styles.sideColumnDesktop,
                ]}
              >
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryEyebrow}>RESUMO</Text>
                  <Text style={styles.summaryTitle}>Valores</Text>

                  <View style={styles.summaryDivider} />

                  <SummaryRow
                    label="Valor dos itens/serviços"
                    value={formatarMoeda(subtotal)}
                  />

                  <View style={styles.summaryDivider} />

                  {maoDeObraNumero > 0 ? (
                    <SummaryRow
                      label="Mão de obra"
                      value={`+ ${formatarMoeda(maoDeObraNumero)}`}
                    />
                  ) : null}

                  {outrosGastosNumero > 0 ? (
                    <SummaryRow
                      label="Outros gastos"
                      value={`+ ${formatarMoeda(outrosGastosNumero)}`}
                    />
                  ) : null}

                  {acrescimoNumero > 0 ? (
                    <SummaryRow
                      label="Acréscimo"
                      value={`+ ${formatarMoeda(acrescimoNumero)}`}
                    />
                  ) : null}

                  {descontoNumero > 0 ? (
                    <SummaryRow
                      label="Desconto"
                      value={`- ${formatarMoeda(descontoNumero)}`}
                    />
                  ) : null}

                  <View style={styles.summaryDivider} />

                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total do orçamento</Text>
                    <Text style={styles.totalValue}>
                      {formatarMoeda(total)}
                    </Text>
                  </View>

                  <Text style={styles.totalFormula}>
                    Itens/serviços + mão de obra + outros gastos + acréscimo - desconto
                  </Text>

                  {(formaPagamento.trim() || condicoesPagamento.trim()) ? (
                    <View style={styles.paymentSummaryBox}>
                      <Text style={styles.paymentSummaryTitle}>
                        PAGAMENTO
                      </Text>

                      {formaPagamento.trim() ? (
                        <View style={styles.paymentSummaryRow}>
                          <Text style={styles.paymentSummaryLabel}>
                            Forma
                          </Text>
                          <Text style={styles.paymentSummaryValue}>
                            {formaPagamento.trim()}
                          </Text>
                        </View>
                      ) : null}

                      {condicoesPagamento.trim() ? (
                        <View style={styles.paymentConditionsSummary}>
                          <Text style={styles.paymentSummaryLabel}>
                            Condições
                          </Text>
                          <Text style={styles.paymentConditionsText}>
                            {condicoesPagamento.trim()}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  <View style={styles.summaryInfo}>
                    <Text style={styles.summaryInfoTitle}>
                      Plano FREE
                    </Text>
                    <Text style={styles.summaryInfoText}>
                      O PDF deste orçamento usará a identidade visual padrão do
                      Orvena.
                    </Text>
                  </View>

                  {erro ? (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{erro}</Text>
                    </View>
                  ) : null}

                  {sucesso ? (
                    <View style={styles.successBox}>
                      <Text style={styles.successText}>{sucesso}</Text>
                    </View>
                  ) : null}

                  <Pressable
                    style={[
                      styles.saveButton,
                      salvando && styles.saveButtonDisabled,
                    ]}
                    onPress={salvarOrcamento}
                    disabled={salvando}
                  >
                    {salvando ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveButtonText}>
                        SALVAR ALTERAÇÕES
                      </Text>
                    )}
                  </Pressable>

                  <Pressable
                    style={styles.cancelButton}
                    onPress={voltar}
                    disabled={salvando}
                  >
                    <Text style={styles.cancelButtonText}>CANCELAR</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>

      {children}
    </View>
  );
}

function FieldLabel({ text }: { text: string }) {
  return <Text style={styles.fieldLabel}>{text}</Text>;
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
      <Text style={styles.summaryRowLabel}>{label}</Text>
      <Text style={styles.summaryRowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    minHeight: 500,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B0C10",
    gap: 12,
    padding: 24,
  },

  loadingText: {
    color: "#777E89",
    fontSize: 11,
  },

  safeArea: {
    flex: 1,
    backgroundColor: "#0B0C10",
  },

  flex: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
  },

  page: {
    width: "100%",
    maxWidth: 1240,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 48,
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 22,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#292E37",
    backgroundColor: "#13161C",
    alignItems: "center",
    justifyContent: "center",
  },

  backButtonText: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "800",
  },

  headerTextArea: {
    flex: 1,
  },

  headerEyebrow: {
    color: "#7C5CFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.7,
  },

  headerTitle: {
    color: "#FFFFFF",
    fontSize: 29,
    fontWeight: "900",
    marginTop: 5,
  },

  headerSubtitle: {
    color: "#7D848F",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
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
    gap: 16,
  },

  sideColumn: {
    width: "100%",
  },

  sideColumnDesktop: {
    width: 340,
  },

  sectionCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#292E37",
    backgroundColor: "#12151B",
    padding: 18,
  },

  sectionHeader: {
    marginBottom: 7,
  },

  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },

  sectionSubtitle: {
    color: "#737A85",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },

  fieldLabel: {
    color: "#A9AFB8",
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 7,
    marginTop: 13,
  },

  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2B3039",
    backgroundColor: "#0D1015",
    color: "#FFFFFF",
    fontSize: 13,
    paddingHorizontal: 14,
    outlineStyle: "none",
  } as any,

  textArea: {
    minHeight: 96,
    paddingTop: 13,
    paddingBottom: 13,
  },

  textAreaLarge: {
    minHeight: 120,
    paddingTop: 13,
    paddingBottom: 13,
  },

  cepRow: {
    flexDirection: "row",
    gap: 9,
  },

  cepInput: {
    flex: 1,
  },

  cepButton: {
    minWidth: 96,
    borderRadius: 14,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  cepButtonDisabled: {
    opacity: 0.65,
  },

  cepButtonText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  cepError: {
    color: "#FF7D86",
    fontSize: 10,
    marginTop: 7,
  },

  addressResult: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#285A42",
    backgroundColor: "#101B17",
    padding: 12,
    marginTop: 10,
  },

  addressResultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  addressResultTitle: {
    color: "#DFFFF0",
    fontSize: 10,
    fontWeight: "900",
  },

  addressResultCheck: {
    color: "#6BE6AC",
    fontSize: 14,
    fontWeight: "900",
  },

  addressResultText: {
    color: "#A8BEB2",
    fontSize: 10,
    lineHeight: 16,
    marginTop: 5,
  },

  addressResultState: {
    color: "#71887A",
    fontSize: 9,
    marginTop: 3,
  },

  fieldGrid: {
    gap: 0,
  },

  fieldGridDesktop: {
    flexDirection: "row",
    gap: 12,
  },

  fieldGridItem: {
    flex: 1,
  },

  itemsList: {
    gap: 12,
    marginTop: 7,
  },

  itemCard: {
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#272B34",
    backgroundColor: "#0F1217",
    padding: 14,
  },

  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  itemTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  removeButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#4A2931",
    backgroundColor: "#211217",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  removeButtonText: {
    color: "#FF8790",
    fontSize: 8,
    fontWeight: "900",
  },

  itemTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 13,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#252A32",
  },

  itemTotalLabel: {
    color: "#747B86",
    fontSize: 10,
    fontWeight: "700",
  },

  itemTotalValue: {
    color: "#C9C2FF",
    fontSize: 14,
    fontWeight: "900",
  },

  addItemButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#403568",
    backgroundColor: "#191526",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 13,
  },

  addItemButtonText: {
    color: "#B7AAFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  summaryCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#31294A",
    backgroundColor: "#151321",
    padding: 18,
  },

  summaryEyebrow: {
    color: "#8F79FF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,
  },

  summaryTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 5,
  },

  summaryDivider: {
    height: 1,
    backgroundColor: "#302A43",
    marginVertical: 14,
  },

  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginVertical: 5,
  },

  summaryRowLabel: {
    color: "#858B96",
    fontSize: 11,
  },

  summaryRowValue: {
    color: "#D0D3D8",
    fontSize: 12,
    fontWeight: "800",
  },

  paymentConditionsArea: {
    minHeight: 92,
    paddingTop: 13,
    paddingBottom: 13,
  },

  paymentSummaryBox: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#2C3140",
    backgroundColor: "#10131A",
    padding: 11,
    marginTop: 13,
  },

  paymentSummaryTitle: {
    color: "#8F79FF",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  paymentSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },

  paymentSummaryLabel: {
    color: "#777E89",
    fontSize: 9,
    fontWeight: "800",
  },

  paymentSummaryValue: {
    flex: 1,
    color: "#D0D3D8",
    fontSize: 10,
    fontWeight: "800",
    textAlign: "right",
  },

  paymentConditionsSummary: {
    marginTop: 9,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: "#252A32",
  },

  paymentConditionsText: {
    color: "#B6BBC3",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 4,
  },

  totalFormula: {
    color: "#666D78",
    fontSize: 8,
    lineHeight: 13,
    marginTop: 4,
    textAlign: "right",
  },

  totalRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },

  totalLabel: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  totalValue: {
    color: "#B9ADFF",
    fontSize: 24,
    fontWeight: "900",
  },

  summaryInfo: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2C3140",
    backgroundColor: "#10131A",
    padding: 12,
    marginTop: 18,
  },

  summaryInfoTitle: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },

  summaryInfoText: {
    color: "#777E89",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 4,
  },

  errorBox: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#552C35",
    backgroundColor: "#211217",
    padding: 11,
    marginTop: 14,
  },

  errorText: {
    color: "#FF8A93",
    fontSize: 10,
    lineHeight: 15,
  },

  successBox: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#285A42",
    backgroundColor: "#101B17",
    padding: 11,
    marginTop: 14,
  },

  successText: {
    color: "#76EAB3",
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "800",
  },

  saveButton: {
    minHeight: 54,
    borderRadius: 15,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },

  saveButtonDisabled: {
    opacity: 0.65,
  },

  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  cancelButton: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#303640",
    backgroundColor: "#101319",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 9,
  },

  cancelButtonText: {
    color: "#8A919C",
    fontSize: 9,
    fontWeight: "900",
  },
});