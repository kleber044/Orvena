import * as Network from "expo-network";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  const [reconectado, setReconectado] = useState(false);
  const [inicializado, setInicializado] = useState(false);

  useEffect(() => {
    let ativo = true;
    let timerReconectado: ReturnType<typeof setTimeout> | null = null;

    function atualizarEstado(
      isConnected?: boolean | null,
      isInternetReachable?: boolean | null
    ) {
      if (!ativo) return;

      const semConexao =
        isConnected === false || isInternetReachable === false;

      setOffline((estavaOffline) => {
        if (
          inicializado &&
          estavaOffline &&
          !semConexao
        ) {
          setReconectado(true);

          if (timerReconectado) {
            clearTimeout(timerReconectado);
          }

          timerReconectado = setTimeout(() => {
            if (ativo) {
              setReconectado(false);
            }
          }, 2500);
        }

        return semConexao;
      });

      setInicializado(true);
    }

    async function verificarInicial() {
      try {
        const estado = await Network.getNetworkStateAsync();

        atualizarEstado(
          estado.isConnected,
          estado.isInternetReachable
        );
      } catch (error) {
        console.log("Não foi possível verificar a conexão:", error);
        setInicializado(true);
      }
    }

    void verificarInicial();

    const subscription = Network.addNetworkStateListener((estado) => {
      atualizarEstado(
        estado.isConnected,
        estado.isInternetReachable
      );
    });

    return () => {
      ativo = false;
      subscription.remove();

      if (timerReconectado) {
        clearTimeout(timerReconectado);
      }
    };
  }, [inicializado]);

  if (!offline && !reconectado) {
    return null;
  }

  const paddingTop =
    Platform.OS === "web"
      ? 10
      : Math.max(insets.top, 8);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrapper,
        offline ? styles.offline : styles.online,
        { paddingTop },
      ]}
    >
      <Text style={styles.icon}>
        {offline ? "⚠️" : "✓"}
      </Text>

      <View style={styles.textArea}>
        <Text style={styles.title}>
          {offline
            ? "Você está sem conexão"
            : "Conexão restaurada"}
        </Text>

        <Text style={styles.subtitle}>
          {offline
            ? "Algumas ações podem não funcionar até a internet voltar."
            : "O Orvena voltou a se conectar à internet."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 20,
    minHeight: 58,
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    borderBottomWidth: 1,
  },
  offline: {
    backgroundColor: "#2A2114",
    borderBottomColor: "#6A522C",
  },
  online: {
    backgroundColor: "#102019",
    borderBottomColor: "#285A42",
  },
  icon: {
    fontSize: 16,
    marginBottom: 1,
  },
  textArea: {
    flex: 1,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  subtitle: {
    color: "#C7CCD3",
    fontSize: 8,
    lineHeight: 12,
    marginTop: 2,
  },
});
