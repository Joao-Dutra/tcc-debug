import { useEffect, useRef } from 'react';
import fundo from '../arte/camada-1-fundo.webp';
import menino from '../arte/camada-2-menino.webp';
import joaninha from '../arte/camada-3-joaninha.webp';

/**
 * A cena do detetive e da joaninha, em três camadas (D43).
 *
 * É decoração da tela inicial.
 * Nunca entra na tela do exercício nem na área do estudo, que continuam como
 * estavam (D39).
 *
 * As camadas têm o mesmo enquadramento e ficam empilhadas. O que dá a
 * profundidade é cada uma se deslocar um pouco mais que a de trás quando o
 * ponteiro anda pela janela, e a cena inteira inclinar alguns graus na
 * direção dele. Na rolagem, as camadas da frente sobem mais depressa.
 *
 * O ponteiro e a rolagem escrevem em variáveis CSS do próprio elemento, e não
 * em estado do React: nenhum componente desenha de novo por causa do mouse, o
 * que importa nas máquinas do laboratório. Quem pediu menos movimento ao
 * sistema não recebe nem os ouvintes: a cena fica parada.
 */

/** O quanto a cena acompanha o ponteiro, de -1 a 1 em cada eixo. */
function posicaoDoPonteiro(evento: PointerEvent): { x: number; y: number } {
  return {
    x: (evento.clientX / window.innerWidth) * 2 - 1,
    y: (evento.clientY / window.innerHeight) * 2 - 1,
  };
}

export function CenaDoDetetive() {
  const cena = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const elemento = cena.current;
    if (!elemento) return;
    const menosMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Só ponteiro de precisão: no toque, o dedo que rola a página não é um
    // ponteiro passeando pela cena.
    const comMouse = window.matchMedia('(hover: hover) and (pointer: fine)');

    let pedido = 0;
    let x = 0;
    let y = 0;
    const aplicar = () => {
      pedido = 0;
      elemento.style.setProperty('--ponteiro-x', x.toFixed(3));
      elemento.style.setProperty('--ponteiro-y', y.toFixed(3));
      // Até uma tela de rolagem, e não mais: depois disso a cena já saiu.
      const rolagem = Math.min(window.scrollY / window.innerHeight, 1);
      elemento.style.setProperty('--rolagem', rolagem.toFixed(3));
    };
    // Um quadro por vez: o ponteiro dispara bem mais eventos do que a tela
    // consegue desenhar.
    const agendar = () => {
      if (pedido === 0) pedido = window.requestAnimationFrame(aplicar);
    };
    const aoMover = (evento: PointerEvent) => {
      ({ x, y } = posicaoDoPonteiro(evento));
      agendar();
    };

    const ligar = () => {
      desligar();
      if (menosMovimento.matches) return;
      window.addEventListener('scroll', agendar, { passive: true });
      if (comMouse.matches) window.addEventListener('pointermove', aoMover, { passive: true });
    };
    const desligar = () => {
      window.removeEventListener('scroll', agendar);
      window.removeEventListener('pointermove', aoMover);
      if (pedido !== 0) window.cancelAnimationFrame(pedido);
      pedido = 0;
      for (const nome of ['--ponteiro-x', '--ponteiro-y', '--rolagem']) elemento.style.removeProperty(nome);
    };

    ligar();
    // A preferência pode mudar com a página aberta.
    menosMovimento.addEventListener('change', ligar);
    return () => {
      menosMovimento.removeEventListener('change', ligar);
      desligar();
    };
  }, []);

  return (
    // Decoração: quem usa leitor de tela não perde nada sem ela.
    <div className="cena-do-detetive" ref={cena} aria-hidden="true">
      <div className="cena-palco">
        <img className="cena-camada cena-fundo" src={fundo} alt="" draggable={false} />
        <img className="cena-camada cena-menino" src={menino} alt="" draggable={false} />
        <img className="cena-camada cena-joaninha" src={joaninha} alt="" draggable={false} />
      </div>
    </div>
  );
}
