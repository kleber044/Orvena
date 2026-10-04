import { router, useSegments } from "expo-router";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  VERSAO_PRIVACIDADE,
  VERSAO_TERMOS,
} from "../../lib/termos-versoes";

// Rotas em que NÃO exige login.
const ROTAS_PUBLICAS = new Set([
  "",
  "index",
  "login",
  "cadastro",
  "verificar-email",
  "recuperar-senha",
  "alterar-senha",
  "termos",
  "privacidade",
  "+not-found",
]);

// Rotas em que NÃO faz sentido verificar aceite de termos.
// ATENÇÃO: "" e "index" NÃO entram aqui — a home precisa ser verificada.
const ROTAS_SEM_ACEITE = new Set([
  "login",
  "cadastro",
  "verificar-email",
  "recuperar-senha",
  "alterar-senha",
  "termos",
  "privacidade",
  "aceitar-termos",
  "+not-found",
]);

const ROTA_ACEITE = "aceitar-termos";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const segments = useSegments();

  const [autenticado, setAutenticado] = useState<boolean | null>(null);
  const [precisaAceitar, setPrecisaAceitar] = useState<boolean | null>(null);
  const [tick, setTick] = useState(0);

  const verificadoRef = useRef<string | null>(null);
  const rotaAnteriorRef = useRef<string>("");

  const rotaAtual = useMemo(
    () => String(segments?.[0] ?? ""),
    [segments]
  );
  const ehRotaAceite = rotaAtual === ROTA_ACEITE;
  const ehRotaPublica = ROTAS_PUBLICAS.has(rotaAtual);
  const naoVerifica = ROTAS_SEM_ACEITE.has(rotaAtual);

  console.log(
    "[AG] rota:", JSON.stringify(rotaAtual),
    "| autenticado:", autenticado,
    "| precisaAceitar:", precisaAceitar,
    "| naoVerifica:", naoVerifica
  );

  // Detecta saída da tela de aceite → re-verifica
  useEffect(() => {
    const anterior = rotaAnteriorRef.current;
    rotaAnteriorRef.current = rotaAtual;

    if (anterior === ROTA_ACEITE && rotaAtual !== ROTA_ACEITE) {
      console.log("[AG] saiu de /aceitar-termos, re-verificando...");
      verificadoRef.current = null;
      setPrecisaAceitar(null);
      setTick((t) => t + 1);
    }
  }, [rotaAtual]);

  // Checa autenticação
  useEffect(() => {
    let ativo = true;

    async function checarSessao() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!ativo) return;
        if (error || !user) {
          console.log("[AG] sem usuário autenticado");
          setAutenticado(false);
          verificadoRef.current = null;
          setPrecisaAceitar(null);
        } else {
          console.log("[AG] usuário autenticado:", user.id);
          setAutenticado(true);
        }
      } catch (e) {
        if (!ativo) return;
        console.log("[AG] erro checando sessão:", e);
        setAutenticado(false);
      }
    }

    void checarSessao();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!ativo) return;
        if (!session?.user) {
          setAutenticado(false);
          verificadoRef.current = null;
          setPrecisaAceitar(null);
        } else {
          setAutenticado(true);
        }
      }
    );

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

  // Verifica aceite quando autenticado
  useEffect(() => {
    if (autenticado !== true) return;
    if (naoVerifica) {
      console.log("[AG] rota em ROTAS_SEM_ACEITE, pulando verificação");
      return;
    }

    let ativo = true;

    async function checarAceite() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!ativo || !user) return;

        if (verificadoRef.current === user.id) {
          console.log("[AG] aceite já verificado para este usuário");
          return;
        }

        console.log("[AG] consultando tabela termos_aceites...");
        const { data, error } = await supabase
          .from("termos_aceites")
          .select("versao_termos, versao_privacidade")
          .eq("user_id", user.id)
          .order("aceito_em", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!ativo) return;

        if (error) {
          console.log("[AG] erro consultando aceite:", error.message);
          setPrecisaAceitar(true);
          verificadoRef.current = user.id;
          return;
        }

        const ok =
          !!data &&
          data.versao_termos === VERSAO_TERMOS &&
          data.versao_privacidade === VERSAO_PRIVACIDADE;

        console.log(
          "[AG] aceite no banco:", JSON.stringify(data),
          "| esperado:", VERSAO_TERMOS, "/", VERSAO_PRIVACIDADE,
          "| OK:", ok
        );

        setPrecisaAceitar(!ok);
        verificadoRef.current = user.id;
      } catch (e) {
        if (!ativo) return;
        console.log("[AG] exceção checando aceite:", e);
        setPrecisaAceitar(true);
      }
    }

    void checarAceite();

    return () => { ativo = false; };
  }, [autenticado, naoVerifica, tick]);

  // Redirecionamentos
  useEffect(() => {
    if (autenticado === null) return;

    // Não logado em rota protegida → login
    if (autenticado === false && !ehRotaPublica) {
      console.log("[AG] → redirecionando para /login");
      router.replace("/login" as any);
      return;
    }

    // Logado, precisa aceitar, não está na tela de aceite
    if (
      autenticado === true &&
      precisaAceitar === true &&
      !ehRotaAceite
    ) {
      console.log("[AG] → redirecionando para /aceitar-termos");
      router.replace("/aceitar-termos" as any);
      return;
    }
  }, [autenticado, precisaAceitar, ehRotaPublica, ehRotaAceite]);

  return <>{children}</>;
}