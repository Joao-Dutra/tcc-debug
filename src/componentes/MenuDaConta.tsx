import { rotasDoPapel } from './rotas-do-papel';
import { useIdentidade } from './usar-identidade';

/**
 * O menu das rotas do papel (D39), no cabeçalho, depois do login.
 *
 * Só conveniência: o professor vê a autoria; o pesquisador, o painel de
 * controle, as métricas e o mapa de rotas. O participante não vê nada — nem
 * o anônimo, nem a conta ainda sem papel. Quem barra o acesso continua sendo
 * o banco, por papel.
 */
export function MenuDaConta() {
  const identidade = useIdentidade();
  const rotas = rotasDoPapel(identidade);
  if (rotas.length === 0) return null;
  const aqui = typeof window === 'undefined' ? '' : window.location.hash;
  return (
    <nav className="menu-da-conta" aria-label="Suas áreas">
      <ul>
        {rotas.map((r) => (
          <li key={r.caminho}>
            <a href={r.caminho} aria-current={aqui === r.caminho ? 'page' : undefined}>
              {r.rotulo}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
