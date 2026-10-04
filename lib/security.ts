const HOSTS_CHECKOUT = [
  "mercadopago.com",
  "mercadopago.com.br",
  "mercadopago.com.ar",
  "mercadopago.com.mx",
  "mercadopago.com.co",
  "mercadopago.com.pe",
  "mercadopago.com.uy",
  "mercadopago.cl",
  "mpago.la",
];

const TEXTO_TECNICO =
  /(postgres|sqlstate|syntax error|jwt|stack|pgrst|schema|duplicate key|permission denied|row-level|row level|edge function|internal server|password|secret|api[_ -]?key|service[_ -]?role|bearer\s)/i;

export function hostPermitido(hostname: string, dominios: string[]) {
  const host = hostname.trim().toLowerCase().replace(/\.+$/, "");

  return dominios.some(
    (dominio) => host === dominio || host.endsWith(`.${dominio}`)
  );
}

export function urlCheckoutPermitida(valor: string) {
  try {
    const url = new URL(valor);
    return url.protocol === "https:" && hostPermitido(url.hostname, HOSTS_CHECKOUT);
  } catch {
    return false;
  }
}

export function urlAnexoPermitida(valor: string, supabaseUrl: string | undefined) {
  try {
    if (!supabaseUrl) return false;

    const alvo = new URL(valor);
    const base = new URL(supabaseUrl);

    return alvo.protocol === "https:" && alvo.hostname === base.hostname;
  } catch {
    return false;
  }
}

export function mensagemSegura(valor: unknown, reserva: string) {
  const texto = typeof valor === "string" ? valor.trim() : "";

  if (!texto || texto.length > 180 || TEXTO_TECNICO.test(texto)) {
    return reserva;
  }

  return texto;
}

export function validarSenhaNova(senha: string) {
  if (senha.length < 8) {
    return "A senha precisa ter pelo menos 8 caracteres.";
  }

  if (senha.length > 72) {
    return "A senha pode ter no máximo 72 caracteres.";
  }

  if (!/[A-Za-z]/.test(senha) || !/[0-9]/.test(senha)) {
    return "A senha precisa ter letras e números.";
  }

  return null;
}

export function cpfValido(valor: string) {
  const cpf = valor.replace(/\D/g, "");

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const digito = (tamanho: number) => {
    let soma = 0;

    for (let indice = 0; indice < tamanho; indice += 1) {
      soma += Number(cpf[indice]) * (tamanho + 1 - indice);
    }

    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

export function anuncioDestinadoAoUsuario(
  anuncio: {
    usuario_id?: string | null;
    email_usuario?: string | null;
  },
  usuario: {
    id: string;
    email?: string | null;
  }
) {
  const idAlvo = anuncio.usuario_id?.trim() || "";
  const emailAlvo = anuncio.email_usuario?.trim().toLowerCase() || "";

  if (!idAlvo && !emailAlvo) {
    return true;
  }

  if (idAlvo && idAlvo === usuario.id) {
    return true;
  }

  const email = usuario.email?.trim().toLowerCase() || "";
  return Boolean(emailAlvo && email && emailAlvo === email);
}

export function dividirValorSeguro(valor: string, limite = 1800) {
  if (!Number.isInteger(limite) || limite < 1) {
    throw new Error("Limite de armazenamento inválido.");
  }

  if (!valor) {
    return [];
  }

  const partes: string[] = [];

  for (let indice = 0; indice < valor.length; indice += limite) {
    partes.push(valor.slice(indice, indice + limite));
  }

  return partes;
}

type MensagemCartao =
  | {
      source: "orvena-mercadopago";
      type: "card-token";
      token: string;
      email: string;
    }
  | {
      source: "orvena-mercadopago";
      type: "card-error";
      message: string;
    };

export function lerMensagemCartao(valor: unknown): MensagemCartao | null {
  if (!valor || typeof valor !== "object") {
    return null;
  }

  const dados = valor as Record<string, unknown>;

  if (dados.source !== "orvena-mercadopago") {
    return null;
  }

  if (dados.type === "card-error") {
    return typeof dados.message === "string"
      ? {
          source: "orvena-mercadopago",
          type: "card-error",
          message: dados.message.slice(0, 180),
        }
      : null;
  }

  if (
    dados.type === "card-token" &&
    typeof dados.token === "string" &&
    dados.token.length > 0 &&
    dados.token.length <= 512
  ) {
    return {
      source: "orvena-mercadopago",
      type: "card-token",
      token: dados.token,
      email: typeof dados.email === "string" ? dados.email.slice(0, 320) : "",
    };
  }

  return null;
}
