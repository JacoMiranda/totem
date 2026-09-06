import { describe, expect, it } from 'vitest';
import { codigoDoTotem, slugDaEmpresa } from './nomeTotem';

/**
 * Precisa bater com App\Services\NomeadorDeTotens (backend) - os casos aqui
 * são os mesmos do CadastroMultiTenantTest.
 */
describe('nomeTotem', () => {
  it('slug da empresa junta palavras e tira acento', () => {
    expect(slugDaEmpresa('Luiza Brok')).toBe('LuizaBrok');
    expect(slugDaEmpresa('Prefeitura de São Paulo')).toBe('PrefeituraDeSaoPaulo');
    expect(slugDaEmpresa('  ')).toBe('Organizacao');
  });

  it('código numera com dois dígitos', () => {
    expect(codigoDoTotem('Luiza Brok', 1)).toBe('LuizaBrok-01');
    expect(codigoDoTotem('Luiza Brok', 12)).toBe('LuizaBrok-12');
  });

  it('local entra no código sem acento', () => {
    expect(codigoDoTotem('Luiza Brok', 1, 'Recepção')).toBe('LuizaBrok-01-Recepcao');
    expect(codigoDoTotem('Luiza Brok', 2, 'Sala de Espera')).toBe('LuizaBrok-02-SalaDeEspera');
  });

  it('local vazio não vira sufixo solto', () => {
    expect(codigoDoTotem('Luiza Brok', 1, '   ')).toBe('LuizaBrok-01');
    expect(codigoDoTotem('Luiza Brok', 1, undefined)).toBe('LuizaBrok-01');
  });
});
