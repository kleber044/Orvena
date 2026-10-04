import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function IndexScreen() {
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    async function iniciar() {
      try {
        setCarregando(true);
        setErro("");

        const primeiraTentativa = await supabase.auth.getSession();

        if (!ativo) return;

        if (primeiraTentativa.error) {
          console.log(
            "Erro ao restaurar sessão:",
            primeiraTentativa.error
          );
        }

        if (primeiraTentativa.data.session?.user) {
          router.replace("/(tabs)" as any);
          return;
        }

        // Pequena segunda tentativa evita mandar o usuário para o login
        // enquanto o armazenamento local ainda está sendo restaurado.
        await esperar(350);

        if (!ativo) return;

        const segundaTentativa = await supabase.auth.getSession();

        if (!ativo) return;

        if (segundaTentativa.error) {
          console.log(
            "Erro na segunda tentativa de restaurar sessão:",
            segundaTentativa.error
          );
          setErro("Não foi possível verificar sua sessão.");
          return;
        }

        if (segundaTentativa.data.session?.user) {
          router.replace("/(tabs)" as any);
          return;
        }

        router.replace("/login" as any);
      } catch (error) {
        console.log("Erro ao iniciar o Orvena:", error);

        if (ativo) {
          setErro("Não foi possível iniciar o Orvena.");
        }
      } finally {
        if (ativo) {
          setCarregando(false);
        }
      }
    }

    void iniciar();

    return () => {
      ativo = false;
    };
  }, []);

  async function tentarNovamente() {
    try {
      setCarregando(true);
      setErro("");

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.log("Erro ao verificar sessão novamente:", error);
        setErro("Não foi possível verificar sua sessão.");
        return;
      }

      if (session?.user) {
        router.replace("/(tabs)" as any);
      } else {
        router.replace("/login" as any);
      }
    } catch (error) {
      console.log("Erro ao tentar novamente:", error);
      setErro("Não foi possível iniciar o Orvena.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>O</Text>
        </View>

        <Text style={styles.brand}>ORVENA</Text>
        <Text style={styles.tagline}>Seu negócio, organizado.</Text>

        {carregando ? (
          <View style={styles.loadingArea}>
            <ActivityIndicator size="large" color="#7C5CFF" />
            <Text style={styles.loadingText}>
              Restaurando sua sessão...
            </Text>
          </View>
        ) : null}

        {erro ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{erro}</Text>

            <Pressable
              style={styles.retryButton}
              onPress={tentarNovamente}
            >
              <Text style={styles.retryText}>
                TENTAR NOVAMENTE
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B0C10",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 23,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
  },
  brand: {
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: 2.2,
    marginTop: 17,
  },
  tagline: {
    color: "#777E89",
    fontSize: 11,
    marginTop: 5,
  },
  loadingArea: {
    alignItems: "center",
    marginTop: 34,
    gap: 11,
  },
  loadingText: {
    color: "#777E89",
    fontSize: 10,
  },
  errorBox: {
    width: "100%",
    maxWidth: 410,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#552C35",
    backgroundColor: "#211217",
    padding: 15,
    marginTop: 28,
  },
  errorText: {
    color: "#FF9098",
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
  },
  retryButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: "#312029",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  retryText: {
    color: "#FFB1B7",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});
