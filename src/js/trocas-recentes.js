/**
 * Sistema de Ganhos Recentes das Trocas - RangoRaro
 */

if (typeof window.__RANGO_MAX_RECENT_TRADES === 'undefined') {
    window.__RANGO_MAX_RECENT_TRADES = 5;
}
if (typeof window.__RANGO_RECENT_TRADES_COLLECTION === 'undefined') {
    window.__RANGO_RECENT_TRADES_COLLECTION = 'ganhosTrocas';
}
const MAX_RECENT_TRADES = window.__RANGO_MAX_RECENT_TRADES;
const RECENT_TRADES_COLLECTION = window.__RANGO_RECENT_TRADES_COLLECTION;

let trocasContainer = null;

function initTrocasRecentes() {
    trocasContainer = document.querySelector('.grade-trocas');
    
    if (trocasContainer) {
        listenToRecentTrades();
        console.log('Sistema de Trocas Recentes inicializado');
    }
}

// js/trocas-recentes.js

async function registrarGanhoTroca(item) {
    // RASTREADOR: Esta mensagem azul é a que DEVERIA aparecer no console após uma TROCA.
    console.log('%c FUNÇÃO DE TROCA CHAMADA!', 'color: cyan; font-size: 14px; font-weight: bold;', item);

    try {
        if (typeof firebase === 'undefined' || typeof firebase.functions === 'undefined') {
            console.error('Firebase Functions não está disponível.');
            return;
        }
        const registerTradeWin = firebase.functions().httpsCallable('registerTradeWin');
        const currentUser = auth.currentUser;
        if (!currentUser) {
            console.error("Usuário não está logado para registrar ganho.");
            return;
        }
        const ganhoData = {
            itemId: item.id,
            itemNome: item.name,
            itemPreco: item.price,
            valorPago: item.paidPrice,
            multiplicador: item.multiplier,
            itemImagem: item.image
        };
        await registerTradeWin(ganhoData);
    } catch (error) {
        console.error('Erro ao chamar a Cloud Function registerTradeWin:', error);
    }
}

function listenToRecentTrades() {
    if (!db) return;

    db.collection(RECENT_TRADES_COLLECTION)
        .orderBy('timestamp', 'desc')
        .limit(MAX_RECENT_TRADES)
        .onSnapshot(snapshot => {
            const trades = [];
            snapshot.forEach(doc => {
                trades.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            updateTrocasUI(trades);
        });
}

function updateTrocasUI(trades) {
    if (!trocasContainer) return;

    // Se não há trocas, mostra mensagem padrão
    if (trades.length === 0) {
        trocasContainer.innerHTML = `
            <div class="troca-empty">
                <p>Nenhuma troca recente. Seja o primeiro a ganhar nas Trocas!</p>
            </div>`;
        return;
    }

    // Reverte a ordem dos trades para que o mais recente fique à esquerda
    const tradesLimitados = trades.slice(0, 5).reverse();

    tradesLimitados.forEach((trade, index) => {
        const existingCard = trocasContainer.querySelector(`[data-trade-id="${trade.id}"]`);
        if (!existingCard) {
            const card = createTradeCard(trade);
            card.style.transform = 'translateX(-100%)';
            card.style.opacity = '0';
            
            // Remove o card mais à direita quando atingir o limite
            if (trocasContainer.children.length >= 5) {
                const lastCard = trocasContainer.lastElementChild;
                lastCard.style.transition = 'all 0.3s ease-out';
                lastCard.style.transform = 'scale(0.9)';
                lastCard.style.opacity = '0';
                setTimeout(() => lastCard.remove(), 300);
            }

            // Adiciona o novo card no início (esquerda)
            trocasContainer.insertBefore(card, trocasContainer.firstChild);
            
            // Força um reflow
            card.offsetHeight;
            
            // Anima o card entrando da esquerda
            card.style.transition = 'all 0.5s ease-out';
            card.style.transform = 'translateX(0)';
            card.style.opacity = '1';
        }
    });
}

function createTradeCard(trade) {
    const card = document.createElement('div');
    card.className = 'troca-card';
    card.setAttribute('data-trade-id', trade.id);
    
    const precoFormatado = `R$ ${trade.valorPago.toFixed(2).replace('.', ',')}`;

    card.innerHTML = `
        <div class="rating">
            <span>${trade.multiplicador}x</span>
        </div>
        <div class="troca-avatar">
            <img src="${trade.userFoto}" alt="Avatar de ${trade.userNome}">
        </div>
        <div class="troca-image">
            <img src="${trade.itemImagem}" alt="${trade.itemNome}">
        </div>
        <div class="troca-info">
            <p>${trade.itemNome}</p>
        </div>
        <div class="troca-price">${precoFormatado}</div>
    `;

    return card;
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Remove o setTimeout e chama initTrocasRecentes diretamente
    initTrocasRecentes();
});
