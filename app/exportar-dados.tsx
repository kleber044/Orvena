import * as FileSystem from "expo-file-system/legacy";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";

type Exportacao = Record<string, unknown>;


function voltarSeguro() {
  router.replace("/configuracoes" as any);
}

export default function ExportarDadosScreen() {
  const [exportando, setExportando] = useState(false);
  const [validandoSessao, setValidandoSessao] = useState(true);
  const [redirecionandoLogin, setRedirecionandoLogin] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  useEffect(() => {
    void validarSessao();
  }, []);

  async function validarSessao() {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        setRedirecionandoLogin(true);
        router.replace("/login" as any);
        return;
      }

      setValidandoSessao(false);
    } catch {
      setRedirecionandoLogin(true);
      router.replace("/login" as any);
    }
  }

  async function buscarTabela(
    tabela: string,
    colunaUsuario: string,
    userId: string
  ) {
    const { data, error } = await supabase
      .from(tabela)
      .select("*")
      .eq(colunaUsuario, userId);

    if (error) {
      console.log(`Erro ao exportar ${tabela}:`, error);
      throw new Error(`Falha ao consultar ${tabela}`);
    }

    return data || [];
  }

  async function exportar() {
    if (exportando) return;

    try {
      setExportando(true);
      setErro("");
      setSucesso("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login" as any);
        return;
      }

      const { data: perfil, error: perfilError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (perfilError) {
        console.log("Erro ao exportar perfil:", perfilError);
        throw new Error("Falha ao consultar profile");
      }

      const [
        empresas,
        clientes,
        obras,
        servicos,
        orcamentos,
        financeiro,
        agenda,
        pagamentos,
        solicitacoesExclusao,
      ] = await Promise.all([
        buscarTabela("empresas", "user_id", user.id),
        buscarTabela("clientes", "user_id", user.id),
        buscarTabela("obras", "user_id", user.id),
        buscarTabela("servicos", "user_id", user.id),
        buscarTabela("orcamentos", "user_id", user.id),
        buscarTabela("financeiro_lancamentos", "user_id", user.id),
        buscarTabela("agenda_eventos", "user_id", user.id),
        buscarTabela("pagamentos_orvena", "user_id", user.id),
        buscarTabela("solicitacoes_exclusao_conta", "user_id", user.id),
      ]);

      const idsOrcamentos = (orcamentos as any[])
        .map((item) => item?.id)
        .filter(Boolean);

      let itensOrcamentos: any[] = [];

      if (idsOrcamentos.length > 0) {
        const { data, error } = await supabase
          .from("orcamento_itens")
          .select("*")
          .in("orcamento_id", idsOrcamentos);

        if (error) {
          console.log("Erro ao exportar itens de orçamento:", error);
          throw new Error("Falha ao consultar itens de orçamento");
        }

        itensOrcamentos = data || [];
      }

      const exportacao: Exportacao = {
        orvena_exportacao: {
          versao: 1,
          gerado_em: new Date().toISOString(),
          conta: {
            id: user.id,
            email: user.email || null,
            criado_em: user.created_at || null,
          },
        },
        perfil: perfil || null,
        empresas,
        clientes,
        obras,
        servicos,
        orcamentos,
        orcamento_itens: itensOrcamentos,
        financeiro_lancamentos: financeiro,
        agenda_eventos: agenda,
        pagamentos_orvena: pagamentos,
        solicitacoes_exclusao_conta: solicitacoesExclusao,
      };

      const conteudo = JSON.stringify(exportacao, null, 2);
      const nomeArquivo = `orvena-meus-dados-${formatarDataArquivo(
        new Date()
      )}.json`;

      if (Platform.OS === "web") {
        baixarNoNavegador(nomeArquivo, conteudo);
      } else {
        const diretorio = FileSystem.cacheDirectory;

        if (!diretorio) {
          throw new Error("Diretório temporário indisponível");
        }

        const caminho = `${diretorio}${nomeArquivo}`;

        await FileSystem.writeAsStringAsync(caminho, conteudo, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        const disponivel = await Sharing.isAvailableAsync();

        if (!disponivel) {
          throw new Error("Compartilhamento indisponível");
        }

        await Sharing.shareAsync(caminho, {
          mimeType: "application/json",
          dialogTitle: "Exportar meus dados do Orvena",
          UTI: "public.json",
        });
      }

      setSucesso(
        "Cópia dos seus dados gerada com sucesso. Guarde o arquivo em um local seguro."
      );
    } catch (error) {
      console.log("Erro ao exportar dados:", error);
      setErro(
        "Não foi possível gerar uma cópia completa dos seus dados. Tente novamente."
      );
    } finally {
      setExportando(false);
    }
  }

  if (validandoSessao || redirecionandoLogin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.authLoading}>
          <ActivityIndicator size="large" color="#7C5CFF" />
        </View>
      </SafeAreaView>
    );
  }

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
              <Text style={styles.eyebrow}>CONTA E PRIVACIDADE</Text>
              <Text style={styles.title}>Exportar meus dados</Text>
              <Text style={styles.subtitle}>
                Gere uma cópia das informações vinculadas à sua conta.
              </Text>
            </View>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <Text style={styles.heroIconText}>↓</Text>
            </View>

            <View style={styles.heroMain}>
              <Text style={styles.heroTitle}>Sua cópia de dados</Text>
              <Text style={styles.heroText}>
                O arquivo é gerado em formato JSON e pode conter informações
                pessoais e comerciais.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>O que será incluído</Text>

            <DataRow text="Dados básicos da conta e perfil" />
            <DataRow text="Dados da empresa" />
            <DataRow text="Clientes, obras e serviços" />
            <DataRow text="Orçamentos e itens dos orçamentos" />
            <DataRow text="Agenda e lançamentos financeiros" />
            <DataRow text="Histórico de pagamentos registrado no Orvena" />
            <DataRow text="Solicitações de exclusão vinculadas à conta" />
          </View>

          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Arquivo confidencial</Text>
            <Text style={styles.warningText}>
              O arquivo pode conter nomes, contatos, valores e outras
              informações privadas. Não envie essa cópia para pessoas ou
              serviços em que você não confia.
            </Text>
          </View>

          {erro ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{erro}</Text>
            </View>
          ) : null}

          {sucesso ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{sucesso}</Text>
            </View>
          ) : null}

          <Pressable
            style={[
              styles.primaryButton,
              exportando && styles.primaryButtonDisabled,
            ]}
            onPress={exportar}
            disabled={exportando}
          >
            {exportando ? (
              <>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>
                  GERANDO SUA CÓPIA...
                </Text>
              </>
            ) : (
              <Text style={styles.primaryButtonText}>
                EXPORTAR MEUS DADOS
              </Text>
            )}
          </Pressable>

          <Text style={styles.footer}>
            A exportação não exclui nem altera os dados salvos no Orvena.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DataRow({ text }: { text: string }) {
  return (
    <View style={styles.dataRow}>
      <View style={styles.checkCircle}>
        <Text style={styles.checkText}>✓</Text>
      </View>
      <Text style={styles.dataText}>{text}</Text>
    </View>
  );
}

function formatarDataArquivo(data: Date) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  const hora = String(data.getHours()).padStart(2, "0");
  const minuto = String(data.getMinutes()).padStart(2, "0");

  return `${ano}-${mes}-${dia}-${hora}${minuto}`;
}

function baixarNoNavegador(nomeArquivo: string, conteudo: string) {
  if (typeof document === "undefined") {
    throw new Error("Navegador indisponível");
  }

  const blob = new Blob([conteudo], {
    type: "application/json;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = nomeArquivo;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

const styles = StyleSheet.create({
  authLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B0C10",
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#0B0C10",
  },
  scroll: {
    flexGrow: 1,
  },
  page: {
    width: "100%",
    maxWidth: 780,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 54,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#292E37",
    backgroundColor: "#13161C",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    color: "#7C5CFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.25,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 5,
  },
  subtitle: {
    color: "#7D848F",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#342D4D",
    backgroundColor: "#171321",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginBottom: 13,
  },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
  },
  heroIconText: {
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "900",
  },
  heroMain: {
    flex: 1,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  heroText: {
    color: "#958BAE",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  card: {
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#292E37",
    backgroundColor: "#12151B",
    padding: 17,
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 8,
  },
  dataRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 7,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#171F1B",
    borderWidth: 1,
    borderColor: "#315B47",
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: {
    color: "#76EAB3",
    fontSize: 10,
    fontWeight: "900",
  },
  dataText: {
    flex: 1,
    color: "#858C96",
    fontSize: 10,
    lineHeight: 15,
  },
  warningCard: {
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#594A27",
    backgroundColor: "#211C11",
    padding: 15,
    marginTop: 12,
  },
  warningTitle: {
    color: "#E0C272",
    fontSize: 11,
    fontWeight: "900",
  },
  warningText: {
    color: "#A89769",
    fontSize: 9,
    lineHeight: 15,
    marginTop: 5,
  },
  errorBox: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#552C35",
    backgroundColor: "#211217",
    padding: 13,
    marginTop: 12,
  },
  errorText: {
    color: "#FF9098",
    fontSize: 10,
    lineHeight: 15,
  },
  successBox: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#285A42",
    backgroundColor: "#101B17",
    padding: 13,
    marginTop: 12,
  },
  successText: {
    color: "#76EAB3",
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "800",
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: "#7C5CFF",
    marginTop: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    paddingHorizontal: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.55,
  },
  footer: {
    color: "#626973",
    fontSize: 9,
    lineHeight: 14,
    textAlign: "center",
    marginTop: 11,
  },
});