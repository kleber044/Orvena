import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
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

import { supabase } from "../lib/supabase";

const C = {
  bg: "#09090F",
  card: "#14131D",
  input: "#0D0D15",
  purple: "#7C5CFF",
  purpleLight: "#A995FF",
  border: "#292637",
  white: "#FFFFFF",
  muted: "#9996A8",
  green: "#53DDA0",
  red: "#FF8797",
};

function formatarCep(valor: string) {
  const numeros = valor.replace(/\D/g, "").slice(0, 8);

  if (numeros.length <= 5) return numeros;

  return `${numeros.slice(0, 5)}-${numeros.slice(5)}`;
}

function descobrirExtensao(asset: ImagePicker.ImagePickerAsset) {
  const mime = asset.mimeType?.toLowerCase() || "";

  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";

  const nome = asset.fileName || asset.uri;
  const extensao = nome
    .match(/\.([a-zA-Z0-9]+)(?:\?|$)/)?.[1]
    ?.toLowerCase();

  if (extensao === "png" || extensao === "webp") {
    return extensao;
  }

  return "jpg";
}

function mimeDaExtensao(extensao: string) {
  if (extensao === "png") return "image/png";
  if (extensao === "webp") return "image/webp";

  return "image/jpeg";
}

function base64ParaUint8Array(base64: string) {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);

  for (let i = 0; i < binario.length; i += 1) {
    bytes[i] = binario.charCodeAt(i);
  }

  return bytes;
}

type IconName = React.ComponentProps<typeof Ionicons>["name"];

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

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Icon name={icon} color={C.purpleLight} size={21} />
        </View>

        <View style={styles.sectionHeaderText}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
      </View>

      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  required,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  maxLength,
  editable,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  icon?: IconName;
  required?: boolean;
  keyboardType?: React.ComponentProps<typeof TextInput>["keyboardType"];
  autoCapitalize?: React.ComponentProps<typeof TextInput>["autoCapitalize"];
  autoCorrect?: boolean;
  maxLength?: number;
  editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? (
          <Text style={styles.required}> *</Text>
        ) : null}
      </Text>

      <View
        style={[
          styles.inputWrap,
          focused && styles.inputFocused,
          editable === false && styles.inputDisabled,
        ]}
      >
        {icon ? (
          <View style={styles.inputIcon}>
            <Icon
              name={icon}
              size={19}
              color={focused ? C.purpleLight : C.muted}
            />
          </View>
        ) : null}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#777486"
          style={styles.input}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          maxLength={maxLength}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          selectionColor={C.purple}
          underlineColorAndroid="transparent"
        />
      </View>
    </View>
  );
}

export default function EmpresaScreen() {
  const { width } = useWindowDimensions();

  const isDesktop = width >= 1050;
  const isTablet = width >= 650;
  const isSmall = width < 390;

  const [nomeFantasia, setNomeFantasia] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [documento, setDocumento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");

  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [estado, setEstado] = useState("");

  const [logoUrl, setLogoUrl] = useState("");

  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [redirecionandoLogin, setRedirecionandoLogin] =
    useState(false);

  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const [aba, setAba] = useState<
    "dados" | "endereco" | "logo"
  >("dados");

  const scrollRef = useRef<ScrollView>(null);
  const ultimaBuscaCep = useRef(0);
  const cepAtual = useRef("");

  useEffect(() => {
    void carregarEmpresa();

    return () => {
      ultimaBuscaCep.current += 1;
    };
  }, []);

  async function carregarEmpresa() {
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

      const { data, error } = await supabase
        .from("empresas")
        .select(
          "nome_fantasia, razao_social, documento, telefone, email, cep, logradouro, numero, complemento, bairro, cidade, uf, estado, logo_url"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        setErro(error.message);
        return;
      }

      if (!data) return;

      setNomeFantasia(data.nome_fantasia || "");
      setRazaoSocial(data.razao_social || "");
      setDocumento(data.documento || "");
      setTelefone(data.telefone || "");
      setEmail(data.email || "");

      const cepSalvo = data.cep
        ? formatarCep(data.cep)
        : "";

      setCep(cepSalvo);
      cepAtual.current = cepSalvo.replace(/\D/g, "");

      setLogradouro(data.logradouro || "");
      setNumero(data.numero || "");
      setComplemento(data.complemento || "");
      setBairro(data.bairro || "");
      setCidade(data.cidade || "");
      setUf(data.uf || "");
      setEstado(data.estado || "");
      setLogoUrl(data.logo_url || "");
    } catch {
      setErro("Não foi possível carregar os dados da empresa.");
    } finally {
      setCarregando(false);
    }
  }

  function limparEndereco() {
    setLogradouro("");
    setBairro("");
    setCidade("");
    setUf("");
    setEstado("");
    setNumero("");
    setComplemento("");
  }

  function alterarCep(valor: string) {
    const formatado = formatarCep(valor);
    const numeros = formatado.replace(/\D/g, "");

    setCep(formatado);
    cepAtual.current = numeros;

    ultimaBuscaCep.current += 1;
    setBuscandoCep(false);

    setErro("");
    setSucesso("");

    limparEndereco();

    if (numeros.length === 8) {
      void buscarCep(formatado);
    }
  }

  async function buscarCep(valor: string) {
    const cepLimpo = valor.replace(/\D/g, "");

    if (cepLimpo.length !== 8) {
      setErro("Informe um CEP com 8 números.");
      return;
    }

    const idBusca = ++ultimaBuscaCep.current;

    try {
      setBuscandoCep(true);
      setErro("");

      const resposta = await fetch(
        `https://viacep.com.br/ws/${cepLimpo}/json/`
      );

      if (idBusca !== ultimaBuscaCep.current) return;

      if (!resposta.ok) {
        limparEndereco();
        setErro("Não foi possível consultar este CEP.");
        return;
      }

      const dados = await resposta.json();

      if (
        idBusca !== ultimaBuscaCep.current ||
        cepAtual.current !== cepLimpo
      ) {
        return;
      }

      if (dados.erro) {
        limparEndereco();
        setErro("CEP não encontrado.");
        return;
      }

      const cepFormatado = formatarCep(
        dados.cep || cepLimpo
      );

      setCep(cepFormatado);
      cepAtual.current = cepFormatado.replace(/\D/g, "");

      setLogradouro(dados.logradouro || "");
      setBairro(dados.bairro || "");
      setCidade(dados.localidade || "");
      setUf(dados.uf || "");
      setEstado(dados.estado || "");
    } catch {
      if (idBusca !== ultimaBuscaCep.current) return;

      limparEndereco();
      setErro("Não foi possível consultar o CEP.");
    } finally {
      if (idBusca === ultimaBuscaCep.current) {
        setBuscandoCep(false);
      }
    }
  }

  async function selecionarLogo() {
    if (enviandoLogo || salvando) return;

    try {
      setErro("");
      setSucesso("");

      if (Platform.OS !== "web") {
        const permissao =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permissao.granted) {
          setErro(
            "Permita o acesso às fotos para selecionar a logo da empresa."
          );
          return;
        }
      }

      const resultado =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.9,
        });

      if (resultado.canceled || !resultado.assets?.[0]) {
        return;
      }

      const asset = resultado.assets[0];

      if (
        asset.fileSize &&
        asset.fileSize > 5 * 1024 * 1024
      ) {
        setErro("A logo precisa ter no máximo 5 MB.");
        return;
      }

      setEnviandoLogo(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setRedirecionandoLogin(true);
        router.replace("/login" as any);
        return;
      }

      let arquivo: ArrayBuffer | Uint8Array;

      if (Platform.OS === "web") {
        const respostaArquivo = await fetch(asset.uri);

        if (!respostaArquivo.ok) {
          setErro(
            "Não foi possível ler a imagem selecionada."
          );
          return;
        }

        arquivo = await respostaArquivo.arrayBuffer();
      } else {
        try {
          const base64 =
            await FileSystem.readAsStringAsync(asset.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });

          arquivo = base64ParaUint8Array(base64);
        } catch (leituraError) {
          console.log(
            "Erro ao ler imagem no celular:",
            leituraError
          );

          setErro(
            "Não foi possível ler a imagem selecionada."
          );
          return;
        }
      }

      const extensao = descobrirExtensao(asset);
      const contentType =
        asset.mimeType || mimeDaExtensao(extensao);

      const caminho = `${user.id}/logo.${extensao}`;

      const { error: uploadError } = await supabase.storage
        .from("logos-empresa")
        .upload(caminho, arquivo, {
          contentType,
          upsert: true,
          cacheControl: "3600",
        });

      if (uploadError) {
        setErro(uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("logos-empresa")
        .getPublicUrl(caminho);

      const urlComCache =
        `${publicUrlData.publicUrl}?v=${Date.now()}`;

      const { error: empresaError } = await supabase
        .from("empresas")
        .upsert(
          {
            user_id: user.id,
            logo_url: urlComCache,
          },
          {
            onConflict: "user_id",
          }
        );

      if (empresaError) {
        setErro(empresaError.message);
        return;
      }

      setLogoUrl(urlComCache);
      setSucesso("Logo atualizada com sucesso.");
    } catch (error) {
      console.log("Erro ao enviar logo:", error);

      setErro(
        "Não foi possível enviar a logo da empresa."
      );
    } finally {
      setEnviandoLogo(false);
    }
  }

  function validar() {
    if (!nomeFantasia.trim()) {
      setAba("dados");
      setErro("Informe o nome da empresa.");
      return false;
    }

    const cepLimpo = cep.replace(/\D/g, "");

    if (cepLimpo.length > 0) {
      if (cepLimpo.length !== 8) {
        setAba("endereco");
        setErro("Informe um CEP válido.");
        return false;
      }

      if (buscandoCep) {
        setAba("endereco");
        setErro("Aguarde a consulta do CEP terminar.");
        return false;
      }

      if (!logradouro.trim() && !cidade.trim()) {
        setAba("endereco");
        setErro("Consulte o CEP antes de salvar.");
        return false;
      }

      if (!numero.trim()) {
        setAba("endereco");
        setErro("Informe o número do endereço.");
        return false;
      }
    }

    setErro("");
    return true;
  }

  async function salvarEmpresa() {
    if (salvando || enviandoLogo) return;
    if (!validar()) return;

    try {
      setSalvando(true);
      setErro("");
      setSucesso("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setRedirecionandoLogin(true);
        router.replace("/login" as any);
        return;
      }

      const { error } = await supabase
        .from("empresas")
        .upsert(
          {
            user_id: user.id,

            nome_fantasia: nomeFantasia.trim(),
            razao_social: razaoSocial.trim() || null,
            documento: documento.trim() || null,
            telefone: telefone.trim() || null,
            email: email.trim().toLowerCase() || null,

            cep: cep.replace(/\D/g, "") || null,
            logradouro: logradouro.trim() || null,
            numero: numero.trim() || null,
            complemento: complemento.trim() || null,
            bairro: bairro.trim() || null,
            cidade: cidade.trim() || null,
            uf: uf.trim() || null,
            estado: estado.trim() || null,
            logo_url: logoUrl || null,
          },
          {
            onConflict: "user_id",
          }
        );

      if (error) {
        setErro(error.message);
        return;
      }

      setSucesso(
        "Dados da empresa salvos com sucesso."
      );

      router.replace("/(tabs)" as any);
    } catch {
      setErro(
        "Não foi possível salvar os dados da empresa."
      );
    } finally {
      setSalvando(false);
    }
  }

  function voltar() {
    router.replace("/(tabs)" as any);
  }

  function mudarAba(
    novaAba: "dados" | "endereco" | "logo"
  ) {
    setAba(novaAba);

    scrollRef.current?.scrollTo({
      y: 0,
      animated: true,
    });
  }

  const enderecoDisponivel = Boolean(
    logradouro || bairro || cidade || uf
  );

  const enderecoCompleto = [
    logradouro,
    numero,
    complemento,
    bairro,
    cidade,
    uf,
  ]
    .filter(Boolean)
    .join(", ");

  const ocupacaoNome = nomeFantasia.trim() || "Sua empresa";

  const progresso = [
    Boolean(nomeFantasia.trim()),
    Boolean(documento.trim() || telefone.trim() || email.trim()),
    Boolean(cep.trim() && numero.trim()),
    Boolean(logoUrl),
  ].filter(Boolean).length;

  if (carregando || redirecionandoLogin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          <View style={styles.loadingIcon}>
            <Icon
              name="business-outline"
              size={30}
              color={C.purpleLight}
            />
          </View>

          <ActivityIndicator
            size="large"
            color={C.purple}
          />

          <Text style={styles.loadingText}>
            Carregando sua empresa...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={
          Platform.OS === "ios" ? "padding" : undefined
        }
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: isSmall
                ? 12
                : isDesktop
                ? 28
                : 16,
              paddingBottom: isDesktop ? 56 : 30,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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
                <Icon
                  name="arrow-back"
                  size={22}
                />
              </Pressable>

              <View style={styles.headerCenter}>
                <Text style={styles.headerEyebrow}>
                  CONFIGURAÇÕES
                </Text>

                <Text style={styles.headerTitle}>
                  Minha empresa
                </Text>

                <Text style={styles.headerSubtitle}>
                  Gerencie a identidade e os dados do seu negócio.
                </Text>
              </View>

              {isTablet ? (
                <View style={styles.headerBadge}>
                  <Icon
                    name="shield-checkmark-outline"
                    size={15}
                    color={C.purpleLight}
                  />

                  <Text style={styles.headerBadgeText}>
                    ORVENA PRO
                  </Text>
                </View>
              ) : null}
            </View>

            {/* BANNER PRINCIPAL */}

            <View style={styles.hero}>
              <View style={styles.heroTop}>
                <View style={styles.heroIcon}>
                  {logoUrl ? (
                    <Image
                      source={{ uri: logoUrl }}
                      style={styles.heroLogo}
                      resizeMode="contain"
                    />
                  ) : (
                    <Icon
                      name="business"
                      size={29}
                      color={C.purpleLight}
                    />
                  )}
                </View>

                <View style={styles.heroText}>
                  <Text
                    style={styles.heroEyebrow}
                    numberOfLines={1}
                  >
                    PERFIL EMPRESARIAL
                  </Text>

                  <Text
                    style={styles.heroTitle}
                    numberOfLines={2}
                  >
                    {ocupacaoNome}
                  </Text>

                  <Text style={styles.heroDescription}>
                    Personalize as informações da sua empresa.
                  </Text>
                </View>
              </View>

              <View style={styles.heroDivider} />

              <View style={styles.progressTop}>
                <Text style={styles.progressLabel}>
                  Informações preenchidas
                </Text>

                <Text style={styles.progressNumber}>
                  {progresso}/4
                </Text>
              </View>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${(progresso / 4) * 100}%`,
                    },
                  ]}
                />
              </View>

              <Text style={styles.progressHint}>
                Nome, contato, endereço e logo.
              </Text>
            </View>

            {/* MENSAGENS */}

            {erro ? (
              <View style={styles.errorBox}>
                <Icon
                  name="alert-circle-outline"
                  size={21}
                  color={C.red}
                />

                <Text style={styles.errorText}>
                  {erro}
                </Text>

                <Pressable
                  onPress={() => setErro("")}
                  hitSlop={10}
                >
                  <Icon
                    name="close"
                    size={20}
                    color={C.red}
                  />
                </Pressable>
              </View>
            ) : null}

            {sucesso ? (
              <View style={styles.successBox}>
                <Icon
                  name="checkmark-circle-outline"
                  size={21}
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
                    size={20}
                    color={C.green}
                  />
                </Pressable>
              </View>
            ) : null}

            {/* NAVEGAÇÃO */}

            <View style={styles.tabBar}>
              {(
                [
                  {
                    key: "dados",
                    title: "Dados",
                    icon: "business-outline",
                  },
                  {
                    key: "endereco",
                    title: "Endereço",
                    icon: "location-outline",
                  },
                  {
                    key: "logo",
                    title: "Marca",
                    icon: "image-outline",
                  },
                ] as const
              ).map((item) => {
                const ativo = aba === item.key;

                return (
                  <Pressable
                    key={item.key}
                    style={[
                      styles.tab,
                      ativo && styles.tabActive,
                    ]}
                    onPress={() => mudarAba(item.key)}
                    accessibilityRole="tab"
                    accessibilityState={{
                      selected: ativo,
                    }}
                  >
                    <Icon
                      name={item.icon}
                      size={18}
                      color={
                        ativo ? C.purpleLight : C.muted
                      }
                    />

                    <Text
                      style={[
                        styles.tabText,
                        ativo && styles.tabTextActive,
                      ]}
                    >
                      {item.title}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* CONTEÚDO */}

            <View
              style={[
                styles.columns,
                isDesktop && styles.columnsDesktop,
              ]}
            >
              <View style={styles.mainColumn}>
                {/* DADOS */}

                {aba === "dados" ? (
                  <>
                    <SectionCard
                      icon="business-outline"
                      title="Identidade da empresa"
                      subtitle="Preencha as informações principais do seu negócio."
                    >
                      <Field
                        label="Nome da empresa"
                        required
                        value={nomeFantasia}
                        onChangeText={setNomeFantasia}
                        placeholder="Ex.: Construtora Alfa"
                        icon="business-outline"
                      />

                      <Field
                        label="Razão social"
                        value={razaoSocial}
                        onChangeText={setRazaoSocial}
                        placeholder="Ex.: Construtora Alfa LTDA"
                        icon="document-text-outline"
                      />

                      <View
                        style={[
                          styles.fieldRow,
                          isTablet && styles.fieldRowWide,
                        ]}
                      >
                        <View style={styles.fieldColumn}>
                          <Field
                            label="CPF / CNPJ"
                            value={documento}
                            onChangeText={setDocumento}
                            placeholder="Informe o documento"
                            icon="card-outline"
                            keyboardType="number-pad"
                          />
                        </View>

                        <View style={styles.fieldColumn}>
                          <Field
                            label="Telefone"
                            value={telefone}
                            onChangeText={setTelefone}
                            placeholder="(81) 99999-9999"
                            icon="call-outline"
                            keyboardType="phone-pad"
                          />
                        </View>
                      </View>

                      <Field
                        label="E-mail"
                        value={email}
                        onChangeText={setEmail}
                        placeholder="contato@empresa.com"
                        icon="mail-outline"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </SectionCard>

                    <View style={styles.tipCard}>
                      <View style={styles.tipIcon}>
                        <Icon
                          name="information-circle-outline"
                          size={22}
                          color={C.purpleLight}
                        />
                      </View>

                      <View style={styles.tipContent}>
                        <Text style={styles.tipTitle}>
                          Identidade profissional
                        </Text>

                        <Text style={styles.tipText}>
                          Esses dados poderão ser utilizados nos
                          documentos personalizados do plano PRO.
                        </Text>
                      </View>
                    </View>
                  </>
                ) : null}

                {/* ENDEREÇO */}

                {aba === "endereco" ? (
                  <SectionCard
                    icon="location-outline"
                    title="Endereço da empresa"
                    subtitle="Informe o CEP para preencher o endereço automaticamente."
                  >
                    <Text style={styles.label}>
                      CEP
                    </Text>

                    <View style={styles.cepRow}>
                      <View
                        style={[
                          styles.inputWrap,
                          styles.cepInputWrap,
                        ]}
                      >
                        <View style={styles.inputIcon}>
                          <Icon
                            name="navigate-outline"
                            color={C.muted}
                            size={19}
                          />
                        </View>

                        <TextInput
                          value={cep}
                          onChangeText={alterarCep}
                          placeholder="00000-000"
                          placeholderTextColor="#777486"
                          keyboardType="number-pad"
                          maxLength={9}
                          style={styles.input}
                          selectionColor={C.purple}
                        />
                      </View>

                      <Pressable
                        style={[
                          styles.searchButton,
                          (buscandoCep || salvando) &&
                            styles.disabled,
                        ]}
                        disabled={buscandoCep || salvando}
                        onPress={() => buscarCep(cep)}
                      >
                        {buscandoCep ? (
                          <ActivityIndicator
                            size="small"
                            color={C.white}
                          />
                        ) : (
                          <>
                            <Icon
                              name="search"
                              size={18}
                            />

                            {!isSmall ? (
                              <Text
                                style={styles.searchButtonText}
                              >
                                Buscar
                              </Text>
                            ) : null}
                          </>
                        )}
                      </Pressable>
                    </View>

                    {buscandoCep ? (
                      <Text style={styles.cepHelper}>
                        Consultando endereço...
                      </Text>
                    ) : null}

                    {enderecoDisponivel ? (
                      <>
                        <View style={styles.addressResult}>
                          <View style={styles.addressResultIcon}>
                            <Icon
                              name="checkmark"
                              size={18}
                              color={C.green}
                            />
                          </View>

                          <View style={styles.addressResultContent}>
                            <Text style={styles.addressResultTitle}>
                              Endereço encontrado
                            </Text>

                            <Text style={styles.addressResultText}>
                              {[
                                logradouro,
                                bairro,
                                cidade,
                                uf,
                              ]
                                .filter(Boolean)
                                .join(" • ")}
                            </Text>

                            {estado ? (
                              <Text style={styles.addressState}>
                                {estado}
                              </Text>
                            ) : null}
                          </View>
                        </View>

                        <View
                          style={[
                            styles.fieldRow,
                            isTablet && styles.fieldRowWide,
                          ]}
                        >
                          <View style={styles.fieldColumn}>
                            <Field
                              label="Número"
                              required
                              value={numero}
                              onChangeText={setNumero}
                              placeholder="Ex.: 125"
                              icon="home-outline"
                            />
                          </View>

                          <View style={styles.fieldColumn}>
                            <Field
                              label="Complemento"
                              value={complemento}
                              onChangeText={setComplemento}
                              placeholder="Sala, bloco, andar..."
                              icon="layers-outline"
                            />
                          </View>
                        </View>
                      </>
                    ) : (
                      <View style={styles.emptyAddress}>
                        <View style={styles.emptyAddressIcon}>
                          <Icon
                            name="map-outline"
                            size={28}
                            color={C.purpleLight}
                          />
                        </View>

                        <Text style={styles.emptyAddressTitle}>
                          Seu endereço aparecerá aqui
                        </Text>

                        <Text style={styles.emptyAddressText}>
                          Digite um CEP válido para buscar os dados
                          automaticamente.
                        </Text>
                      </View>
                    )}
                  </SectionCard>
                ) : null}

                {/* LOGO */}

                {aba === "logo" ? (
                  <SectionCard
                    icon="image-outline"
                    title="Logo da empresa"
                    subtitle="Personalize sua marca com uma imagem profissional."
                  >
                    <View style={styles.logoArea}>
                      <View style={styles.logoPreview}>
                        {logoUrl ? (
                          <Image
                            source={{ uri: logoUrl }}
                            style={styles.logoImage}
                            resizeMode="contain"
                          />
                        ) : (
                          <Icon
                            name="image-outline"
                            size={42}
                            color={C.purpleLight}
                          />
                        )}
                      </View>

                      <Text style={styles.logoTitle}>
                        {logoUrl
                          ? "Logo cadastrada"
                          : "Adicione sua logo"}
                      </Text>

                      <Text style={styles.logoDescription}>
                        Escolha uma imagem quadrada para representar
                        sua empresa.
                      </Text>

                      <View style={styles.fileInfo}>
                        <Icon
                          name="document-outline"
                          size={15}
                          color={C.muted}
                        />

                        <Text style={styles.fileInfoText}>
                          JPG, PNG ou WEBP • Máximo de 5 MB
                        </Text>
                      </View>

                      <Pressable
                        style={[
                          styles.uploadButton,
                          (enviandoLogo || salvando) &&
                            styles.disabled,
                        ]}
                        onPress={selecionarLogo}
                        disabled={enviandoLogo || salvando}
                      >
                        {enviandoLogo ? (
                          <>
                            <ActivityIndicator
                              color={C.white}
                              size="small"
                            />

                            <Text
                              style={styles.uploadButtonText}
                            >
                              Enviando imagem...
                            </Text>
                          </>
                        ) : (
                          <>
                            <Icon
                              name="cloud-upload-outline"
                              size={20}
                            />

                            <Text
                              style={styles.uploadButtonText}
                            >
                              {logoUrl
                                ? "Trocar logo"
                                : "Selecionar imagem"}
                            </Text>
                          </>
                        )}
                      </Pressable>
                    </View>

                    <View style={styles.logoNote}>
                      <Icon
                        name="sparkles-outline"
                        size={20}
                        color={C.purpleLight}
                      />

                      <Text style={styles.logoNoteText}>
                        A logo será salva automaticamente após o
                        envio. Você pode alterar os demais dados e
                        salvar normalmente.
                      </Text>
                    </View>
                  </SectionCard>
                ) : null}

                {/* BOTÃO INFERIOR NO CELULAR */}

                {!isDesktop ? (
                  <View style={styles.mobileActions}>
                    <Pressable
                      style={[
                        styles.saveButton,
                        (salvando || enviandoLogo) &&
                          styles.disabled,
                      ]}
                      onPress={salvarEmpresa}
                      disabled={salvando || enviandoLogo}
                    >
                      {salvando ? (
                        <ActivityIndicator
                          color={C.white}
                        />
                      ) : (
                        <>
                          <Icon
                            name="checkmark-circle-outline"
                            size={21}
                          />

                          <Text style={styles.saveButtonText}>
                            Salvar alterações
                          </Text>
                        </>
                      )}
                    </Pressable>

                    <Text style={styles.saveHint}>
                      Suas informações serão atualizadas no Orvena.
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* PRÉVIA DESKTOP */}

              {isDesktop ? (
                <View style={styles.sideColumn}>
                  <View style={styles.previewCard}>
                    <View style={styles.previewHeader}>
                      <Icon
                        name="eye-outline"
                        size={17}
                        color={C.purpleLight}
                      />

                      <Text style={styles.previewEyebrow}>
                        PRÉVIA DA EMPRESA
                      </Text>
                    </View>

                    <View style={styles.previewLogo}>
                      {logoUrl ? (
                        <Image
                          source={{ uri: logoUrl }}
                          style={styles.previewImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <Icon
                          name="business"
                          size={36}
                          color={C.purpleLight}
                        />
                      )}
                    </View>

                    <Text style={styles.previewName}>
                      {ocupacaoNome}
                    </Text>

                    {razaoSocial.trim() ? (
                      <Text style={styles.previewSub}>
                        {razaoSocial.trim()}
                      </Text>
                    ) : null}

                    <View style={styles.previewDivider} />

                    {documento.trim() ? (
                      <View style={styles.previewInfoRow}>
                        <Icon
                          name="card-outline"
                          size={17}
                          color={C.muted}
                        />

                        <Text style={styles.previewInfoText}>
                          {documento.trim()}
                        </Text>
                      </View>
                    ) : null}

                    {telefone.trim() ? (
                      <View style={styles.previewInfoRow}>
                        <Icon
                          name="call-outline"
                          size={17}
                          color={C.muted}
                        />

                        <Text style={styles.previewInfoText}>
                          {telefone.trim()}
                        </Text>
                      </View>
                    ) : null}

                    {email.trim() ? (
                      <View style={styles.previewInfoRow}>
                        <Icon
                          name="mail-outline"
                          size={17}
                          color={C.muted}
                        />

                        <Text style={styles.previewInfoText}>
                          {email.trim()}
                        </Text>
                      </View>
                    ) : null}

                    {enderecoCompleto ? (
                      <View style={styles.previewAddress}>
                        <Icon
                          name="location-outline"
                          size={18}
                          color={C.purpleLight}
                        />

                        <Text
                          style={styles.previewAddressText}
                        >
                          {enderecoCompleto}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.previewPro}>
                      <Icon
                        name="sparkles"
                        size={20}
                        color={C.purpleLight}
                      />

                      <View style={styles.previewProText}>
                        <Text style={styles.previewProTitle}>
                          Identidade PRO
                        </Text>

                        <Text style={styles.previewProDescription}>
                          Com o plano PRO ativo, seus dados poderão
                          substituir a marca padrão Orvena nos
                          documentos.
                        </Text>
                      </View>
                    </View>

                    <Pressable
                      style={[
                        styles.saveButton,
                        (salvando || enviandoLogo) &&
                          styles.disabled,
                      ]}
                      onPress={salvarEmpresa}
                      disabled={salvando || enviandoLogo}
                    >
                      {salvando ? (
                        <ActivityIndicator
                          color={C.white}
                        />
                      ) : (
                        <>
                          <Icon
                            name="checkmark-circle-outline"
                            size={21}
                          />

                          <Text style={styles.saveButtonText}>
                            Salvar alterações
                          </Text>
                        </>
                      )}
                    </Pressable>

                    <Text style={styles.saveHint}>
                      Alterações salvas com segurança.
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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

  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 18,
    padding: 24,
  },

  loadingIcon: {
    width: 70,
    height: 70,
    borderRadius: 22,
    backgroundColor: "#201A37",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#43366D",
  },

  loadingText: {
    color: C.muted,
    fontSize: 14,
  },

  scrollContent: {
    flexGrow: 1,
    paddingTop: 20,
  },

  page: {
    width: "100%",
    maxWidth: 1250,
    alignSelf: "center",
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 24,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },

  headerCenter: {
    flex: 1,
    minWidth: 0,
  },

  headerEyebrow: {
    color: C.purpleLight,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 4,
  },

  headerTitle: {
    color: C.white,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.8,
  },

  headerSubtitle: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },

  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "#211A38",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#40335F",
  },

  headerBadgeText: {
    color: C.purpleLight,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  hero: {
    borderRadius: 21,
    padding: 19,
    backgroundColor: "#1A162B",
    borderWidth: 1,
    borderColor: "#3C315B",
    marginBottom: 20,
    overflow: "hidden",
  },

  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },

  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#292041",
    borderWidth: 1,
    borderColor: "#544383",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },

  heroLogo: {
    width: "100%",
    height: "100%",
  },

  heroText: {
    flex: 1,
    minWidth: 0,
  },

  heroEyebrow: {
    color: C.purpleLight,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
    marginBottom: 5,
  },

  heroTitle: {
    color: C.white,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
  },

  heroDescription: {
    color: "#A9A1BA",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },

  heroDivider: {
    height: 1,
    backgroundColor: "#403554",
    marginTop: 20,
    marginBottom: 18,
  },

  progressTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },

  progressLabel: {
    color: "#BBB3CD",
    fontSize: 12,
    fontWeight: "600",
  },

  progressNumber: {
    color: C.purpleLight,
    fontSize: 12,
    fontWeight: "800",
  },

  progressTrack: {
    height: 7,
    borderRadius: 20,
    backgroundColor: "#342B48",
    marginTop: 12,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    backgroundColor: C.purple,
    borderRadius: 20,
  },

  progressHint: {
    color: "#9189A4",
    fontSize: 11,
    marginTop: 9,
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#28151D",
    borderWidth: 1,
    borderColor: "#633443",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },

  errorText: {
    flex: 1,
    minWidth: 0,
    color: C.red,
    fontSize: 13,
    lineHeight: 19,
  },

  successBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#12251D",
    borderWidth: 1,
    borderColor: "#285B43",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },

  successText: {
    flex: 1,
    minWidth: 0,
    color: C.green,
    fontSize: 13,
    lineHeight: 19,
  },

  tabBar: {
    flexDirection: "row",
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 5,
    borderWidth: 1,
    borderColor: C.border,
    gap: 3,
    marginBottom: 20,
  },

  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 47,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
  },

  tabActive: {
    backgroundColor: "#2A2144",
    borderWidth: 1,
    borderColor: "#48376F",
  },

  tabText: {
    color: C.muted,
    fontSize: 12,
    fontWeight: "700",
  },

  tabTextActive: {
    color: C.purpleLight,
  },

  columns: {
    gap: 20,
  },

  columnsDesktop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  mainColumn: {
    flex: 1,
    minWidth: 0,
    gap: 16,
  },

  sideColumn: {
    width: 340,
    flexShrink: 0,
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
    backgroundColor: "#261F3D",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },

  sectionHeaderText: {
    flex: 1,
    minWidth: 0,
  },

  sectionTitle: {
    color: C.white,
    fontSize: 17,
    fontWeight: "800",
  },

  sectionSubtitle: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  sectionBody: {
    marginTop: 20,
  },

  field: {
    marginBottom: 17,
    minWidth: 0,
  },

  label: {
    color: "#D1CEDA",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 9,
  },

  required: {
    color: C.purpleLight,
  },

  inputWrap: {
    minHeight: 52,
    backgroundColor: C.input,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#302D3E",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    minWidth: 0,
  },

  inputFocused: {
    borderColor: C.purple,
    backgroundColor: "#131020",
  },

  inputDisabled: {
    opacity: 0.6,
  },

  inputIcon: {
    paddingLeft: 14,
    paddingRight: 2,
    flexShrink: 0,
  },

  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 50,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: C.white,
    fontSize: 14,
    outlineStyle: "none",
  } as any,

  fieldRow: {
    gap: 0,
  },

  fieldRowWide: {
    flexDirection: "row",
    gap: 13,
  },

  fieldColumn: {
    flex: 1,
    minWidth: 0,
  },

  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#171426",
    borderWidth: 1,
    borderColor: "#332A4B",
  },

  tipIcon: {
    width: 33,
    height: 33,
    borderRadius: 10,
    backgroundColor: "#292041",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  tipContent: {
    flex: 1,
    minWidth: 0,
  },

  tipTitle: {
    color: C.white,
    fontSize: 13,
    fontWeight: "800",
  },

  tipText: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 5,
  },

  cepRow: {
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    minWidth: 0,
  },

  cepInputWrap: {
    flex: 1,
    minWidth: 0,
  },

  searchButton: {
    minHeight: 52,
    minWidth: 53,
    borderRadius: 13,
    backgroundColor: C.purple,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 13,
    flexShrink: 0,
  },

  searchButtonText: {
    color: C.white,
    fontSize: 12,
    fontWeight: "800",
  },

  cepHelper: {
    color: C.purpleLight,
    fontSize: 12,
    marginTop: 10,
  },

  addressResult: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    borderRadius: 14,
    backgroundColor: "#10251C",
    borderWidth: 1,
    borderColor: "#28583E",
    padding: 14,
    marginTop: 18,
    marginBottom: 5,
  },

  addressResultIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#1B3B2B",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  addressResultContent: {
    flex: 1,
    minWidth: 0,
  },

  addressResultTitle: {
    color: C.green,
    fontSize: 13,
    fontWeight: "800",
  },

  addressResultText: {
    color: "#C0D3C7",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 5,
  },

  addressState: {
    color: "#8FAC9A",
    fontSize: 11,
    marginTop: 3,
  },

  emptyAddress: {
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
    marginTop: 17,
    borderRadius: 15,
    backgroundColor: "#101019",
    borderWidth: 1,
    borderColor: "#302D3E",
    borderStyle: "dashed",
  },

  emptyAddressIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#241D38",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },

  emptyAddressTitle: {
    color: C.white,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },

  emptyAddressText: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 7,
    maxWidth: 260,
  },

  logoArea: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "#101019",
    borderWidth: 1,
    borderColor: "#39304C",
    borderStyle: "dashed",
    padding: 20,
  },

  logoPreview: {
    width: 110,
    height: 110,
    borderRadius: 25,
    backgroundColor: "#241C3C",
    borderWidth: 1,
    borderColor: "#4B3A7A",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 17,
  },

  logoImage: {
    width: "100%",
    height: "100%",
  },

  logoTitle: {
    color: C.white,
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },

  logoDescription: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 7,
  },

  fileInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    flexWrap: "wrap",
  },

  fileInfoText: {
    color: C.muted,
    fontSize: 11,
  },

  uploadButton: {
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: C.purple,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
    marginTop: 20,
    width: "100%",
  },

  uploadButtonText: {
    color: C.white,
    fontSize: 13,
    fontWeight: "800",
  },

  logoNote: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginTop: 17,
    padding: 13,
    borderRadius: 12,
    backgroundColor: "#211A35",
  },

  logoNoteText: {
    flex: 1,
    minWidth: 0,
    color: "#B4AACB",
    fontSize: 12,
    lineHeight: 19,
  },

  mobileActions: {
    paddingTop: 3,
  },

  saveButton: {
    minHeight: 54,
    width: "100%",
    borderRadius: 14,
    backgroundColor: C.purple,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 14,
  },

  saveButtonText: {
    color: C.white,
    fontSize: 14,
    fontWeight: "800",
  },

  saveHint: {
    color: C.muted,
    fontSize: 11,
    textAlign: "center",
    lineHeight: 17,
    marginTop: 11,
  },

  previewCard: {
    backgroundColor: "#191525",
    borderWidth: 1,
    borderColor: "#39304F",
    borderRadius: 20,
    padding: 20,
  },

  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  previewEyebrow: {
    color: C.purpleLight,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  previewLogo: {
    width: 78,
    height: 78,
    borderRadius: 18,
    backgroundColor: "#292140",
    borderWidth: 1,
    borderColor: "#493B6A",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginTop: 24,
    marginBottom: 15,
  },

  previewImage: {
    width: "100%",
    height: "100%",
  },

  previewName: {
    color: C.white,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
  },

  previewSub: {
    color: C.muted,
    fontSize: 12,
    marginTop: 5,
    lineHeight: 18,
  },

  previewDivider: {
    height: 1,
    backgroundColor: "#383146",
    marginVertical: 20,
  },

  previewInfoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 14,
  },

  previewInfoText: {
    flex: 1,
    color: "#BCB6CA",
    fontSize: 12,
    lineHeight: 18,
  },

  previewAddress: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#110F1A",
    borderWidth: 1,
    borderColor: "#332B47",
    marginTop: 5,
  },

  previewAddressText: {
    flex: 1,
    color: "#BCB6CA",
    fontSize: 12,
    lineHeight: 19,
  },

  previewPro: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    backgroundColor: "#251D39",
    borderWidth: 1,
    borderColor: "#43345D",
    borderRadius: 13,
    padding: 13,
    marginTop: 20,
    marginBottom: 20,
  },

  previewProText: {
    flex: 1,
  },

  previewProTitle: {
    color: C.white,
    fontSize: 12,
    fontWeight: "800",
  },

  previewProDescription: {
    color: "#A99FBC",
    fontSize: 11,
    lineHeight: 18,
    marginTop: 5,
  },

  disabled: {
    opacity: 0.6,
  },
});