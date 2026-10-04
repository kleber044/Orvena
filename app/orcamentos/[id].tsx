import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import { router, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useMemo, useState } from "react";
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

import { mensagemSegura } from "../../lib/security";
import { supabase } from "../../lib/supabase";

type Orcamento = {
  id: string;
  numero: number;
  cliente_nome: string;
  cliente_telefone: string | null;
  cliente_endereco: string | null;
  cliente_cep: string | null;
  cliente_logradouro: string | null;
  cliente_numero: string | null;
  cliente_complemento: string | null;
  cliente_bairro: string | null;
  cliente_cidade: string | null;
  cliente_uf: string | null;
  cliente_estado: string | null;
  cliente_email: string | null;
  titulo: string | null;
  descricao: string | null;
  observacoes: string | null;
  validade_dias: number;
  desconto: number | string;
  mao_de_obra: number | string;
  outros_gastos: number | string;
  acrescimo: number | string;
  forma_pagamento: string | null;
  condicoes_pagamento: string | null;
  subtotal: number | string;
  total: number | string;
  status: "rascunho" | "enviado" | "aprovado" | "recusado" | "cancelado";
  criado_em: string;
  atualizado_em: string;
};

type ItemOrcamento = {
  id: string;
  descricao: string;
  quantidade: number | string;
  valor_unitario: number | string;
  total: number | string;
  ordem: number;
};

type Empresa = {
  nome_fantasia: string | null;
  razao_social: string | null;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  estado: string | null;
  logo_url: string | null;
};

type PlanoUsuario = "free" | "trialing" | "pro";

const STATUS_LABELS: Record<Orcamento["status"], string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
  cancelado: "Cancelado",
};

function formatarMoeda(valor: number | string) {
  const numero = Number(valor || 0);

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(numero) ? numero : 0);
}

function formatarData(valor: string) {
  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}

export default function OrcamentoDetalhesScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [itens, setItens] = useState<ItemOrcamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [redirecionandoLogin, setRedirecionandoLogin] = useState(false);
  const [erro, setErro] = useState("");
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [baixandoPdf, setBaixandoPdf] = useState(false);
  const [alterandoStatus, setAlterandoStatus] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [planoUsuario, setPlanoUsuario] = useState<PlanoUsuario>("free");
  const [empresa, setEmpresa] = useState<Empresa | null>(null);

  useEffect(() => {
    carregar();
  }, [id]);

  function voltar() {
    router.replace("/orcamentos" as any);
  }

  async function carregar() {
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
        setRedirecionandoLogin(true);
        router.replace("/login" as any);
        return;
      }

      const { data: orcamentoData, error: orcamentoError } = await supabase
        .from("orcamentos")
        .select(
          "id, numero, cliente_nome, cliente_telefone, cliente_endereco, cliente_cep, cliente_logradouro, cliente_numero, cliente_complemento, cliente_bairro, cliente_cidade, cliente_uf, cliente_estado, cliente_email, titulo, descricao, observacoes, validade_dias, desconto, mao_de_obra, outros_gastos, acrescimo, forma_pagamento, condicoes_pagamento, subtotal, total, status, criado_em, atualizado_em"
        )
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (orcamentoError || !orcamentoData) {
        setErro(
          orcamentoError?.message || "Não foi possível carregar o orçamento."
        );
        return;
      }

      const { data: itensData, error: itensError } = await supabase
        .from("orcamento_itens")
        .select(
          "id, descricao, quantidade, valor_unitario, total, ordem"
        )
        .eq("orcamento_id", id)
        .eq("user_id", user.id)
        .order("ordem", { ascending: true });

      if (itensError) {
        setErro(itensError.message);
        return;
      }

      const [{ data: profileData }, { data: empresaData }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("plano")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("empresas")
            .select(
              "nome_fantasia, razao_social, documento, telefone, email, cep, logradouro, numero, complemento, bairro, cidade, uf, estado, logo_url"
            )
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

      const plano = (profileData?.plano || "free") as PlanoUsuario;

      setPlanoUsuario(plano);
      setEmpresa((empresaData || null) as Empresa | null);
      setOrcamento(orcamentoData as Orcamento);
      setItens((itensData || []) as ItemOrcamento[]);
    } catch {
      setErro("Não foi possível carregar este orçamento.");
    } finally {
      setCarregando(false);
    }
  }

  const desconto = useMemo(
    () => Number(orcamento?.desconto || 0),
    [orcamento]
  );

  function escaparHtml(valor: string | null | undefined) {
    return String(valor ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function enderecoCompleto() {
    return (
      [
        orcamento?.cliente_logradouro,
        orcamento?.cliente_numero,
        orcamento?.cliente_complemento,
        orcamento?.cliente_bairro,
        orcamento?.cliente_cidade,
        orcamento?.cliente_uf,
      ]
        .filter(Boolean)
        .join(", ") ||
      orcamento?.cliente_endereco ||
      "Não informado"
    );
  }

  const proAtivo =
    planoUsuario === "pro" || planoUsuario === "trialing";

  function empresaEnderecoCompleto() {
    if (!empresa) {
      return "";
    }

    return [
      empresa.logradouro,
      empresa.numero,
      empresa.complemento,
      empresa.bairro,
      empresa.cidade,
      empresa.uf,
    ]
      .filter(Boolean)
      .join(", ");
  }

  function empresaContatoResumo() {
    if (!empresa) {
      return "";
    }

    return [empresa.documento, empresa.telefone, empresa.email]
      .filter(Boolean)
      .join(" • ");
  }

  async function carregarLogoDataUrl() {
    if (!proAtivo || !empresa?.logo_url) {
      return "";
    }

    try {
      const resposta = await fetch(empresa.logo_url);

      if (!resposta.ok) {
        return "";
      }

      const blob = await resposta.blob();

      return await new Promise<string>((resolve) => {
        const reader = new FileReader();

        reader.onloadend = () => {
          resolve(
            typeof reader.result === "string" ? reader.result : ""
          );
        };

        reader.onerror = () => resolve("");
        reader.readAsDataURL(blob);
      });
    } catch {
      return "";
    }
  }

  function gerarHtmlPdf() {
    if (!orcamento) {
      return "";
    }

    const usarIdentidadeEmpresa =
      proAtivo && Boolean(empresa?.nome_fantasia?.trim());

    const marcaNome = usarIdentidadeEmpresa
      ? empresa?.nome_fantasia?.trim() || "Sua empresa"
      : "ORVENA";

    const marcaSubtitulo = usarIdentidadeEmpresa
      ? empresaContatoResumo()
      : "Seu negócio, organizado.";

    const marcaLogo =
      usarIdentidadeEmpresa && empresa?.logo_url
        ? `<img class="brand-logo" src="${escaparHtml(
            empresa.logo_url
          )}" alt="Logo da empresa" />`
        : "";

    const empresaEnderecoHtml =
      usarIdentidadeEmpresa && empresaEnderecoCompleto()
        ? `<div class="company-address">${escaparHtml(
            empresaEnderecoCompleto()
          )}</div>`
        : "";

    const itensHtml = itens
      .map(
        (item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${escaparHtml(item.descricao)}</td>
            <td class="right">${escaparHtml(String(item.quantidade))}</td>
            <td class="right">${escaparHtml(formatarMoeda(item.valor_unitario))}</td>
            <td class="right strong">${escaparHtml(formatarMoeda(item.total))}</td>
          </tr>
        `
      )
      .join("");

    const emailHtml = orcamento.cliente_email
      ? `<div><span>E-mail:</span> ${escaparHtml(orcamento.cliente_email)}</div>`
      : "";

    const telefoneHtml = orcamento.cliente_telefone
      ? `<div><span>Telefone:</span> ${escaparHtml(orcamento.cliente_telefone)}</div>`
      : "";

    const cep = orcamento.cliente_cep
      ? orcamento.cliente_cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")
      : "";

    const pagamentoHtml =
      orcamento.forma_pagamento || orcamento.condicoes_pagamento
        ? `
          <section class="payment">
            <h3>Pagamento</h3>
            ${
              orcamento.forma_pagamento
                ? `<p><strong>Forma:</strong> ${escaparHtml(
                    orcamento.forma_pagamento
                  )}</p>`
                : ""
            }
            ${
              orcamento.condicoes_pagamento
                ? `<p><strong>Condições:</strong> ${escaparHtml(
                    orcamento.condicoes_pagamento
                  )}</p>`
                : ""
            }
          </section>
        `
        : "";

    const observacoesHtml = orcamento.observacoes
      ? `
        <section class="notes">
          <h3>Observações</h3>
          <p>${escaparHtml(orcamento.observacoes).replace(/\n/g, "<br/>")}</p>
        </section>
      `
      : "";

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  @page { margin: 24px; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: Arial, Helvetica, sans-serif;
    color: #1d1d24;
    background: #ffffff;
    font-size: 12px;
  }
  .page { padding: 18px; }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid #7C5CFF;
    padding-bottom: 18px;
    margin-bottom: 22px;
  }
  .brand-area {
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 58%;
  }
  .brand-logo {
    width: 58px;
    height: 58px;
    object-fit: contain;
    border-radius: 10px;
  }
  .brand {
    font-size: 28px;
    font-weight: 800;
    letter-spacing: 2px;
    color: #7C5CFF;
  }
  .tagline {
    margin-top: 4px;
    color: #777783;
    font-size: 10px;
    line-height: 1.4;
  }
  .company-address {
    margin-top: 4px;
    color: #777783;
    font-size: 9px;
    line-height: 1.35;
  }
  .doc {
    text-align: right;
  }
  .doc h1 {
    margin: 0;
    font-size: 22px;
    color: #17171f;
  }
  .doc p {
    margin: 5px 0 0;
    color: #767680;
  }
  .grid {
    display: flex;
    gap: 16px;
    margin-bottom: 18px;
  }
  .box {
    flex: 1;
    border: 1px solid #dedee7;
    border-radius: 10px;
    padding: 14px;
  }
  .box h3, section h3 {
    margin: 0 0 9px;
    color: #353541;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: .6px;
  }
  .box div {
    margin: 4px 0;
    color: #555560;
  }
  .box span {
    font-weight: 700;
    color: #2d2d36;
  }
  .description {
    margin-bottom: 18px;
    border: 1px solid #dedee7;
    border-radius: 10px;
    padding: 14px;
  }
  .description h2 {
    margin: 0 0 7px;
    font-size: 16px;
  }
  .description p {
    margin: 0;
    line-height: 1.5;
    color: #5a5a65;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
  }
  th {
    background: #f1efff;
    color: #4e4387;
    text-align: left;
    padding: 10px 8px;
    border-bottom: 1px solid #d9d4fa;
    font-size: 10px;
  }
  td {
    padding: 10px 8px;
    border-bottom: 1px solid #ededf2;
    vertical-align: top;
  }
  .right { text-align: right; }
  .strong { font-weight: 700; }
  .totals {
    margin-left: auto;
    width: 320px;
    margin-top: 20px;
  }
  .total-row {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    padding: 7px 0;
    border-bottom: 1px solid #eeeeF3;
  }
  .grand-total {
    margin-top: 8px;
    padding: 12px;
    border-radius: 9px;
    background: #7C5CFF;
    color: #fff;
    font-size: 16px;
    font-weight: 800;
    display: flex;
    justify-content: space-between;
  }
  section.payment, section.notes {
    margin-top: 18px;
    border: 1px solid #dedee7;
    border-radius: 10px;
    padding: 14px;
  }
  section p {
    margin: 5px 0;
    line-height: 1.45;
    color: #555560;
  }
  .footer {
    margin-top: 28px;
    padding-top: 12px;
    border-top: 1px solid #e4e4e9;
    text-align: center;
    color: #8a8a95;
    font-size: 9px;
  }
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="brand-area">
        ${marcaLogo}
        <div>
          <div class="brand">${escaparHtml(marcaNome)}</div>
          ${
            marcaSubtitulo
              ? `<div class="tagline">${escaparHtml(marcaSubtitulo)}</div>`
              : ""
          }
          ${empresaEnderecoHtml}
        </div>
      </div>
      <div class="doc">
        <h1>ORÇAMENTO #${escaparHtml(String(orcamento.numero))}</h1>
        <p>${escaparHtml(formatarData(orcamento.criado_em))}</p>
        <p>Validade: ${escaparHtml(String(orcamento.validade_dias))} dias</p>
      </div>
    </div>

    <div class="grid">
      <div class="box">
        <h3>Cliente</h3>
        <div><span>Nome:</span> ${escaparHtml(orcamento.cliente_nome)}</div>
        ${telefoneHtml}
        ${emailHtml}
      </div>

      <div class="box">
        <h3>Endereço</h3>
        ${cep ? `<div><span>CEP:</span> ${escaparHtml(cep)}</div>` : ""}
        <div>${escaparHtml(enderecoCompleto())}</div>
      </div>
    </div>

    <div class="description">
      <h2>${escaparHtml(orcamento.titulo || "Orçamento")}</h2>
      <p>${escaparHtml(
        orcamento.descricao || "Sem descrição."
      ).replace(/\n/g, "<br/>")}</p>
    </div>

    <h3>Itens e serviços</h3>
    <table>
      <thead>
        <tr>
          <th style="width: 7%">#</th>
          <th>Descrição</th>
          <th class="right" style="width: 12%">Qtd.</th>
          <th class="right" style="width: 19%">Valor unit.</th>
          <th class="right" style="width: 19%">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itensHtml}
      </tbody>
    </table>

    <div class="totals">
      <div class="total-row">
        <span>Itens/serviços</span>
        <strong>${escaparHtml(formatarMoeda(orcamento.subtotal))}</strong>
      </div>
      ${
        Number(orcamento.mao_de_obra || 0) > 0
          ? `<div class="total-row"><span>Mão de obra</span><strong>${escaparHtml(
              formatarMoeda(orcamento.mao_de_obra)
            )}</strong></div>`
          : ""
      }
      ${
        Number(orcamento.outros_gastos || 0) > 0
          ? `<div class="total-row"><span>Outros gastos</span><strong>${escaparHtml(
              formatarMoeda(orcamento.outros_gastos)
            )}</strong></div>`
          : ""
      }
      ${
        Number(orcamento.acrescimo || 0) > 0
          ? `<div class="total-row"><span>Acréscimo</span><strong>+ ${escaparHtml(
              formatarMoeda(orcamento.acrescimo)
            )}</strong></div>`
          : ""
      }
      ${
        Number(orcamento.desconto || 0) > 0
          ? `<div class="total-row"><span>Desconto</span><strong>- ${escaparHtml(
              formatarMoeda(orcamento.desconto)
            )}</strong></div>`
          : ""
      }
      <div class="grand-total">
        <span>TOTAL</span>
        <span>${escaparHtml(formatarMoeda(orcamento.total))}</span>
      </div>
    </div>

    ${pagamentoHtml}
    ${observacoesHtml}

    <div class="footer">
      ${
        usarIdentidadeEmpresa
          ? `Documento emitido por ${escaparHtml(marcaNome)}`
          : "Documento gerado pelo Orvena - Plano FREE"
      }
    </div>
  </div>
</body>
</html>
    `;
  }

  async function atualizarStatus(
    novoStatus: Orcamento["status"]
  ) {
    if (!orcamento || alterandoStatus) {
      return;
    }

    try {
      setAlterandoStatus(true);
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

      const { error } = await supabase
        .from("orcamentos")
        .update({ status: novoStatus })
        .eq("id", orcamento.id)
        .eq("user_id", user.id);

      if (error) {
        setErro(mensagemSegura(error.message, "Não foi possível alterar o status do orçamento."));
        return;
      }

      setOrcamento((atual) =>
        atual ? { ...atual, status: novoStatus } : atual
      );
    } catch {
      setErro("Não foi possível alterar o status do orçamento.");
    } finally {
      setAlterandoStatus(false);
    }
  }

  function confirmarAtualizacaoStatus(
    novoStatus: Orcamento["status"]
  ) {
    if (!orcamento || alterandoStatus || orcamento.status === novoStatus) {
      return;
    }

    const atual = STATUS_LABELS[orcamento.status];
    const novo = STATUS_LABELS[novoStatus];

    let mensagem =
      `Alterar o orçamento #${orcamento.numero} de "${atual}" para "${novo}"?`;

    if (novoStatus === "aprovado") {
      mensagem =
        `Confirmar o orçamento #${orcamento.numero} como APROVADO? ` +
        "Essa alteração pode refletir no financeiro e nos relatórios do Orvena.";
    } else if (novoStatus === "cancelado") {
      mensagem =
        `Cancelar o orçamento #${orcamento.numero}? ` +
        "Ele continuará salvo, mas passará a constar como cancelado.";
    } else if (novoStatus === "recusado") {
      mensagem =
        `Marcar o orçamento #${orcamento.numero} como RECUSADO? ` +
        "Ele continuará salvo no histórico.";
    }

    const executar = () => void atualizarStatus(novoStatus);

    if (Platform.OS === "web") {
      const confirmou =
        typeof window !== "undefined" ? window.confirm(mensagem) : false;

      if (confirmou) {
        executar();
      }

      return;
    }

    Alert.alert(
      `Alterar para ${novo}`,
      mensagem,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: novoStatus === "cancelado" ? "Cancelar orçamento" : "Confirmar",
          style:
            novoStatus === "cancelado" || novoStatus === "recusado"
              ? "destructive"
              : "default",
          onPress: executar,
        },
      ]
    );
  }

  async function excluirOrcamentoConfirmado() {
    if (!orcamento || excluindo) {
      return;
    }

    try {
      setExcluindo(true);
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

      const { error } = await supabase
        .from("orcamentos")
        .delete()
        .eq("id", orcamento.id)
        .eq("user_id", user.id);

      if (error) {
        setErro(mensagemSegura(error.message, "Não foi possível excluir este orçamento."));
        return;
      }

      router.replace("/orcamentos" as any);
    } catch {
      setErro("Não foi possível excluir este orçamento.");
    } finally {
      setExcluindo(false);
    }
  }

  function excluirOrcamento() {
    if (!orcamento || excluindo) {
      return;
    }

    if (Platform.OS === "web") {
      const confirmou =
        typeof window !== "undefined"
          ? window.confirm(
              `Excluir permanentemente o orçamento #${orcamento.numero}?`
            )
          : false;

      if (confirmou) {
        void excluirOrcamentoConfirmado();
      }

      return;
    }

    Alert.alert(
      "Excluir orçamento",
      `Deseja excluir permanentemente o orçamento #${orcamento.numero}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => void excluirOrcamentoConfirmado(),
        },
      ]
    );
  }

  async function baixarPdfWeb() {
    if (!orcamento || baixandoPdf || typeof window === "undefined") {
      return;
    }

    try {
      setBaixandoPdf(true);
      setErro("");

      // @ts-ignore - a build ESM do jsPDF não possui arquivo de tipos separado.
      const jspdfModule = await import("jspdf/dist/jspdf.es.min.js");
      const jsPDF =
        (jspdfModule as any).jsPDF ||
        (jspdfModule as any).default?.jsPDF ||
        (jspdfModule as any).default;
      const autoTableModule = await import("jspdf-autotable");
      const autoTable =
        autoTableModule.default || (autoTableModule as any).autoTable;

      const doc = new jsPDF({
        unit: "pt",
        format: "a4",
        orientation: "portrait",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const margem = 42;
      const roxo = [124, 92, 255] as [number, number, number];
      const cinza = [95, 99, 110] as [number, number, number];

      const usarIdentidadeEmpresa =
        proAtivo && Boolean(empresa?.nome_fantasia?.trim());

      const marcaNome = usarIdentidadeEmpresa
        ? empresa?.nome_fantasia?.trim() || "Sua empresa"
        : "ORVENA";

      const marcaSubtitulo = usarIdentidadeEmpresa
        ? empresaContatoResumo()
        : "Seu negócio, organizado.";

      const logoDataUrl = usarIdentidadeEmpresa
        ? await carregarLogoDataUrl()
        : "";

      doc.setFillColor(255, 255, 255);
      doc.rect(
        0,
        0,
        doc.internal.pageSize.getWidth(),
        doc.internal.pageSize.getHeight(),
        "F"
      );

      let marcaX = margem;

      if (logoDataUrl) {
        try {
          doc.addImage(
            logoDataUrl,
            undefined,
            margem,
            28,
            42,
            42,
            undefined,
            "FAST"
          );
          marcaX = margem + 52;
        } catch (logoError) {
          console.log("Não foi possível adicionar a logo ao PDF:", logoError);
        }
      }

      doc.setTextColor(...roxo);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(usarIdentidadeEmpresa ? 16 : 22);
      doc.text(marcaNome, marcaX, 47, {
        maxWidth: usarIdentidadeEmpresa ? 245 : undefined,
      });

      doc.setTextColor(...cinza);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);

      if (marcaSubtitulo) {
        const linhasMarca = doc.splitTextToSize(
          marcaSubtitulo,
          usarIdentidadeEmpresa ? 245 : 220
        );
        doc.text(linhasMarca, marcaX, 61);
      }

      if (usarIdentidadeEmpresa && empresaEnderecoCompleto()) {
        const linhasEnderecoEmpresa = doc.splitTextToSize(
          empresaEnderecoCompleto(),
          245
        );
        doc.setFontSize(7);
        doc.text(linhasEnderecoEmpresa, marcaX, 75);
      }

      doc.setTextColor(30, 30, 38);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(
        `ORÇAMENTO #${orcamento.numero}`,
        pageWidth - margem,
        50,
        { align: "right" }
      );

      doc.setTextColor(...cinza);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(
        formatarData(orcamento.criado_em),
        pageWidth - margem,
        65,
        { align: "right" }
      );
      doc.text(
        `Validade: ${orcamento.validade_dias} dias`,
        pageWidth - margem,
        78,
        { align: "right" }
      );

      doc.setDrawColor(...roxo);
      doc.setLineWidth(2);
      doc.line(margem, 92, pageWidth - margem, 92);

      let y = 112;

      doc.setTextColor(45, 45, 55);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("CLIENTE", margem, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...cinza);

      y += 16;
      doc.text(`Nome: ${orcamento.cliente_nome}`, margem, y);

      if (orcamento.cliente_telefone) {
        y += 13;
        doc.text(`Telefone: ${orcamento.cliente_telefone}`, margem, y);
      }

      if (orcamento.cliente_email) {
        y += 13;
        doc.text(`E-mail: ${orcamento.cliente_email}`, margem, y);
      }

      y += 22;

      doc.setTextColor(45, 45, 55);
      doc.setFont("helvetica", "bold");
      doc.text("ENDEREÇO", margem, y);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...cinza);
      doc.setFontSize(9);

      const cep = orcamento.cliente_cep
        ? orcamento.cliente_cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")
        : "";

      y += 16;

      if (cep) {
        doc.text(`CEP: ${cep}`, margem, y);
        y += 13;
      }

      const enderecoLinhas = doc.splitTextToSize(
        enderecoCompleto(),
        pageWidth - margem * 2
      );
      doc.text(enderecoLinhas, margem, y);
      y += enderecoLinhas.length * 12 + 18;

      doc.setTextColor(30, 30, 38);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(orcamento.titulo || "Orçamento", margem, y);

      if (orcamento.descricao) {
        y += 15;
        doc.setTextColor(...cinza);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);

        const descricaoLinhas = doc.splitTextToSize(
          orcamento.descricao,
          pageWidth - margem * 2
        );
        doc.text(descricaoLinhas, margem, y);
        y += descricaoLinhas.length * 12 + 15;
      } else {
        y += 18;
      }

      const linhasTabela = itens.map((item, index) => [
        String(index + 1),
        item.descricao,
        String(item.quantidade),
        formatarMoeda(item.valor_unitario),
        formatarMoeda(item.total),
      ]);

      autoTable(doc, {
        startY: y,
        head: [["#", "Descrição", "Qtd.", "Valor unit.", "Total"]],
        body: linhasTabela,
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 6,
          textColor: [45, 45, 55],
          lineColor: [225, 225, 232],
          lineWidth: 0.5,
        },
        headStyles: {
          fillColor: [241, 239, 255],
          textColor: [78, 67, 135],
          fontStyle: "bold",
        },
        columnStyles: {
          0: { cellWidth: 24 },
          2: { cellWidth: 42, halign: "right" },
          3: { cellWidth: 78, halign: "right" },
          4: { cellWidth: 82, halign: "right" },
        },
        margin: {
          left: margem,
          right: margem,
        },
      });

      const finalTabela =
        (doc as any).lastAutoTable?.finalY || y + 70;

      let resumoY = finalTabela + 20;
      const resumoX = pageWidth - 245;
      const resumoValorX = pageWidth - margem;

      const linhaResumo = (label: string, valor: string) => {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...cinza);
        doc.setFontSize(9);
        doc.text(label, resumoX, resumoY);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(35, 35, 43);
        doc.text(valor, resumoValorX, resumoY, { align: "right" });

        resumoY += 16;
      };

      linhaResumo(
        "Itens/serviços",
        formatarMoeda(orcamento.subtotal)
      );

      if (Number(orcamento.mao_de_obra || 0) > 0) {
        linhaResumo(
          "Mão de obra",
          formatarMoeda(orcamento.mao_de_obra)
        );
      }

      if (Number(orcamento.outros_gastos || 0) > 0) {
        linhaResumo(
          "Outros gastos",
          formatarMoeda(orcamento.outros_gastos)
        );
      }

      if (Number(orcamento.acrescimo || 0) > 0) {
        linhaResumo(
          "Acréscimo",
          `+ ${formatarMoeda(orcamento.acrescimo)}`
        );
      }

      if (Number(orcamento.desconto || 0) > 0) {
        linhaResumo(
          "Desconto",
          `- ${formatarMoeda(orcamento.desconto)}`
        );
      }

      resumoY += 4;

      doc.setFillColor(...roxo);
      doc.roundedRect(
        resumoX - 10,
        resumoY - 13,
        resumoValorX - resumoX + 10,
        30,
        6,
        6,
        "F"
      );

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("TOTAL", resumoX, resumoY + 6);
      doc.text(
        formatarMoeda(orcamento.total),
        resumoValorX - 8,
        resumoY + 6,
        { align: "right" }
      );

      resumoY += 42;

      const garantirPagina = (altura: number) => {
        const pageHeight = doc.internal.pageSize.getHeight();

        if (resumoY + altura > pageHeight - 45) {
          doc.addPage();
          resumoY = 45;
        }
      };

      if (orcamento.forma_pagamento || orcamento.condicoes_pagamento) {
        garantirPagina(70);

        doc.setTextColor(45, 45, 55);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("PAGAMENTO", margem, resumoY);
        resumoY += 15;

        doc.setFont("helvetica", "normal");
        doc.setTextColor(...cinza);

        if (orcamento.forma_pagamento) {
          doc.text(
            `Forma: ${orcamento.forma_pagamento}`,
            margem,
            resumoY
          );
          resumoY += 14;
        }

        if (orcamento.condicoes_pagamento) {
          const linhas = doc.splitTextToSize(
            `Condições: ${orcamento.condicoes_pagamento}`,
            pageWidth - margem * 2
          );
          doc.text(linhas, margem, resumoY);
          resumoY += linhas.length * 12 + 12;
        }
      }

      if (orcamento.observacoes) {
        garantirPagina(70);

        doc.setTextColor(45, 45, 55);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("OBSERVAÇÕES", margem, resumoY);
        resumoY += 15;

        doc.setFont("helvetica", "normal");
        doc.setTextColor(...cinza);

        const linhas = doc.splitTextToSize(
          orcamento.observacoes,
          pageWidth - margem * 2
        );
        doc.text(linhas, margem, resumoY);
      }

      const paginas = doc.getNumberOfPages();

      for (let pagina = 1; pagina <= paginas; pagina += 1) {
        doc.setPage(pagina);

        const pageHeight = doc.internal.pageSize.getHeight();

        doc.setDrawColor(225, 225, 232);
        doc.setLineWidth(0.5);
        doc.line(
          margem,
          pageHeight - 28,
          pageWidth - margem,
          pageHeight - 28
        );

        doc.setTextColor(140, 140, 150);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text(
          usarIdentidadeEmpresa
            ? `Documento emitido por ${marcaNome}`
            : "Documento gerado pelo Orvena - Plano FREE",
          pageWidth / 2,
          pageHeight - 16,
          { align: "center" }
        );
      }

      doc.save(`orcamento-${orcamento.numero}.pdf`);
    } catch (error) {
      console.log("Erro ao baixar PDF no navegador:", error);

      const mensagem =
        error instanceof Error
          ? error.message
          : "Erro desconhecido ao baixar o PDF.";

      setErro(`Não foi possível baixar o PDF. ${mensagem}`);
    } finally {
      setBaixandoPdf(false);
    }
  }

  async function gerarPdf() {
    if (!orcamento || gerandoPdf) {
      return;
    }

    try {
      setGerandoPdf(true);
      setErro("");

      const html = gerarHtmlPdf();

      if (Platform.OS === "web") {
        if (typeof window === "undefined") {
          setErro("O PDF só pode ser aberto no navegador.");
          return;
        }

        const janelaPdf = window.open("", "_blank");

        if (!janelaPdf) {
          setErro(
            "O navegador bloqueou a abertura do PDF. Libere os pop-ups deste site e tente novamente."
          );
          return;
        }

        janelaPdf.document.open();
        janelaPdf.document.write(html);
        janelaPdf.document.close();

        const abrirImpressao = () => {
          try {
            janelaPdf.focus();
            janelaPdf.print();
          } catch (erroImpressao) {
            console.log("Erro ao abrir impressão:", erroImpressao);
          }
        };

        if (janelaPdf.document.readyState === "complete") {
          setTimeout(abrirImpressao, 250);
        } else {
          janelaPdf.onload = () => {
            setTimeout(abrirImpressao, 250);
          };
        }

        return;
      }

      if (Platform.OS === "android") {
        const resultado = await Print.printToFileAsync({
          html,
          base64: true,
        });

        const base64 = (resultado as any).base64 as string | undefined;

        if (!base64) {
          setErro("Não foi possível preparar o PDF para compartilhamento.");
          return;
        }

        const pastaDestino =
          FileSystem.cacheDirectory || FileSystem.documentDirectory;

        if (!pastaDestino) {
          setErro("Não foi possível acessar o armazenamento do app.");
          return;
        }

        const destino =
          `${pastaDestino}orcamento-${orcamento.numero}-${Date.now()}.pdf`;

        await FileSystem.writeAsStringAsync(destino, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const disponivel = await Sharing.isAvailableAsync();

        if (!disponivel) {
          setErro(`PDF criado em: ${destino}`);
          return;
        }

        await Sharing.shareAsync(destino, {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
          dialogTitle: `Orçamento #${orcamento.numero}`,
        });

        return;
      }

      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      const disponivel = await Sharing.isAvailableAsync();

      if (!disponivel) {
        setErro(`PDF criado em: ${uri}`);
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle: `Orçamento #${orcamento.numero}`,
      });
    } catch (error) {
      console.log("Erro ao gerar PDF:", error);

      const mensagem =
        error instanceof Error
          ? error.message
          : "Erro desconhecido ao gerar o PDF.";

      setErro(`Não foi possível gerar o PDF. ${mensagem}`);
    } finally {
      setGerandoPdf(false);
    }
  }

  if (carregando || redirecionandoLogin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7C5CFF" />
        </View>
      </SafeAreaView>
    );
  }

  if (!orcamento) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Não foi possível abrir</Text>
          <Text style={styles.errorText}>{erro || "Orçamento não encontrado."}</Text>

          <Pressable style={styles.backAction} onPress={voltar}>
            <Text style={styles.backActionText}>VOLTAR</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.page}>
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={voltar}>
              <Text style={styles.backButtonText}>←</Text>
            </Pressable>

            <View style={styles.headerTextArea}>
              <Text style={styles.headerEyebrow}>ORÇAMENTO #{orcamento.numero}</Text>
              <Text style={styles.headerTitle}>
                {orcamento.titulo || "Orçamento"}
              </Text>
              <Text style={styles.headerSubtitle}>
                Criado em {formatarData(orcamento.criado_em)}
              </Text>
            </View>

            <StatusBadge status={orcamento.status} />
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <View style={styles.heroContent}>
              <Text style={styles.heroEyebrow}>VISÃO DO ORÇAMENTO · #{orcamento.numero}</Text>
              <Text style={styles.heroTitle}>{orcamento.cliente_nome}</Text>
              <Text style={styles.heroDescription} numberOfLines={2}>
                {orcamento.titulo || "Proposta sem título"}
              </Text>
              <Text style={styles.heroValue}>{formatarMoeda(orcamento.total)}</Text>
            </View>
            {isDesktop ? <Ionicons name="document-text-outline" size={84} color="rgba(255,255,255,0.25)" style={styles.heroArt} /> : null}
          </View>

          {erro ? (
            <View style={styles.inlineError}>
              <Ionicons name="alert-circle-outline" size={20} color="#FF8997" />
              <Text style={styles.inlineErrorText}>{erro}</Text>
              <Pressable onPress={() => setErro("")} accessibilityLabel="Fechar aviso">
                <Ionicons name="close" size={18} color="#FF8997" />
              </Pressable>
            </View>
          ) : null}

          <View
            style={[
              styles.columns,
              isDesktop && styles.columnsDesktop,
            ]}
          >
            <View style={styles.mainColumn}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Cliente</Text>

                <InfoRow label="Nome" value={orcamento.cliente_nome} />
                <InfoRow
                  label="Telefone"
                  value={orcamento.cliente_telefone || "Não informado"}
                />
                <InfoRow
                  label="CEP"
                  value={
                    orcamento.cliente_cep
                      ? orcamento.cliente_cep.replace(
                          /^(\d{5})(\d{3})$/,
                          "$1-$2"
                        )
                      : "Não informado"
                  }
                />
                <InfoRow
                  label="Endereço"
                  value={
                    [
                      orcamento.cliente_logradouro,
                      orcamento.cliente_numero,
                      orcamento.cliente_complemento,
                      orcamento.cliente_bairro,
                      orcamento.cliente_cidade,
                      orcamento.cliente_uf,
                    ]
                      .filter(Boolean)
                      .join(", ") ||
                    orcamento.cliente_endereco ||
                    "Não informado"
                  }
                />
                {orcamento.cliente_email ? (
                  <InfoRow
                    label="E-mail"
                    value={orcamento.cliente_email}
                  />
                ) : null}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Detalhes</Text>

                <InfoRow
                  label="Título"
                  value={orcamento.titulo || "Não informado"}
                />

                <View style={styles.blockInfo}>
                  <Text style={styles.infoLabel}>Descrição</Text>
                  <Text style={styles.infoLongText}>
                    {orcamento.descricao || "Nenhuma descrição informada."}
                  </Text>
                </View>

                <InfoRow
                  label="Validade"
                  value={`${orcamento.validade_dias} dias`}
                />
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Itens</Text>

                <View style={styles.itemsList}>
                  {itens.map((item, index) => (
                    <View key={item.id} style={styles.itemCard}>
                      <View style={styles.itemTop}>
                        <Text style={styles.itemNumber}>Item {index + 1}</Text>
                        <Text style={styles.itemTotal}>
                          {formatarMoeda(item.total)}
                        </Text>
                      </View>

                      <Text style={styles.itemDescription}>
                        {item.descricao}
                      </Text>

                      <View style={styles.itemMeta}>
                        <Text style={styles.itemMetaText}>
                          Qtd: {String(item.quantidade)}
                        </Text>
                        <Text style={styles.itemMetaText}>
                          Unitário: {formatarMoeda(item.valor_unitario)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {Boolean(orcamento.forma_pagamento ||
                orcamento.condicoes_pagamento) ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Pagamento</Text>

                  {orcamento.forma_pagamento ? (
                    <InfoRow
                      label="Forma"
                      value={orcamento.forma_pagamento}
                    />
                  ) : null}

                  {orcamento.condicoes_pagamento ? (
                    <View style={styles.blockInfo}>
                      <Text style={styles.infoLabel}>Condições</Text>
                      <Text style={styles.infoLongText}>
                        {orcamento.condicoes_pagamento}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Observações</Text>
                <Text style={styles.observationsText}>
                  {orcamento.observacoes || "Nenhuma observação informada."}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.sideColumn,
                isDesktop && styles.sideColumnDesktop,
              ]}
            >
              <View style={styles.managementCard}>
                <Text style={styles.managementEyebrow}>GERENCIAMENTO</Text>
                <Text style={styles.managementTitle}>
                  Status do orçamento
                </Text>

                <View style={styles.statusActions}>
                  {(
                    [
                      "rascunho",
                      "enviado",
                      "aprovado",
                      "recusado",
                      "cancelado",
                    ] as Orcamento["status"][]
                  ).map((status) => {
                    const ativo = orcamento.status === status;

                    return (
                      <Pressable
                        key={status}
                        style={[
                          styles.statusActionButton,
                          ativo && styles.statusActionButtonActive,
                        ]}
                        onPress={() => confirmarAtualizacaoStatus(status)}
                        disabled={alterandoStatus || ativo}
                      >
                        <Text
                          style={[
                            styles.statusActionText,
                            ativo && styles.statusActionTextActive,
                          ]}
                        >
                          {STATUS_LABELS[status]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.managementDivider} />

                <Pressable
                  style={styles.editButton}
                  onPress={() =>
                    router.push({
                      pathname: "/orcamentos/editar/[id]" as any,
                      params: { id: orcamento.id },
                    })
                  }
                >
                  <Ionicons name="create-outline" size={18} color="#B9ADFF" />
                  <Text style={styles.editButtonText}>Editar orçamento</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.deleteButton,
                    excluindo && styles.pdfButtonDisabled,
                  ]}
                  onPress={excluirOrcamento}
                  disabled={excluindo}
                >
                  {excluindo ? (
                    <ActivityIndicator color="#FF8E98" />
                  ) : (
                    <><Ionicons name="trash-outline" size={17} color="#FF8E98" /><Text style={styles.deleteButtonText}>Excluir orçamento</Text></>
                  )}
                </Pressable>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryEyebrow}>RESUMO</Text>
                <Text style={styles.summaryTitle}>Valores</Text>

                <View style={styles.divider} />

                <SummaryRow
                  label="Itens/serviços"
                  value={formatarMoeda(orcamento.subtotal)}
                />

                {Number(orcamento.mao_de_obra || 0) > 0 ? (
                  <SummaryRow
                    label="Mão de obra"
                    value={`+ ${formatarMoeda(orcamento.mao_de_obra)}`}
                  />
                ) : null}

                {Number(orcamento.outros_gastos || 0) > 0 ? (
                  <SummaryRow
                    label="Outros gastos"
                    value={`+ ${formatarMoeda(orcamento.outros_gastos)}`}
                  />
                ) : null}

                {Number(orcamento.acrescimo || 0) > 0 ? (
                  <SummaryRow
                    label="Acréscimo"
                    value={`+ ${formatarMoeda(orcamento.acrescimo)}`}
                  />
                ) : null}

                {desconto > 0 ? (
                  <SummaryRow
                    label="Desconto"
                    value={`- ${formatarMoeda(desconto)}`}
                  />
                ) : null}

                <View style={styles.divider} />

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>
                    {formatarMoeda(orcamento.total)}
                  </Text>
                </View>

                <View style={styles.freeInfo}>
                  <Text style={styles.freeInfoTitle}>{proAtivo ? "Orvena Pro" : "Plano Grátis"}</Text>
                  <Text style={styles.freeInfoText}>
                    {proAtivo && empresa?.nome_fantasia?.trim()
                      ? "Seu PDF utilizará a identidade visual da sua empresa."
                      : "Este PDF utilizará a identidade visual padrão do Orvena."}
                  </Text>
                </View>

                {Platform.OS === "web" ? (
                  <View style={styles.webPdfActions}>
                    <Pressable
                      style={[
                        styles.pdfButton,
                        styles.webPdfButton,
                        gerandoPdf && styles.pdfButtonDisabled,
                      ]}
                      onPress={gerarPdf}
                      disabled={gerandoPdf || baixandoPdf}
                    >
                      {gerandoPdf ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <><Ionicons name="document-outline" size={18} color="#FFFFFF" /><Text style={styles.pdfButtonText}>Abrir PDF</Text></>
                      )}
                    </Pressable>

                    <Pressable
                      style={[
                        styles.downloadPdfButton,
                        baixandoPdf && styles.pdfButtonDisabled,
                      ]}
                      onPress={baixarPdfWeb}
                      disabled={gerandoPdf || baixandoPdf}
                    >
                      {baixandoPdf ? (
                        <ActivityIndicator color="#B9ADFF" />
                      ) : (
                        <><Ionicons name="download-outline" size={18} color="#B9ADFF" /><Text style={styles.downloadPdfButtonText}>Baixar PDF</Text></>
                      )}
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    style={[
                      styles.pdfButton,
                      gerandoPdf && styles.pdfButtonDisabled,
                    ]}
                    onPress={gerarPdf}
                    disabled={gerandoPdf}
                  >
                    {gerandoPdf ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.pdfButtonText}>
                        {Platform.OS === "android"
                          ? "COMPARTILHAR PDF"
                          : "GERAR E COMPARTILHAR PDF"}
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
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
      <Text style={styles.summaryRowLabel}>{label}</Text>
      <Text style={styles.summaryRowValue}>{value}</Text>
    </View>
  );
}

function StatusBadge({
  status,
}: {
  status: Orcamento["status"];
}) {
  return (
    <View
      style={[
        styles.statusBadge,
        status === "aprovado" && styles.statusApproved,
        status === "enviado" && styles.statusSent,
        status === "recusado" && styles.statusRejected,
        status === "cancelado" && styles.statusCancelled,
      ]}
    >
      <Text
        style={[
          styles.statusText,
          status === "aprovado" && styles.statusTextApproved,
          status === "enviado" && styles.statusTextSent,
          status === "recusado" && styles.statusTextRejected,
          status === "cancelado" && styles.statusTextCancelled,
        ]}
      >
        {STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: { minHeight: 190, padding: 24, borderRadius: 22, backgroundColor: "#4F36BD", borderWidth: 1, borderColor: "#6449D4", overflow: "hidden", marginBottom: 21, justifyContent: "center" },
  heroGlow: { position: "absolute", width: 370, height: 370, borderRadius: 185, right: -100, top: -190, backgroundColor: "#7558F5", opacity: 0.58 },
  heroContent: { maxWidth: 690, zIndex: 1 },
  heroEyebrow: { color: "#DDD4FF", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  heroTitle: { color: "#FFFFFF", fontSize: 26, fontWeight: "900", marginTop: 10 },
  heroDescription: { color: "#E6DFFF", fontSize: 12, marginTop: 7 },
  heroValue: { color: "#FFFFFF", fontSize: 27, fontWeight: "900", marginTop: 17 },
  heroArt: { position: "absolute", right: 85, top: 49, transform: [{ rotate: "9deg" }] },
  inlineError: { backgroundColor: "#29171C", borderWidth: 1, borderColor: "#65343D", borderRadius: 13, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 },
  inlineErrorText: { flex: 1, color: "#FF8997", fontSize: 12, lineHeight: 18 },

  safeArea: {
    flex: 1,
    backgroundColor: "#090A10",
  },

  scrollContent: {
    flexGrow: 1,
  },

  page: {
    width: "100%",
    maxWidth: 1320,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 48,
  },

  center: {
    flex: 1,
    minHeight: 500,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  centerText: {
    color: "#9399AA",
    fontSize: 11,
    marginTop: 12,
  },

  errorTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },

  errorText: {
    color: "#C47B83",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 480,
  },

  backAction: {
    minHeight: 44,
    borderRadius: 13,
    backgroundColor: "#7C5CFF",
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },

  backActionText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 13,
    marginBottom: 22,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#292D3B",
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
    color: "#A997FF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
  },

  headerTitle: {
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "900",
    marginTop: 5,
  },

  headerSubtitle: {
    color: "#9399AA",
    fontSize: 10,
    marginTop: 5,
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
    gap: 14,
  },

  sideColumn: {
    width: "100%",
  },

  sideColumnDesktop: {
    width: 355,
  },

  card: {
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#292D3B",
    backgroundColor: "#141722",
    padding: 18,
  },

  cardTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 10,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#23272E",
  },

  infoLabel: {
    color: "#9399AA",
    fontSize: 10,
    fontWeight: "800",
  },

  infoValue: {
    flex: 1,
    color: "#D7DADE",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
  },

  blockInfo: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#23272E",
  },

  infoLongText: {
    color: "#B3B8C0",
    fontSize: 11,
    lineHeight: 18,
    marginTop: 6,
  },

  itemsList: {
    gap: 10,
  },

  itemCard: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#292D3B",
    backgroundColor: "#0E1018",
    padding: 13,
  },

  itemTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  itemNumber: {
    color: "#80749E",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  itemTotal: {
    color: "#C1B7FF",
    fontSize: 13,
    fontWeight: "900",
  },

  itemDescription: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 7,
  },

  itemMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 13,
    marginTop: 8,
  },

  itemMetaText: {
    color: "#707782",
    fontSize: 9,
  },

  observationsText: {
    color: "#A2A8B1",
    fontSize: 11,
    lineHeight: 18,
  },

  managementCard: {
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#292D3B",
    backgroundColor: "#141722",
    padding: 18,
    marginBottom: 14,
  },

  managementEyebrow: {
    color: "#A997FF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.3,
  },

  managementTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 5,
  },

  statusActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 13,
  },

  statusActionButton: {
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#303640",
    backgroundColor: "#101319",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },

  statusActionButtonActive: {
    borderColor: "#5A49AA",
    backgroundColor: "#211B38",
  },

  statusActionText: {
    color: "#9399AA",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.3,
  },

  statusActionTextActive: {
    color: "#B9ADFF",
  },

  managementDivider: {
    height: 1,
    backgroundColor: "#262B33",
    marginVertical: 14,
  },

  editButton: {
    flexDirection: "row",
    gap: 8,
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#4B3D86",
    backgroundColor: "#191526",
    alignItems: "center",
    justifyContent: "center",
  },

  editButtonText: {
    color: "#B9ADFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  deleteButton: {
    flexDirection: "row",
    gap: 8,
    minHeight: 46,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#5A2C35",
    backgroundColor: "#211217",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 9,
  },

  deleteButtonText: {
    color: "#FF8E98",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  summaryCard: {
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#31294A",
    backgroundColor: "#181524",
    padding: 18,
  },

  summaryEyebrow: {
    color: "#8F79FF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
  },

  summaryTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 5,
  },

  divider: {
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

  freeInfo: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2C3140",
    backgroundColor: "#10131A",
    padding: 12,
    marginTop: 18,
  },

  freeInfoTitle: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },

  freeInfoText: {
    color: "#9399AA",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 4,
  },

  webPdfActions: {
    gap: 9,
    marginTop: 15,
  },

  webPdfButton: {
    marginTop: 0,
  },

  downloadPdfButton: {
    flexDirection: "row",
    gap: 8,
    minHeight: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#4B3D86",
    backgroundColor: "#191526",
    alignItems: "center",
    justifyContent: "center",
  },

  downloadPdfButtonText: {
    color: "#B9ADFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  pdfButton: {
    flexDirection: "row",
    gap: 8,
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 15,
  },

  pdfButtonDisabled: {
    opacity: 0.65,
  },

  pdfButtonText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3B3F47",
    backgroundColor: "#1A1D22",
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  statusText: {
    color: "#A2A7AF",
    fontSize: 10,
    fontWeight: "900",
  },

  statusApproved: {
    borderColor: "#285A42",
    backgroundColor: "#102019",
  },

  statusTextApproved: {
    color: "#71DFAA",
  },

  statusSent: {
    borderColor: "#35506B",
    backgroundColor: "#111B25",
  },

  statusTextSent: {
    color: "#80BCE8",
  },

  statusRejected: {
    borderColor: "#63313A",
    backgroundColor: "#211217",
  },

  statusTextRejected: {
    color: "#FF8790",
  },

  statusCancelled: {
    borderColor: "#484848",
    backgroundColor: "#1A1A1A",
  },

  statusTextCancelled: {
    color: "#999999",
  },
});