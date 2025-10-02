// js/recentes.js
/**
 * Sistema de Ganhos Recentes - RangoRaro
 * 
 * Este arquivo gerencia:
 * 1. Registro de ganhos na página de Trocas quando alguém ganha pelo botão "Girar"
 * 2. Sincronização em tempo real dos ganhos recentes no index.html
 * 3. Exibição dos cards com imagem do item, perfil do usuário, nome e preço
 */

// --- CONFIGURAÇÕES ---
if (typeof window.__RANGO_MAX_RECENT_ITEMS === 'undefined') {
    window.__RANGO_MAX_RECENT_ITEMS = 6; // Número máximo de itens recentes a exibir
}
if (typeof window.__RANGO_RECENT_ITEMS_COLLECTION === 'undefined') {
    window.__RANGO_RECENT_ITEMS_COLLECTION = 'ganhosRecentes';
}
const MAX_RECENT_ITEMS = window.__RANGO_MAX_RECENT_ITEMS;
const RECENT_ITEMS_COLLECTION = window.__RANGO_RECENT_ITEMS_COLLECTION;

// --- ELEMENTOS DOM ---
let recentesContainer = null;
// Unsubscribe functions for Firestore listeners
let unsubscribeRecentes = null;
let unsubscribeTrocas = null;

// Caches locais para os snapshots
let _latestRecentes = [];
let _latestTrocas = [];

/**
 * Inicializa o sistema de recentes
 * Deve ser chamada quando a página carrega
 */
function initRecentes() {
    // Busca o container de recentes no DOM
    recentesContainer = document.querySelector('.recentes');

    if (recentesContainer) {
        // Se estamos no index.html, inicia o listener para ganhos recentes
        listenToRecentWins();
        console.log('Sistema de Recentes inicializado no index.html');
    }

    console.log('Sistema de Recentes carregado');
}

/**
 * Registra um ganho no banco de dados
 * Chamada quando alguém ganha na página de Trocas (botão Girar)
 * 
 * @param {Object} item - O item ganho
 * @param {string} item.id - ID do item
 * @param {string} item.name - Nome do item
 * @param {number} item.price - Preço do item
 * @param {string} item.image - URL da imagem do item
 */
// js/recentes.js

async function registrarGanho(item) {
    try {
        // Verifica se o Firebase e as Functions estão disponíveis
        if (typeof firebase === 'undefined' || typeof firebase.functions === 'undefined') {
            console.error('Firebase Functions não está disponível.');
            return;
        }

        // Prepara uma chamada para a Cloud Function 'registerPackageWin'
        const registerPackageWin = firebase.functions().httpsCallable('registerPackageWin');

        // Pega o usuário atual para garantir que ele esteja logado
        const currentUser = auth.currentUser;
        if (!currentUser) {
            console.error("Usuário não está logado para registrar ganho de pacote.");
            return;
        }

        // Os dados que enviaremos para a Cloud Function
        const ganhoData = {
            itemId: item.id,
            itemNome: item.name,
            itemPreco: item.price,
            itemImagem: item.image,
            itemRaridade: item.rarity || 'comum'
        };

        // Chama a função e aguarda a resposta
        await registerPackageWin(ganhoData);

    } catch (error) {
        console.error('Erro ao chamar a Cloud Function registerPackageWin:', error);
    }
}

/**
 * Escuta por novos ganhos em tempo real e atualiza a interface
 * Usado no index.html para mostrar os ganhos recentes
 */
function listenToRecentWins() {
    if (typeof db === 'undefined') {
        console.warn('Firestore `db` não está definido. Impossível escutar ganhos recentes.');
        return;
    }

    // Evita registrar listeners múltiplas vezes
    if (unsubscribeRecentes || unsubscribeTrocas) {
        console.log('Listeners de recentes já registrados.');
        return;
    }

    console.log('Registrando listeners de ganhos recentes e trocas...');

    // Listener para a coleção principal de recentes
    unsubscribeRecentes = db.collection(RECENT_ITEMS_COLLECTION)
        .orderBy('timestamp', 'desc')
        .limit(Number(MAX_RECENT_ITEMS))
        .onSnapshot(snapshot => {
            _latestRecentes = snapshot.docs.map(doc => ({ id: `${RECENT_ITEMS_COLLECTION}_${doc.id}`, _rawId: doc.id, collection: RECENT_ITEMS_COLLECTION, ...doc.data() }));
            console.log(`Snapshot ${RECENT_ITEMS_COLLECTION}: ${_latestRecentes.length} docs`);
            snapshot.docs.forEach(d => {
                const ts = d.get('timestamp');
                if (!ts) console.warn(`${RECENT_ITEMS_COLLECTION} doc ${d.id} sem timestamp`);
                else console.log(`${RECENT_ITEMS_COLLECTION} doc ${d.id} ts=${typeof ts.toMillis === 'function' ? ts.toMillis() : ts}`);
            });
            mergeAndRenderRecentes();
        }, error => {
            console.error('Erro no snapshot de', RECENT_ITEMS_COLLECTION, error);
        });

    // Listener para a coleção de trocas
    unsubscribeTrocas = db.collection('ganhosTrocas')
        .orderBy('timestamp', 'desc')
        .limit(Number(MAX_RECENT_ITEMS))
        .onSnapshot(snapshot => {
            _latestTrocas = snapshot.docs.map(doc => ({ id: `ganhosTrocas_${doc.id}`, _rawId: doc.id, collection: 'ganhosTrocas', ...doc.data() }));
            console.log(`Snapshot ganhosTrocas: ${_latestTrocas.length} docs`);
            snapshot.docs.forEach(d => {
                const ts = d.get('timestamp');
                if (!ts) console.warn(`ganhosTrocas doc ${d.id} sem timestamp`);
                else console.log(`ganhosTrocas doc ${d.id} ts=${typeof ts.toMillis === 'function' ? ts.toMillis() : ts}`);
            });
            mergeAndRenderRecentes();
        }, error => {
            console.error('Erro no snapshot de ganhosTrocas', error);
        });

    // Cleanup quando a aba/page for descarregada
    window.addEventListener('beforeunload', () => {
        if (typeof unsubscribeRecentes === 'function') unsubscribeRecentes();
        if (typeof unsubscribeTrocas === 'function') unsubscribeTrocas();
    });
}

/**
 * Combina os dois caches, ordena por timestamp (mais recentes primeiro) e renderiza
 */
function mergeAndRenderRecentes() {
    const combined = [..._latestRecentes, ..._latestTrocas];

    combined.sort((a, b) => {
        const toMillis = t => {
            if (!t) return 0;
            if (typeof t.toMillis === 'function') return t.toMillis();
            if (typeof t === 'number') return t;
            const parsed = Date.parse(t);
            return isNaN(parsed) ? 0 : parsed;
        };
        return toMillis(b.timestamp) - toMillis(a.timestamp);
    });

    const top = combined.slice(0, MAX_RECENT_ITEMS);
    updateRecentesUI(top);
}

/**
 * Atualiza a interface dos recentes com os novos ganhos, AGORA COM ANIMAÇÕES.
 * Adiciona novos itens no topo com animação e remove os antigos do final.
 * @param {Array} ganhos - Lista dos ganhos recentes vinda do Firestore.
 */
function updateRecentesUI(ganhos) {
    if (!recentesContainer) {
        console.warn('Container de recentes não encontrado');
        return;
    }

    if (ganhos.length === 0) {
        recentesContainer.innerHTML = `<div class="recentes-empty"><p>Nenhum ganho recente ainda.</p></div>`;
        return;
    }

    // 1. Invertemos a lista para processar do mais antigo para o mais novo.
    // Isso garante que a animação de entrada aconteça na ordem correta.
    const ganhosReversos = [...ganhos].reverse();

    ganhosReversos.forEach(ganho => {
        // 2. Verifica se o card já existe na tela para não animar de novo.
        const existingCard = recentesContainer.querySelector(`[data-ganho-id="${ganho.id}"]`);
        
        if (!existingCard) {
            const card = createRecentCard(ganho);

            // 3. Define o estado inicial do card (invisível e um pouco acima).
            card.style.opacity = '0';
            card.style.transform = 'translateY(-20px)';
            
            // 4. Adiciona o novo card no topo da lista.
            recentesContainer.insertBefore(card, recentesContainer.firstChild);

            // 5. Se a lista estiver cheia, remove o último item com uma animação de saída.
            if (recentesContainer.children.length > MAX_RECENT_ITEMS) {
                const oldestCard = recentesContainer.lastElementChild;
                
                oldestCard.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                oldestCard.style.opacity = '0';
                oldestCard.style.transform = 'scale(0.9)'; // Efeito de encolher
                
                setTimeout(() => {
                    oldestCard.remove();
                }, 300); // Remove do DOM após a animação
            }

            // 6. Força o navegador a aplicar o estado inicial (passo técnico essencial).
            card.offsetHeight; 

            // 7. Aplica o estado final, ativando a animação de entrada.
            card.style.transition = 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }
    });

    // Etapa de limpeza: remove cards que não estão mais na lista de ganhos recentes
    const currentIds = ganhos.map(g => g.id);
    Array.from(recentesContainer.children).forEach(card => {
        const cardId = card.getAttribute('data-ganho-id');
        if (cardId && !currentIds.includes(cardId)) {
            card.remove();
        }
    });
}

/**
 * Cria um card placeholder (quando não há 6 itens)
 */
function createPlaceholderCard() {
    const card = document.createElement('div');
    card.className = 'recentes-card placeholder';
    card.setAttribute('data-ganho-id', 'placeholder');
    card.innerHTML = `
        <div class="recentes-image placeholder-image"></div>
        <div class="recentes-info">
            <p class="placeholder-text">Aguardando...</p>
            <span class="placeholder-text">--</span>
        </div>
        <div class="recentes-avatar placeholder-avatar"></div>
    `;
    return card;
}

/**
 * Cria um card individual para um ganho recente
 * 
// Em recentes.js, substitua a função createRecentCard inteira por esta:

/**
 * Cria um card individual para um ganho recente.
 * AGORA INTELIGENTE: Sabe diferenciar entre ganhos de Pacotes e Trocas.
 * * @param {Object} ganho - Dados do ganho
 * @returns {HTMLElement} - Elemento do card
 */
function createRecentCard(ganho) {
    const card = document.createElement('div');
    card.className = 'recentes-card';
    card.setAttribute('data-ganho-id', ganho.id);
    card.setAttribute('data-rarity', ganho.itemRaridade || 'comum');

    // --- LÓGICA DA CORREÇÃO ---
    // Cria a parte principal do card (com preço ou multiplicador) de forma dinâmica.
    let infoPrincipalHtml = '';

    // Se o 'ganho' tiver a propriedade 'multiplicador', sabemos que é uma TROCA.
    if (ganho.multiplicador !== undefined) {
        const valorPagoFormatado = `R$ ${(ganho.valorPago || 0).toFixed(2).replace('.', ',')}`;
        infoPrincipalHtml = `<span>${ganho.multiplicador}x <small>(${valorPagoFormatado})</small></span>`;
    } 
    // Senão, tratamos como um ganho de PACOTE.
    else {
        const precoFormatado = `R$ ${(ganho.itemPreco || 0).toFixed(2).replace('.', ',')}`;
        infoPrincipalHtml = `<span>${precoFormatado}</span>`;
    }
    // --- FIM DA LÓGICA DA CORREÇÃO ---

    const userPhoto = ganho.userFoto || 'https://static.vecteezy.com/system/resources/previews/009/292/244/non_2x/default-avatar-icon-of-social-media-user-vector.jpg';

    // Monta o HTML final do card usando a 'infoPrincipalHtml' que criamos
    card.innerHTML = `
        <div class="recentes-image">
            <img src="${ganho.itemImagem}" alt="${ganho.itemNome}" />
        </div>
        <div class="recentes-info">
            <p>${ganho.itemNome}</p>
            ${infoPrincipalHtml} 
        </div>
        <div class="recentes-avatar">
            <img src="${userPhoto}" alt="Avatar de ${ganho.userNome}" />
        </div>
    `;

    return card;
}

/**
 * Limpa ganhos antigos do banco de dados
 * Mantém apenas os últimos 50 ganhos para não sobrecarregar o banco
 */
async function limparGanhosAntigos() {
    try {
        if (typeof db === 'undefined') {
            return;
        }

        // Busca todos os ganhos ordenados por timestamp (mais antigos primeiro)
        const querySnapshot = await db.collection(RECENT_ITEMS_COLLECTION)
            .orderBy('timestamp', 'asc')
            .get();

        // Se tiver mais que 50 ganhos, deleta os mais antigos
        if (querySnapshot.size > 50) {
            const docsToDelete = querySnapshot.docs.slice(0, querySnapshot.size - 50);

            const batch = db.batch();
            docsToDelete.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            console.log(`${docsToDelete.length} ganhos antigos removidos`);
        }

    } catch (error) {
        console.error('Erro ao limpar ganhos antigos:', error);
    }
}

// --- INTEGRAÇÃO COM TROCAS.JS ---

/**
 * Função modificada para o trocas.js
 * Deve substituir a função handleSpinResult existente
 */
function handleSpinResultWithRecents(landedAngle, isDemo) {
    const endAngle = (startAngle + sweepAngle) % 360;
    let won = false;

    // Determina se ganhou baseado no ângulo
    if (startAngle > endAngle) {
        won = (landedAngle >= startAngle) || (landedAngle <= endAngle);
    } else {
        won = (landedAngle >= startAngle) && (landedAngle <= endAngle);
    }

    if (won && !isDemo) {
        // Se ganhou e não é demonstração:

        // 1. Faz a animação de confetti
        fireConfetti();

        // 2. Registra o ganho no banco de dados
        if (selectedSnack) {
            registrarGanho(selectedSnack);
        }
    }

    // Finaliza o spinner
    setTimeout(() => {
        isSpinning = false;
        rouletteArrow.classList.remove('show');
        rouletteArrow.style.transition = 'none';
        updateSpinButtonState();
    }, 1000);
}

// --- AUTO-INICIALIZAÇÃO ---

// Inicializa quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    // Remove o setTimeout e chama initRecentes diretamente
    initRecentes();

    // Limpa ganhos antigos periodicamente (a cada hora)
    setInterval(limparGanhosAntigos, 60 * 60 * 1000);
});