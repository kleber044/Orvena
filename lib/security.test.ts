import assert from "node:assert/strict";
import test from "node:test";

import {
  anuncioDestinadoAoUsuario,
  cpfValido,
  dividirValorSeguro,
  hostPermitido,
  lerMensagemCartao,
  mensagemSegura,
  urlAnexoPermitida,
  urlCheckoutPermitida,
  validarSenhaNova,
} from "./security.ts";

test("aceita somente checkout HTTPS do Mercado Pago", () => {
  assert.equal(
    urlCheckoutPermitida("https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=1"),
    true
  );
  assert.equal(urlCheckoutPermitida("https://mpago.la/abc"), true);
  assert.equal(urlCheckoutPermitida("http://www.mercadopago.com.br/checkout"), false);
  assert.equal(urlCheckoutPermitida("https://mercadopago.com.br.evil.test/pay"), false);
  assert.equal(urlCheckoutPermitida("javascript:alert(1)"), false);
});

test("anexo só abre no host do Supabase configurado", () => {
  const base = "https://exemplo.supabase.co";

  assert.equal(
    urlAnexoPermitida(
      "https://exemplo.supabase.co/storage/v1/object/sign/suporte-anexos/a",
      base
    ),
    true
  );
  assert.equal(
    urlAnexoPermitida("https://evil.supabase.co/storage/v1/object/sign/a", base),
    false
  );
  assert.equal(urlAnexoPermitida("file:///etc/passwd", base), false);
});

test("esconde erro técnico e preserva aviso curto", () => {
  assert.equal(
    mensagemSegura("duplicate key value violates unique constraint", "reserva"),
    "reserva"
  );
  assert.equal(mensagemSegura("Informe um CPF válido.", "reserva"), "Informe um CPF válido.");
});

test("senha nova exige tamanho, letras e números", () => {
  assert.match(validarSenhaNova("curta1") || "", /8 caracteres/);
  assert.match(validarSenhaNova("somenteletras") || "", /letras e números/);
  assert.equal(validarSenhaNova("senha1234"), null);
  assert.match(validarSenhaNova("a".repeat(73)) || "", /72/);
});

test("valida dígitos do CPF", () => {
  assert.equal(cpfValido("529.982.247-25"), true);
  assert.equal(cpfValido("111.111.111-11"), false);
  assert.equal(cpfValido("52998224724"), false);
});

test("anúncio geral aparece e anúncio de outra conta não", () => {
  const usuario = { id: "user-1", email: "a@orvena.app" };

  assert.equal(
    anuncioDestinadoAoUsuario({ usuario_id: null, email_usuario: null }, usuario),
    true
  );
  assert.equal(
    anuncioDestinadoAoUsuario({ usuario_id: "user-2", email_usuario: null }, usuario),
    false
  );
  assert.equal(
    anuncioDestinadoAoUsuario(
      { usuario_id: null, email_usuario: "a@orvena.app" },
      usuario
    ),
    true
  );
});

test("divide sessão grande sem ultrapassar o limite do cofre", () => {
  const partes = dividirValorSeguro("x".repeat(4000), 1800);

  assert.equal(partes.length, 3);
  assert.ok(partes.every((parte) => parte.length <= 1800));
  assert.equal(partes.join(""), "x".repeat(4000));
});

test("rejeita mensagem de cartão fora do contrato", () => {
  assert.equal(lerMensagemCartao({ source: "outro", type: "card-token" }), null);
  assert.equal(
    lerMensagemCartao({
      source: "orvena-mercadopago",
      type: "card-token",
      token: "tok_123",
      email: "a@orvena.app",
    })?.type,
    "card-token"
  );
  assert.equal(
    hostPermitido("checkout.mercadopago.com", ["mercadopago.com"]),
    true
  );
});
