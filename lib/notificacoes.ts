import AsyncStorage from "@react-native-async-storage/async-storage";

import { anuncioDestinadoAoUsuario } from "./security";
import { supabase } from "./supabase";

export type NotificacaoOrvena = {
  id: string;
  tipo: "plano" | "pagamento" | "agenda" | "orcamento" | "anuncio";
  titulo: string;
  mensagem: string;
  icone: string;
  prioridade: 1 | 2 | 3;
  dataReferencia: string | null;
  rota: string;
};

type PerfilPlano = {
  plano: string | null;
  trial_termina_em: string | null;
  pro_ate: string | null;
};

type PagamentoResumo = {
  id: string;
  provider_payment_id: string | null;
  metodo: string | null;
  status: string | null;
  valor: number | string | null;
  criado_em: string | null;
  aprovado_em: string | null;
};

type EventoResumo = {
  id: string;
  titulo: string | null;
  descricao: string | null;
  data_evento: string | null;
  hora_evento: string | null;
  tipo: string | null;
  status: string | null;
  origem: string | null;
};

type AnuncioResumo = {
  id: string;
  titulo: string;
  mensagem: string | null;
  prioridade: string | null;
  destino: string | null;
  usuario_id: string | null;
  email_usuario: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  criado_em: string | null;
};

const PREFIXO_LIDAS = "@orvena:notificacoes_lidas:";

export async function carregarNotificacoesOrvena(): Promise<{
  notificacoes: NotificacaoOrvena[];
  idsLidos: string[];
  userId: string;
}> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      notificacoes: [],
      idsLidos: [],
      userId: "",
    };
  }

  const notificacoes: NotificacaoOrvena[] = [];

  const [
    perfilResult,
    pagamentosResult,
    agendaResult,
    anunciosResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("plano, trial_termina_em, pro_ate")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("pagamentos_orvena")
      .select(
        "id, provider_payment_id, metodo, status, valor, criado_em, aprovado_em"
      )
      .eq("user_id", user.id)
      .order("criado_em", { ascending: false })
      .limit(20),
    supabase
      .from("agenda_eventos")
      .select(
        "id, titulo, descricao, data_evento, hora_evento, tipo, status, origem"
      )
      .eq("user_id", user.id)
      .eq("status", "pendente")
      .gte("data_evento", hojeIso())
      .lte("data_evento", adicionarDiasIso(7))
      .order("data_evento", { ascending: true })
      .limit(25),
    supabase
      .from("admin_comunicacao")
      .select(
        "id, titulo, mensagem, prioridade, destino, usuario_id, email_usuario, data_inicio, data_fim, criado_em"
      )
      .eq("tipo", "aviso")
      .eq("categoria", "anuncio")
      .eq("status", "ativo")
      .order("criado_em", { ascending: false })
      .limit(100),
  ]);

  if (perfilResult.error) {
    console.log("Notificações - perfil:", perfilResult.error.message);
  } else if (perfilResult.data) {
    adicionarNotificacoesPlano(
      notificacoes,
      perfilResult.data as PerfilPlano
    );
  }

  if (pagamentosResult.error) {
    console.log(
      "Notificações - pagamentos:",
      pagamentosResult.error.message
    );
  } else {
    adicionarNotificacoesPagamento(
      notificacoes,
      (pagamentosResult.data || []) as PagamentoResumo[]
    );
  }

  if (agendaResult.error) {
    console.log("Notificações - agenda:", agendaResult.error.message);
  } else {
    adicionarNotificacoesAgenda(
      notificacoes,
      (agendaResult.data || []) as EventoResumo[]
    );
  }

  if (anunciosResult.error) {
    console.log("Notificações - anúncios:", anunciosResult.error.message);
  } else {
    adicionarNotificacoesAnuncios(
      notificacoes,
      (anunciosResult.data || []) as AnuncioResumo[],
      {
        id: user.id,
        email: user.email ?? null,
      }
    );
  }

  notificacoes.sort((a, b) => {
    if (a.prioridade !== b.prioridade) {
      return a.prioridade - b.prioridade;
    }

    const dataA = a.dataReferencia
      ? new Date(a.dataReferencia).getTime()
      : Number.MAX_SAFE_INTEGER;
    const dataB = b.dataReferencia
      ? new Date(b.dataReferencia).getTime()
      : Number.MAX_SAFE_INTEGER;

    if (a.tipo === "anuncio" && b.tipo === "anuncio") {
      return dataB - dataA;
    }

    return dataA - dataB;
  });

  const idsLidos = await carregarIdsLidos(user.id);

  return {
    notificacoes,
    idsLidos,
    userId: user.id,
  };
}

export async function contarNotificacoesNaoLidas() {
  const { notificacoes, idsLidos } = await carregarNotificacoesOrvena();
  const lidos = new Set(idsLidos);

  return notificacoes.filter((item) => !lidos.has(item.id)).length;
}

export async function marcarNotificacaoComoLida(
  userId: string,
  notificacaoId: string
) {
  if (!userId || !notificacaoId) return;

  const ids = await carregarIdsLidos(userId);
  const novos = Array.from(new Set([...ids, notificacaoId])).slice(-300);

  await AsyncStorage.setItem(
    `${PREFIXO_LIDAS}${userId}`,
    JSON.stringify(novos)
  );
}

export async function marcarTodasNotificacoesComoLidas(
  userId: string,
  notificacoes: NotificacaoOrvena[]
) {
  if (!userId) return;

  const idsAtuais = await carregarIdsLidos(userId);
  const idsNovos = notificacoes.map((item) => item.id);
  const juntos = Array.from(new Set([...idsAtuais, ...idsNovos])).slice(-300);

  await AsyncStorage.setItem(
    `${PREFIXO_LIDAS}${userId}`,
    JSON.stringify(juntos)
  );
}

async function carregarIdsLidos(userId: string) {
  if (!userId) return [];

  try {
    const bruto = await AsyncStorage.getItem(`${PREFIXO_LIDAS}${userId}`);

    if (!bruto) return [];

    const parsed = JSON.parse(bruto);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item) => typeof item === "string");
  } catch (error) {
    console.log("Erro ao carregar notificações lidas:", error);
    return [];
  }
}

function adicionarNotificacoesPlano(
  lista: NotificacaoOrvena[],
  perfil: PerfilPlano
) {
  const plano = String(perfil.plano || "free").toLowerCase();

  if (plano === "trialing" && perfil.trial_termina_em) {
    const dias = diferencaDias(perfil.trial_termina_em);

    if (dias >= 0 && dias <= 5) {
      lista.push({
        id: `plano:trial:${perfil.trial_termina_em}`,
        tipo: "plano",
        titulo:
          dias === 0
            ? "Seu teste Pro termina hoje"
            : `Seu teste Pro termina em ${dias} ${dias === 1 ? "dia" : "dias"}`,
        mensagem:
          "Confira o Orvena Pro para continuar usando os recursos exclusivos após o fim do teste.",
        icone: "◆",
        prioridade: 1,
        dataReferencia: perfil.trial_termina_em,
        rota: "/plano",
      });
    }
  }

  if (plano === "pro" && perfil.pro_ate) {
    const dias = diferencaDias(perfil.pro_ate);

    if (dias >= 0 && dias <= 5) {
      lista.push({
        id: `plano:pro:${perfil.pro_ate}`,
        tipo: "plano",
        titulo:
          dias === 0
            ? "Seu Orvena Pro vence hoje"
            : `Seu Orvena Pro vence em ${dias} ${dias === 1 ? "dia" : "dias"}`,
        mensagem:
          "Veja os detalhes da sua assinatura e renove se necessário.",
        icone: "◆",
        prioridade: 1,
        dataReferencia: perfil.pro_ate,
        rota: "/plano",
      });
    }
  }
}

function adicionarNotificacoesPagamento(
  lista: NotificacaoOrvena[],
  pagamentos: PagamentoResumo[]
) {
  for (const pagamento of pagamentos) {
    const status = String(pagamento.status || "").toLowerCase();
    const metodo = String(pagamento.metodo || "").toLowerCase();
    const idProvider =
      pagamento.provider_payment_id || pagamento.id;

    if (
      metodo === "pix" &&
      (status === "pending" || status === "action_required")
    ) {
      lista.push({
        id: `pagamento:pix-pendente:${idProvider}`,
        tipo: "pagamento",
        titulo: "Pix aguardando pagamento",
        mensagem: `${formatarValor(
          pagamento.valor
        )} • abra o histórico para ver novamente o QR Code e o Pix Copia e Cola.`,
        icone: "◆",
        prioridade: 1,
        dataReferencia: pagamento.criado_em,
        rota: "/historico-pagamentos",
      });

      continue;
    }

    if (status === "approved") {
      const referencia =
        pagamento.aprovado_em || pagamento.criado_em;

      if (referencia && dentroDosUltimosDias(referencia, 7)) {
        lista.push({
          id: `pagamento:aprovado:${idProvider}`,
          tipo: "pagamento",
          titulo: "Pagamento aprovado",
          mensagem: `${formatarValor(
            pagamento.valor
          )} • seu comprovante está disponível no histórico de pagamentos.`,
          icone: "✓",
          prioridade: 2,
          dataReferencia: referencia,
          rota: "/historico-pagamentos",
        });
      }
    }
  }
}

function adicionarNotificacoesAgenda(
  lista: NotificacaoOrvena[],
  eventos: EventoResumo[]
) {
  for (const evento of eventos) {
    if (!evento.data_evento) continue;

    const dias = diferencaDias(evento.data_evento);

    if (dias < 0 || dias > 7) continue;

    const ehValidadeOrcamento =
      evento.tipo === "validade_orcamento" ||
      evento.origem === "orcamento_validade";

    if (ehValidadeOrcamento) {
      lista.push({
        id: `orcamento:validade:${evento.id}:${evento.data_evento}`,
        tipo: "orcamento",
        titulo:
          dias === 0
            ? "Orçamento vence hoje"
            : dias === 1
              ? "Orçamento vence amanhã"
              : `Orçamento vence em ${dias} dias`,
        mensagem:
          evento.titulo ||
          evento.descricao ||
          "Confira o prazo de validade do orçamento.",
        icone: "📄",
        prioridade: dias <= 1 ? 1 : 2,
        dataReferencia: evento.data_evento,
        rota: "/orcamentos",
      });

      continue;
    }

    lista.push({
      id: `agenda:${evento.id}:${evento.data_evento}`,
      tipo: "agenda",
      titulo:
        dias === 0
          ? "Compromisso para hoje"
          : dias === 1
            ? "Compromisso amanhã"
            : `Compromisso em ${dias} dias`,
      mensagem: montarMensagemEvento(evento),
      icone: "📅",
      prioridade: dias <= 1 ? 1 : 3,
      dataReferencia: evento.data_evento,
      rota: "/agenda",
    });
  }
}

function adicionarNotificacoesAnuncios(
  lista: NotificacaoOrvena[],
  anuncios: AnuncioResumo[],
  usuario: { id: string; email: string | null }
) {
  const agora = Date.now();

  for (const anuncio of anuncios) {
    if (!anuncio.titulo?.trim()) continue;
    if (!anuncioDestinadoAoUsuario(anuncio, usuario)) continue;

    if (anuncio.data_inicio) {
      const inicio = new Date(anuncio.data_inicio).getTime();

      if (!Number.isNaN(inicio) && inicio > agora) {
        continue;
      }
    }

    if (anuncio.data_fim) {
      const fim = new Date(anuncio.data_fim).getTime();

      if (!Number.isNaN(fim) && fim < agora) {
        continue;
      }
    }

    lista.push({
      id: `anuncio:${anuncio.id}`,
      tipo: "anuncio",
      titulo: anuncio.titulo.trim(),
      mensagem:
        anuncio.mensagem?.trim() ||
        "Você recebeu um novo anúncio do Orvena.",
      icone: anuncio.prioridade === "critica" ? "🚨" : "📢",
      prioridade: prioridadeAnuncio(anuncio.prioridade),
      dataReferencia: anuncio.criado_em,
      rota: "/notificacoes",
    });
  }
}

function prioridadeAnuncio(
  prioridade: string | null
): 1 | 2 | 3 {
  const valor = String(prioridade || "normal").toLowerCase();

  if (valor === "critica") return 1;
  if (valor === "alta") return 2;

  return 3;
}

function montarMensagemEvento(evento: EventoResumo) {
  const titulo = evento.titulo?.trim() || "Compromisso";
  const hora = evento.hora_evento?.trim();

  return hora ? `${titulo} • ${hora}` : titulo;
}

function diferencaDias(dataIso: string) {
  const alvo = dataSomenteDia(dataIso);
  const hoje = dataSomenteDia(hojeIso());

  if (!alvo || !hoje) return 9999;

  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

function dentroDosUltimosDias(dataIso: string, dias: number) {
  const data = new Date(dataIso);

  if (Number.isNaN(data.getTime())) return false;

  const agora = Date.now();
  const diferenca = agora - data.getTime();

  return diferenca >= 0 && diferenca <= dias * 86400000;
}

function dataSomenteDia(valor: string) {
  const parte = String(valor).slice(0, 10);
  const [ano, mes, dia] = parte.split("-").map(Number);

  if (!ano || !mes || !dia) return null;

  return new Date(ano, mes - 1, dia);
}

function hojeIso() {
  return formatarDia(new Date());
}

function adicionarDiasIso(dias: number) {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return formatarDia(data);
}

function formatarDia(data: Date) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function formatarValor(valor: number | string | null) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
