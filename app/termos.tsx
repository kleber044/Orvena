import { router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function voltarSeguro() {
  router.replace("/configuracoes" as any);
}

export default function TermosScreen() {
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
              <Text style={styles.title}>Termos de Uso</Text>
              <Text style={styles.subtitle}>
                Condições para utilização da plataforma Orvena.
              </Text>
            </View>
          </View>

          <View style={styles.updatedBox}>
            <Text style={styles.updatedLabel}>ÚLTIMA ATUALIZAÇÃO</Text>
            <Text style={styles.updatedValue}>14 de setembro de 2026</Text>
          </View>

          <LegalSection title="1. Sobre o Orvena">
            O Orvena é uma plataforma de gestão voltada à organização de
            atividades profissionais e empresariais, incluindo recursos como
            clientes, obras, serviços, orçamentos, agenda, financeiro,
            relatórios e personalização de documentos.
          </LegalSection>

          <LegalSection title="2. Cadastro e conta">
            Para usar recursos que exigem autenticação, o usuário deve criar
            uma conta e fornecer informações verdadeiras e atualizadas. O
            acesso à conta é pessoal, e o usuário é responsável por manter suas
            credenciais protegidas.
          </LegalSection>

          <LegalSection title="3. Responsabilidade pelos dados cadastrados">
            O usuário é responsável pelas informações que inserir no Orvena,
            incluindo dados de clientes, obras, serviços, valores, agenda,
            documentos e informações da empresa. O usuário deve possuir base
            legítima para armazenar e utilizar dados de terceiros na
            plataforma.
          </LegalSection>

          <LegalSection title="4. Plano gratuito e Orvena Pro">
            O Orvena pode oferecer funcionalidades gratuitas e funcionalidades
            exclusivas do plano Pro. Recursos, limites, preço e condições do
            plano podem ser apresentados no próprio aplicativo antes da
            contratação.
          </LegalSection>

          <LegalSection title="5. Pagamentos">
            Pagamentos do Orvena Pro são processados por provedores externos de
            pagamento, atualmente o Mercado Pago. O Orvena não armazena o
            número completo do cartão nem o código de segurança do cartão.
          </LegalSection>

          <LegalSection title="6. Pix">
            Pagamentos por Pix liberam o período de acesso informado no momento
            da compra e não geram renovação automática. Para continuar com o
            plano após o vencimento, será necessário realizar uma nova
            renovação.
          </LegalSection>

          <LegalSection title="7. Cartão e renovação automática">
            Quando a opção de assinatura recorrente por cartão estiver
            disponível e for contratada, a renovação poderá ocorrer
            automaticamente conforme as condições exibidas antes da
            contratação. O usuário poderá solicitar o cancelamento da renovação
            automática pelos recursos disponibilizados no aplicativo.
          </LegalSection>

          <LegalSection title="8. Períodos gratuitos">
            Quando houver período gratuito, sua disponibilidade poderá ser
            limitada a uma utilização por conta. As condições aplicáveis serão
            informadas na tela de contratação.
          </LegalSection>

          <LegalSection title="9. Disponibilidade do serviço">
            Buscamos manter o Orvena disponível e funcional, mas podem ocorrer
            interrupções temporárias por manutenção, atualizações, falhas de
            rede, serviços de terceiros ou eventos fora do nosso controle.
          </LegalSection>

          <LegalSection title="10. Uso inadequado">
            É proibido utilizar o Orvena para atividades ilegais, fraudes,
            invasões, distribuição de conteúdo malicioso, tentativa de acesso
            não autorizado ou qualquer atividade que prejudique a plataforma,
            seus usuários ou terceiros.
          </LegalSection>

          <LegalSection title="11. Documentos e relatórios">
            Orçamentos, relatórios, PDFs e outros documentos gerados pelo
            Orvena são produzidos com base nos dados informados pelo próprio
            usuário. Cabe ao usuário revisar as informações antes de enviar,
            assinar ou utilizar esses documentos comercialmente.
          </LegalSection>

          <LegalSection title="12. Exclusão da conta">
            O usuário pode solicitar a exclusão da conta pelos recursos
            disponibilizados no Orvena. A solicitação poderá passar por análise
            antes da exclusão definitiva, inclusive para tratar obrigações
            administrativas, segurança, prevenção a fraude e registros que
            precisem ser preservados conforme a legislação aplicável.
          </LegalSection>

          <LegalSection title="13. Alterações">
            Estes Termos podem ser atualizados para acompanhar mudanças no
            produto, nos serviços ou em requisitos legais. Quando uma alteração
            relevante exigir nova aceitação, o Orvena poderá solicitar essa
            confirmação ao usuário.
          </LegalSection>

          <LegalSection title="14. Contato">
            Dúvidas relacionadas ao uso do Orvena, à conta ou a estes Termos
            devem ser encaminhadas pelos canais oficiais de suporte
            disponibilizados pela plataforma.
          </LegalSection>

          <Text style={styles.footer}>
            Ao utilizar o Orvena, você declara que leu e concorda com estes
            Termos de Uso.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LegalSection({
  title,
  children,
}: {
  title: string;
  children: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0B0C10" },
  scroll: { flexGrow: 1 },
  page: {
    width: "100%",
    maxWidth: 880,
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
  backText: { color: "#FFFFFF", fontSize: 23, fontWeight: "900" },
  headerText: { flex: 1 },
  eyebrow: {
    color: "#7C5CFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 29,
    fontWeight: "900",
    marginTop: 5,
  },
  subtitle: {
    color: "#7D848F",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },
  updatedBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#342D4D",
    backgroundColor: "#171321",
    padding: 14,
    marginBottom: 14,
  },
  updatedLabel: {
    color: "#9B87FF",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  updatedValue: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 5,
  },
  section: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#292E37",
    backgroundColor: "#12151B",
    padding: 17,
    marginBottom: 11,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  sectionText: {
    color: "#858C96",
    fontSize: 10,
    lineHeight: 17,
    marginTop: 7,
  },
  footer: {
    color: "#686F79",
    fontSize: 9,
    lineHeight: 15,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 12,
  },
});
