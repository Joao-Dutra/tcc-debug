import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App';
// Fontes empacotadas no build, e não carregadas de fora (D13): a aplicação
// precisa funcionar com a máquina desconectada. Só o subconjunto latino de
// cada peso usado, que cobre o português inteiro.
import '@fontsource/zen-maru-gothic/latin-500.css';
import '@fontsource/zen-maru-gothic/latin-700.css';
import '@fontsource/atkinson-hyperlegible-mono/latin-400.css';
import '@fontsource/atkinson-hyperlegible-mono/latin-700.css';
import './index.css';
import { ativarEspelho } from './nucleo/metricas';
import { espelhoLocal } from './componentes/espelho-local';

// Antes da primeira tela: o que foi arquivado em outra carga da página volta
// ao arquivo em memória (D15).
ativarEspelho(espelhoLocal());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Quem pediu ao sistema menos movimento recebe as transições do desenho
        sem animação: o estado muda na hora, e nada do significado se perde. */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>
);
