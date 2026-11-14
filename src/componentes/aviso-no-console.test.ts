import { describe, expect, it, vi } from 'vitest';
import { AVISO_NO_CONSOLE, avisarNoConsole } from './aviso-no-console';

describe('o recado no console (D41)', () => {
  it('diz que é pesquisa e que o que vai ao servidor fica registrado', () => {
    expect(AVISO_NO_CONSOLE).toMatch(/ambiente de pesquisa/);
    expect(AVISO_NO_CONSOLE).toMatch(/fica registrado/);
  });

  it('não entrega a isca nem os limites', () => {
    // Avisar onde está a isca a tornaria inútil (0006).
    expect(AVISO_NO_CONSOLE).not.toMatch(/obter_gabarito|suspeit|limite|isca/i);
  });

  it('sai uma vez, como informação, e não como erro', () => {
    const saida = { info: vi.fn() };
    avisarNoConsole(saida);
    expect(saida.info).toHaveBeenCalledTimes(1);
    expect(saida.info.mock.calls[0][0]).toContain(AVISO_NO_CONSOLE);
  });
});
