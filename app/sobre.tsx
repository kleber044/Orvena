import Constants from "expo-constants";
import { router } from "expo-router";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function voltarConfiguracoes() {
  router.replace("/configuracoes" as any);
}

export default function SobreScreen() {
  const versao =
    Constants.expoConfig?.version ||
    Constants.manifest2?.extra?.expoClient?.version ||
    "desenvolvimento";

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.page}>
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={voltarConfiguracoes}>
              <Text style={styles.backText}>←</Text>
            </Pressable>

            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>ORVENA</Text>
              <Text style={styles.title}>Sobre o Orvena</Text>
              <Text style={styles.subtitle}>
                Informações do aplicativo e documentos importantes.
              </Text>
            </View>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>O</Text>
            </View>

            <View style={styles.heroMain}>
              <Text style={styles.heroTitle}>Orvena</Text>
              <Text style={styles.heroSubtitle}>Gestão inteligente</Text>

              <View style={styles.versionBadge}>
                <Text style={styles.versionText}>VERSÃO {versao}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>O que é o Orvena</Text>
            <Text style={styles.cardText}>
              O Orvena é uma plataforma de gestão para organizar clientes,
              obras, serviços, orçamentos, agenda, financeiro, relatórios e
              informações da empresa em um só lugar.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Conta e dados</Text>
            <Text style={styles.cardText}>
              Seus dados ficam vinculados à conta autenticada e são usados para
              fornecer os recursos do aplicativo. Informações de cartão são
              processadas pelo provedor de pagamentos e não ficam armazenadas
              integralmente no Orvena.
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Documentos e suporte</Text>

          <MenuRow
            icon="📄"
            title="Termos de Uso"
            subtitle="Condições de utilização do Orvena"
            onPress={() => router.push("/termos" as any)}
          />

          <MenuRow
            icon="🛡️"
            title="Política de Privacidade"
            subtitle="Como seus dados são tratados"
            onPress={() => router.push("/privacidade" as any)}
          />

          <MenuRow
            icon="💬"
            title="Ajuda e suporte"
            subtitle="Dúvidas frequentes e orientações"
            onPress={() => router.push("/suporte" as any)}
          />

          <View style={styles.footerCard}>
            <Text style={styles.footerTitle}>ORVENA</Text>
            <Text style={styles.footerText}>
              © 2026 Orvena. Todos os direitos reservados.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowIcon}>
        <Text style={styles.rowIconText}>{icon}</Text>
      </View>

      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>

      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B0C10",
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 50,
  },
  page: {
    width: "100%",
    maxWidth: 850,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 13,
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
    letterSpacing: 1.2,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "900",
    marginTop: 4,
  },
  subtitle: {
    color: "#777E89",
    fontSize: 10,
    marginTop: 4,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#302A53",
    backgroundColor: "#151326",
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    marginBottom: 14,
  },
  logo: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
  },
  heroMain: {
    flex: 1,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },
  heroSubtitle: {
    color: "#9A92C4",
    fontSize: 10,
    marginTop: 3,
  },
  versionBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4F4383",
    backgroundColor: "#211D35",
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 10,
  },
  versionText: {
    color: "#BDB1FF",
    fontSize: 8,
    fontWeight: "900",
  },
  card: {
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#292E37",
    backgroundColor: "#12151B",
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  cardText: {
    color: "#7D848F",
    fontSize: 9,
    lineHeight: 15,
    marginTop: 6,
  },
  sectionTitle: {
    color: "#777E89",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
    marginTop: 5,
    marginBottom: 8,
  },
  row: {
    minHeight: 72,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#292E37",
    backgroundColor: "#12151B",
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 9,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#1B1F26",
    borderWidth: 1,
    borderColor: "#303640",
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconText: {
    fontSize: 17,
  },
  rowMain: {
    flex: 1,
  },
  rowTitle: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  rowSubtitle: {
    color: "#737A85",
    fontSize: 8,
    marginTop: 4,
  },
  chevron: {
    color: "#6D7480",
    fontSize: 22,
    fontWeight: "700",
  },
  footerCard: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 20,
  },
  footerTitle: {
    color: "#7C5CFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  footerText: {
    color: "#5F6671",
    fontSize: 8,
    marginTop: 5,
  },
});
