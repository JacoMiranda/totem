/**
 * Espelho client-side de App\Services\NomeadorDeTotens, usado APENAS para
 * pré-visualizar os nomes no formulário de cadastro ("Luiza Brok" + 3 totens
 * -> LuizaBrok-01...). Quem gera de verdade é o backend, na hora de criar os
 * dispositivos - aqui é só para o cliente enxergar o resultado antes de
 * enviar. Ao mexer nas regras, mexa nos dois.
 */

/** "Luiza Brok" -> "LuizaBrok"; "Prefeitura de São Paulo" -> "PrefeituraDeSaoPaulo". */
export function slugDaEmpresa(nome: string): string {
  const slug = palavras(nome).join('');

  return slug !== '' ? slug.slice(0, 40) : 'Organizacao';
}

/** Código do totem: `LuizaBrok-01` ou `LuizaBrok-01-Recepcao`. */
export function codigoDoTotem(nomeEmpresa: string, indice: number, local?: string): string {
  const sequencia = String(indice).padStart(2, '0');
  const sufixo = local?.trim() ? `-${palavras(local).join('')}` : '';

  return `${slugDaEmpresa(nomeEmpresa)}-${sequencia}${sufixo}`;
}

/** Divide em palavras, remove acentos e aplica Capitalização. */
function palavras(texto: string): string[] {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // marcas de acento separadas pelo NFD
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
}
