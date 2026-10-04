import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import { dividirValorSeguro } from "./security";

const OPCOES: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

function chaveTotal(chave: string) {
  return `${chave}.partes`;
}

function chaveParte(chave: string, indice: number) {
  return `${chave}.parte.${indice}`;
}

async function lerTotal(chave: string) {
  const bruto = await SecureStore.getItemAsync(chaveTotal(chave), OPCOES);
  const total = Number(bruto);

  return Number.isInteger(total) && total > 0 ? total : 0;
}

async function lerSeguro(chave: string) {
  const total = await lerTotal(chave);

  if (!total) {
    return SecureStore.getItemAsync(chave, OPCOES);
  }

  let valor = "";

  for (let indice = 0; indice < total; indice += 1) {
    const parte = await SecureStore.getItemAsync(chaveParte(chave, indice), OPCOES);

    if (parte == null) {
      return null;
    }

    valor += parte;
  }

  return valor;
}

async function gravarSeguro(chave: string, valor: string) {
  const anterior = await lerTotal(chave);
  const partes = dividirValorSeguro(valor);

  for (let indice = 0; indice < partes.length; indice += 1) {
    await SecureStore.setItemAsync(chaveParte(chave, indice), partes[indice], OPCOES);
  }

  await SecureStore.setItemAsync(chaveTotal(chave), String(partes.length), OPCOES);

  for (let indice = partes.length; indice < anterior; indice += 1) {
    await SecureStore.deleteItemAsync(chaveParte(chave, indice), OPCOES);
  }

  await SecureStore.deleteItemAsync(chave, OPCOES).catch(() => undefined);
}

async function apagarSeguro(chave: string) {
  const total = await lerTotal(chave);

  for (let indice = 0; indice < total; indice += 1) {
    await SecureStore.deleteItemAsync(chaveParte(chave, indice), OPCOES);
  }

  await SecureStore.deleteItemAsync(chaveTotal(chave), OPCOES).catch(() => undefined);
  await SecureStore.deleteItemAsync(chave, OPCOES).catch(() => undefined);
}

export const armazenamentoSessaoSeguro = {
  async getItem(chave: string) {
    try {
      const seguro = await lerSeguro(chave);

      if (seguro != null) {
        return seguro;
      }
    } catch {
      console.log("Não foi possível ler a sessão protegida.");
    }

    const legado = await AsyncStorage.getItem(chave);

    if (!legado) {
      return null;
    }

    try {
      await gravarSeguro(chave, legado);
      await AsyncStorage.removeItem(chave);
    } catch {
      console.log("A sessão anterior permanece no armazenamento local.");
    }

    return legado;
  },

  async setItem(chave: string, valor: string) {
    try {
      await gravarSeguro(chave, valor);
      await AsyncStorage.removeItem(chave);
    } catch {
      console.log("Não foi possível proteger a sessão. Usando armazenamento local.");
      await AsyncStorage.setItem(chave, valor);
    }
  },

  async removeItem(chave: string) {
    await AsyncStorage.removeItem(chave);

    try {
      await apagarSeguro(chave);
    } catch {
      console.log("Não foi possível remover a sessão protegida.");
    }
  },
};
