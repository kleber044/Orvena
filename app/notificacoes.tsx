import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  carregarNotificacoesOrvena,
  marcarNotificacaoComoLida,
  marcarTodasNotificacoesComoLidas,
  type NotificacaoOrvena,
} from "../lib/notificacoes";

const CORES = {
  fundo: "#080B13",
  card: "#121826",
  borda: "#273044",
  texto: "#F8FAFC",
  secundario: "#94A3B8",
  roxo: "#8B5CF6",
  branco: "#FFFFFF",
};

function formatarData(data: string | null) {
  if (!data) return "Data não informada";

  const valor = new Date(data);

  if (Number.isNaN(valor.getTime())) {
    return data;
  }

  return valor.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function obterIcone(tipo: NotificacaoOrvena["tipo"]) {
  switch (tipo) {
    case "anuncio":
      return "📢";
    case "pagamento":
      return "💳";
    case "plano":
      return "💎";
    case "agenda":
      return "📅";
    case "orcamento":
      return "📄";
    default:
      return "🔔";
  }
}

function ordenarNotificacoes(
  lista: NotificacaoOrvena[]
): NotificacaoOrvena[] {
  return [...lista].sort((a, b) => {
    const dataA = a.dataReferencia
      ? new Date(a.dataReferencia).getTime()
      : 0;

    const dataB = b.dataReferencia
      ? new Date(b.dataReferencia).getTime()
      : 0;

    const tempoA = Number.isFinite(dataA) ? dataA : 0;
    const tempoB = Number.isFinite(dataB) ? dataB : 0;

    // A notificação mais recente aparece primeiro.
    return tempoB - tempoA;
  });
}

export default function NotificacoesScreen() {
  const router = useRouter();

  const [notificacoes, setNotificacoes] = useState<
    NotificacaoOrvena[]
  >([]);

  const [idsLidos, setIdsLidos] = useState<string[]>([]);
  const [userId, setUserId] = useState("");

  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);

  const [anuncioAberto, setAnuncioAberto] =
    useState<NotificacaoOrvena | null>(null);

  const carregar = useCallback(async () => {
    try {
      const resultado = await carregarNotificacoesOrvena();

      setNotificacoes(
        ordenarNotificacoes(resultado.notificacoes)
      );

      setIdsLidos(resultado.idsLidos);
      setUserId(resultado.userId);
    } catch (error) {
      console.log("Erro ao carregar notificações:", error);

      Alert.alert(
        "Erro",
        "Não foi possível carregar suas notificações."
      );
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  const quantidadeNaoLidas = notificacoes.filter(
    (item) => !idsLidos.includes(item.id)
  ).length;

  async function marcarComoLida(item: NotificacaoOrvena) {
    if (!userId || idsLidos.includes(item.id)) {
      return;
    }

    try {
      await marcarNotificacaoComoLida(userId, item.id);

      setIdsLidos((anteriores) =>
        anteriores.includes(item.id)
          ? anteriores
          : [...anteriores, item.id]
      );
    } catch (error) {
      console.log("Erro ao marcar notificação:", error);
    }
  }

  function abrirNotificacao(item: NotificacaoOrvena) {
    void marcarComoLida(item);

    if (item.tipo === "anuncio") {
      setAnuncioAberto(item);
      return;
    }

    if (item.rota && item.rota !== "/notificacoes") {
      router.push(item.rota as Href);
    }
  }

  async function marcarTodas() {
    if (!userId || atualizando) {
      return;
    }

    setAtualizando(true);

    try {
      await marcarTodasNotificacoesComoLidas(
        userId,
        notificacoes
      );

      setIdsLidos((anteriores) =>
        Array.from(
          new Set([
            ...anteriores,
            ...notificacoes.map((item) => item.id),
          ])
        )
      );
    } catch (error) {
      console.log(
        "Erro ao marcar todas as notificações:",
        error
      );

      Alert.alert(
        "Erro",
        "Não foi possível marcar todas as notificações como lidas."
      );
    } finally {
      setAtualizando(false);
    }
  }

  function fecharAnuncio() {
    setAnuncioAberto(null);
  }

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom"]}
    >
      <View style={styles.cabecalho}>
        <Pressable
          onPress={() => router.back()}
          style={styles.botaoVoltar}
          accessibilityLabel="Voltar"
        >
          <Text style={styles.voltarTexto}>‹</Text>
        </Pressable>

        <View style={styles.tituloArea}>
          <Text style={styles.titulo}>
            Notificações
          </Text>

          <Text style={styles.subtitulo}>
            {quantidadeNaoLidas === 0
              ? "Tudo em dia"
              : `${quantidadeNaoLidas} ${
                  quantidadeNaoLidas === 1
                    ? "não lida"
                    : "não lidas"
                }`}
          </Text>
        </View>

        <View style={styles.campainha}>
          <Text style={styles.campainhaTexto}>🔔</Text>
        </View>
      </View>

      {!carregando && notificacoes.length > 0 && (
        <View style={styles.barraAcoes}>
          <Text style={styles.totalTexto}>
            {notificacoes.length} notificações
          </Text>

          <Pressable
            onPress={() => void marcarTodas()}
            disabled={
              quantidadeNaoLidas === 0 || atualizando
            }
          >
            <Text
              style={[
                styles.marcarTodas,
                (quantidadeNaoLidas === 0 ||
                  atualizando) &&
                  styles.desabilitado,
              ]}
            >
              {atualizando
                ? "Aguarde..."
                : "Marcar todas como lidas"}
            </Text>
          </Pressable>
        </View>
      )}

      {carregando ? (
        <View style={styles.estadoCentral}>
          <ActivityIndicator
            size="large"
            color={CORES.roxo}
          />

          <Text style={styles.estadoTexto}>
            Carregando notificações...
          </Text>
        </View>
      ) : notificacoes.length === 0 ? (
        <View style={styles.estadoCentral}>
          <Text style={styles.vazioIcone}>🔔</Text>

          <Text style={styles.vazioTitulo}>
            Nenhuma notificação
          </Text>

          <Text style={styles.estadoTexto}>
            Suas notificações aparecerão aqui.
          </Text>

          <Pressable
            style={styles.botaoAtualizar}
            onPress={() => {
              setCarregando(true);
              void carregar();
            }}
          >
            <Text style={styles.botaoAtualizarTexto}>
              Atualizar
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.lista}
          contentContainerStyle={styles.listaConteudo}
          showsVerticalScrollIndicator={false}
        >
          {notificacoes.map((item) => {
            const lida = idsLidos.includes(item.id);

            return (
              <Pressable
                key={item.id}
                onPress={() => abrirNotificacao(item)}
                style={[
                  styles.card,
                  !lida && styles.cardNaoLido,
                ]}
              >
                <View style={styles.cardTopo}>
                  <View style={styles.iconeContainer}>
                    <Text style={styles.iconeTexto}>
                      {obterIcone(item.tipo)}
                    </Text>
                  </View>

                  <View style={styles.cardPrincipal}>
                    <View style={styles.linhaTitulo}>
                      <Text style={styles.cardTitulo}>
                        {item.titulo}
                      </Text>

                      {!lida && (
                        <View style={styles.bolinha} />
                      )}
                    </View>

                    <Text
                      style={styles.cardMensagem}
                      numberOfLines={3}
                    >
                      {item.mensagem}
                    </Text>

                    <Text style={styles.cardData}>
                      {formatarData(item.dataReferencia)}
                    </Text>

                    {item.tipo === "anuncio" && (
                      <Text style={styles.verAnuncio}>
                        Toque para ver o anúncio completo
                      </Text>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <Modal
        visible={anuncioAberto !== null}
        transparent
        animationType="fade"
        onRequestClose={fecharAnuncio}
        statusBarTranslucent
      >
        <View style={styles.modalFundo}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={fecharAnuncio}
            accessibilityLabel="Fechar anúncio"
          />

          <View style={styles.modalConteudo}>
            <View style={styles.modalCabecalho}>
              <View style={styles.modalIcone}>
                <Text style={styles.modalIconeTexto}>
                  📢
                </Text>
              </View>

              <Text style={styles.modalEtiqueta}>
                COMUNICADO ORVENA
              </Text>

              <Pressable
                onPress={fecharAnuncio}
                style={styles.modalFecharX}
                accessibilityLabel="Fechar"
              >
                <Text style={styles.modalFecharXTexto}>
                  ✕
                </Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={
                styles.modalScrollConteudo
              }
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalTitulo}>
                {anuncioAberto?.titulo}
              </Text>

              <Text style={styles.modalData}>
                {formatarData(
                  anuncioAberto?.dataReferencia ?? null
                )}
              </Text>

              <View style={styles.divisor} />

              <Text style={styles.modalMensagem}>
                {anuncioAberto?.mensagem}
              </Text>
            </ScrollView>

            <Pressable
              onPress={fecharAnuncio}
              style={styles.botaoFechar}
            >
              <Text style={styles.botaoFecharTexto}>
                Fechar
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CORES.fundo,
  },

  cabecalho: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: CORES.borda,
    minHeight: 110,
  },

  botaoVoltar: {
    width: 42,
    height: 48,
    justifyContent: "center",
    alignItems: "flex-start",
  },

  voltarTexto: {
    color: CORES.branco,
    fontSize: 38,
    lineHeight: 42,
  },

  tituloArea: {
    flex: 1,
    paddingLeft: 4,
  },

  titulo: {
    color: CORES.texto,
    fontSize: 23,
    fontWeight: "800",
  },

  subtitulo: {
    color: CORES.secundario,
    fontSize: 13,
    marginTop: 6,
  },

  campainha: {
    width: 46,
    height: 46,
    backgroundColor: CORES.card,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  campainhaTexto: {
    fontSize: 22,
  },

  barraAcoes: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  totalTexto: {
    fontSize: 12,
    color: CORES.secundario,
  },

  marcarTodas: {
    fontSize: 12,
    color: CORES.roxo,
    fontWeight: "700",
  },

  desabilitado: {
    opacity: 0.4,
  },

  lista: {
    flex: 1,
  },

  listaConteudo: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 12,
  },

  card: {
    backgroundColor: CORES.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: CORES.borda,
  },

  cardNaoLido: {
    borderColor: "#6D4BCD",
    backgroundColor: "#19172C",
  },

  cardTopo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  iconeContainer: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: "#26213E",
    alignItems: "center",
    justifyContent: "center",
  },

  iconeTexto: {
    fontSize: 21,
  },

  cardPrincipal: {
    flex: 1,
  },

  linhaTitulo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  cardTitulo: {
    color: CORES.texto,
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
  },

  bolinha: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: CORES.roxo,
  },

  cardMensagem: {
    color: "#CBD5E1",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
  },

  cardData: {
    color: CORES.secundario,
    fontSize: 11,
    marginTop: 12,
  },

  verAnuncio: {
    color: "#A78BFA",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 10,
  },

  estadoCentral: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    gap: 15,
  },

  estadoTexto: {
    color: CORES.secundario,
    fontSize: 14,
    textAlign: "center",
  },

  vazioIcone: {
    fontSize: 48,
  },

  vazioTitulo: {
    color: CORES.texto,
    fontSize: 19,
    fontWeight: "800",
  },

  botaoAtualizar: {
    backgroundColor: CORES.roxo,
    borderRadius: 12,
    paddingHorizontal: 25,
    paddingVertical: 13,
    marginTop: 12,
  },

  botaoAtualizarTexto: {
    color: CORES.branco,
    fontWeight: "800",
  },

  modalFundo: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  modalConteudo: {
    width: "100%",
    maxWidth: 500,
    maxHeight: "85%",
    backgroundColor: CORES.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#39324F",
    padding: 22,
    overflow: "hidden",
  },

  modalCabecalho: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  modalIcone: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#29213F",
    alignItems: "center",
    justifyContent: "center",
  },

  modalIconeTexto: {
    fontSize: 21,
  },

  modalEtiqueta: {
    color: "#A78BFA",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    flex: 1,
  },

  modalFecharX: {
    width: 35,
    height: 35,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#252B38",
  },

  modalFecharXTexto: {
    color: CORES.branco,
    fontSize: 18,
    fontWeight: "700",
  },

  modalScroll: {
    flexGrow: 0,
    marginTop: 22,
    marginBottom: 20,
  },

  modalScrollConteudo: {
    paddingBottom: 5,
  },

  modalTitulo: {
    color: CORES.branco,
    fontSize: 23,
    fontWeight: "900",
    lineHeight: 31,
  },

  modalData: {
    color: CORES.secundario,
    fontSize: 12,
    marginTop: 12,
  },

  divisor: {
    height: 1,
    backgroundColor: CORES.borda,
    marginVertical: 22,
  },

  modalMensagem: {
    color: "#E2E8F0",
    fontSize: 15,
    lineHeight: 25,
  },

  botaoFechar: {
    backgroundColor: CORES.roxo,
    borderRadius: 14,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },

  botaoFecharTexto: {
    color: CORES.branco,
    fontSize: 15,
    fontWeight: "800",
  },
});