function mensagemDoErro(erro: unknown) {
  const mensagemOriginal =
    erro && typeof erro === "object" && "message" in erro
      ? String((erro as { message?: unknown }).message ?? "")
      : typeof erro === "string"
        ? erro
        : "";

  return mensagemOriginal.trim().toLowerCase();
}

export function erroOcultaExistenciaDaConta(erro: unknown) {
  const mensagem = mensagemDoErro(erro);

  return (
    mensagem.includes("user not found") ||
    mensagem.includes("email not found") ||
    mensagem.includes("no user found") ||
    mensagem.includes("user does not exist") ||
    mensagem.includes("signups not allowed for otp") ||
    mensagem.includes("signup not allowed for otp")
  );
}

export function erroLimiteAuth(erro: unknown) {
  const mensagem = mensagemDoErro(erro);

  return (
    mensagem.includes("rate limit") ||
    mensagem.includes("rate_limit") ||
    mensagem.includes("too many requests") ||
    mensagem.includes("security purposes") ||
    mensagem.includes("you can only request this after") ||
    mensagem.includes("email rate limit exceeded")
  );
}

export function traduzirErroAuth(erro: unknown): string {
  const mensagem = mensagemDoErro(erro);

  if (!mensagem) return "Ocorreu um erro. Tente novamente.";

  if (
    mensagem.includes("invalid login credentials") ||
    mensagem.includes("invalid credentials") ||
    mensagem.includes("invalid login")
  ) {
    return "E-mail ou senha incorretos.";
  }

  if (
    mensagem.includes("email not confirmed") ||
    mensagem.includes("email_not_confirmed")
  ) {
    return "Confirme seu e-mail antes de entrar.";
  }

  if (
    mensagem.includes("user already registered") ||
    mensagem.includes("already registered") ||
    mensagem.includes("already been registered")
  ) {
    return "Não foi possível criar a conta com este e-mail. Se você já tem cadastro, use a tela de entrar.";
  }

  if (
    mensagem.includes("otp_expired") ||
    mensagem.includes("token has expired") ||
    mensagem.includes("token expired") ||
    mensagem.includes("expired")
  ) {
    return "Código expirado. Solicite um novo código.";
  }

  if (
    mensagem.includes("token is invalid") ||
    mensagem.includes("invalid token") ||
    mensagem.includes("invalid otp") ||
    mensagem.includes("otp is invalid")
  ) {
    return "Código inválido. Confira e tente novamente.";
  }

  if (erroLimiteAuth(erro)) {
    return "Aguarde alguns instantes antes de tentar novamente.";
  }

  if (
    mensagem.includes("password should be at least") ||
    mensagem.includes("password must be at least") ||
    mensagem.includes("weak password")
  ) {
    return "A senha informada não atende aos requisitos de segurança.";
  }

  if (
    mensagem.includes("new password should be different") ||
    mensagem.includes("same password")
  ) {
    return "A nova senha precisa ser diferente da senha atual.";
  }

  if (erroOcultaExistenciaDaConta(erro)) {
    return "Não foi possível continuar com este e-mail. Confira os dados e tente novamente.";
  }

  if (
    mensagem.includes("network request failed") ||
    mensagem.includes("failed to fetch") ||
    mensagem.includes("networkerror") ||
    mensagem.includes("fetch failed")
  ) {
    return "Não foi possível conectar. Verifique sua internet e tente novamente.";
  }

  if (
    mensagem.includes("signup is disabled") ||
    mensagem.includes("signups not allowed")
  ) {
    return "A criação de novas contas está temporariamente indisponível.";
  }

  if (
    mensagem.includes("email address") &&
    mensagem.includes("invalid")
  ) {
    return "Digite um endereço de e-mail válido.";
  }

  if (
    mensagem.includes("session") &&
    (mensagem.includes("missing") ||
      mensagem.includes("expired") ||
      mensagem.includes("not found"))
  ) {
    return "Sua sessão expirou. Entre novamente.";
  }

  if (
    mensagem.includes("reauthentication") ||
    mensagem.includes("reauthenticate")
  ) {
    return "Por segurança, confirme sua identidade novamente.";
  }

  if (
    mensagem.includes("database error") ||
    mensagem.includes("unexpected failure")
  ) {
    return "Ocorreu um erro ao processar sua solicitação. Tente novamente.";
  }

  return "Ocorreu um erro. Tente novamente.";
}
