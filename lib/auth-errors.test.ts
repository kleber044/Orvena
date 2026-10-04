import assert from "node:assert/strict";
import test from "node:test";

import {
  erroLimiteAuth,
  erroOcultaExistenciaDaConta,
  traduzirErroAuth,
} from "./auth-errors.ts";

test("login inválido não revela qual campo errou", () => {
  assert.equal(
    traduzirErroAuth({ message: "Invalid login credentials" }),
    "E-mail ou senha incorretos."
  );
});

test("conta inexistente na recuperação não confirma a ausência", () => {
  const erro = { message: "User not found" };

  assert.equal(erroOcultaExistenciaDaConta(erro), true);
  assert.doesNotMatch(traduzirErroAuth(erro), /não encontramos/i);
});

test("limite de tentativas continua explícito", () => {
  const erro = { message: "Email rate limit exceeded" };

  assert.equal(erroLimiteAuth(erro), true);
  assert.match(traduzirErroAuth(erro), /Aguarde/);
});
