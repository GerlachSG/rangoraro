/**
 * Sistema de Ganhos Recentes das Trocas - RangoRaro
 */

const MAX_RECENT_TRADES = 5; // Número de trocas recentes a exibir
const RECENT_TRADES_COLLECTION = 'ganhosTrocas'; // Nome da coleção no Firestore

let trocasContainer = null;

function initTrocasRecentes() {
    trocasContainer = document.querySelector('.grade-trocas');
    
    if (trocasContainer) {
        listenToRecentTrades();
        console.log('Sistema de Trocas Recentes inicializado');
    }
}

async function registrarGanhoTroca(item) {
    try {
        if (typeof db === 'undefined') {
            console.error('Firebase não está disponível');
            return;
        }

        const currentUser = auth.currentUser;

        const ganhoData = {
            itemId: item.id,
            itemNome: item.name,
            itemPreco: item.price,
            valorPago: item.paidPrice,
            multiplicador: item.multiplier,
            itemImagem: item.image,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userId: currentUser ? currentUser.uid : null,
            userNome: currentUser ? currentUser.displayName : 'Usuário Anônimo',
            userFoto: currentUser ? currentUser.photoURL : 'https://static.vecteezy.com/system/resources/previews/009/292/244/non_2x/default-avatar-icon-of-social-media-user-vector.jpg'
        };

        await db.collection(RECENT_TRADES_COLLECTION).add(ganhoData);
    } catch (error) {
        console.error('Erro ao registrar ganho da troca:', error);
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
    const tradesLimitados = trades.slice(0, 7).reverse();

    tradesLimitados.forEach((trade, index) => {
        const existingCard = trocasContainer.querySelector(`[data-trade-id="${trade.id}"]`);
        if (!existingCard) {
            const card = createTradeCard(trade);
            card.style.transform = 'translateX(-100%)';
            card.style.opacity = '0';
            
            // Remove o card mais à direita quando atingir o limite
            if (trocasContainer.children.length >= 7) {
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
