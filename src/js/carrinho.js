// Cart System for RangoRaro

let cartItems = []; // Array de itens com seus IDs de documento
let selectedItems = new Set(); // Armazena os IDs dos documentos dos itens selecionados
let cartUnsubscribe = null;
// Keep track of previous badge count to animate on increase
let previousBadgeCount = 0;
// Ensure we don't animate on the first render (only animate on subsequent increases)
let badgeInitialized = false;

// Initialize cart system
function initCart() {
    const cartButton = document.querySelector('.cart');
    if (!cartButton) return;

    // Create cart modal
    createCartModal();
    
    // Add click listener to cart button
    cartButton.addEventListener('click', openCart);

    // Load cart items from Firestore when user logs in
    auth.onAuthStateChanged(user => {
        // If we were listening to a previous user's inventory, unsubscribe
        if (cartUnsubscribe) {
            try { cartUnsubscribe(); } catch (e) { /* ignore */ }
            cartUnsubscribe = null;
        }

        if (user) {
            // Start realtime listener to the user's inventory
            cartUnsubscribe = listenToUserInventory(user.uid);
        } else {
            cartItems = [];
            selectedItems.clear();
            updateCartUI();
            // reset badge animation guard when logged out
            previousBadgeCount = 0;
            badgeInitialized = false;
        }
    });
}

function createCartModal() {
    const modalHTML = `
        <div class="cart-modal-overlay">
            <div class="cart-modal">
                <div class="cart-header">
                    <h2>Seu carrinho</h2>
                    <button class="cart-close">&times;</button>
                </div>
                <div class="cart-summary">
                    <div class="cart-total">Total: R$ 0,00</div>
                    <div class="cart-actions">
                        <button class="cart-action-btn btn-sell-all">Vender Selecionado</button>
                        <div class="cart-second-actions">
                            <button class="cart-action-btn btn-withdraw">Sacar Saldo</button>
                            <button class="cart-action-btn btn-delivery">Entregar Rango</button>
                        </div>
                    </div>
                </div>
                <div class="cart-select-container" style="padding: 10px 20px;">
                    <button class="cart-select">Selecionar Tudo</button>
                </div>
                <div class="cart-items"></div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add event listeners
    const overlay = document.querySelector('.cart-modal-overlay');
    const closeBtn = document.querySelector('.cart-close');
    const sellBtn = document.querySelector('.btn-sell-all');
    const withdrawBtn = document.querySelector('.btn-withdraw');
    const deliveryBtn = document.querySelector('.btn-delivery');
    const selectAllBtn = document.querySelector('.cart-select');

    closeBtn.addEventListener('click', closeCart);
    overlay.addEventListener('click', e => {
        if (e.target === overlay) closeCart();
    });

    sellBtn.addEventListener('click', sellSelectedItems);
    withdrawBtn.addEventListener('click', withdrawFunds);
    deliveryBtn.addEventListener('click', requestDelivery);
    selectAllBtn.addEventListener('click', toggleSelectAll);
}

async function addToCart(item) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const userCartCol = db.collection('users').doc(user.uid).collection('carrinho');
        await userCartCol.add({
            itemId: item.id,
            id: item.id,
            name: item.name,
            image: item.image,
            price: (typeof item.price === 'number') ? item.price : Number(item.price) || 0,
            addedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Erro ao adicionar item ao carrinho:', error);
    }
}

async function saveItemToInventory(userId, item) {
    try {
        const userCartCol = db.collection('users').doc(userId).collection('carrinho');
        await userCartCol.add({
            itemId: item.id,
            id: item.id,
            name: item.name,
            image: item.image,
            price: (typeof item.price === 'number') ? item.price : Number(item.price) || 0,
            addedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (err) {
        console.error('Erro ao salvar item no inventário:', err);
    }
}

function listenToUserInventory(userId) {
    if (!db) return null;
    try {
        const invRef = db.collection('users').doc(userId).collection('carrinho').orderBy('addedAt', 'desc');
        const unsubscribe = invRef.onSnapshot(snapshot => {
            const items = [];
            snapshot.forEach(doc => {
                items.push({ docId: doc.id, ...doc.data() });
            });
            cartItems = items;
            
            const currentDocIds = new Set(cartItems.map(item => item.docId));
            selectedItems.forEach(docId => {
                if (!currentDocIds.has(docId)) {
                    selectedItems.delete(docId);
                }
            });

            updateCartUI();
        }, err => console.error('Erro ao escutar inventário:', err));
        return unsubscribe;
    } catch (e) {
        console.error('Erro iniciando listener do inventário:', e);
        return null;
    }
}

function updateCartUI() {
    const cartCount = document.querySelector('.cart-count');
    const cartItemsContainer = document.querySelector('.cart-items');
    const cartSummary = document.querySelector('.cart-summary');
    
    if (cartCount) {
        cartCount.textContent = cartItems.length;
    }
    
    updateBadge();

    if (cartItems.length === 0) {
        document.querySelector('.cart-total').style.display = 'none';
        cartSummary.style.background = 'transparent';
        cartSummary.style.border = 'none';
        document.querySelector('.cart-select-container').style.display = 'none';
        
        cartItemsContainer.innerHTML = `
            <div class="empty-cart-display">
                <h2>Seu Carrinho está Vazio</h2>
                <p>Abra pacotes ou faça trocas para ganhar recompensas!</p>
            </div>`;
        
        cartItemsContainer.classList.add('is-empty-flex');
    } else {
        document.querySelector('.cart-total').style.display = 'block';
        cartSummary.style.background = 'var(--cor-fundo-secundario)';
        cartSummary.style.borderBottom = '1px solid var(--cor-borda)';
        cartItemsContainer.classList.remove('is-empty-flex');
        document.querySelector('.cart-select-container').style.display = 'block';

        const checkmarkSVG = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
                <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clip-rule="evenodd" />
            </svg>`;

        cartItemsContainer.innerHTML = cartItems.map(item => {
            const nome = item.name || 'Produto';
            const imagem = item.image || '';
            const valor = (typeof item.price === 'number') ? item.price : 0;
            const isSelected = selectedItems.has(item.docId);
            
            return `
            <div class="cart-item ${isSelected ? 'selected' : ''}" data-doc-id="${item.docId}">
                <div class="selection-overlay">${checkmarkSVG}</div>
                <img src="${imagem}" alt="${nome}" class="cart-item-image">
                <div class="cart-item-info">
                    <div class="cart-item-name">${nome}</div>
                    <div class="cart-item-price">R$ ${valor.toFixed(2).replace('.', ',')}</div>
                </div>
            </div>
        `;
        }).join('');

        document.querySelectorAll('.cart-item').forEach(el => {
            el.addEventListener('click', handleItemSelection);
        });
    }

    updateTotalDisplay();
    updateActionsState();
    updateSelectAllButtonState(); // <-- Garante que o estado do botão esteja correto
}

function updateTotalDisplay() {
    const cartTotal = document.querySelector('.cart-total');
    if (!cartTotal) return;

    if (selectedItems.size > 0) {
        const selectedValue = cartItems
            .filter(item => selectedItems.has(item.docId))
            .reduce((sum, item) => {
                const price = (typeof item.price === 'number') ? item.price : 0;
                return sum + price;
            }, 0);
        cartTotal.textContent = `Selecionado: R$ ${selectedValue.toFixed(2).replace('.', ',')}`;
    } else {
        const totalValue = cartItems.reduce((sum, item) => {
            const price = (typeof item.price === 'number') ? item.price : 0;
            return sum + price;
        }, 0);
        cartTotal.textContent = `Total: R$ ${totalValue.toFixed(2).replace('.', ',')}`;
    }
}

function handleItemSelection(event) {
    const itemElement = event.currentTarget;
    const docId = itemElement.dataset.docId;

    if (selectedItems.has(docId)) {
        selectedItems.delete(docId);
        itemElement.classList.remove('selected');
    } else {
        selectedItems.add(docId);
        itemElement.classList.add('selected');
    }
    
    updateTotalDisplay();
    updateActionsState();
    updateSelectAllButtonState(); // <-- Atualiza o botão aqui
}

// LÓGICA DO BOTÃO ATUALIZADA
function toggleSelectAll() {
    const anyItemSelected = selectedItems.size > 0;

    // Se qualquer item estiver selecionado, a ação do botão é LIMPAR a seleção.
    // Se nenhum estiver selecionado, a ação é selecionar TUDO.
    if (anyItemSelected) {
        // Desseleciona todos
        document.querySelectorAll('.cart-item').forEach(el => {
            selectedItems.delete(el.dataset.docId);
            el.classList.remove('selected');
        });
    } else {
        // Seleciona todos
        document.querySelectorAll('.cart-item').forEach(el => {
            selectedItems.add(el.dataset.docId);
            el.classList.add('selected');
        });
    }

    // Atualiza todos os componentes da UI que dependem da seleção
    updateTotalDisplay();
    updateActionsState();
    updateSelectAllButtonState();
}

// NOVO! - Função dedicada para atualizar o texto do botão
function updateSelectAllButtonState() {
    const selectAllBtn = document.querySelector('.cart-select');
    if (!selectAllBtn) return;

    // Se tiver 1 ou mais itens selecionados, o botão vira "Desselecionar Tudo"
    if (selectedItems.size > 0) {
        selectAllBtn.textContent = 'Desselecionar Tudo';
    } else {
        selectAllBtn.textContent = 'Selecionar Tudo';
    }
}


function updateActionsState() {
    const hasSelection = selectedItems.size > 0;
    document.querySelectorAll('.cart-action-btn').forEach(btn => {
        btn.disabled = !hasSelection;
        if (hasSelection) {
            btn.classList.add('enabled');
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        } else {
            btn.classList.remove('enabled');
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        }
    });
}

function updateBadge() {
    const cartBtn = document.querySelector('.header-right .cart');
    if (cartBtn) {
        let badge = cartBtn.querySelector('.cart-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'cart-badge';
            cartBtn.appendChild(badge);
        }
        const newCount = cartItems.length;
        badge.textContent = newCount;

        if (badgeInitialized) {
            if (newCount > previousBadgeCount) {
                badge.classList.remove('cart-badge--pop');
                void badge.offsetWidth;
                badge.classList.add('cart-badge--pop');
            }
        } else {
            badgeInitialized = true;
        }
        previousBadgeCount = newCount;
    }
}

function openCart() {
    const overlay = document.querySelector('.cart-modal-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
        document.body.classList.add('modal-open'); // Adiciona esta linha
    }
}

function closeCart() {
    const overlay = document.querySelector('.cart-modal-overlay');
    if (overlay) {
        overlay.style.display = 'none';
        document.body.classList.remove('modal-open'); // Adiciona esta linha
    }
}

async function sellSelectedItems() {
    const user = auth.currentUser;
    if (!user || selectedItems.size === 0) return;

    const itemsToSell = cartItems.filter(item => selectedItems.has(item.docId));
    if (itemsToSell.length === 0) return;

    try {
        const total = itemsToSell.reduce((sum, item) => sum + item.price, 0);
        
        await db.collection('users').doc(user.uid).set({
            balance: firebase.firestore.FieldValue.increment(total)
        }, { merge: true });

        const batch = db.batch();
        itemsToSell.forEach(item => {
            const docRef = db.collection('users').doc(user.uid).collection('carrinho').doc(item.docId);
            batch.delete(docRef);
        });
        await batch.commit();

        selectedItems.clear();

        try {
            if (window.confetti) {
                confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } });
            }
        } catch (e) { /* ignore */ }
        
        try {
            const balanceEl = document.querySelector('.header-right .balance');
            if (balanceEl) {
                balanceEl.classList.remove('balance--pop');
                void balanceEl.offsetWidth;
                balanceEl.classList.add('balance--pop');
            }
        } catch (e) { /* ignore animation errors */ }
    } catch (error) {
        console.error('Erro ao vender itens selecionados:', error);
    }
}

function withdrawFunds() {
    if (selectedItems.size === 0) return;
    console.log("Requisitando saque para:", Array.from(selectedItems));
}

function requestDelivery() {
    if (selectedItems.size === 0) return;
    console.log("Requisitando entrega para:", Array.from(selectedItems));
}

document.addEventListener('DOMContentLoaded', initCart);