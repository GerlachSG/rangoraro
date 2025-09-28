// Cart System for RangoRaro

let cartItems = [];
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
            // Also do an initial load for backward compatibility
            loadCartItems(user.uid);
        } else {
            cartItems = [];
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
                        <button class="cart-action-btn btn-withdraw">Sacar Saldo</button>
                        <button class="cart-action-btn btn-sell-all">Vender Tudo</button>
                        <button class="cart-action-btn btn-delivery">Entregar Rango</button>
                    </div>
                </div>
                <div class="cart-items"></div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add event listeners
    const overlay = document.querySelector('.cart-modal-overlay');
    const closeBtn = document.querySelector('.cart-close');
    const sellAllBtn = document.querySelector('.btn-sell-all');
    const withdrawBtn = document.querySelector('.btn-withdraw');
    const deliveryBtn = document.querySelector('.btn-delivery');

    closeBtn.addEventListener('click', closeCart);
    overlay.addEventListener('click', e => {
        if (e.target === overlay) closeCart();
    });

    sellAllBtn.addEventListener('click', sellAllItems);
    withdrawBtn.addEventListener('click', withdrawFunds);
    deliveryBtn.addEventListener('click', requestDelivery);
}

async function addToCart(item) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        // Write into the per-user cart stored under users/{uid}/carrinho (subcollection)
        const userCartCol = db.collection('users').doc(user.uid).collection('carrinho');
        // Use an auto-generated document id so multiple identical items can be stored separately.
        // Keep the original item id in `itemId` for reference.
        await userCartCol.add({
            itemId: item.id,
            id: item.id,
            // English keys for compatibility
            name: item.name,
            image: item.image,
            price: (typeof item.price === 'number') ? item.price : Number(item.price) || 0,
            // addedAt timestamp
            addedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        // loadCartItems will be triggered by realtime listener; call it once to refresh view
        loadCartItems(user.uid);
    } catch (error) {
        console.error('Erro ao adicionar item ao carrinho:', error);
    }
}

async function loadCartItems(userId) {
    // Prefer the per-user subcollection under users/{uid}/carrinho. If legacy 'carrinhos' exists, migrate its items.
    try {
        const userCartCol = db.collection('users').doc(userId).collection('carrinho').orderBy('addedAt', 'desc');
        const snapshot = await userCartCol.get();

        if (!snapshot.empty) {
            const items = [];
            snapshot.forEach(doc => items.push(doc.data()));
            cartItems = items;
            updateCartUI();
            return;
        }

        // If no items in users/{uid}/carrinho, just empty the cartItems
        cartItems = [];
        updateCartUI();
    } catch (error) {
        console.error('Erro ao carregar itens do carrinho:', error);
    }
}

/**
 * Save item into per-user inventory collection: inventarios/{uid}/itens/{itemId}
 */
async function saveItemToInventory(userId, item) {
    try {
        // Legacy helper kept for compatibility; prefer saving into users/{uid}/carrinho
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

/**
 * Sell one unit of the given itemId from the user's cart.
 * This will delete a single document matching itemId (most recently added)
 * and increment the user's balance by the item price.
 */
async function sellOneItem(itemId, itemPrice) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const cartCol = db.collection('users').doc(user.uid).collection('carrinho');
    // find one document matching the itemId (any one occurrence)
    // Avoid ordering to prevent composite index requirement.
    const snapshot = await cartCol.where('itemId', '==', itemId).limit(1).get();
        if (snapshot.empty) {
            // fallback: try without where (in case older entries had different shape)
            const fallback = await cartCol.orderBy('addedAt', 'desc').limit(1).get();
            if (fallback.empty) return;
            await fallback.docs[0].ref.delete();
        } else {
            const doc = snapshot.docs[0];
            await doc.ref.delete();
        }

        // credit user's balance by itemPrice
        const priceNum = (typeof itemPrice === 'number') ? itemPrice : Number(itemPrice) || 0;
        await db.collection('users').doc(user.uid).set({
            balance: firebase.firestore.FieldValue.increment(priceNum)
        }, { merge: true });

        // Refresh local view (listener should update automatically, but force a reload to be safe)
        loadCartItems(user.uid);
    } catch (err) {
        console.error('Erro ao vender 1 unidade do item:', err);
    }
}

/**
 * Listen in realtime to inventarios/{uid}/itens and update cartItems on changes.
 * Returns the unsubscribe function.
 */
function listenToUserInventory(userId) {
    if (!db) return null;
    try {
        const invRef = db.collection('users').doc(userId).collection('carrinho').orderBy('addedAt', 'desc');
        const unsubscribe = invRef.onSnapshot(snapshot => {
            const items = [];
            snapshot.forEach(doc => items.push(doc.data()));
            cartItems = items;
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
    const cartTotal = document.querySelector('.cart-total');
    const cartSummary = document.querySelector('.cart-summary');

    if (cartCount) {
        cartCount.textContent = cartItems.length;
    }

    if (cartItems.length === 0) {
        // Esconde o texto do total e ajusta o sumário para o estado vazio
        cartTotal.style.display = 'none';
        cartSummary.style.background = 'transparent';
        cartSummary.style.border = 'none';
        
        // Cria o display centralizado de carrinho vazio
        cartItemsContainer.innerHTML = `
            <div class="empty-cart-display">
                <h2>Seu Carrinho está Vazio</h2>
                <p>Abra pacotes ou faça trocas para ganhar recompensas!</p>
            </div>`;
        
        // Adiciona classe para aplicar flexbox e centralizar
        cartItemsContainer.classList.add('is-empty-flex');

        // Desabilita os botões de ação
        document.querySelectorAll('.cart-action-btn').forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        });
    } else {
        // Restaura os estilos padrão quando há itens
        cartTotal.style.display = 'block';
        cartSummary.style.background = 'var(--cor-fundo-secundario)';
        cartSummary.style.borderBottom = '1px solid var(--cor-borda)';
        cartItemsContainer.classList.remove('is-empty-flex');

        // Agrupa itens iguais por itemId (ou id se itemId não existir)
        const grouped = {};
        cartItems.forEach(item => {
            const key = item.itemId || item.id || JSON.stringify(item);
            if (!grouped[key]) grouped[key] = { count: 0, sample: item };
            grouped[key].count++;
        });

        const groups = Object.keys(grouped).map(k => ({ key: k, count: grouped[k].count, item: grouped[k].sample }));

        // Renderiza cada grupo com quantidade e botão vender
        cartItemsContainer.innerHTML = groups.map(g => {
            const item = g.item;
            const nome = item.name || 'Produto';
            const imagem = item.image || '';
            const valor = (typeof item.price === 'number') ? item.price : 0;
            const quantidade = g.count;
            const priceText = quantidade > 1 ? `R$ ${valor.toFixed(2).replace('.', ',')} (${quantidade}x)` : `R$ ${valor.toFixed(2).replace('.', ',')}`;
            return `
            <div class="cart-item" data-item-id="${item.itemId || item.id}">
                <img src="${imagem}" alt="${nome}" class="cart-item-image">
                <div class="cart-item-info">
                    <div class="cart-item-name">${nome}</div>
                    <div class="price-row">
                        <div class="cart-item-price">${priceText}</div>
                        <button class="cart-sell-btn btn-sell-all">Vender</button>
                    </div>
                </div>
            </div>
        `;
        }).join('');

        // Calcula e exibe o total (soma por unidade * quantidade)
        const total = groups.reduce((sum, g) => {
            const valor = (typeof g.item.price === 'number') ? g.item.price : 0;
            return sum + (valor * g.count);
        }, 0);
        cartTotal.textContent = `Total: R$ ${total.toFixed(2).replace('.', ',')}`;

        // Adiciona listeners aos botões vender recém-criados
        setTimeout(() => {
            document.querySelectorAll('.cart-sell-btn').forEach(btn => {
                btn.removeEventListener('click', onSellBtnClick);
                btn.addEventListener('click', onSellBtnClick);
            });
        }, 0);

        // Habilita os botões de ação
        document.querySelectorAll('.cart-action-btn').forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        });
    }

    // Update badge inside cart button if present
    const cartBtn = document.querySelector('.header-right .cart');
    if (cartBtn) {
        let badge = cartBtn.querySelector('.cart-badge');
        if (!badge) {
            // create badge if not present and append to the right of the text
            badge = document.createElement('span');
            badge.className = 'cart-badge';
            cartBtn.appendChild(badge);
        }
        const newCount = cartItems.length;
        // update text
        badge.textContent = newCount;

        // If this is the first time we set the badge, don't animate; just initialize
        if (badgeInitialized) {
            // If count increased, trigger pop animation
            if (newCount > previousBadgeCount) {
                // force reflow then add animation class
                badge.classList.remove('cart-badge--pop');
                // eslint-disable-next-line no-unused-expressions
                void badge.offsetWidth;
                badge.classList.add('cart-badge--pop');
            }
        } else {
            // mark as initialized after first render
            badgeInitialized = true;
        }
        previousBadgeCount = newCount;
    }
}

function openCart() {
    const overlay = document.querySelector('.cart-modal-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }
}

function closeCart() {
    const overlay = document.querySelector('.cart-modal-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

async function sellAllItems() {
    const user = auth.currentUser;
    if (!user || cartItems.length === 0) return;

    try {
        const total = cartItems.reduce((sum, item) => sum + item.price, 0);
        
        // Adiciona o valor ao saldo do usuário no documento 'users' e campo 'balance'
        await db.collection('users').doc(user.uid).set({
            balance: firebase.firestore.FieldValue.increment(total)
        }, { merge: true });

        // Remove todos os itens do inventário do usuário (now stored under users/{uid}/carrinho)
        const invRef = db.collection('users').doc(user.uid).collection('carrinho');
        const snapshot = await invRef.get();
        const batch = db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        cartItems = [];
        updateCartUI();
        // Trigger confetti effect if available
        try {
            if (window.confetti) {
                confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } });
            }
        } catch (e) { /* ignore */ }
        // Animate balance badge/button to indicate funds were added
        try {
            const balanceEl = document.querySelector('.header-right .balance');
            if (balanceEl) {
                balanceEl.classList.remove('balance--pop');
                // force reflow
                // eslint-disable-next-line no-unused-expressions
                void balanceEl.offsetWidth;
                balanceEl.classList.add('balance--pop');
            }
        } catch (e) { /* ignore animation errors */ }
    } catch (error) {
        console.error('Erro ao vender itens:', error);
        // No browser alert; error logged to console
    }
}

function withdrawFunds() {
    // Placeholder for withdrawal functionality
    // placeholder: UI-only - no alert
}

function requestDelivery() {
    // Placeholder for delivery functionality
    // placeholder: UI-only - no alert
}

// Click handler for per-item sell buttons
function onSellBtnClick(e) {
    const btn = e.currentTarget;
    const itemEl = btn.closest('.cart-item');
    if (!itemEl) return;
    const itemId = itemEl.getAttribute('data-item-id');
    // Find sample price from current cartItems
    const sample = cartItems.find(it => (it.itemId || it.id) === itemId);
    const price = sample ? ((typeof sample.price === 'number') ? sample.price : 0) : 0;
    // Disable button briefly to prevent double click (keep text 'Vender' to avoid flick)
    btn.disabled = true;
    // pop animation
    btn.classList.remove('pop-animate');
    // force reflow
    // eslint-disable-next-line no-unused-expressions
    void btn.offsetWidth;
    btn.classList.add('pop-animate');

    sellOneItem(itemId, price).then(() => {
        // small confetti when sold
        try {
            if (window.confetti) {
                confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
            }
        } catch (e) { /* ignore */ }
        // restore button text; the listener will refresh the UI
        btn.disabled = false;
    }).catch(() => {
        btn.disabled = false;
    });
}

// Initialize cart when DOM is loaded
document.addEventListener('DOMContentLoaded', initCart);
