import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { supabase } from "../lib/supabase";
import AuthGuard from "./components/AuthGuard";
import OfflineBanner from "./components/OfflineBanner";
import SupportFloatingButton from "./components/SupportFloatingButton";

const ADMIN_URL = (
  process.env.EXPO_PUBLIC_ADMIN_API_URL ?? ""
).replace(/\/+$/, "");

const INTERVALO = 15000;

const TITULO_PADRAO =
  "Orvena temporariamente indispon\u00edvel";

const MENSAGEM_PADRAO =
  "Estamos realizando uma manuten\u00e7\u00e3o. Tente novamente em alguns minutos.";

type Manutencao = {
  ativo: boolean;
  titulo: string;
  mensagem: string;
  previsao: string;
};

type RespostaApi = {
  success: boolean;
  manutencao?: Manutencao;
  error?: string;
};

export default function RootLayout() {
  const { width } = useWindowDimensions();
  const desktop = width >= 768;

  const [manutencao, setManutencao] =
    useState<Manutencao | null>(null);

  const [verificando, setVerificando] = useState(true);
  const [erro, setErro] = useState("");

  const [verificandoManual, setVerificandoManual] =
    useState(false);

  const consultaEmAndamento = useRef(false);
  const montado = useRef(true);

  const verificar = useCallback(async (manual = false) => {
    if (consultaEmAndamento.current) {
      return;
    }

    consultaEmAndamento.current = true;

    if (manual && montado.current) {
      setVerificandoManual(true);
    }

    try {
      const { data: ativo, error: erroSupabase } = await supabase.rpc(
        "orvena_manutencao_ativa"
      );

      if (erroSupabase || typeof ativo !== "boolean") {
        throw erroSupabase || new Error("Estado de manutenção inválido.");
      }

      let estado: Manutencao = {
        ativo,
        titulo: TITULO_PADRAO,
        mensagem: MENSAGEM_PADRAO,
        previsao: "",
      };

      if (ativo && ADMIN_URL) {
        try {
          const resposta = await fetch(`${ADMIN_URL}/api/public/manutencao`, {
            method: "GET",
            headers: { Accept: "application/json" },
          });
          if (resposta.ok) {
            const resultado = (await resposta.json()) as RespostaApi;
            if (resultado.success && resultado.manutencao) {
              estado = {
                ativo: true,
                titulo: resultado.manutencao.titulo || TITULO_PADRAO,
                mensagem: resultado.manutencao.mensagem || MENSAGEM_PADRAO,
                previsao: resultado.manutencao.previsao || "",
              };
            }
          }
        } catch (error) {
          console.log("[ORVENA] Textos personalizados indisponíveis:", error);
        }
      }

      if (!montado.current) return;
      setManutencao(estado);
      setErro("");
      console.log("[ORVENA] Manutenção:", ativo ? "ATIVADA" : "DESATIVADA");
    } catch (error) {
      console.log("[ORVENA] Erro ao verificar manutenção no Supabase:", error);
      if (montado.current) {
        setManutencao({
          ativo: false,
          titulo: TITULO_PADRAO,
          mensagem: MENSAGEM_PADRAO,
          previsao: "",
        });
        setErro("");
      }
    } finally {
      consultaEmAndamento.current = false;
      if (montado.current) {
        setVerificandoManual(false);
        setVerificando(false);
      }
    }
  }, []);

  useEffect(() => {
    montado.current = true;

    void verificar(false);

    const intervalo = setInterval(() => {
      void verificar(false);
    }, INTERVALO);

    const assinatura = AppState.addEventListener(
      "change",
      (estado) => {
        if (estado === "active") {
          void verificar(false);
        }
      }
    );

    return () => {
      montado.current = false;
      clearInterval(intervalo);
      assinatura.remove();
    };
  }, [verificar]);

  const acessoLiberado = !verificando && manutencao?.ativo === false && !erro;
  const telaIndisponivel = !verificando && !acessoLiberado;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />

      <View style={styles.raiz}>
        {acessoLiberado && (
          <AuthGuard>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: {
                  backgroundColor: "#0B0C10",
                },
                animation: "none",
              }}
            />
          </AuthGuard>
        )}

        {acessoLiberado && (
          <>
            <OfflineBanner />
            <SupportFloatingButton />
          </>
        )}

        {verificando && (
          <View style={styles.bloqueio}>
            <ActivityIndicator size="large" color="#7C5CFF" />
            <Text style={styles.carregamento}>
              Verificando disponibilidade do Orvena...
            </Text>
          </View>
        )}

        {telaIndisponivel && (
          <View style={styles.bloqueio}>
            {desktop && (
              <>
                <View pointerEvents="none" style={styles.luzSuperior} />
                <View pointerEvents="none" style={styles.luzInferior} />

                <View style={styles.cabecalhoDesktop}>
                  <View style={styles.logoPequena}>
                    <Text style={styles.logoPequenaTexto}>O</Text>
                  </View>

                  <Text style={styles.nomeCabecalho}>ORVENA</Text>

                  <View style={styles.statusCabecalho}>
                    <View style={styles.pontoStatus} />
                    <Text style={styles.statusCabecalhoTexto}>
                      AVISO DO SISTEMA
                    </Text>
                  </View>
                </View>
              </>
            )}

            <ScrollView
              style={styles.scrollManutencao}
              contentContainerStyle={[
                styles.scrollConteudo,
                desktop && styles.scrollConteudoDesktop,
              ]}
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.card, desktop && styles.cardDesktop]}>
                {desktop && <View style={styles.linhaSuperior} />}

                <View
                  style={[styles.conteudo, desktop && styles.conteudoDesktop]}
                >
                  <View style={[styles.logo, desktop && styles.logoDesktop]}>
                    <Text
                      style={[
                        styles.logoTexto,
                        desktop && styles.logoTextoDesktop,
                      ]}
                    >
                      O
                    </Text>
                  </View>

                  <Text
                    style={[styles.marca, desktop && styles.marcaDesktop]}
                  >
                    ORVENA
                  </Text>

                  <View
                    style={[styles.etiqueta, desktop && styles.etiquetaDesktop]}
                  >
                    <View style={styles.pontoManutencao} />
                    <Text style={styles.etiquetaTexto}>
                      {"MANUTEN\u00c7\u00c3O EM ANDAMENTO"}
                    </Text>
                  </View>

                  <Text
                    style={[styles.titulo, desktop && styles.tituloDesktop]}
                  >
                    {manutencao?.titulo || TITULO_PADRAO}
                  </Text>

                  <Text
                    style={[
                      styles.mensagem,
                      desktop && styles.mensagemDesktop,
                    ]}
                  >
                    {manutencao?.mensagem || MENSAGEM_PADRAO}
                  </Text>

                  {!!manutencao?.previsao && (
                    <View
                      style={[
                        styles.previsao,
                        desktop && styles.previsaoDesktop,
                      ]}
                    >
                      {desktop && (
                        <View style={styles.iconeRelogio}>
                          <Text style={styles.relogioTexto}>
                            {"\u25f7"}
                          </Text>
                        </View>
                      )}

                      <View
                        style={[
                          styles.previsaoConteudo,
                          desktop && styles.previsaoConteudoDesktop,
                        ]}
                      >
                        <Text style={styles.previsaoRotulo}>
                          {"PREVIS\u00c3O DE RETORNO"}
                        </Text>

                        <Text
                          style={[
                            styles.previsaoTexto,
                            desktop && styles.previsaoTextoDesktop,
                          ]}
                        >
                          {manutencao.previsao}
                        </Text>
                      </View>
                    </View>
                  )}

                  <Pressable
                    onPress={() => void verificar(true)}
                    disabled={verificandoManual}
                    style={[
                      styles.botao,
                      desktop && styles.botaoDesktop,
                      verificandoManual && styles.botaoDesativado,
                    ]}
                  >
                    {verificandoManual ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.botaoTexto}>
                        VERIFICAR NOVAMENTE
                      </Text>
                    )}
                  </Pressable>

                  {erro ? (
                    <Text style={styles.erro}>{erro}</Text>
                  ) : (
                    <Text
                      style={[styles.rodape, desktop && styles.rodapeDesktop]}
                    >
                      {
                        "O aplicativo verifica automaticamente quando a manuten\u00e7\u00e3o terminar."
                      }
                    </Text>
                  )}
                </View>

                {desktop && (
                  <View style={styles.rodapeCard}>
                    <View style={styles.pontoRodape} />
                    <Text style={styles.rodapeCardTexto}>
                      {
                        "Estamos trabalhando para retornar o mais breve poss\u00edvel."
                      }
                    </Text>
                  </View>
                )}
              </View>

              {desktop && (
                <Text style={styles.rodapePagina}>
                  {"ORVENA \u00b7 GEST\u00c3O INTELIGENTE"}
                </Text>
              )}
            </ScrollView>
          </View>
        )}

      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  raiz: {
    flex: 1,
    backgroundColor: "#0B0C10",
  },

  bloqueio: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    elevation: 9999,
    backgroundColor: "#0B0C10",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },

  carregamento: {
    marginTop: 20,
    color: "#A2A8B3",
    fontSize: 13,
    textAlign: "center",
  },

  scrollManutencao: {
    flex: 1,
    width: "100%",
  },

  scrollConteudo: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 28,
  },

  scrollConteudoDesktop: {
    paddingTop: 100,
    paddingBottom: 70,
  },

  luzSuperior: {
    position: "absolute",
    top: -270,
    left: "50%",
    width: 700,
    height: 700,
    marginLeft: -350,
    borderRadius: 350,
    backgroundColor: "#171127",
    opacity: 0.45,
  },

  luzInferior: {
    position: "absolute",
    bottom: -450,
    right: -230,
    width: 650,
    height: 650,
    borderRadius: 325,
    backgroundColor: "#151022",
    opacity: 0.35,
  },

  cabecalhoDesktop: {
    position: "absolute",
    top: 34,
    left: 45,
    right: 45,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 2,
  },

  logoPequena: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
  },

  logoPequenaTexto: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },

  nomeCabecalho: {
    marginLeft: 11,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
  },

  statusCabecalho: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: "#3C324E",
    borderRadius: 999,
    backgroundColor: "#181421",
    paddingHorizontal: 15,
    paddingVertical: 10,
  },

  pontoStatus: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#F2BD6D",
  },

  statusCabecalhoTexto: {
    color: "#D0BDD7",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  card: {
    width: "100%",
    maxWidth: 460,
    alignItems: "center",
  },

  cardDesktop: {
    maxWidth: 660,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#383047",
    backgroundColor: "#15141D",
    overflow: "hidden",
  },

  linhaSuperior: {
    width: "100%",
    height: 4,
    backgroundColor: "#7C5CFF",
  },

  conteudo: {
    width: "100%",
    alignItems: "center",
  },

  conteudoDesktop: {
    paddingHorizontal: 64,
    paddingTop: 42,
    paddingBottom: 38,
  },

  logo: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
  },

  logoDesktop: {
    width: 78,
    height: 78,
    borderRadius: 24,
  },

  logoTexto: {
    color: "#FFFFFF",
    fontSize: 35,
    fontWeight: "900",
  },

  logoTextoDesktop: {
    fontSize: 37,
  },

  marca: {
    marginTop: 18,
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: 3,
  },

  marcaDesktop: {
    marginTop: 13,
    fontSize: 23,
  },

  etiqueta: {
    marginTop: 30,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#624824",
    backgroundColor: "#261E13",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  etiquetaDesktop: {
    marginTop: 27,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },

  pontoManutencao: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F4C678",
  },

  etiquetaTexto: {
    color: "#F4C678",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },

  titulo: {
    marginTop: 26,
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 34,
  },

  tituloDesktop: {
    marginTop: 25,
    fontSize: 34,
    lineHeight: 43,
    letterSpacing: -0.6,
  },

  mensagem: {
    marginTop: 15,
    color: "#A2A8B3",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 23,
  },

  mensagemDesktop: {
    marginTop: 17,
    fontSize: 15,
    lineHeight: 25,
    maxWidth: 450,
  },

  previsao: {
    marginTop: 27,
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#302A45",
    backgroundColor: "#171321",
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  previsaoDesktop: {
    marginTop: 30,
    flexDirection: "row",
    justifyContent: "flex-start",
    padding: 20,
    gap: 16,
    backgroundColor: "#201A2C",
    borderColor: "#433657",
  },

  iconeRelogio: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#4B3C64",
    backgroundColor: "#2D2341",
    alignItems: "center",
    justifyContent: "center",
  },

  relogioTexto: {
    color: "#BBA7FF",
    fontSize: 25,
    fontWeight: "900",
  },

  previsaoConteudo: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  previsaoConteudoDesktop: {
    flex: 1,
    width: "auto",
  },

  previsaoRotulo: {
    color: "#A894FF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
    textAlign: "center",
  },

  previsaoTexto: {
    marginTop: 9,
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },

  previsaoTextoDesktop: {
    fontSize: 23,
    marginTop: 6,
  },

  botao: {
    width: "100%",
    minHeight: 49,
    marginTop: 28,
    borderRadius: 14,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
  },

  botaoDesktop: {
    minHeight: 56,
    borderRadius: 15,
    marginTop: 24,
  },

  botaoDesativado: {
    opacity: 0.6,
  },

  botaoTexto: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  rodape: {
    marginTop: 16,
    color: "#707683",
    fontSize: 10,
    textAlign: "center",
    lineHeight: 17,
  },

  rodapeDesktop: {
    color: "#A6A1AE",
    fontSize: 13,
    marginTop: 18,
    lineHeight: 20,
  },

  rodapeCard: {
    width: "100%",
    minHeight: 60,
    borderTopWidth: 1,
    borderTopColor: "#302938",
    backgroundColor: "#121119",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    gap: 9,
  },

  pontoRodape: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#8D79D9",
  },

  rodapeCardTexto: {
    color: "#AAA3B2",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },

  rodapePagina: {
    marginTop: 28,
    color: "#817A8E",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textAlign: "center",
  },

  erro: {
    marginTop: 12,
    color: "#F5C99B",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 19,
  },
});