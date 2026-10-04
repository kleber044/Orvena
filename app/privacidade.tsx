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

export default function PrivacidadeScreen() {
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
              <Text style={styles.title}>Política de Privacidade</Text>
              <Text style={styles.subtitle}>
                Como as informações são utilizadas e protegidas no Orvena.
              </Text>
            </View>
          </View>

          <View style={styles.updatedBox}>
            <Text style={styles.updatedLabel}>ÚLTIMA ATUALIZAÇÃO</Text>
            <Text style={styles.updatedValue}>14 de setembro de 2026</Text>
          </View>

          <LegalSection title="1. Informações da conta">
            Para criar e manter uma conta, o Orvena pode tratar informações
            como nome, endereço de e-mail, identificador interno da conta,
            dados de autenticação e informações necessárias à segurança da
            sessão.
          </LegalSection>

          <LegalSection title="2. Informações da empresa">
            Caso o usuário configure sua empresa, poderão ser armazenados dados
            como nome fantasia, razão social, CPF ou CNPJ, telefone, e-mail,
            endereço, CEP e logotipo.
          </LegalSection>

          <LegalSection title="3. Dados inseridos pelo usuário">
            O Orvena armazena informações necessárias às funcionalidades
            utilizadas pelo usuário, como clientes, obras, serviços,
            orçamentos, agenda, lançamentos financeiros e dados utilizados em
            relatórios e documentos.
          </LegalSection>

          <LegalSection title="4. Pagamentos">
            Para administrar o plano Pro, o Orvena pode registrar informações
            de pagamento como método utilizado, valor, moeda, status,
            identificador da transação, datas de criação e aprovação e dados
            técnicos necessários à conciliação do pagamento.
          </LegalSection>

          <LegalSection title="5. Dados do cartão">
            O número completo do cartão e o código de segurança não são
            armazenados pelo Orvena. O processamento e a tokenização dos dados
            de cartão são realizados pelo provedor de pagamentos, atualmente o
            Mercado Pago.
          </LegalSection>

          <LegalSection title="6. Finalidades do tratamento">
            As informações são utilizadas para autenticar usuários, entregar
            as funcionalidades contratadas, salvar e sincronizar dados,
            processar pagamentos, controlar acesso ao plano Pro, prevenir
            abusos, prestar suporte, corrigir falhas e melhorar a segurança e a
            experiência da plataforma.
          </LegalSection>

          <LegalSection title="7. Compartilhamento com prestadores">
            Informações podem ser tratadas por prestadores necessários ao
            funcionamento do serviço, como infraestrutura de autenticação e
            banco de dados, processamento de pagamentos e serviços técnicos
            utilizados por funcionalidades específicas. O compartilhamento é
            limitado ao necessário para a execução dessas atividades.
          </LegalSection>

          <LegalSection title="8. Dados de terceiros">
            O usuário pode inserir informações de clientes ou outros terceiros
            no Orvena. Nesses casos, o próprio usuário é responsável por
            possuir uma base legítima para coletar, armazenar e utilizar essas
            informações.
          </LegalSection>

          <LegalSection title="9. Segurança">
            O Orvena utiliza mecanismos de autenticação, regras de acesso por
            usuário e controles no servidor para reduzir o risco de acesso não
            autorizado. Nenhum sistema é completamente imune a incidentes, mas
            adotamos medidas compatíveis com a natureza do serviço.
          </LegalSection>

          <LegalSection title="10. Retenção">
            Os dados são mantidos pelo tempo necessário à prestação do serviço,
            ao cumprimento de obrigações legais, à prevenção de fraude, à
            segurança e à defesa de direitos. Alguns registros administrativos
            podem precisar ser preservados mesmo após a exclusão da conta,
            quando houver fundamento legítimo ou obrigação legal.
          </LegalSection>

          <LegalSection title="11. Exclusão da conta">
            O usuário pode solicitar a exclusão da conta dentro do Orvena. A
            solicitação será analisada antes da exclusão definitiva. Durante a
            análise, a conta poderá permanecer ativa.
          </LegalSection>

          <LegalSection title="12. Direitos do titular">
            Conforme a legislação aplicável, o titular pode solicitar
            informações sobre seus dados e, quando cabível, correção,
            atualização, exclusão ou outras providências relacionadas ao
            tratamento de informações pessoais.
          </LegalSection>

          <LegalSection title="13. Cookies e armazenamento local">
            A versão web ou móvel do Orvena pode utilizar armazenamento local
            e tecnologias necessárias para manter sessão, preferências e
            funcionamento adequado do aplicativo.
          </LegalSection>

          <LegalSection title="14. Atualizações desta Política">
            Esta Política pode ser atualizada quando houver mudanças relevantes
            no produto, nos prestadores utilizados ou nas práticas de
            tratamento de dados. A data da versão atual será exibida nesta
            página.
          </LegalSection>

          <LegalSection title="15. Contato">
            Solicitações relacionadas à privacidade e proteção de dados devem
            ser enviadas pelos canais oficiais de suporte disponibilizados pelo
            Orvena.
          </LegalSection>

          <Text style={styles.footer}>
            Esta Política descreve as práticas gerais de privacidade do Orvena e
            deve permanecer compatível com o funcionamento real da plataforma.
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
