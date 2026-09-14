import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Fontes empacotadas no build, e não carregadas de fora (D13): a aplicação
// precisa funcionar com a máquina desconectada. Só o subconjunto latino de
// cada peso usado, que cobre o português inteiro.
import '@fontsource/space-grotesk/latin-400.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-600.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
