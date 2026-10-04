import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { supabase } from "../lib/supabase";

export default function TesteManutencaoPix() {
  const [resultado, setResultado] = useState("Iniciando teste...");

  useEffect(() => {
    let ativo = true;

    async function testar() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          if (ativo) {
            setResultado(
              "TESTE CANCELADO: entre na sua conta antes de executar."
            );
          }
          return;
        }

        // CPF propositalmente vazio.
        // Com a manutencao ativada, o servidor deve retornar 503
        // antes de tentar validar o CPF ou criar qualquer pagamento.
        const { data, error } = await supabase.functions.invoke(
          "mercadopago-criar-pix",
          {
            body: { cpf: "" },
          }
        );

        if (!ativo) return;

        const status = error && "context" in error
          ? (error.context as Response)?.status
          : null;

        setResultado(
          JSON.stringify(
            {
              status_http: status,
              resposta: data,
              erro: error?.message ?? null,
            },
            null,
            2
          )
        );
      } catch (error) {
        if (ativo) {
          setResultado(
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    }

    void testar();

    return () => {
      ativo = false;
    };
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#0B0C10",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <Text
        style={{
          color: "#FFFFFF",
          fontSize: 22,
          fontWeight: "800",
          marginBottom: 20,
        }}
      >
        Teste de manutencao - Pix
      </Text>

      <ScrollView>
        <Text selectable style={{ color: "#FFFFFF", fontSize: 14 }}>
          {resultado}
        </Text>
      </ScrollView>

      {resultado === "Iniciando teste..." && (
        <ActivityIndicator color="#7C5CFF" />
      )}
    </View>
  );
}