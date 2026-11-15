<div align="center">

# RANGO RARO

Plataforma web de gamificação e delivery baseada em caixas probabilísticas de alimentos, conversão de prêmios em saldo digital e resgate via PIX (Demonstrativo).

<br />

<a href="https://gerlachsg.github.io/rangoraro/src/pages/index">
  <img src="https://img.shields.io/badge/ACESSAR_APLICA%C3%87%C3%83O-FF5722?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Acessar Aplicação" />
</a>

<br /><br />

<img src="https://img.shields.io/badge/JavaScript-ES6+-18181B?style=flat-square&logo=javascript&logoColor=F7DF1E" alt="JavaScript" />
<img src="https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white" alt="HTML5" />
<img src="https://img.shields.io/badge/CSS3-3D_Transforms-1572B6?style=flat-square&logo=css3&logoColor=white" alt="CSS3" />
<img src="https://img.shields.io/badge/Firebase-Firestore_%26_Auth-18181B?style=flat-square&logo=firebase&logoColor=FFCA28" alt="Firebase" />
<img src="https://img.shields.io/badge/Python-Drop_Rates-18181B?style=flat-square&logo=python&logoColor=3776AB" alt="Python" />

<br /><br />

<img src="./docs/gifs/hero-showcase.gif" alt="Demonstração principal do Rango Raro" width="100%" />

</div>

<hr />

<h2>Créditos e Autoria</h2>

<table>
  <thead>
    <tr>
      <th align="left">Desenvolvedor</th>
      <th align="left">Perfil</th>
      <th align="left">Responsabilidades</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Eduardo Augusto Miranda Junior</strong></td>
      <td><a href="https://github.com/eduardoamjunior">@eduardoamjunior</a></td>
      <td>Arte original no Figma, UI/UX design e desenvolvimento da interface e mecânica visual do sistema de cassino</td>
    </tr>
    <tr>
      <td><strong>Igor Costa Gerlach</strong></td>
      <td><a href="https://github.com/gerlachsg">@gerlachsg</a></td>
      <td>Lógica funcional do cassino, regras de sorteio e integração com o banco de dados</td>
    </tr>
  </tbody>
</table>

<hr />

<h2>Visão Geral</h2>

<p>
  O <strong>Rango Raro</strong> aplica mecânicas de <em>loot boxes</em> ao universo gastronômico. O usuário adquire caixas temáticas com diferentes faixas de risco e retorno, realiza a abertura animada na interface e recebe itens classificados por nível de raridade. Os itens obtidos podem ser convertidos diretamente em saldo na carteira da plataforma para solicitação de saque via PIX.
</p>

<h3>Principais Funcionalidades</h3>

<ul>
  <li><strong>Sistema de Caixas Probabilísticas:</strong> Sorteio ponderado por <em>drop rates</em> definidos por tier de raridade, com roleta horizontal animada e efeitos 3D (<em>tilt</em> e perspectiva CSS).</li>
  <li><strong>Carteira Digital e Resgate PIX:</strong> Conversão instantânea dos itens sorteados em saldo e fluxo de solicitação de transferência via chave PIX.</li>
  <li><strong>Autenticação e Persistência:</strong> Login integrado com Google via Firebase Authentication e sincronização em tempo real de inventário, histórico de aberturas e saldo no Cloud Firestore.</li>
  <li><strong>Suporte Integrado:</strong> Widget flutuante embutido com FAQ dinâmico e chat de atendimento persistido no Firestore.</li>
  <li><strong>Entrega Otimizada de Mídia:</strong> Ativos visuais das caixas e itens servidos via GitHub CDN para reduzir latência de carregamento.</li>
</ul>

<hr />

<h2>Demonstração</h2>

<table>
  <tr>
    <td width="50%" align="center">
      <img src="./docs/gifs/abertura-caixa.gif" alt="Abertura de Caixa" width="100%" />
      <br />
      <sub><strong>Abertura de Caixa e Roleta</strong> — Animação de sorteio e revelação de raridade</sub>
    </td>
    <td width="50%" align="center">
      <img src="./docs/gifs/carteira-pix.gif" alt="Carteira e Saque PIX" width="100%" />
      <br />
      <sub><strong>Carteira e Resgate</strong> — Conversão de itens em saldo e solicitação PIX</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="./docs/gifs/inventario-historico.gif" alt="Inventário e Histórico" width="100%" />
      <br />
      <sub><strong>Inventário e Histórico</strong> — Registro persistente de drops por usuário</sub>
    </td>
    <td width="50%" align="center">
      <img src="./docs/gifs/suporte-chat.gif" alt="Widget de Suporte" width="100%" />
      <br />
      <sub><strong>Central de Suporte</strong> — Chat em tempo real e FAQ integrado</sub>
    </td>
  </tr>
</table>

<hr />

<h2>Arquitetura e Stack Tecnológica</h2>

<table>
  <thead>
    <tr>
      <th align="left">Camada</th>
      <th align="left">Tecnologia</th>
      <th align="left">Responsabilidade</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Frontend</strong></td>
      <td>HTML5, CSS3, JavaScript</td>
      <td>Interface responsiva, animações 3D, lógica da roleta e widget de chat</td>
    </tr>
    <tr>
      <td><strong>Backend / BaaS</strong></td>
      <td>Firebase Firestore &amp; Auth</td>
      <td>Autenticação Google, armazenamento de usuários, saldos, saques e mensagens</td>
    </tr>
    <tr>
      <td><strong>Data &amp; Balanceamento</strong></td>
      <td>Python</td>
      <td>Modelagem matemática das probabilidades, validação de RTP e carga de dados</td>
    </tr>
    <tr>
      <td><strong>CDN</strong></td>
      <td>GitHub Raw / Pages</td>
      <td>Hospedagem estática otimizada dos ícones e ilustrações dos rangos</td>
    </tr>
  </tbody>
</table>

<hr />

<h2>Estrutura de Coleções (Firestore)</h2>

<pre><code>firestore/
├── users/          # Perfil, saldo atual, chave PIX e histórico de drops
├── boxes/          # Catálogo de caixas, preços e pools de itens vinculados
├── withdrawals/    # Solicitações de saque PIX e status de processamento
└── support_chats/  # Sessões de atendimento e histórico de mensagens do widget</code></pre>
