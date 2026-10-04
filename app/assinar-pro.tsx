import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
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
import { WebView } from "react-native-webview";

import { supabase } from "../lib/supabase";

const PUBLIC_KEY =
  process.env.EXPO_PUBLIC_MERCADOPAGO_PUBLIC_KEY || "";

type Metodo = "cartao" | "pix";

type CardTokenMessage = {
  source: "orvena-mercadopago";
  type: "card-token";
  token: string;
  email: string;
};

type CardErrorMessage = {
  source: "orvena-mercadopago";
  type: "card-error";
  message: string;
};

export default function AssinarProScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const [metodo, setMetodo] = useState<Metodo>("cartao");
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [redirecionandoLogin, setRedirecionandoLogin] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const [cpfPix, setCpfPix] = useState("");
  const [gerandoPix, setGerandoPix] = useState(false);
  const [pixPaymentId, setPixPaymentId] = useState("");
  const [pixQrCode, setPixQrCode] = useState("");
  const [pixQrCodeBase64, setPixQrCodeBase64] = useState("");
  const [pixStatus, setPixStatus] = useState("");
  const [pixExpiraEm, setPixExpiraEm] = useState("");
  const [consultandoPix, setConsultandoPix] = useState(false);
  const [mostrarPosPagamento, setMostrarPosPagamento] = useState(false);
  const [aguardandoConfirmacaoCartao, setAguardandoConfirmacaoCartao] =
    useState(false);

  useEffect(() => {
    void carregarUsuario();
  }, []);

  useEffect(() => {
    if (!aguardandoConfirmacaoCartao) {
      return;
    }

    let cancelado = false;
    let tentativas = 0;

    const verificar = async () => {
      if (cancelado) {
        return;
      }

      tentativas += 1;

      try {
        const { error: syncError } = await supabase.rpc(
          "sincronizar_plano_orvena"
        );

        if (syncError) {
          console.log(
            "Sincronização durante confirmação do cartão:",
            syncError.message
          );
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("plano, pro_ate, mercadopago_subscription_status")
          .eq("id", user.id)
          .single();

        if (error) {
          console.log(
            "Erro ao verificar liberação do Pro:",
            error.message
          );
          return;
        }

        const plano = String(data?.plano || "free");
        const proAte = data?.pro_ate
          ? new Date(data.pro_ate).getTime()
          : 0;

        const proValido =
          plano === "pro" &&
          Number.isFinite(proAte) &&
          proAte > Date.now();

        if (proValido && !cancelado) {
          setAguardandoConfirmacaoCartao(false);
          setSucesso(
            "Pagamento confirmado! O Orvena Pro foi liberado por 30 dias."
          );
          setMostrarPosPagamento(true);
        }
      } catch (error) {
        console.log(
          "Erro ao acompanhar confirmação do cartão:",
          error
        );
      }

      if (
        tentativas >= 40 &&
        !cancelado
      ) {
        setAguardandoConfirmacaoCartao(false);
        setSucesso(
          "Sua assinatura foi recebida. A confirmação do pagamento ainda está sendo processada pelo Mercado Pago. Você pode continuar usando o Orvena e o Pro será liberado automaticamente assim que o pagamento for confirmado."
        );
      }
    };

    void verificar();

    const intervalo = setInterval(() => {
      void verificar();
    }, 3000);

    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [aguardandoConfirmacaoCartao]);

  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }

    const receberMensagem = (event: MessageEvent) => {
      const data = event.data as CardTokenMessage | CardErrorMessage;

      if (!data || data.source !== "orvena-mercadopago") {
        return;
      }

      if (data.type === "card-error") {
        setErro(data.message || "Não foi possível validar o cartão.");
        return;
      }

      if (data.type === "card-token") {
        void criarAssinatura(data.token, data.email);
      }
    };

    window.addEventListener("message", receberMensagem);

    return () => {
      window.removeEventListener("message", receberMensagem);
    };
  }, []);

  async function carregarUsuario() {
    try {
      setCarregando(true);
      setErro("");

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        setRedirecionandoLogin(true);
        router.replace("/login" as any);
        return;
      }

      setEmail(user.email || "");
    } catch {
      setErro("Não foi possível carregar sua conta.");
    } finally {
      setCarregando(false);
    }
  }

  async function criarAssinatura(
    token: string,
    payerEmail: string
  ) {
    if (!token || processando || aguardandoConfirmacaoCartao) {
      return;
    }

    try {
      setProcessando(true);
      setErro("");
      setSucesso("");

      const { data, error } = await supabase.functions.invoke(
        "mercadopago-criar-assinatura",
        {
          body: {
            token,
            email: payerEmail || email,
          },
        }
      );

      if (error) {
        console.log("Erro Edge Function assinatura:", error);
        console.log("Erro Edge Function assinatura:", error);
        setErro("Não foi possível criar a assinatura. Tente novamente.");
        return;
      }

      if (!data?.success) {
        setErro(
          data?.error ||
            "O Mercado Pago não conseguiu autorizar sua assinatura."
        );
        return;
      }

      if (
        data?.reused &&
        String(data?.status || "").toLowerCase() === "authorized"
      ) {
        setSucesso(
          "Sua assinatura já está ativa. Confirmando a liberação do Orvena Pro..."
        );
      } else if (data?.reused) {
        setSucesso(
          "Sua assinatura já está em processamento. Aguardando a confirmação do Mercado Pago..."
        );
      } else {
        setSucesso(
          "Assinatura criada. Aguardando a confirmação do pagamento pelo Mercado Pago..."
        );
      }

      setAguardandoConfirmacaoCartao(true);
    } catch (error) {
      console.log("Erro ao criar assinatura:", error);
      setErro("Não foi possível concluir a assinatura.");
    } finally {
      setProcessando(false);
    }
  }

  async function abrirCheckoutSeguroNoCelular() {
    try {
      if (processando) {
        return;
      }

      setProcessando(true);
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

      const payerEmail = user.email || email;

      if (!payerEmail) {
        setErro("Não foi possível identificar o e-mail da sua conta.");
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        "mercadopago-checkout-plano",
        {
          body: {
            email: payerEmail,
            user_id: user.id,
          },
        }
      );

      if (error) {
        console.log("Erro checkout cartão celular:", error);
        setErro(
          error.message ||
            "Não foi possível abrir o checkout do Mercado Pago."
        );
        return;
      }

      if (!data?.success || !data?.checkout_url) {
        console.log("Resposta checkout cartão celular:", data);
        setErro(
          data?.error ||
            "Não foi possível abrir o checkout do Mercado Pago."
        );
        return;
      }

      const podeAbrir = await Linking.canOpenURL(data.checkout_url);

      if (!podeAbrir) {
        setErro("Não foi possível abrir o Mercado Pago neste aparelho.");
        return;
      }

      await Linking.openURL(data.checkout_url);
    } catch (error) {
      console.log("Erro ao abrir checkout cartão no celular:", error);
      setErro("Não foi possível abrir o checkout do Mercado Pago.");
    } finally {
      setProcessando(false);
    }
  }

  function receberMensagemCartaoNoCelular(event: any) {
    try {
      const mensagem = event?.nativeEvent?.data;

      if (!mensagem) {
        return;
      }

      const data = JSON.parse(mensagem) as
        | CardTokenMessage
        | CardErrorMessage;

      if (!data || data.source !== "orvena-mercadopago") {
        return;
      }

      if (data.type === "card-error") {
        setErro(data.message || "Não foi possível validar o cartão.");
        return;
      }

      if (data.type === "card-token") {
        void criarAssinatura(data.token, data.email);
      }
    } catch (error) {
      console.log("Erro ao receber dados seguros do cartão:", error);
      setErro("Não foi possível processar os dados do cartão.");
    }
  }

  function formatarCpf(valor: string) {
    const numeros = valor.replace(/\D/g, "").slice(0, 11);

    if (numeros.length <= 3) return numeros;
    if (numeros.length <= 6) {
      return `${numeros.slice(0, 3)}.${numeros.slice(3)}`;
    }
    if (numeros.length <= 9) {
      return `${numeros.slice(0, 3)}.${numeros.slice(
        3,
        6
      )}.${numeros.slice(6)}`;
    }

    return `${numeros.slice(0, 3)}.${numeros.slice(
      3,
      6
    )}.${numeros.slice(6, 9)}-${numeros.slice(9)}`;
  }

  async function gerarPix() {
    if (gerandoPix) return;

    const cpf = cpfPix.replace(/\D/g, "");

    if (cpf.length !== 11) {
      setErro("Informe um CPF válido para gerar o Pix.");
      return;
    }

    try {
      setGerandoPix(true);
      setErro("");
      setSucesso("");

      const { data, error } = await supabase.functions.invoke(
        "mercadopago-criar-pix",
        {
          body: { cpf },
        }
      );

      if (error) {
        setErro(error.message || "Não foi possível gerar o Pix.");
        return;
      }

      if (!data?.success) {
        setErro(data?.error || "Não foi possível gerar o Pix.");
        return;
      }

      setPixPaymentId(String(data.payment_id || ""));
      setPixQrCode(String(data.qr_code || ""));
      setPixQrCodeBase64(String(data.qr_code_base64 || ""));
      setPixStatus(String(data.status || "pending"));
      setPixExpiraEm(String(data.expires_at || ""));
    } catch {
      setErro("Não foi possível gerar o Pix.");
    } finally {
      setGerandoPix(false);
    }
  }

  async function consultarPix() {
    if (!pixPaymentId || consultandoPix) return;

    try {
      setConsultandoPix(true);
      setErro("");

      const { data, error } = await supabase.functions.invoke(
        "mercadopago-consultar-pix",
        {
          body: {
            payment_id: pixPaymentId,
          },
        }
      );

      if (error || !data?.success) {
        setErro(
          data?.error ||
            error?.message ||
            "Não foi possível consultar o pagamento."
        );
        return;
      }

      setPixStatus(String(data.status || ""));

      if (data.status === "approved") {
        setSucesso(
          "Pix aprovado! O Orvena Pro foi liberado por 30 dias."
        );
        setMostrarPosPagamento(true);
      }
    } catch {
      setErro("Não foi possível consultar o pagamento.");
    } finally {
      setConsultandoPix(false);
    }
  }

  async function copiarPix() {
    if (!pixQrCode) {
      setErro("O código Pix ainda não foi gerado.");
      return;
    }

    try {
      setErro("");

      if (
        Platform.OS === "web" &&
        typeof navigator !== "undefined" &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(pixQrCode);
      } else {
        await Clipboard.setStringAsync(pixQrCode);
      }

      setSucesso("Pix Copia e Cola copiado.");
    } catch (error) {
      console.log("Erro ao copiar Pix:", error);
      setErro(
        "Não foi possível copiar o Pix automaticamente. Selecione o código e copie manualmente."
      );
    }
  }

  const cardFormHtml = useMemo(() => {
    if (!PUBLIC_KEY) {
      return "";
    }

    const emailInicial = JSON.stringify(email || "");

    return `
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1, viewport-fit=cover"
  />
  <script src="https://sdk.mercadopago.com/js/v2"></script>
  <style>
    * {
      box-sizing: border-box;
      font-family: Inter, Arial, sans-serif;
    }

    html, body {
      width: 100%;
      min-height: 100%;
      margin: 0;
      padding: 0;
      background: #12151B;
      color: #FFFFFF;
      -webkit-text-size-adjust: 100%;
      touch-action: manipulation;
    }

    input,
    select,
    button {
      touch-action: manipulation;
      pointer-events: auto;
    }

    form {
      width: 100%;
      display: grid;
      gap: 12px;
    }

    .label {
      display: block;
      color: #A9AFB8;
      font-size: 11px;
      font-weight: 800;
      margin: 0 0 6px;
    }

    .field,
    .mp-field,
    select {
      width: 100%;
      height: 48px;
      border: 1px solid #2B3039;
      border-radius: 13px;
      background: #0D1015;
      color: #FFFFFF !important;
      padding: 0 13px;
      outline: none;
      font-size: 13px;
      caret-color: #FFFFFF;
      -webkit-text-fill-color: #FFFFFF !important;
      opacity: 1;
    }

    input.field {
      color: #FFFFFF !important;
      caret-color: #FFFFFF !important;
      -webkit-text-fill-color: #FFFFFF !important;
      background-color: #0D1015 !important;
    }

    input.field::placeholder {
      color: #686F7A !important;
      -webkit-text-fill-color: #686F7A !important;
      opacity: 1;
    }

    select.field,
    select.field option {
      color: #FFFFFF !important;
      background: #0D1015 !important;
      -webkit-text-fill-color: #FFFFFF !important;
    }

    input.field:-webkit-autofill,
    input.field:-webkit-autofill:hover,
    input.field:-webkit-autofill:focus,
    input.field:-webkit-autofill:active {
      -webkit-text-fill-color: #FFFFFF !important;
      caret-color: #FFFFFF !important;
      box-shadow: 0 0 0 1000px #0D1015 inset !important;
      -webkit-box-shadow: 0 0 0 1000px #0D1015 inset !important;
      transition: background-color 9999s ease-out 0s;
    }

    .mp-field {
      padding: 0;
      position: relative;
      overflow: hidden;
    }

    .mp-field iframe {
      display: block !important;
      width: 100% !important;
      height: 100% !important;
      border: 0 !important;
    }

    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .hidden-field {
      display: none;
    }

    button {
      height: 52px;
      border: 0;
      border-radius: 14px;
      background: #7C5CFF;
      color: white;
      font-size: 11px;
      font-weight: 900;
      cursor: pointer;
      margin-top: 4px;
    }

    button:disabled {
      opacity: .65;
      cursor: default;
    }

    @media (max-width: 700px) {
      form {
        gap: 14px;
      }

      .row {
        grid-template-columns: 1fr;
        gap: 14px;
      }

      .field,
      .mp-field,
      select {
        min-height: 54px;
        height: 54px;
        font-size: 16px !important;
      }

      input.field {
        font-size: 16px !important;
        line-height: 22px !important;
      }

      .label {
        font-size: 12px;
        margin-bottom: 7px;
      }

      button {
        min-height: 54px;
        font-size: 12px;
      }

      .mp-field iframe {
        min-height: 54px !important;
      }
    }

    .safe {
      border: 1px solid #285A42;
      border-radius: 12px;
      background: #101B17;
      color: #89BFA3;
      padding: 10px 12px;
      font-size: 10px;
      line-height: 15px;
    }

    .error {
      display: none;
      border: 1px solid #552C35;
      border-radius: 12px;
      background: #211217;
      color: #FF8A93;
      padding: 10px 12px;
      font-size: 10px;
      line-height: 15px;
    }

    .status {
      display: none;
      border: 1px solid #3A315B;
      border-radius: 12px;
      background: #161326;
      color: #B8AAFF;
      padding: 10px 12px;
      font-size: 10px;
      line-height: 15px;
    }

    @media (max-width: 560px) {
      .row {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <form id="form-checkout">
    <div>
      <label class="label">Número do cartão</label>
      <div id="form-checkout__cardNumber" class="mp-field"></div>
    </div>

    <div class="row">
      <div>
        <label class="label">Validade</label>
        <div id="form-checkout__expirationDate" class="mp-field"></div>
      </div>

      <div>
        <label class="label">CVV</label>
        <div id="form-checkout__securityCode" class="mp-field"></div>
      </div>
    </div>

    <div>
      <label class="label">Nome impresso no cartão</label>
      <input
        id="form-checkout__cardholderName"
        class="field"
        type="text"
        autocomplete="cc-name"
        placeholder="Nome do titular"
      />
    </div>

    <div class="row">
      <div>
        <label class="label">Documento</label>
        <select
          id="form-checkout__identificationType"
          class="field"
        ></select>
      </div>

      <div>
        <label class="label">Número do documento</label>
        <input
          id="form-checkout__identificationNumber"
          class="field"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          placeholder="000.000.000-00"
          maxlength="18"
        />
      </div>
    </div>

    <div>
      <label class="label">E-mail</label>
      <input
        id="form-checkout__cardholderEmail"
        class="field"
        type="email"
        autocomplete="email"
        value=""
        placeholder="seu@email.com"
      />
    </div>

    <select
      id="form-checkout__issuer"
      class="hidden-field"
    ></select>

    <select
      id="form-checkout__installments"
      class="hidden-field"
    ></select>

    <div class="safe">
      Seus dados de cartão são tokenizados diretamente pelo Mercado Pago.
      O Orvena não recebe nem armazena o número completo do cartão ou CVV.
    </div>

    <div id="card-error" class="error"></div>
    <div id="card-status" class="status"></div>

    <button id="form-checkout__submit" type="submit">
      ASSINAR ORVENA PRO
    </button>
  </form>

  <script>
    const initialEmail = ${emailInicial};
    const emailField = document.getElementById(
      "form-checkout__cardholderEmail"
    );

    if (emailField && initialEmail) {
      emailField.value = initialEmail;
    }

    const mp = new MercadoPago(
      ${JSON.stringify(PUBLIC_KEY)},
      { locale: "pt-BR" }
    );

    const errorBox = document.getElementById("card-error");
    const statusBox = document.getElementById("card-status");
    const submitButton = document.getElementById(
      "form-checkout__submit"
    );

    let submitCallbackExecutado = false;
    let submitFeedbackTimer = null;

    function showStatus(message) {
      if (!statusBox) return;
      statusBox.style.display = "block";
      statusBox.textContent = message || "";
    }

    function hideStatus() {
      if (!statusBox) return;
      statusBox.style.display = "none";
      statusBox.textContent = "";
    }

    submitButton.addEventListener("click", () => {
      submitCallbackExecutado = false;
      errorBox.style.display = "none";
      showStatus("Validando os dados do cartão...");

      if (submitFeedbackTimer) {
        clearTimeout(submitFeedbackTimer);
      }

      submitFeedbackTimer = setTimeout(() => {
        if (!submitCallbackExecutado) {
          hideStatus();
          showError(
            "O Mercado Pago não conseguiu validar os dados. Confira número do cartão, validade, CVV, nome, documento e e-mail."
          );
          submitButton.disabled = false;
          submitButton.textContent = "ASSINAR ORVENA PRO";
        }
      }, 4500);
    });

    const identificationTypeField = document.getElementById(
      "form-checkout__identificationType"
    );

    const identificationNumberField = document.getElementById(
      "form-checkout__identificationNumber"
    );

    function somenteNumeros(valor) {
      return String(valor || "").replace(/\\D/g, "");
    }

    function formatarCpf(valor) {
      const numeros = somenteNumeros(valor).slice(0, 11);

      if (numeros.length <= 3) return numeros;
      if (numeros.length <= 6) {
        return numeros.replace(/(\\d{3})(\\d+)/, "$1.$2");
      }
      if (numeros.length <= 9) {
        return numeros.replace(
          /(\\d{3})(\\d{3})(\\d+)/,
          "$1.$2.$3"
        );
      }

      return numeros.replace(
        /(\\d{3})(\\d{3})(\\d{3})(\\d{1,2})/,
        "$1.$2.$3-$4"
      );
    }

    function formatarCnpj(valor) {
      const numeros = somenteNumeros(valor).slice(0, 14);

      if (numeros.length <= 2) return numeros;
      if (numeros.length <= 5) {
        return numeros.replace(/(\\d{2})(\\d+)/, "$1.$2");
      }
      if (numeros.length <= 8) {
        return numeros.replace(
          /(\\d{2})(\\d{3})(\\d+)/,
          "$1.$2.$3"
        );
      }
      if (numeros.length <= 12) {
        return numeros.replace(
          /(\\d{2})(\\d{3})(\\d{3})(\\d+)/,
          "$1.$2.$3/$4"
        );
      }

      return numeros.replace(
        /(\\d{2})(\\d{3})(\\d{3})(\\d{4})(\\d{1,2})/,
        "$1.$2.$3/$4-$5"
      );
    }

    function tipoDocumentoSelecionado() {
      const valor = String(
        identificationTypeField?.value || "CPF"
      ).toUpperCase();

      return valor === "CNPJ" ? "CNPJ" : "CPF";
    }

    function atualizarCampoDocumento() {
      if (!identificationNumberField) {
        return;
      }

      const tipo = tipoDocumentoSelecionado();
      const numeros = somenteNumeros(identificationNumberField.value);

      if (tipo === "CNPJ") {
        identificationNumberField.placeholder = "00.000.000/0000-00";
        identificationNumberField.maxLength = 18;
        identificationNumberField.value = formatarCnpj(numeros);
      } else {
        identificationNumberField.placeholder = "000.000.000-00";
        identificationNumberField.maxLength = 14;
        identificationNumberField.value = formatarCpf(numeros);
      }
    }

    if (identificationNumberField) {
      identificationNumberField.addEventListener("input", () => {
        const tipo = tipoDocumentoSelecionado();

        identificationNumberField.value =
          tipo === "CNPJ"
            ? formatarCnpj(identificationNumberField.value)
            : formatarCpf(identificationNumberField.value);
      });
    }

    if (identificationTypeField) {
      identificationTypeField.addEventListener(
        "change",
        atualizarCampoDocumento
      );

      // O Mercado Pago pode preencher as opções alguns instantes
      // depois da montagem do formulário.
      setTimeout(atualizarCampoDocumento, 250);
      setTimeout(atualizarCampoDocumento, 800);
    }

    function enviarParaOrvena(payload) {
      try {
        if (
          window.ReactNativeWebView &&
          typeof window.ReactNativeWebView.postMessage === "function"
        ) {
          window.ReactNativeWebView.postMessage(
            JSON.stringify(payload)
          );
          return;
        }

        window.parent.postMessage(payload, "*");
      } catch (error) {
        console.error("Erro ao enviar mensagem para o Orvena:", error);
      }
    }

    function showError(message) {
      hideStatus();
      errorBox.style.display = "block";
      errorBox.textContent =
        message || "Confira os dados do cartão e tente novamente.";

      enviarParaOrvena({
        source: "orvena-mercadopago",
        type: "card-error",
        message: errorBox.textContent,
      });
    }

    const cardForm = mp.cardForm({
      amount: "14.99",
      iframe: true,
      form: {
        id: "form-checkout",
        cardNumber: {
          id: "form-checkout__cardNumber",
          placeholder: "0000 0000 0000 0000",
          style: {
            color: "#FFFFFF",
            placeholderColor: "#5F6672",
            fontSize: "16px",
            fontFamily: "Arial, sans-serif",
            height: "100%",
            width: "100%",
            padding: "0 12px",
          },
        },
        expirationDate: {
          id: "form-checkout__expirationDate",
          placeholder: "MM/AA",
          style: {
            color: "#FFFFFF",
            placeholderColor: "#5F6672",
            fontSize: "16px",
            fontFamily: "Arial, sans-serif",
            height: "100%",
            width: "100%",
            padding: "0 12px",
          },
        },
        securityCode: {
          id: "form-checkout__securityCode",
          placeholder: "123",
          style: {
            color: "#FFFFFF",
            placeholderColor: "#5F6672",
            fontSize: "16px",
            fontFamily: "Arial, sans-serif",
            height: "100%",
            width: "100%",
            padding: "0 12px",
          },
        },
        cardholderName: {
          id: "form-checkout__cardholderName",
          placeholder: "Nome do titular",
        },
        issuer: {
          id: "form-checkout__issuer",
          placeholder: "Emissor",
        },
        installments: {
          id: "form-checkout__installments",
          placeholder: "Parcelas",
        },
        identificationType: {
          id: "form-checkout__identificationType",
          placeholder: "Documento",
        },
        identificationNumber: {
          id: "form-checkout__identificationNumber",
          placeholder: "Documento",
        },
        cardholderEmail: {
          id: "form-checkout__cardholderEmail",
          placeholder: "E-mail",
        },
      },
      callbacks: {
        onFormMounted: (error) => {
          if (error) {
            showError("Não foi possível carregar o formulário do cartão.");
            return;
          }

          setTimeout(atualizarCampoDocumento, 100);
        },

        onSubmit: (event) => {
          event.preventDefault();
          submitCallbackExecutado = true;

          if (submitFeedbackTimer) {
            clearTimeout(submitFeedbackTimer);
          }

          errorBox.style.display = "none";
          showStatus("Cartão validado. Preparando assinatura...");
          submitButton.disabled = true;
          submitButton.textContent = "VALIDANDO CARTÃO...";

          try {
            const data = cardForm.getCardFormData();

            if (!data.token) {
              showError(
                "Não foi possível gerar o token seguro do cartão."
              );
              atualizarCampoDocumento();
              submitButton.disabled = false;
              submitButton.textContent = "ASSINAR ORVENA PRO";
              return;
            }

            showStatus("Dados seguros gerados. Ativando o Orvena Pro...");

            enviarParaOrvena({
              source: "orvena-mercadopago",
              type: "card-token",
              token: data.token,
              email: data.cardholderEmail || initialEmail,
            });
          } catch (error) {
            console.error(error);
            atualizarCampoDocumento();
            showError("Confira os dados informados e tente novamente.");
            submitButton.disabled = false;
            submitButton.textContent = "ASSINAR ORVENA PRO";
          }
        },

        onFetching: () => {
          return () => {};
        },
      },
    });
  </script>
</body>
</html>`;
  }, [email]);

  function voltar() {
    router.replace("/plano" as any);
  }

  if (carregando || redirecionandoLogin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color="#7C5CFF" />
        </View>
      </SafeAreaView>
    );
  }

  const iframe = Platform.OS === "web" && cardFormHtml
    ? React.createElement("iframe" as any, {
        title: "Pagamento seguro Orvena Pro",
        srcDoc: cardFormHtml,
        scrolling: "no",
        allow: "payment *",
        style: {
          width: "100%",
          height: isDesktop ? 590 : 760,
          border: "0",
          borderRadius: 16,
          background: "#12151B",
          display: "block",
          pointerEvents: "auto",
          touchAction: "manipulation",
        },
      })
    : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        nestedScrollEnabled
      >
        <View style={styles.page}>
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={voltar}>
              <Text style={styles.backButtonText}>←</Text>
            </Pressable>

            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>ORVENA PRO</Text>
              <Text style={styles.title}>Escolha como assinar</Text>
              <Text style={styles.subtitle}>
                R$ 14,99. Cartão com renovação automática ou Pix por 30 dias.
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
              <View style={styles.methodCard}>
                <Text style={styles.sectionEyebrow}>
                  FORMA DE PAGAMENTO
                </Text>
                <Text style={styles.sectionTitle}>
                  Como deseja pagar?
                </Text>

                <View style={styles.methodGrid}>
                  <Pressable
                    style={[
                      styles.methodOption,
                      metodo === "cartao" &&
                        styles.methodOptionActive,
                    ]}
                    onPress={() => {
                      setMetodo("cartao");
                      setErro("");
                    }}
                  >
                    <View style={styles.methodIcon}>
                      <Text style={styles.methodIconText}>▣</Text>
                    </View>

                    <View style={styles.methodContent}>
                      <Text style={styles.methodTitle}>
                        Cartão de crédito
                      </Text>
                      <Text style={styles.methodText}>
                        R$ 14,99 por mês com renovação automática.
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.radio,
                        metodo === "cartao" && styles.radioActive,
                      ]}
                    />
                  </Pressable>

                  <Pressable
                    style={[
                      styles.methodOption,
                      metodo === "pix" &&
                        styles.methodOptionActive,
                    ]}
                    onPress={() => {
                      setMetodo("pix");
                      setErro("");
                    }}
                  >
                    <View style={styles.methodIcon}>
                      <Text style={styles.methodIconText}>◆</Text>
                    </View>

                    <View style={styles.methodContent}>
                      <Text style={styles.methodTitle}>Pix</Text>
                      <Text style={styles.methodText}>
                        R$ 14,99 por 30 dias • QR Code e Pix Copia e Cola.
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.radio,
                        metodo === "pix" && styles.radioActive,
                      ]}
                    />
                  </Pressable>
                </View>
              </View>

              {metodo === "cartao" ? (
                <View style={styles.paymentCard}>
                  <View style={styles.paymentHeader}>
                    <View>
                      <Text style={styles.sectionEyebrow}>
                        CARTÃO DE CRÉDITO
                      </Text>
                      <Text style={styles.sectionTitle}>
                        Dados do cartão
                      </Text>
                    </View>

                    <View style={styles.secureBadge}>
                      <Text style={styles.secureBadgeText}>
                        PAGAMENTO SEGURO
                      </Text>
                    </View>
                  </View>

                  {Platform.OS === "web" ? (
                    PUBLIC_KEY ? (
                      iframe
                    ) : (
                      <View style={styles.errorBox}>
                        <Text style={styles.errorText}>
                          A Public Key do Mercado Pago não foi encontrada
                          no .env.
                        </Text>
                      </View>
                    )
                  ) : PUBLIC_KEY ? (
                    <View style={styles.mobileWebViewBox}>
                      <Text style={styles.mobileCardText}>
                        Preencha os dados abaixo. O cartão é processado com
                        segurança pelo Mercado Pago sem sair do Orvena.
                      </Text>

                      <WebView
                        originWhitelist={["*"]}
                        source={{
                          html: cardFormHtml,
                          baseUrl: "https://orvena.pro",
                        }}
                        onMessage={receberMensagemCartaoNoCelular}
                        javaScriptEnabled
                        domStorageEnabled
                        thirdPartyCookiesEnabled
                        sharedCookiesEnabled
                        keyboardDisplayRequiresUserAction={false}
                        automaticallyAdjustContentInsets={false}
                        nestedScrollEnabled
                        scrollEnabled
                        style={styles.mobileCardWebView}
                      />

                      {processando ? (
                        <View style={styles.mobileProcessingBox}>
                          <ActivityIndicator color="#FFFFFF" />
                          <Text style={styles.mobileProcessingText}>
                            Processando sua assinatura...
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>
                        A Public Key do Mercado Pago não foi encontrada
                        no aplicativo.
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.paymentCard}>
                  <Text style={styles.sectionEyebrow}>PIX</Text>
                  <Text style={styles.sectionTitle}>
                    Orvena Pro por 30 dias
                  </Text>

                  <View style={styles.pixNotice}>
                    <Text style={styles.pixNoticeTitle}>
                      R$ 14,99 • renovação manual
                    </Text>
                    <Text style={styles.pixNoticeText}>
                      Pague com qualquer banco usando QR Code ou Pix Copia
                      e Cola. Esta opção libera 30 dias de Pro após a
                      confirmação do pagamento e não possui renovação
                      automática.
                    </Text>
                  </View>

                  {!pixPaymentId ? (
                    <View style={styles.pixForm}>
                      <Text style={styles.pixLabel}>CPF do pagador</Text>
                      <TextInput
                        value={cpfPix}
                        onChangeText={(valor) =>
                          setCpfPix(formatarCpf(valor))
                        }
                        placeholder="000.000.000-00"
                        placeholderTextColor="#555B65"
                        keyboardType="number-pad"
                        inputMode="numeric"
                        autoCorrect={false}
                        autoCapitalize="none"
                        maxLength={14}
                        style={styles.pixInput}
                      />

                      <Pressable
                        style={[
                          styles.primaryButton,
                          gerandoPix && styles.disabled,
                        ]}
                        onPress={gerarPix}
                        disabled={gerandoPix}
                      >
                        {gerandoPix ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={styles.primaryButtonText}>
                            GERAR PIX DE R$ 14,99
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.pixGenerated}>
                      {pixQrCodeBase64 ? (
                        <View style={styles.qrWrap}>
                          <Image
                            source={{
                              uri: `data:image/png;base64,${pixQrCodeBase64}`,
                            }}
                            style={styles.qrImage}
                            resizeMode="contain"
                          />
                        </View>
                      ) : null}

                      <Text style={styles.pixGeneratedTitle}>
                        Escaneie o QR Code
                      </Text>
                      <Text style={styles.pixGeneratedText}>
                        Abra o aplicativo do seu banco e escolha pagar com
                        Pix.
                      </Text>

                      <Text style={styles.pixLabel}>
                        Pix Copia e Cola
                      </Text>

                      <TextInput
                        value={pixQrCode}
                        editable
                        showSoftInputOnFocus={false}
                        multiline
                        selectTextOnFocus
                        contextMenuHidden={false}
                        style={styles.pixCode}
                      />

                      <Pressable
                        style={styles.copyButton}
                        onPress={copiarPix}
                      >
                        <Text style={styles.copyButtonText}>
                          COPIAR PIX
                        </Text>
                      </Pressable>

                      <View style={styles.pixStatusBox}>
                        <Text style={styles.pixStatusLabel}>
                          STATUS DO PAGAMENTO
                        </Text>
                        <Text style={styles.pixStatusValue}>
                          {pixStatus === "approved"
                            ? "APROVADO"
                            : "AGUARDANDO PAGAMENTO"}
                        </Text>

                        {pixExpiraEm ? (
                          <Text style={styles.pixExpires}>
                            Este Pix expira em{" "}
                            {new Date(pixExpiraEm).toLocaleString(
                              "pt-BR"
                            )}
                          </Text>
                        ) : null}
                      </View>

                      <Pressable
                        style={[
                          styles.primaryButton,
                          consultandoPix && styles.disabled,
                        ]}
                        onPress={consultarPix}
                        disabled={consultandoPix}
                      >
                        {consultandoPix ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={styles.primaryButtonText}>
                            JÁ PAGUEI • VERIFICAR PAGAMENTO
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  )}
                </View>
              )}

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

              {aguardandoConfirmacaoCartao ? (
                <View style={styles.cardWaitingBox}>
                  <ActivityIndicator size="small" color="#B8AAFF" />
                  <View style={styles.cardWaitingTextArea}>
                    <Text style={styles.cardWaitingTitle}>
                      Confirmando pagamento
                    </Text>
                    <Text style={styles.cardWaitingText}>
                      Não feche o Orvena. Assim que o Mercado Pago confirmar a
                      cobrança, o Pro será liberado automaticamente.
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>

            <View
              style={[
                styles.sideColumn,
                isDesktop && styles.sideColumnDesktop,
              ]}
            >
              <View style={styles.summaryCard}>
                <Text style={styles.summaryEyebrow}>ORVENA PRO</Text>
                <Text style={styles.summaryTitle}>
                  30 dias de Pro
                </Text>
                <Text style={styles.summarySubtitle}>
                  Escolha a forma que combina com você:
                </Text>

                <View style={styles.priceRow}>
                  <Text style={styles.price}>R$ 14,99</Text>
                  <Text style={styles.pricePeriod}>/mês</Text>
                </View>

                <View style={styles.summaryDivider} />

                <SummaryLine text="Clientes e obras" />
                <SummaryLine text="Financeiro" />
                <SummaryLine text="Agenda" />
                <SummaryLine text="Relatórios" />
                <SummaryLine text="Identidade personalizada nos PDFs" />

                <View style={styles.cancelBox}>
                  <Text style={styles.cancelTitle}>
                    Como funciona a renovação
                  </Text>
                  <Text style={styles.cancelText}>
                    No cartão, a renovação é automática conforme a assinatura.
                    No Pix, cada pagamento libera 30 dias e a renovação é
                    manual.
                  </Text>
                </View>

                <Text style={styles.providerText}>
                  Pagamentos processados com segurança pelo Mercado Pago.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={mostrarPosPagamento}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.postPaymentBackdrop}>
          <View style={styles.postPaymentCard}>
            <View style={styles.postPaymentIcon}>
              <Text style={styles.postPaymentIconText}>✓</Text>
            </View>

            <Text style={styles.postPaymentEyebrow}>
              PAGAMENTO CONFIRMADO
            </Text>

            <Text style={styles.postPaymentTitle}>
              Orvena Pro ativado por 30 dias
            </Text>

            <Text style={styles.postPaymentText}>
              Antes de usar todos os recursos Pro, cadastre os dados da sua
              empresa. Essas informações serão usadas para personalizar seus
              documentos e PDFs.
            </Text>

            <View style={styles.postPaymentInfoBox}>
              <Text style={styles.postPaymentInfoTitle}>
                O que você vai cadastrar
              </Text>

              <Text style={styles.postPaymentInfoText}>
                • Nome da empresa{"\n"}
                • Logo{"\n"}
                • CPF ou CNPJ{"\n"}
                • Telefone e e-mail{"\n"}
                • Endereço
              </Text>

              <Text style={styles.postPaymentInfoHint}>
                Depois de salvar, você volta automaticamente para a tela Hoje
                com os recursos Pro liberados.
              </Text>
            </View>

            <Pressable
              style={styles.postPaymentButton}
              onPress={() => {
                setMostrarPosPagamento(false);
                router.replace("/empresa" as any);
              }}
            >
              <Text style={styles.postPaymentButtonText}>
                CADASTRAR MINHA EMPRESA
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {processando ? (
        <View style={styles.processingOverlay}>
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" color="#7C5CFF" />
            <Text style={styles.processingTitle}>
              Ativando Orvena Pro...
            </Text>
            <Text style={styles.processingText}>
              Aguarde a confirmação segura do Mercado Pago.
            </Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function SummaryLine({ text }: { text: string }) {
  return (
    <View style={styles.summaryLine}>
      <View style={styles.summaryCheck}>
        <Text style={styles.summaryCheckText}>✓</Text>
      </View>
      <Text style={styles.summaryLineText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B0C10",
  },

  scrollContent: {
    flexGrow: 1,
  },

  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },

  loadingText: {
    color: "#777E89",
    fontSize: 11,
  },

  page: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 48,
  },

  header: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
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

  headerText: {
    flex: 1,
  },

  eyebrow: {
    color: "#7C5CFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 29,
    fontWeight: "900",
    marginTop: 5,
  },

  subtitle: {
    color: "#7D848F",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  columns: {
    gap: 16,
  },

  columnsDesktop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  mainColumn: {
    flex: 1,
    gap: 15,
  },

  sideColumn: {
    width: "100%",
  },

  sideColumnDesktop: {
    width: 340,
  },

  methodCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#292E37",
    backgroundColor: "#12151B",
    padding: 18,
  },

  sectionEyebrow: {
    color: "#8F79FF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.3,
  },

  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 5,
  },

  methodGrid: {
    gap: 10,
    marginTop: 16,
  },

  methodOption: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2C313A",
    backgroundColor: "#0F1217",
    padding: 13,
  },

  methodOptionActive: {
    borderColor: "#6650CE",
    backgroundColor: "#171323",
  },

  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#40356A",
    backgroundColor: "#211B38",
    alignItems: "center",
    justifyContent: "center",
  },

  methodIconText: {
    color: "#B3A5FF",
    fontSize: 18,
    fontWeight: "900",
  },

  methodContent: {
    flex: 1,
  },

  methodTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  methodText: {
    color: "#7D848F",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 4,
  },

  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#4A505B",
  },

  radioActive: {
    borderWidth: 5,
    borderColor: "#8F79FF",
  },

  paymentCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#292E37",
    backgroundColor: "#12151B",
    padding: 18,
  },

  paymentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 15,
  },

  secureBadge: {
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#285A42",
    backgroundColor: "#101B17",
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  secureBadgeText: {
    color: "#73C79B",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  mobileWebViewBox: {
    width: "100%",
    marginTop: 14,
    gap: 12,
  },

  mobileCardWebView: {
    width: "100%",
    height: 780,
    backgroundColor: "#12151B",
    borderRadius: 16,
  },

  mobileProcessingBox: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#171321",
    borderWidth: 1,
    borderColor: "#3A2F5D",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
  },

  mobileProcessingText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },

  mobileCardBox: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#302A43",
    backgroundColor: "#10131A",
    padding: 15,
  },

  mobileCardTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  mobileCardText: {
    color: "#7D848F",
    fontSize: 10,
    lineHeight: 16,
    marginTop: 6,
  },

  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  pixNotice: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#4C4227",
    backgroundColor: "#201C11",
    padding: 14,
    marginTop: 15,
  },

  pixNoticeTitle: {
    color: "#E5C873",
    fontSize: 11,
    fontWeight: "900",
  },

  pixNoticeText: {
    color: "#A99A6C",
    fontSize: 10,
    lineHeight: 16,
    marginTop: 5,
  },

  pixForm: {
    marginTop: 15,
  },

  pixLabel: {
    color: "#A9AFB8",
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 7,
    marginTop: 12,
  },

  pixInput: {
    minHeight: 54,
    height: 54,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#2B3039",
    backgroundColor: "#0D1015",
    color: "#FFFFFF",
    fontSize: 13,
    paddingHorizontal: 13,
  },

  pixGenerated: {
    marginTop: 16,
  },

  qrWrap: {
    width: 230,
    height: 230,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignSelf: "center",
    padding: 10,
  },

  qrImage: {
    width: "100%",
    height: "100%",
  },

  pixGeneratedTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 14,
  },

  pixGeneratedText: {
    color: "#7D848F",
    fontSize: 9,
    lineHeight: 14,
    textAlign: "center",
    marginTop: 4,
  },

  pixCode: {
    minHeight: 90,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#2B3039",
    backgroundColor: "#0D1015",
    color: "#AAB0B9",
    fontSize: 9,
    lineHeight: 14,
    padding: 12,
  },

  copyButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#4B3D86",
    backgroundColor: "#191526",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 9,
  },

  copyButtonText: {
    color: "#B9ADFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  pixStatusBox: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#302A43",
    backgroundColor: "#10131A",
    padding: 12,
    marginTop: 12,
  },

  pixStatusLabel: {
    color: "#7D848F",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  pixStatusValue: {
    color: "#E7C86E",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 4,
  },

  pixExpires: {
    color: "#666D77",
    fontSize: 8,
    lineHeight: 13,
    marginTop: 5,
  },

  errorBox: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#552C35",
    backgroundColor: "#211217",
    padding: 12,
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
    padding: 12,
  },

  cardWaitingBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#3A315B",
    backgroundColor: "#161326",
    padding: 12,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  cardWaitingTextArea: {
    flex: 1,
  },

  cardWaitingTitle: {
    color: "#D4CCFF",
    fontSize: 10,
    fontWeight: "900",
  },

  cardWaitingText: {
    color: "#9189B6",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 3,
  },

  successText: {
    color: "#76EAB3",
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "800",
  },

  summaryCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#352B52",
    backgroundColor: "#15131E",
    padding: 18,
  },

  summaryEyebrow: {
    color: "#8F79FF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.3,
  },

  summaryTitle: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
    marginTop: 7,
  },

  summarySubtitle: {
    color: "#7D848F",
    fontSize: 9,
    marginTop: 14,
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginTop: 4,
  },

  price: {
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "900",
  },

  pricePeriod: {
    color: "#858B95",
    fontSize: 10,
    fontWeight: "700",
  },

  summaryDivider: {
    height: 1,
    backgroundColor: "#2B2737",
    marginVertical: 15,
  },

  summaryLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 11,
  },

  summaryCheck: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: "#17241D",
    borderWidth: 1,
    borderColor: "#2B5D44",
    alignItems: "center",
    justifyContent: "center",
  },

  summaryCheckText: {
    color: "#6FE8AE",
    fontSize: 10,
    fontWeight: "900",
  },

  summaryLineText: {
    color: "#B9BDC4",
    fontSize: 9,
    fontWeight: "700",
    flex: 1,
  },

  cancelBox: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#302A43",
    backgroundColor: "#10131A",
    padding: 11,
    marginTop: 5,
  },

  cancelTitle: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },

  cancelText: {
    color: "#777E89",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 4,
  },

  providerText: {
    color: "#616873",
    fontSize: 8,
    lineHeight: 13,
    textAlign: "center",
    marginTop: 13,
  },

  postPaymentBackdrop: {
    flex: 1,
    backgroundColor: "rgba(7,8,11,0.88)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  postPaymentCard: {
    width: "100%",
    maxWidth: 460,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#3A3060",
    backgroundColor: "#15131E",
    padding: 24,
    alignItems: "center",
  },

  postPaymentIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#14271E",
    borderWidth: 1,
    borderColor: "#2F6B4A",
    alignItems: "center",
    justifyContent: "center",
  },

  postPaymentIconText: {
    color: "#76EAB3",
    fontSize: 27,
    fontWeight: "900",
  },

  postPaymentEyebrow: {
    color: "#76EAB3",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginTop: 16,
  },

  postPaymentTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 7,
  },

  postPaymentText: {
    color: "#A1A7B1",
    fontSize: 11,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 9,
  },

  postPaymentInfoBox: {
    width: "100%",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#302A43",
    backgroundColor: "#10131A",
    padding: 14,
    marginTop: 18,
  },

  postPaymentInfoTitle: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },

  postPaymentInfoText: {
    color: "#B9BDC4",
    fontSize: 10,
    lineHeight: 18,
    marginTop: 8,
  },

  postPaymentInfoHint: {
    color: "#777E89",
    fontSize: 9,
    lineHeight: 15,
    marginTop: 10,
  },

  postPaymentButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },

  postPaymentButtonText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  processingOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(7,8,11,0.82)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  processingCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#352B52",
    backgroundColor: "#15131E",
    alignItems: "center",
    padding: 24,
  },

  processingTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 14,
  },

  processingText: {
    color: "#7D848F",
    fontSize: 10,
    textAlign: "center",
    lineHeight: 15,
    marginTop: 5,
  },

  disabled: {
    opacity: 0.65,
  },
});