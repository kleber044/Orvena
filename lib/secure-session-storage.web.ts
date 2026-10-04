// Na web o Supabase usa o armazenamento padrão do navegador.
// O cofre nativo fica isolado neste arquivo para o export web não carregar o módulo do dispositivo.
export const armazenamentoSessaoSeguro = {
  getItem(_chave: string): Promise<string | null> {
    return Promise.resolve(null);
  },
  setItem(_chave: string, _valor: string): Promise<void> {
    return Promise.resolve();
  },
  removeItem(_chave: string): Promise<void> {
    return Promise.resolve();
  },
};
