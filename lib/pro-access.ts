import { supabase } from "./supabase";

export type ProAccessResult = {
  autenticado: boolean;
  temPro: boolean;
  plano: "free" | "trialing" | "pro";
  motivo?: string;
};

export async function verificarAcessoPro(): Promise<ProAccessResult> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        autenticado: false,
        temPro: false,
        plano: "free",
        motivo: "Sua sessão expirou. Entre novamente.",
      };
    }

    const { data, error } = await supabase.rpc(
      "verificar_acesso_pro_orvena"
    );

    if (error) {
      console.log("Erro ao verificar acesso Pro:", error.message);

      return {
        autenticado: true,
        temPro: false,
        plano: "free",
        motivo:
          "Não foi possível confirmar seu plano agora. Tente novamente.",
      };
    }

    const resultado =
      Array.isArray(data) && data.length > 0 ? data[0] : data;

    const temPro = Boolean(resultado?.tem_pro);
    const plano =
      resultado?.plano === "pro" || resultado?.plano === "trialing"
        ? resultado.plano
        : "free";

    return {
      autenticado: true,
      temPro,
      plano,
      motivo: temPro
        ? undefined
        : "Este recurso faz parte do Orvena Pro.",
    };
  } catch (error) {
    console.log("Erro inesperado ao verificar Pro:", error);

    return {
      autenticado: true,
      temPro: false,
      plano: "free",
      motivo:
        "Não foi possível confirmar seu plano agora. Tente novamente.",
    };
  }
}
