// js/recentes.js (Versão final focada APENAS em Ganhos de Pacotes)

const MAX_RECENT_ITEMS = 6;
const RECENT_ITEMS_COLLECTION = 'ganhosRecentes';
let recentesContainer = null;
let unsubscribeRecentes = null;

function initRecentes() {
    recentesContainer = document.querySelector('.recentes');
    if (recentesContainer) {
        listenToRecentPackageWins();
    }
}

async function registrarGanho(item, packageInfo) {
    try {
        const registerPackageWin = firebase.functions().httpsCallable('registerPackageWin');
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        
        const ganhoData = {
            itemId: item.id,
            itemNome: item.name,
            itemPreco: item.price,
            itemImagem: item.image,
            itemRaridade: item.rarity || 'comum',
            // Informações do pacote
            pacoteId: packageInfo?.id || null,
            pacoteNome: packageInfo?.nome || null,
            pacoteImagem: packageInfo?.imagem || null,
            pacotePreco: packageInfo?.preco || null
        };
        
        console.log('📦 Enviando para Cloud Function:', ganhoData); // DEBUG
        
        await registerPackageWin(ganhoData);
        
        console.log('✅ Ganho registrado com sucesso!'); // DEBUG
    } catch (error) {
        console.error('❌ Erro ao chamar registerPackageWin:', error);
    }
}

function listenToRecentPackageWins() {
    if (typeof db === 'undefined' || unsubscribeRecentes) return;

    // Listener que ouve APENAS a coleção de ganhos de pacotes.
    unsubscribeRecentes = db.collection(RECENT_ITEMS_COLLECTION)
        .orderBy('timestamp', 'desc')
        .limit(MAX_RECENT_ITEMS)
        .onSnapshot(snapshot => {
            // Pega os dados e manda direto para atualizar a tela, sem misturar com mais nada.
            const ganhos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateRecentesUI(ganhos);
        });
}

function updateRecentesUI(ganhos) {
    if (!recentesContainer) return;
    if (ganhos.length === 0) {
        recentesContainer.innerHTML = `<div class="recentes-empty"><p>Nenhum ganho recente ainda.</p></div>`;
        return;
    }

    const ganhosReversos = [...ganhos].reverse();
    ganhosReversos.forEach(ganho => {
        if (!recentesContainer.querySelector(`[data-ganho-id="${ganho.id}"]`)) {
            const card = createRecentCard(ganho);
            card.style.opacity = '0';
            card.style.transform = 'translateY(-20px)';
            recentesContainer.insertBefore(card, recentesContainer.firstChild);
            if (recentesContainer.children.length > MAX_RECENT_ITEMS) {
                const oldestCard = recentesContainer.lastElementChild;
                oldestCard.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                oldestCard.style.opacity = '0';
                oldestCard.style.transform = 'scale(0.9)';
                setTimeout(() => { oldestCard.remove(); }, 300);
            }
            card.offsetHeight;
            card.style.transition = 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }
    });

    const currentIds = ganhos.map(g => g.id);
    Array.from(recentesContainer.children).forEach(card => {
        const cardId = card.getAttribute('data-ganho-id');
        if (cardId && !currentIds.includes(cardId)) card.remove();
    });
}

// Função de criar o card, agora SIMPLIFICADA para mostrar apenas pacotes.
function createRecentCard(ganho) {
    const card = document.createElement('div');
    card.className = 'recentes-card';
    card.setAttribute('data-ganho-id', ganho.id);
    card.setAttribute('data-rarity', ganho.itemRaridade || 'comum');
    
    console.log('Criando card com ganho:', ganho); // DEBUG
    
    // Se tiver informações do pacote, adiciona como data attributes e torna clicável
    if (ganho.pacoteId) {
        console.log('Pacote encontrado:', ganho.pacoteId, ganho.pacoteImagem); // DEBUG
        card.setAttribute('data-package-id', ganho.pacoteId);
        card.style.cursor = 'pointer';
        
        // Define a imagem do pacote como CSS variable para o hover funcionar
        if (ganho.pacoteImagem) {
            card.style.setProperty('--package-bg-image', `url(${ganho.pacoteImagem})`);
            card.setAttribute('data-has-package-image', 'true');
            console.log('CSS variable definida:', card.style.getPropertyValue('--package-bg-image')); // DEBUG
        }
        
        // Adiciona evento de click para redirecionar ao pacote específico
        card.addEventListener('click', () => {
            window.location.href = `abertura.html?pacote=${ganho.pacoteId}`;
        });
    } else {
        console.log('Sem pacoteId para este ganho'); // DEBUG
    }
    
    const precoFormatado = `<span class="preco-pacote">R$ ${(ganho.itemPreco || 0).toFixed(2).replace('.', ',')}</span>`;
    const userPhoto = ganho.userFoto || 'https://static.vecteezy.com/system/resources/previews/009/292/244/non_2x/default-avatar-icon-of-social-media-user-vector.jpg';
    
    card.innerHTML = `
        <div class="recentes-image"><img src="${ganho.itemImagem}" alt="${ganho.itemNome}" /></div>
        <div class="recentes-info"><p>${ganho.itemNome}</p>${precoFormatado}</div>
        <div class="recentes-avatar"><img src="${userPhoto}" alt="Avatar de ${ganho.userNome}" /></div>
    `;
    
    return card;
}

document.addEventListener('DOMContentLoaded', initRecentes);