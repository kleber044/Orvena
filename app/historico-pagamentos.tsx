import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";

type Pagamento = {
  id: string;
  provider_payment_id: string | null;
  metodo: string | null;
  valor: number | string | null;
  moeda: string | null;
  status: string | null;
  criado_em: string | null;
  aprovado_em: string | null;
  dados_provider?: any;
};


function voltarSeguro() {
  router.replace("/plano" as any);
}

export default function HistoricoPagamentosScreen() {
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [redirecionandoLogin, setRedirecionandoLogin] = useState(false);
  const [erro, setErro] = useState("");

  const [selecionado, setSelecionado] = useState<Pagamento | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [mensagemModal, setMensagemModal] = useState("");

  useFocusEffect(
    useCallback(() => {
      void carregarPagamentos();
    }, [])
  );

  async function carregarPagamentos() {
    try {
      setCarregando(true);
      setErro("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setRedirecionandoLogin(true);
        router.replace("/login" as any);
        return;
      }

      const { data, error } = await supabase
        .from("pagamentos_orvena")
        .select(
          "id, provider_payment_id, metodo, valor, moeda, status, criado_em, aprovado_em, dados_provider"
        )
        .eq("user_id", user.id)
        .order("criado_em", { ascending: false });

      if (error) {
        console.log("Erro ao carregar pagamentos:", error);
        setErro("Não foi possível carregar seu histórico de pagamentos.");
        return;
      }

      setPagamentos((data || []) as Pagamento[]);
    } catch (error) {
      console.log("Erro ao carregar histórico de pagamentos:", error);
      setErro("Não foi possível carregar seu histórico de pagamentos.");
    } finally {
      setCarregando(false);
    }
  }

  const totalAprovado = useMemo(() => {
    return pagamentos
      .filter((item) => normalizarStatus(item.status) === "approved")
      .reduce((total, item) => total + Number(item.valor || 0), 0);
  }, [pagamentos]);

  const aprovados = useMemo(() => {
    return pagamentos.filter(
      (item) => normalizarStatus(item.status) === "approved"
    ).length;
  }, [pagamentos]);

  function abrirDetalhes(item: Pagamento) {
    setMensagemModal("");
    setSelecionado(item);
  }

  function fecharDetalhes() {
    if (consultando) return;
    setMensagemModal("");
    setSelecionado(null);
  }

  async function copiarPix() {
    const qrCode = obterQrCode(selecionado);

    if (!qrCode) {
      setMensagemModal("O código Pix não está disponível.");
      return;
    }

    try {
      if (
        Platform.OS === "web" &&
        typeof navigator !== "undefined" &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(qrCode);
      } else {
        await Clipboard.setStringAsync(qrCode);
      }

      setMensagemModal("Pix Copia e Cola copiado.");
    } catch (error) {
      console.log("Erro ao copiar Pix:", error);
      setMensagemModal(
        "Não foi possível copiar automaticamente. Selecione o código e copie manualmente."
      );
    }
  }

  async function verificarPagamento() {
    if (!selecionado?.provider_payment_id || consultando) return;

    try {
      setConsultando(true);
      setMensagemModal("");

      const { data, error } = await supabase.functions.invoke(
        "mercadopago-consultar-pix",
        {
          body: {
            payment_id: selecionado.provider_payment_id,
          },
        }
      );

      if (error || !data?.success) {
        setMensagemModal(
          data?.error ||
            error?.message ||
            "Não foi possível verificar o pagamento agora."
        );
        return;
      }

      const novoStatus = String(data.status || selecionado.status || "");

      const atualizado: Pagamento = {
        ...selecionado,
        status: novoStatus,
        aprovado_em:
          novoStatus === "approved"
            ? selecionado.aprovado_em || new Date().toISOString()
            : selecionado.aprovado_em,
      };

      setSelecionado(atualizado);

      setPagamentos((atuais) =>
        atuais.map((item) =>
          item.id === atualizado.id
            ? {
                ...item,
                status: atualizado.status,
                aprovado_em: atualizado.aprovado_em,
              }
            : item
        )
      );

      if (novoStatus === "approved") {
        setMensagemModal(
          "Pagamento aprovado. O comprovante já está disponível."
        );

        await supabase.rpc("sincronizar_plano_orvena");
      } else {
        setMensagemModal("O pagamento ainda está aguardando confirmação.");
      }

      void carregarPagamentos();
    } catch (error) {
      console.log("Erro ao verificar pagamento:", error);
      setMensagemModal("Não foi possível verificar o pagamento agora.");
    } finally {
      setConsultando(false);
    }
  }

  if (carregando || redirecionandoLogin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#7C5CFF" />
        </View>
      </SafeAreaView>
    );
  }

  const statusSelecionado = normalizarStatus(selecionado?.status);
  const selecionadoAprovado = statusSelecionado === "approved";
  const selecionadoPendente =
    statusSelecionado === "pending" ||
    statusSelecionado === "action_required";
  const selecionadoPix =
    String(selecionado?.metodo || "").toLowerCase() === "pix";

  const qrCode = obterQrCode(selecionado);
  const qrCodeBase64 = obterQrCodeBase64(selecionado);
  const ticketUrl = obterTicketUrl(selecionado);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.page}>
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={voltarSeguro}>
              <Text style={styles.backText}>←</Text>
            </Pressable>

            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>ORVENA</Text>
              <Text style={styles.title}>Histórico de pagamentos</Text>
              <Text style={styles.subtitle}>
                Consulte pagamentos, comprovantes e cobranças Pix pendentes.
              </Text>
            </View>
          </View>

          {erro ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{erro}</Text>

              <Pressable
                style={styles.retryButton}
                onPress={carregarPagamentos}
              >
                <Text style={styles.retryText}>TENTAR NOVAMENTE</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>PAGAMENTOS APROVADOS</Text>
              <Text style={styles.summaryValue}>{aprovados}</Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>TOTAL PAGO</Text>
              <Text style={styles.summaryValue}>
                {formatarMoeda(totalAprovado)}
              </Text>
            </View>
          </View>

          {pagamentos.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Text style={styles.emptyIconText}>$</Text>
              </View>

              <Text style={styles.emptyTitle}>
                Nenhum pagamento encontrado
              </Text>

              <Text style={styles.emptyText}>
                Quando você fizer um pagamento do Orvena Pro, ele aparecerá
                aqui.
              </Text>
            </View>
          ) : (
            <View style={styles.listCard}>
              <Text style={styles.sectionTitle}>Seus pagamentos</Text>

              {pagamentos.map((item, index) => {
                const status = normalizarStatus(item.status);
                const aprovado = status === "approved";
                const pendente =
                  status === "pending" || status === "action_required";
                const pix = String(item.metodo || "").toLowerCase() === "pix";

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.paymentRow,
                      index === pagamentos.length - 1 &&
                        styles.paymentRowLast,
                    ]}
                  >
                    <View
                      style={[
                        styles.methodIcon,
                        pix ? styles.methodIconPix : styles.methodIconCard,
                      ]}
                    >
                      <Text style={styles.methodIconText}>
                        {pix ? "◆" : "▣"}
                      </Text>
                    </View>

                    <View style={styles.paymentMain}>
                      <View style={styles.paymentTop}>
                        <View style={styles.paymentTitleArea}>
                          <Text style={styles.paymentTitle}>
                            {formatarMetodo(item.metodo)}
                          </Text>

                          <Text style={styles.paymentDate}>
                            {formatarDataHora(
                              item.aprovado_em || item.criado_em
                            )}
                          </Text>
                        </View>

                        <Text style={styles.paymentValue}>
                          {formatarMoeda(Number(item.valor || 0))}
                        </Text>
                      </View>

                      <View style={styles.paymentBottom}>
                        <View
                          style={[
                            styles.statusBadge,
                            aprovado
                              ? styles.statusApproved
                              : pendente
                                ? styles.statusPending
                                : styles.statusRejected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusText,
                              aprovado
                                ? styles.statusTextApproved
                                : pendente
                                  ? styles.statusTextPending
                                  : styles.statusTextRejected,
                            ]}
                          >
                            {traduzirStatus(status)}
                          </Text>
                        </View>

                        {item.provider_payment_id ? (
                          <Text style={styles.paymentId}>
                            ID {encurtarId(item.provider_payment_id)}
                          </Text>
                        ) : null}
                      </View>

                      <Pressable
                        style={[
                          styles.actionButton,
                          aprovado
                            ? styles.actionButtonApproved
                            : pendente && pix
                              ? styles.actionButtonPending
                              : styles.actionButtonNeutral,
                        ]}
                        onPress={() => abrirDetalhes(item)}
                      >
                        <Text
                          style={[
                            styles.actionButtonText,
                            aprovado
                              ? styles.actionButtonTextApproved
                              : pendente && pix
                                ? styles.actionButtonTextPending
                                : styles.actionButtonTextNeutral,
                          ]}
                        >
                          {aprovado
                            ? "VER COMPROVANTE"
                            : pendente && pix
                              ? "VER QR CODE / PAGAR"
                              : "VER DETALHES"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Sobre este histórico</Text>
            <Text style={styles.infoText}>
              Pagamentos aprovados exibem um comprovante interno do Orvena.
              Cobranças Pix pendentes exibem novamente o QR Code e o Pix Copia
              e Cola quando esses dados estiverem disponíveis.
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={Boolean(selecionado)}
        transparent
        animationType="fade"
        onRequestClose={fecharDetalhes}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScroll}
            >
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalEyebrow}>
                    {selecionadoAprovado
                      ? "PAGAMENTO CONFIRMADO"
                      : selecionadoPendente && selecionadoPix
                        ? "PIX PENDENTE"
                        : "DETALHES DO PAGAMENTO"}
                  </Text>

                  <Text style={styles.modalTitle}>
                    {selecionadoAprovado
                      ? "Comprovante de pagamento"
                      : selecionadoPendente && selecionadoPix
                        ? "Pagar com Pix"
                        : "Pagamento"}
                  </Text>
                </View>

                <Pressable
                  style={styles.modalClose}
                  onPress={fecharDetalhes}
                  disabled={consultando}
                >
                  <Text style={styles.modalCloseText}>×</Text>
                </Pressable>
              </View>

              {selecionadoAprovado ? (
                <>
                  <View style={styles.receiptSuccess}>
                    <View style={styles.receiptCheck}>
                      <Text style={styles.receiptCheckText}>✓</Text>
                    </View>
                    <Text style={styles.receiptSuccessTitle}>
                      Pagamento aprovado
                    </Text>
                    <Text style={styles.receiptSuccessText}>
                      Orvena Pro • pagamento processado pelo Mercado Pago
                    </Text>
                  </View>

                  <View style={styles.receiptCard}>
                    <ReceiptRow
                      label="Valor"
                      value={formatarMoeda(Number(selecionado?.valor || 0))}
                    />
                    <ReceiptRow
                      label="Forma de pagamento"
                      value={formatarMetodo(selecionado?.metodo)}
                    />
                    <ReceiptRow
                      label="Status"
                      value="APROVADO"
                    />
                    <ReceiptRow
                      label="Data da aprovação"
                      value={formatarDataHora(
                        selecionado?.aprovado_em || selecionado?.criado_em
                      )}
                    />
                    <ReceiptRow
                      label="Identificador"
                      value={selecionado?.provider_payment_id || "Não disponível"}
                      last
                    />
                  </View>

                  <Text style={styles.receiptNote}>
                    Este comprovante confirma o pagamento registrado no Orvena.
                    Ele não substitui documento fiscal quando houver obrigação
                    de emissão.
                  </Text>
                </>
              ) : selecionadoPendente && selecionadoPix ? (
                <>
                  {qrCodeBase64 ? (
                    <View style={styles.qrWrap}>
                      <Image
                        source={{
                          uri: `data:image/png;base64,${qrCodeBase64}`,
                        }}
                        style={styles.qrImage}
                        resizeMode="contain"
                      />
                    </View>
                  ) : (
                    <View style={styles.qrUnavailable}>
                      <Text style={styles.qrUnavailableTitle}>
                        QR Code não encontrado
                      </Text>
                      <Text style={styles.qrUnavailableText}>
                        Esta cobrança pode ter sido criada antes de o Orvena
                        salvar os dados do QR Code.
                      </Text>
                    </View>
                  )}

                  {qrCode ? (
                    <>
                      <Text style={styles.pixLabel}>PIX COPIA E COLA</Text>

                      <TextInput
                        value={qrCode}
                        editable={false}
                        multiline
                        selectTextOnFocus
                        style={styles.pixCode}
                      />

                      <Pressable
                        style={styles.copyButton}
                        onPress={copiarPix}
                      >
                        <Text style={styles.copyButtonText}>COPIAR PIX</Text>
                      </Pressable>
                    </>
                  ) : null}

                  {ticketUrl ? (
                    <Text style={styles.ticketHint}>
                      Os dados desta cobrança foram recuperados do registro
                      original do Mercado Pago.
                    </Text>
                  ) : null}

                  <Pressable
                    style={[
                      styles.verifyButton,
                      consultando && styles.disabledButton,
                    ]}
                    onPress={verificarPagamento}
                    disabled={consultando}
                  >
                    {consultando ? (
                      <>
                        <ActivityIndicator color="#FFFFFF" />
                        <Text style={styles.verifyButtonText}>
                          VERIFICANDO...
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.verifyButtonText}>
                        JÁ PAGUEI • VERIFICAR AGORA
                      </Text>
                    )}
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={styles.receiptCard}>
                    <ReceiptRow
                      label="Valor"
                      value={formatarMoeda(Number(selecionado?.valor || 0))}
                    />
                    <ReceiptRow
                      label="Forma de pagamento"
                      value={formatarMetodo(selecionado?.metodo)}
                    />
                    <ReceiptRow
                      label="Status"
                      value={traduzirStatus(statusSelecionado)}
                    />
                    <ReceiptRow
                      label="Data"
                      value={formatarDataHora(selecionado?.criado_em)}
                    />
                    <ReceiptRow
                      label="Identificador"
                      value={selecionado?.provider_payment_id || "Não disponível"}
                      last
                    />
                  </View>

                  {selecionadoPix &&
                  (statusSelecionado === "rejected" ||
                    statusSelecionado === "cancelled" ||
                    statusSelecionado === "canceled") ? (
                    <Pressable
                      style={styles.newPixButton}
                      onPress={() => {
                        fecharDetalhes();
                        router.push("/assinar-pro" as any);
                      }}
                    >
                      <Text style={styles.newPixButtonText}>
                        GERAR NOVO PIX
                      </Text>
                    </Pressable>
                  ) : null}
                </>
              )}

              {mensagemModal ? (
                <View
                  style={[
                    styles.modalMessage,
                    selecionadoAprovado
                      ? styles.modalMessageSuccess
                      : styles.modalMessageInfo,
                  ]}
                >
                  <Text style={styles.modalMessageText}>{mensagemModal}</Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ReceiptRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.receiptRow, last && styles.receiptRowLast]}>
      <Text style={styles.receiptLabel}>{label}</Text>
      <Text style={styles.receiptValue} selectable>
        {value}
      </Text>
    </View>
  );
}

function normalizarStatus(status?: string | null) {
  return String(status || "").trim().toLowerCase();
}

function traduzirStatus(status: string) {
  if (status === "approved") return "APROVADO";
  if (status === "pending" || status === "action_required") {
    return "EM PROCESSAMENTO";
  }
  if (status === "rejected") return "RECUSADO";
  if (status === "cancelled" || status === "canceled") return "CANCELADO";
  if (status === "refunded") return "REEMBOLSADO";

  return "EM ANÁLISE";
}

function formatarMetodo(metodo?: string | null) {
  const valor = String(metodo || "").toLowerCase();

  if (valor === "pix") return "Pix";
  if (valor.includes("card") || valor.includes("credit")) {
    return "Cartão de crédito";
  }

  return metodo || "Pagamento";
}

function formatarDataHora(valor?: string | null) {
  if (!valor) return "Data não disponível";

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return "Data não disponível";
  }

  return data.toLocaleString("pt-BR");
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function encurtarId(valor: string) {
  if (valor.length <= 18) return valor;
  return `${valor.slice(0, 8)}...${valor.slice(-6)}`;
}

function obterPagamentoProvider(item?: Pagamento | null) {
  const dados = item?.dados_provider;

  if (!dados || typeof dados !== "object") return null;

  if (Array.isArray(dados?.transactions?.payments)) {
    return dados.transactions.payments[0] || null;
  }

  return null;
}

function obterQrCode(item?: Pagamento | null) {
  const pagamento = obterPagamentoProvider(item);

  return String(
    pagamento?.payment_method?.qr_code ||
      item?.dados_provider?.point_of_interaction?.transaction_data?.qr_code ||
      ""
  );
}

function obterQrCodeBase64(item?: Pagamento | null) {
  const pagamento = obterPagamentoProvider(item);

  return String(
    pagamento?.payment_method?.qr_code_base64 ||
      item?.dados_provider?.point_of_interaction?.transaction_data
        ?.qr_code_base64 ||
      ""
  );
}

function obterTicketUrl(item?: Pagamento | null) {
  const pagamento = obterPagamentoProvider(item);

  return String(
    pagamento?.payment_method?.ticket_url ||
      item?.dados_provider?.point_of_interaction?.transaction_data?.ticket_url ||
      ""
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B0C10",
  },
  scroll: {
    flexGrow: 1,
    padding: 18,
    paddingVertical: 26,
  },
  page: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: "#8A919C",
    fontSize: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 22,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#13161C",
    borderWidth: 1,
    borderColor: "#292E37",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "800",
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    color: "#7C5CFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "900",
    marginTop: 5,
  },
  subtitle: {
    color: "#7D848F",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 15,
  },
  summaryCard: {
    flex: 1,
    minHeight: 100,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#292E37",
    backgroundColor: "#12151B",
    padding: 16,
    justifyContent: "center",
  },
  summaryLabel: {
    color: "#737A85",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  summaryValue: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "900",
    marginTop: 7,
  },
  listCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#292E37",
    backgroundColor: "#12151B",
    padding: 18,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 8,
  },
  paymentRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#242932",
  },
  paymentRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  methodIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  methodIconPix: {
    backgroundColor: "#12241D",
    borderWidth: 1,
    borderColor: "#2C6046",
  },
  methodIconCard: {
    backgroundColor: "#1B1730",
    borderWidth: 1,
    borderColor: "#4B3A81",
  },
  methodIconText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },
  paymentMain: {
    flex: 1,
  },
  paymentTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  paymentTitleArea: {
    flex: 1,
  },
  paymentTitle: {
    color: "#F2F3F5",
    fontSize: 13,
    fontWeight: "900",
  },
  paymentDate: {
    color: "#717883",
    fontSize: 9,
    marginTop: 4,
  },
  paymentValue: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  paymentBottom: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusApproved: {
    backgroundColor: "#101B17",
    borderColor: "#285A42",
  },
  statusPending: {
    backgroundColor: "#211C11",
    borderColor: "#594A27",
  },
  statusRejected: {
    backgroundColor: "#211217",
    borderColor: "#552C35",
  },
  statusText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  statusTextApproved: {
    color: "#76EAB3",
  },
  statusTextPending: {
    color: "#E0C272",
  },
  statusTextRejected: {
    color: "#FF8A93",
  },
  paymentId: {
    color: "#5F6671",
    fontSize: 8,
  },
  actionButton: {
    alignSelf: "flex-start",
    marginTop: 11,
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonApproved: {
    backgroundColor: "#112018",
    borderColor: "#315B47",
  },
  actionButtonPending: {
    backgroundColor: "#211C11",
    borderColor: "#594A27",
  },
  actionButtonNeutral: {
    backgroundColor: "#171A20",
    borderColor: "#353B45",
  },
  actionButtonText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.45,
  },
  actionButtonTextApproved: {
    color: "#76EAB3",
  },
  actionButtonTextPending: {
    color: "#E0C272",
  },
  actionButtonTextNeutral: {
    color: "#A4AAB4",
  },
  emptyCard: {
    minHeight: 250,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#292E37",
    backgroundColor: "#12151B",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: "#1B1730",
    borderWidth: 1,
    borderColor: "#4B3A81",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconText: {
    color: "#B6A8FF",
    fontSize: 21,
    fontWeight: "900",
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 15,
  },
  emptyText: {
    color: "#777E89",
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
    maxWidth: 350,
    marginTop: 7,
  },
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#292E37",
    backgroundColor: "#11141A",
    padding: 15,
    marginTop: 14,
  },
  infoTitle: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  infoText: {
    color: "#727984",
    fontSize: 9,
    lineHeight: 15,
    marginTop: 5,
  },
  errorBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#552C35",
    backgroundColor: "#211217",
    padding: 13,
    marginBottom: 15,
  },
  errorText: {
    color: "#FF8A93",
    fontSize: 10,
    lineHeight: 15,
  },
  retryButton: {
    alignSelf: "flex-start",
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: "#32212A",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryText: {
    color: "#FFAFB5",
    fontSize: 9,
    fontWeight: "900",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "88%",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#303640",
    backgroundColor: "#11141A",
    overflow: "hidden",
  },
  modalScroll: {
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 17,
  },
  modalEyebrow: {
    color: "#7C5CFF",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "900",
    marginTop: 4,
  },
  modalClose: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#1A1E25",
    borderWidth: 1,
    borderColor: "#303640",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: {
    color: "#FFFFFF",
    fontSize: 25,
    lineHeight: 28,
  },
  receiptSuccess: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#285A42",
    backgroundColor: "#101B17",
    padding: 18,
    marginBottom: 12,
  },
  receiptCheck: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#17472F",
    alignItems: "center",
    justifyContent: "center",
  },
  receiptCheckText: {
    color: "#76EAB3",
    fontSize: 23,
    fontWeight: "900",
  },
  receiptSuccessTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 10,
  },
  receiptSuccessText: {
    color: "#82A594",
    fontSize: 9,
    textAlign: "center",
    lineHeight: 14,
    marginTop: 4,
  },
  receiptCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#292E37",
    backgroundColor: "#0E1116",
    paddingHorizontal: 15,
  },
  receiptRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#242932",
  },
  receiptRowLast: {
    borderBottomWidth: 0,
  },
  receiptLabel: {
    color: "#6F7681",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  receiptValue: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 4,
  },
  receiptNote: {
    color: "#646B76",
    fontSize: 8,
    lineHeight: 13,
    marginTop: 11,
    textAlign: "center",
  },
  qrWrap: {
    alignSelf: "center",
    width: 230,
    height: 230,
    borderRadius: 18,
    padding: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  qrImage: {
    width: "100%",
    height: "100%",
  },
  qrUnavailable: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#594A27",
    backgroundColor: "#211C11",
    padding: 15,
    marginBottom: 14,
  },
  qrUnavailableTitle: {
    color: "#E0C272",
    fontSize: 11,
    fontWeight: "900",
  },
  qrUnavailableText: {
    color: "#A99768",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 5,
  },
  pixLabel: {
    color: "#9299A4",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 7,
  },
  pixCode: {
    minHeight: 90,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2B3039",
    backgroundColor: "#0D1015",
    color: "#FFFFFF",
    padding: 12,
    fontSize: 9,
    lineHeight: 14,
  },
  copyButton: {
    minHeight: 44,
    borderRadius: 13,
    backgroundColor: "#27213D",
    borderWidth: 1,
    borderColor: "#51428A",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  copyButtonText: {
    color: "#BFB2FF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  verifyButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  verifyButtonText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.45,
  },
  disabledButton: {
    opacity: 0.6,
  },
  ticketHint: {
    color: "#686F79",
    fontSize: 8,
    lineHeight: 13,
    marginTop: 9,
    textAlign: "center",
  },
  newPixButton: {
    minHeight: 46,
    borderRadius: 13,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 13,
  },
  newPixButtonText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  modalMessage: {
    borderRadius: 13,
    borderWidth: 1,
    padding: 11,
    marginTop: 12,
  },
  modalMessageSuccess: {
    backgroundColor: "#101B17",
    borderColor: "#285A42",
  },
  modalMessageInfo: {
    backgroundColor: "#171A20",
    borderColor: "#353B45",
  },
  modalMessageText: {
    color: "#C6CBD2",
    fontSize: 9,
    lineHeight: 14,
    textAlign: "center",
  },
});