import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

type Chamado = { id: string; assunto: string; status: "aberto" | "fechado"; fechado_por: "usuario" | "admin" | null; criado_em: string; atualizado_em: string; };
type IconName = React.ComponentProps<typeof Ionicons>["name"];
const C = { bg: "#09090F", card: "#15141E", cardSoft: "#1C1829", purple: "#7C5CFF", purpleLight: "#B09DFF", border: "#302B3D", white: "#FFFFFF", muted: "#A29DAD", green: "#57DDA2", red: "#FF8999" };
function Icon({ name, size = 20, color = C.white }: { name: IconName; size?: number; color?: string }) { return <Ionicons name={name} size={size} color={color} />; }
function dataHora(valor: string) { const data = new Date(valor); return Number.isNaN(data.getTime()) ? "" : data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }

export default function HistoricoSuporteScreen() {
 const { width } = useWindowDimensions();
 const isSmall = width < 390;
 const [chamados, setChamados] = useState<Chamado[]>([]);
 const [carregando, setCarregando] = useState(true);
 const [erro, setErro] = useState("");
 useFocusEffect(useCallback(() => { void carregar(); }, []));
 async function carregar() {
  try {
   setCarregando(true); setErro("");
   const { data: { user } } = await supabase.auth.getUser();
   if (!user) { router.replace("/login" as any); return; }
   const { data, error } = await supabase.from("suporte_chamados")
    .select("id, assunto, status, fechado_por, criado_em, atualizado_em")
    .eq("user_id", user.id).order("atualizado_em", { ascending: false }).limit(20);
   if (error) { console.log("Erro histórico suporte:", error); setErro("Não foi possível carregar seus atendimentos."); return; }
   setChamados((data || []) as Chamado[]);
  } catch (error) { console.log("Erro histórico suporte:", error); setErro("Não foi possível carregar o histórico."); }
  finally { setCarregando(false); }
 }
 function abrirChamado(id: string) { router.push({ pathname: "/suporte/chat/[id]", params: { id } } as any); }
 return (
  <SafeAreaView style={styles.safeArea}>
   <ScrollView style={styles.flex} contentContainerStyle={[styles.scroll, { paddingHorizontal: width >= 1050 ? 28 : isSmall ? 12 : 16 }]} showsVerticalScrollIndicator={false}>
    <View style={[styles.page, { maxWidth: 850 }]}>
     <View style={styles.header}>
      <Pressable style={styles.backButton} onPress={() => router.replace("/suporte" as any)} accessibilityRole="button" accessibilityLabel="Voltar para central de suporte"><Icon name="arrow-back" size={22} /></Pressable>
      <View style={styles.headerContent}><Text style={styles.eyebrow}>CENTRAL DE AJUDA</Text><Text style={styles.title}>Histórico de atendimentos</Text><Text style={styles.subtitle}>Consulte seus chamados abertos e encerrados em uma página exclusiva.</Text></View>
     </View>
     <View style={styles.historyHeader}>
      <View style={styles.historyHeaderText}><Text style={styles.sectionEyebrow}>SEUS ATENDIMENTOS</Text><Text style={styles.sectionTitle}>Meus chamados</Text><Text style={styles.sectionSubtitle}>{chamados.length} chamados recentes</Text></View>
      <Pressable style={styles.refreshButton} onPress={() => void carregar()} disabled={carregando} accessibilityRole="button" accessibilityLabel="Atualizar histórico">{carregando ? <ActivityIndicator size="small" color={C.purpleLight} /> : <><Icon name="refresh" size={17} color={C.purpleLight}/><Text style={styles.refreshText}>Atualizar</Text></>}</Pressable>
     </View>
              {/* ERRO */}

              {erro ? (
                <View style={styles.errorBox}>
                  <Icon
                    name="alert-circle-outline"
                    size={21}
                    color={C.red}
                  />

                  <View style={styles.errorContent}>
                    <Text style={styles.errorText}>
                      {erro}
                    </Text>

                    <Pressable
                      onPress={() => void carregar()}
                      style={styles.retryButton}
                    >
                      <Text style={styles.retryText}>
                        Tentar novamente
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {/* CARREGANDO */}

              {carregando ? (
                <View style={styles.loadingCard}>
                  <ActivityIndicator
                    size="large"
                    color={C.purple}
                  />

                  <Text style={styles.loadingText}>
                    Carregando seus atendimentos...
                  </Text>
                </View>
              ) : chamados.length === 0 ? (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIcon}>
                    <Icon
                      name="chatbubbles-outline"
                      size={31}
                      color={C.purpleLight}
                    />
                  </View>

                  <Text style={styles.emptyTitle}>
                    Nenhum atendimento ainda
                  </Text>

                  <Text style={styles.emptyText}>
                    Se precisar falar com nossa equipe,
                    use o botão de atendimento.
                  </Text>
                </View>
              ) : (
                <View style={styles.ticketsList}>
                  {chamados.map((chamado) => {
                    const aberto =
                      chamado.status === "aberto";

                    return (
                      <Pressable
                        key={chamado.id}
                        style={styles.ticketCard}
                        onPress={() =>
                          abrirChamado(chamado.id)
                        }
                        accessibilityRole="button"
                      >
                        <View style={styles.ticketTop}>
                          <View style={styles.ticketIcon}>
                            <Icon
                              name="chatbubble-ellipses-outline"
                              size={21}
                              color={C.purpleLight}
                            />
                          </View>

                          <View style={styles.ticketMain}>
                            <Text
                              style={styles.ticketTitle}
                              numberOfLines={2}
                            >
                              {chamado.assunto}
                            </Text>

                            <Text style={styles.ticketDate}>
                              Atualizado em{" "}
                              {dataHora(
                                chamado.atualizado_em
                              )}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.ticketBottom}>
                          <View
                            style={[
                              styles.statusBadge,
                              aberto
                                ? styles.statusOpen
                                : styles.statusClosed,
                            ]}
                          >
                            <View
                              style={[
                                styles.statusDot,
                                {
                                  backgroundColor: aberto
                                    ? C.green
                                    : C.muted,
                                },
                              ]}
                            />

                            <Text
                              style={[
                                styles.statusText,
                                {
                                  color: aberto
                                    ? C.green
                                    : C.muted,
                                },
                              ]}
                            >
                              {aberto
                                ? "Em aberto"
                                : "Fechado"}
                            </Text>
                          </View>

                          <View style={styles.openLink}>
                            <Text style={styles.openLinkText}>
                              Abrir conversa
                            </Text>

                            <Icon
                              name="arrow-forward"
                              size={16}
                              color={C.purpleLight}
                            />
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}

    </View>
   </ScrollView>
  </SafeAreaView>
 );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  safeArea: {
    flex: 1,
    backgroundColor: C.bg,
  },

  scroll: {
    flexGrow: 1,
    paddingTop: 20,
    paddingBottom: 50,
  },

  page: {
    width: "100%",
    maxWidth: 1220,
    alignSelf: "center",
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 22,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },

  headerContent: {
    flex: 1,
    minWidth: 0,
  },

  eyebrow: {
    color: C.purpleLight,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.3,
    marginBottom: 5,
  },

  title: {
    color: C.white,
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: -0.7,
  },

  subtitle: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 5,
  },

  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    padding: 20,
    borderRadius: 21,
    backgroundColor: "#1E172F",
    borderWidth: 1,
    borderColor: "#493769",
    marginBottom: 17,
  },

  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#322447",
    borderWidth: 1,
    borderColor: "#594484",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },

  heroContent: {
    flex: 1,
    minWidth: 0,
  },

  heroEyebrow: {
    color: C.purpleLight,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
  },

  heroTitle: {
    color: C.white,
    fontSize: 21,
    fontWeight: "800",
    lineHeight: 28,
    marginTop: 5,
  },

  heroText: {
    color: "#B6ACC8",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 6,
  },

  statsRow: {
    flexDirection: "row",
    gap: 9,
    marginBottom: 25,
  },

  statCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    padding: 12,
  },

  statTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },

  statValue: {
    color: C.white,
    fontSize: 21,
    fontWeight: "800",
  },

  statLabel: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 9,
  },

  columns: {
    gap: 20,
    flexDirection: "column",
  },

  columnsDesktop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  mainColumn: {
    flex: 1,
    minWidth: 0,
  },

  sideColumn: {
    width: "100%",
    gap: 15,
  },

  sideColumnDesktop: {
    width: 345,
    flexShrink: 0,
  },

  sectionHeader: {
    marginBottom: 13,
  },

  sectionEyebrow: {
    color: C.purpleLight,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },

  sectionTitle: {
    color: C.white,
    fontSize: 19,
    fontWeight: "800",
    marginTop: 5,
  },

  sectionSubtitle: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },

  faqCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    overflow: "hidden",
  },

  faqItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    paddingVertical: 17,
    minHeight: 66,
  },

  faqDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#2C2937",
  },

  faqIcon: {
    width: 39,
    height: 39,
    borderRadius: 12,
    backgroundColor: "#29213C",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },

  faqContent: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    minHeight: 39,
  },

  faqQuestion: {
    color: C.white,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 20,
  },

  faqAnswer: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 20,
    marginTop: 9,
  },

  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 10,
    marginTop: 28,
    marginBottom: 15,
  },

  historyHeaderText: {
    flex: 1,
    minWidth: 0,
  },

  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 12,
    minHeight: 39,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#45375E",
    backgroundColor: "#241C35",
    flexShrink: 0,
  },

  refreshText: {
    color: C.purpleLight,
    fontSize: 12,
    fontWeight: "800",
  },

  ticketsList: {
    gap: 10,
  },

  ticketCard: {
    borderRadius: 17,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    padding: 15,
  },

  ticketTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },

  ticketIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: "#29213C",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },

  ticketMain: {
    flex: 1,
    minWidth: 0,
  },

  ticketTitle: {
    color: C.white,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 20,
  },

  ticketDate: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },

  ticketBottom: {
    borderTopWidth: 1,
    borderTopColor: "#2C2937",
    marginTop: 14,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 30,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
  },

  statusOpen: {
    backgroundColor: "#12271D",
    borderColor: "#2D6045",
  },

  statusClosed: {
    backgroundColor: "#22222A",
    borderColor: "#3A3843",
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  statusText: {
    fontSize: 10,
    fontWeight: "800",
  },

  openLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
  },

  openLinkText: {
    color: C.purpleLight,
    fontSize: 11,
    fontWeight: "800",
  },

  supportCard: {
    backgroundColor: "#1A1527",
    borderWidth: 1,
    borderColor: "#48365F",
    borderRadius: 20,
    padding: 19,
  },

  supportIcon: {
    width: 53,
    height: 53,
    borderRadius: 16,
    backgroundColor: "#302445",
    borderWidth: 1,
    borderColor: "#4D3B72",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 17,
  },

  supportEyebrow: {
    color: C.purpleLight,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },

  supportTitle: {
    color: C.white,
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "800",
    marginTop: 7,
  },

  supportText: {
    color: "#AAA2B9",
    fontSize: 13,
    lineHeight: 21,
    marginTop: 9,
  },

  supportInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#251E38",
    borderRadius: 12,
    padding: 12,
    marginTop: 19,
  },

  supportInfoText: {
    flex: 1,
    color: "#B7ACCE",
    fontSize: 12,
    lineHeight: 19,
  },

  activeTicket: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 13,
    padding: 13,
    backgroundColor: "#11241B",
    borderWidth: 1,
    borderColor: "#28553F",
    marginTop: 19,
  },

  activeTicketIcon: {
    width: 35,
    height: 35,
    borderRadius: 11,
    backgroundColor: "#1C3728",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },

  activeTicketText: {
    flex: 1,
    minWidth: 0,
  },

  activeTicketLabel: {
    color: C.green,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  activeTicketTitle: {
    color: C.white,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 5,
  },

  supportButton: {
    minHeight: 54,
    backgroundColor: C.purple,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 19,
  },

  historyButton: {
    minHeight: 52,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#54416F",
    backgroundColor: "#261E39",
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  historyButtonText: {
    flex: 1,
    color: C.white,
    fontSize: 12,
    fontWeight: "800",
  },
  historyCount: {
    minWidth: 23,
    height: 23,
    paddingHorizontal: 5,
    borderRadius: 12,
    backgroundColor: "#45345E",
    alignItems: "center",
    justifyContent: "center",
  },
  historyCountText: {
    fontSize: 10,
    color: C.white,
    fontWeight: "800",
  },
  supportButtonText: {
    color: C.white,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
    flexShrink: 1,
  },

  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 16,
  },

  tipIcon: {
    width: 39,
    height: 39,
    borderRadius: 12,
    backgroundColor: "#29213C",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },

  tipContent: {
    flex: 1,
    minWidth: 0,
  },

  tipTitle: {
    color: C.white,
    fontSize: 13,
    fontWeight: "800",
  },

  tipText: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 6,
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#603440",
    backgroundColor: "#28161D",
    padding: 14,
    marginBottom: 12,
  },

  errorContent: {
    flex: 1,
    minWidth: 0,
  },

  errorText: {
    color: C.red,
    fontSize: 12,
    lineHeight: 19,
  },

  retryButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#3A222C",
    borderRadius: 9,
    marginTop: 10,
  },

  retryText: {
    color: C.red,
    fontSize: 12,
    fontWeight: "800",
  },

  loadingCard: {
    minHeight: 150,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
    gap: 13,
    padding: 20,
  },

  loadingText: {
    color: C.muted,
    fontSize: 12,
  },

  emptyCard: {
    borderRadius: 17,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    alignItems: "center",
    paddingVertical: 30,
    paddingHorizontal: 20,
  },

  emptyIcon: {
    width: 65,
    height: 65,
    borderRadius: 20,
    backgroundColor: "#29213C",
    justifyContent: "center",
    alignItems: "center",
  },

  emptyTitle: {
    color: C.white,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 16,
  },

  emptyText: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 260,
  },

  disabled: {
    opacity: 0.6,
  },

  footer: {
    color: "#777084",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textAlign: "center",
    marginTop: 42,
  },
});