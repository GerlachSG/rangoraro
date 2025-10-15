let cartItems = [];
let selectedItems = new Set();
let cartUnsubscribe = null;
let previousBadgeCount = 0;
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
            try { cartUnsubscribe(); } catch (e) {}
            cartUnsubscribe = null;
        }

        if (user) {
            // Start realtime listener to the user's inventory
            cartUnsubscribe = listenToUserInventory(user.uid);
        } else {
            cartItems = [];
            selectedItems.clear();
            updateCartUI();
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
        // Build payload including optional fields only when present
        const payload = {
            itemId: item.id,
            id: item.id,
            name: item.name,
            image: item.image,
            price: (typeof item.price === 'number') ? item.price : Number(item.price) || 0,
            addedAt: firebase.firestore.FieldValue.serverTimestamp(),
            fastfood: item.fastfood || null
        };

        if (Array.isArray(item.opcoes) && item.opcoes.length > 0) {
            payload.opcoes = item.opcoes.slice();
        }
        if (Array.isArray(item['opcoes-retirar']) && item['opcoes-retirar'].length > 0) {
            payload['opcoes-retirar'] = item['opcoes-retirar'].slice();
        }

        await userCartCol.add(payload);
    } catch (error) {
    }
}

async function saveItemToInventory(userId, item) {
    try {
        const userCartCol = db.collection('users').doc(userId).collection('carrinho');
        const payload = {
            itemId: item.id,
            id: item.id,
            name: item.name,
            image: item.image,
            price: (typeof item.price === 'number') ? item.price : Number(item.price) || 0,
            addedAt: firebase.firestore.FieldValue.serverTimestamp(),
            fastfood: item.fastfood || null
        };

        if (Array.isArray(item.opcoes) && item.opcoes.length > 0) {
            payload.opcoes = item.opcoes.slice();
        }
        if (Array.isArray(item['opcoes-retirar']) && item['opcoes-retirar'].length > 0) {
            payload['opcoes-retirar'] = item['opcoes-retirar'].slice();
        }

        await userCartCol.add(payload);
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
    const selectionCount = selectedItems.size;
    const deliveryBtn = document.querySelector('.btn-delivery');

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

    // Validação para o limite de 5 itens
    if (selectionCount > 5) {
        if (deliveryBtn) {
            deliveryBtn.textContent = 'Selecione apenas 5 itens';
            deliveryBtn.style.backgroundColor = '#8f5600'; // Laranja acinzentado
            deliveryBtn.style.color = '#bdbdbd';
            deliveryBtn.disabled = true;
        }
    } else {
        if (deliveryBtn) {
            deliveryBtn.textContent = 'Entregar Rango';
            deliveryBtn.style.backgroundColor = ''; // Volta à cor original
            deliveryBtn.style.color = '';
            // Re-habilita o botão se houver seleção, pois a condição geral acima o desabilita se não houver.
            if (hasSelection) {
                deliveryBtn.disabled = false;
            }
        }
    }
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
        } catch (e) { }
    } catch (error) {
        console.error('Erro ao vender itens selecionados:', error);
    }
}

function withdrawFunds() {
    if (selectedItems.size === 0) return;
}



let _currentDeliveryContext = null; // { user, selectedItems, enderecoRef, addressData }

// Função principal que inicia o fluxo de entrega.
async function requestDelivery() {
    if (selectedItems.size === 0) return;
    const user = auth.currentUser;
    if (!user) {
        alert('Para solicitar entrega você precisa estar logado.');
        return;
    }

    const selected = cartItems.filter(item => selectedItems.has(item.docId));
    
    // Garante que todos os modais necessários existem no DOM.
    ensureDeliveryModals();

    const userRef = db.collection('users').doc(user.uid);
    const addressCol = userRef.collection('address');

    try {
        const snapshot = await addressCol.get();
        
        if (snapshot.empty) {
            // Nenhum endereço cadastrado: abre o modal para criar o primeiro ('endereco-1').
            const firstAddressRef = addressCol.doc('endereco-1');
            openAddressModal(user, selected, firstAddressRef);
        } else {
            // Endereços existem: abre o modal de seleção.
            const addresses = [];
            snapshot.forEach(doc => {
                addresses.push({ id: doc.id, ...doc.data() });
            });
            // Ordena os endereços para garantir a ordem (endereco-1, endereco-2, etc.).
            addresses.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
            openAddressSelectionModal(user, selected, addresses);
        }
    } catch (err) {
        console.error("Erro ao buscar endereços:", err);
        alert("Ocorreu um erro ao verificar seus endereços. Tente novamente.");
    }
}


// Abre o modal para o usuário escolher um endereço existente ou adicionar um novo.
function openAddressSelectionModal(user, selectedItems, addresses) {
    const overlay = document.querySelector('.delivery-address-selection-modal-overlay');
    if (!overlay) return;

    const container = overlay.querySelector('.delivery-address-list');
    container.innerHTML = ''; // Limpa conteúdo anterior.

    // Renderiza cada endereço salvo.
    addresses.forEach(addr => {
        const addrElement = document.createElement('div');
        addrElement.className = 'address-option';

        const detailsSpan = `<span>${addr.bairro}, ${addr.cidade} - ${addr.estado.toUpperCase()}</span>`;
        
        let extraInfo = '';
        if (addr.complemento && addr.referencia) {
            extraInfo = `${addr.complemento} - ${addr.referencia}`;
        } else if (addr.complemento) {
            extraInfo = addr.complemento;
        } else if (addr.referencia) {
            extraInfo = addr.referencia;
        }
        const extraSpan = extraInfo ? `<span class="address-option-extra">(${extraInfo})</span>` : '';

        addrElement.innerHTML = `
            <div class="address-option-details">
                <strong>${addr.rua}, ${addr.numero}</strong>
                ${detailsSpan}
                ${extraSpan}
            </div>
        `;
        addrElement.addEventListener('click', () => {
            closeModal('.delivery-address-selection-modal-overlay');
            // Procede para a tela de opções com o endereço selecionado.
            openOptionsModal(user, selectedItems, null, addr);
        });
        container.appendChild(addrElement);
    });

    // Renderiza o botão de "Adicionar Novo Endereço" se houver menos de 5.
    if (addresses.length < 5) {
        const addButton = document.createElement('div');
        addButton.className = 'address-option add-new-address';
        addButton.innerHTML = `
            <div class="address-option-details">
                <strong>Adicionar Novo Endereço</strong>
            </div>
        `;
        addButton.addEventListener('click', () => {
            const nextAddressNumber = addresses.length + 1;
            const nextDocId = `endereco-${nextAddressNumber}`;
            const newAddressRef = db.collection('users').doc(user.uid).collection('address').doc(nextDocId);
            closeModal('.delivery-address-selection-modal-overlay');
            openAddressModal(user, selectedItems, newAddressRef);
        });
        container.appendChild(addButton);
    }

    openModal('.delivery-address-selection-modal-overlay');
}

function isAddressComplete(data) {
    if (!data) return false;
    if (!data.cep || !data.cidade || !data.bairro || !data.rua) return false;
    const num = data.numero;
    if (num === undefined || num === null) return false;
    const parsed = parseInt(num, 10);
    return !isNaN(parsed) && parsed > 0;
}
let _deliveryModalsInjected = false;
function ensureDeliveryModals() {
    if (_deliveryModalsInjected) return;

    const html = `
    <div class="cart-modal-overlay delivery-address-modal-overlay delivery-modal-hidden">
        <div class="delivery-modal">
            <div class="delivery-header"><h3>Endereço de Entrega</h3><button class="delivery-close">&times;</button></div>
            <div class="delivery-body">
                <label for="delivery-cep" class="delivery-cep-label">CEP<input id="delivery-cep" name="cep" type="text" class="delivery-cep" placeholder="00000-000" autocomplete="postal-code"><span class="cep-error-message" aria-hidden="true" style="display:none;">CEP inválido.</span></label>
                <label for="delivery-estado">Estado (UF)<input id="delivery-estado" name="estado" type="text" class="delivery-estado" autocomplete="address-level1"></label>
                <label for="delivery-cidade">Cidade<input id="delivery-cidade" name="cidade" type="text" class="delivery-cidade" autocomplete="address-level2"></label>
                <label for="delivery-bairro">Bairro<input id="delivery-bairro" name="bairro" type="text" class="delivery-bairro" autocomplete="address-level3"></label>
                <label for="delivery-rua">Logradouro (Rua)<input id="delivery-rua" name="rua" type="text" class="delivery-rua" autocomplete="street-address"></label>
                <label for="delivery-numero">Número<input id="delivery-numero" name="numero" type="text" class="delivery-numero" autocomplete="address-line2"></label>
                <label for="delivery-complemento">Complemento<input id="delivery-complemento" name="complemento" type="text" class="delivery-complemento" autocomplete="off"></label>
                <label for="delivery-referencia">Referência<input id="delivery-referencia" name="referencia" type="text" class="delivery-referencia" autocomplete="off"></label>
            </div>
            <div class="delivery-actions">
                <button class="btn btn-secondary delivery-cancel">Cancelar</button>
                <button class="btn btn-primary delivery-save">Salvar e Continuar</button>
            </div>
        </div>
    </div>

    <div class="cart-modal-overlay delivery-address-selection-modal-overlay delivery-modal-hidden">
        <div class="delivery-modal">
            <div class="delivery-header"><h3>Selecione o Endereço</h3><button class="delivery-close">&times;</button></div>
            <div class="delivery-body delivery-address-list-container">
                <div class="delivery-address-list"></div>
            </div>
            <div class="delivery-actions">
                 <button class="btn btn-secondary address-selection-cancel">Voltar</button>
            </div>
        </div>
    </div>

    <div class="cart-modal-overlay delivery-options-modal-overlay delivery-modal-hidden">
        <div class="delivery-modal">
            <div class="delivery-header"><h3>Opções do Pedido</h3><button class="options-close">&times;</button></div>
            <div class="delivery-body delivery-options-body">
                </div>
            <div class="delivery-actions">
                <button class="btn btn-secondary options-cancel">Cancelar</button>
                <button class="btn btn-primary options-confirm">Confirmar e Enviar</button>
            </div>
        </div>
    </div>

    <div class="loading-modal-overlay" style="display: none;">
        <div class="loading-modal">
            <div class="loading-spinner"></div>
            <div class="loading-success" style="display: none;">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="success-checkmark">
                    <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clip-rule="evenodd" />
                </svg>
            </div>
            <p class="loading-message">Confirmando pedido...</p>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    const style = document.createElement('style');
    style.textContent = `
        /* Loading modal styles (injetados dinamicamente) */
        .loading-modal-overlay {
            position: fixed;
            inset: 0; /* top:0; right:0; bottom:0; left:0 */
            display: none; /* toggled via JS */
            justify-content: center;
            align-items: center;
            background-color: rgba(0,0,0,0.45);
            z-index: 5000; /* acima de outros modais */
            padding: 20px;
        }
        .loading-modal {
            background: var(--cor-fundo);
            color: var(--cor-texto-principal);
            border-radius: 12px;
            padding: 18px 22px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            border: 1px solid var(--cor-borda);
            min-width: 260px;
            max-width: 520px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.6);
        }
        .loading-spinner {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            border: 4px solid rgba(255,255,255,0.08);
            border-top-color: var(--cor-destaque);
            animation: spin 900ms linear infinite;
            box-sizing: border-box;
        }
        .loading-success {
            display: none;
            width: 56px;
            height: 56px;
            color: var(--cor-destaque);
        }
        .loading-success .success-checkmark { width: 56px; height: 56px; color: #4CAF50; }
        .loading-message {
            color: var(--cor-texto-secundario);
            font-size: 0.95rem;
            text-align: center;
            margin: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* --- CORREÇÃO DE LAYOUT DO MODAL DE SELEÇÃO DE ENDEREÇO --- */
        .delivery-address-selection-modal-overlay .delivery-body {
            display: block; /* Força o layout vertical, desativando o 'flex-wrap' */
            overflow-y: auto; /* Garante a rolagem se houver muitos endereços */
        }
        
        .delivery-address-list { 
            display: flex; 
            flex-direction: column; 
            gap: 15px; 
        }
        .address-option { 
            display: flex; 
            flex-direction: column;
            justify-content: center;
            width: 100%;
            min-height: 90px; /* Altura mínima para melhor clique */
            padding: 15px 20px;
            background-color: var(--cor-fundo-secundario); 
            border-radius: 8px;
            border: 1px solid var(--cor-borda); 
            cursor: pointer; 
            transition: all 0.2s ease;
            box-sizing: border-box;
        }
        .address-option:hover { 
            border-color: var(--cor-destaque); 
            background-color: #3f3535; /* Cor de hover genérica */
        }
        .address-option-details { 
            display: flex; 
            flex-direction: column;
            gap: 4px;
        }
        .address-option-details strong { font-size: 1.1rem; color: var(--cor-texto-principal); }
        .address-option-details span { font-size: 0.9rem; color: var(--cor-texto-secundario); }
        .address-option-extra { font-style: italic; font-size: 0.85rem; color: #999; }
        .delivery-cep-label { position: relative; display: block; }
        .delivery-cep-label .cep-error-message { position: absolute; right: 0; top: 100%; margin-top: 6px; color: #E53E3E; font-size: 0.85rem; }
        .delivery-cep.input-error { border-color: #E53E3E; }
        .add-new-address { 
            border-style: dashed; 
            align-items: center;
        }
    `;
    document.head.appendChild(style);

    // Conecta os botões dos modais (código original sem alterações)
    // Modal de Inserir Endereço
    document.querySelector('.delivery-close').addEventListener('click', () => closeModal('.delivery-address-modal-overlay'));
    document.querySelector('.delivery-cancel').addEventListener('click', () => closeModal('.delivery-address-modal-overlay'));
    document.querySelector('.delivery-save').addEventListener('click', onSaveAddressClicked);
    const addrOverlay = document.querySelector('.delivery-address-modal-overlay');
    if (addrOverlay) addrOverlay.addEventListener('click', e => { if (e.target === addrOverlay) closeModal('.delivery-address-modal-overlay'); });

    // Modal de Seleção de Endereço
    const selOverlay = document.querySelector('.delivery-address-selection-modal-overlay');
    if (selOverlay) {
       selOverlay.querySelector('.delivery-close').addEventListener('click', () => closeModal('.delivery-address-selection-modal-overlay'));
       selOverlay.querySelector('.address-selection-cancel').addEventListener('click', () => closeModal('.delivery-address-selection-modal-overlay'));
       selOverlay.addEventListener('click', e => { if (e.target === selOverlay) closeModal('.delivery-address-selection-modal-overlay'); });
    }

    // Modal de Opções do Pedido
    const optOverlay = document.querySelector('.delivery-options-modal-overlay');
    if (optOverlay) {
        optOverlay.querySelector('.options-close').addEventListener('click', () => closeModal('.delivery-options-modal-overlay'));
        optOverlay.querySelector('.options-cancel').addEventListener('click', () => closeModal('.delivery-options-modal-overlay'));
        optOverlay.addEventListener('click', e => { if (e.target === optOverlay) closeModal('.delivery-options-modal-overlay'); });
    }

    _deliveryModalsInjected = true;
}

function showLoadingModal(message) {
    const overlay = document.querySelector('.loading-modal-overlay');
    if (overlay) {
        overlay.querySelector('.loading-spinner').style.display = 'block';
        overlay.querySelector('.loading-success').style.display = 'none';
        overlay.querySelector('.loading-message').textContent = message;
        overlay.style.display = 'flex';
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.zIndex = '99999';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.pointerEvents = 'auto';

        const modal = overlay.querySelector('.loading-modal');
        if (modal) {
            modal.style.display = 'flex';
            modal.style.zIndex = '100000';
            modal.style.position = 'relative';
        }
    }
}

function showSuccessAndHideModal(message, duration = 3000) {
    const overlay = document.querySelector('.loading-modal-overlay');
    if (overlay) {
        overlay.querySelector('.loading-spinner').style.display = 'none';
        overlay.querySelector('.loading-success').style.display = 'block';
        overlay.querySelector('.loading-message').textContent = message;
        setTimeout(() => {
            hideLoadingModal();
            closeCart();
        }, duration);
    }
}

function hideLoadingModal() {
    const overlay = document.querySelector('.loading-modal-overlay');
    if (overlay) {
        // Remove ou oculta de forma segura
        overlay.style.display = 'none';
        overlay.style.zIndex = '';
        overlay.style.pointerEvents = 'none';
    }
}

function openModal(selector) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.remove('delivery-modal-hidden');
    el.style.display = 'flex';
    document.body.classList.add('modal-open');
}

function closeModal(selector) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.add('delivery-modal-hidden');
    el.style.display = 'none';
    // Só remove a classe do body se nenhum outro modal estiver aberto
    if (!document.querySelector('.cart-modal-overlay[style*="display: flex"]') &&
        !document.querySelector('.delivery-modal-hidden[style*="display: flex"]')) {
        document.body.classList.remove('modal-open');
    }
}

// Abre o modal de inserção de endereço.
function openAddressModal(user, selected, enderecoDocRef) {
    _currentDeliveryContext = { user, selected, enderecoDocRef };
    
    // Limpa os campos e o estado de validação
    ['cep','estado','cidade','bairro','rua','numero','complemento','referencia'].forEach(k => {
        const el = document.querySelector('.delivery-' + k);
        if (el) {
            el.value = '';
            el.classList.remove('input-error');
            delete el.dataset.touched;
        }
    });

    // Tenta preencher com dados existentes (útil para edição futura)
    enderecoDocRef.get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            if (data) {
                Object.keys(data).forEach(key => {
                    const input = document.querySelector(`.delivery-${key}`);
                    if (input) input.value = data[key];
                });
            }
        }
        updateSaveButtonState();
    }).catch(() => {
        updateSaveButtonState();
    });
    
    // Lógica de validação e autocompletar (mantida)
    setupAddressFormValidation();

    const cepInput = document.querySelector('.delivery-cep');
    if (cepInput) {
        cepInput.removeEventListener('blur', onCepBlur);
        cepInput.addEventListener('blur', onCepBlur);
    }

    openModal('.delivery-address-modal-overlay');
    updateSaveButtonState();
}

// Configura toda a validação e lógica de autocompletar do formulário de endereço.
function setupAddressFormValidation() {
    // Tipos de logradouro comuns
    const tiposLogradouro = ['Rua', 'Avenida', 'Travessa', 'Praça', 'Alameda', 'Estrada', 'Rodovia', 'Via', 'Largo', 'Vila', 'Conjunto', 'Quadra', 'Setor', 'Residencial', 'Parque', 'Jardim'];
    function autocompleteTipoRua(rua) {
        rua = rua.trim();
        // Se já começa com um tipo, retorna como está
        for (const tipo of tiposLogradouro) {
            if (rua.toLowerCase().startsWith(tipo.toLowerCase() + ' ')) return rua;
        }
        // Se não, tenta usar o tipo mais comum
        return 'Rua ' + rua;
    }
    // Autocomplete Estado para sigla ao perder foco
    const estadoInput = document.querySelector('.delivery-estado');
    if (estadoInput && !estadoInput.dataset.listenerAttached) {
        estadoInput.dataset.listenerAttached = 'true';
        estadoInput.addEventListener('blur', function() {
            const ufRaw = estadoInput.value.trim();
            const ufSigla = getUfSigla(ufRaw);
            if (ufSigla && ufSigla !== ufRaw) estadoInput.value = ufSigla;
        });
    }
    // Autocompletar CEP ao preencher cidade, bairro e rua
    const cidadeInput = document.querySelector('.delivery-cidade');
    const bairroInput = document.querySelector('.delivery-bairro');
    const ruaInput = document.querySelector('.delivery-rua');

    // Setup input listeners para cada campo
    [cidadeInput, bairroInput, ruaInput].forEach(input => {
        if (input && !input.dataset.listenerAttached) {
            input.dataset.listenerAttached = 'true';
            // Remove estilo de erro quando começa a digitar
            input.addEventListener('input', function() {
                this.classList.remove('input-error');
            });

            // Dispara verificação quando termina de editar
            input.addEventListener('change', function() {
                setTimeout(tryAutocompleteCep, 100);
            });
        }
    });

    // Mapeamento de estados para siglas
    const estadosMap = {
        'acre': 'AC', 'alagoas': 'AL', 'amapa': 'AP', 'amazonas': 'AM', 'bahia': 'BA', 'ceara': 'CE', 'distrito federal': 'DF',
        'espirito santo': 'ES', 'goias': 'GO', 'maranhao': 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG',
        'para': 'PA', 'paraiba': 'PB', 'parana': 'PR', 'pernambuco': 'PE', 'piaui': 'PI', 'rio de janeiro': 'RJ', 'rio grande do norte': 'RN',
        'rio grande do sul': 'RS', 'rondonia': 'RO', 'roraima': 'RR', 'santa catarina': 'SC', 'sao paulo': 'SP', 'sergipe': 'SE', 'tocantins': 'TO'
    };
    function getUfSigla(uf) {
        if (!uf) return '';
        uf = uf.trim().toUpperCase();
        if (uf.length === 2) return uf;
        const ufNorm = uf.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
        return estadosMap[ufNorm] || uf;
    }

    const numeroInput = document.querySelector('.delivery-numero');
    const complementoInput = document.querySelector('.delivery-complemento');
    const referenciaInput = document.querySelector('.delivery-referencia');

    function validateNumero() {
        if (!numeroInput) return true;
        const numValue = numeroInput.value.trim();
        const isInteger = /^\d+$/.test(numValue);
        const parsedNum = parseInt(numValue, 10);
        const isNumeroValid = isInteger && !isNaN(parsedNum) && parsedNum > 0 && numValue.length <= 4;
        if (numeroInput.dataset.touched === "true") {
            if (!isNumeroValid) { numeroInput.classList.add('input-error'); }
            else { numeroInput.classList.remove('input-error'); }
        }
        return isNumeroValid;
    }

    function validateRequiredFieldWithMinLength(input, minLength = 4) {
        if (!input) return false;
        const value = input.value.trim();
        if (input.dataset.touched === "true") {
            if (value.length < minLength) {
                input.classList.add('input-error');
                return false;
            }
        }
        if (value.length >= minLength) {
            input.classList.remove('input-error');
        }
        return value.length >= minLength;
    }

    if (numeroInput && !numeroInput.dataset.listenerAttached) {
        numeroInput.dataset.listenerAttached = 'true';
        numeroInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/[^\d]/g, '');
            if (value.length > 4) value = value.slice(0, 4);
            e.target.value = value;
            numeroInput.dataset.touched = "true";
            validateNumero();
            updateSaveButtonState();
        });
    }
    [complementoInput, referenciaInput].forEach(input => {
        if (input && !input.dataset.listenerAttached) {
            input.dataset.listenerAttached = 'true';
            input.addEventListener('input', () => {
                input.dataset.touched = "true";
                // campo opcional: só valida se algo foi digitado
                const val = input.value.trim();
                if (val === '') {
                    input.classList.remove('input-error');
                } else {
                    validateRequiredFieldWithMinLength(input);
                }
                updateSaveButtonState();
            });
        }
    });

    function updateSaveButtonState() {
        const saveBtn = document.querySelector('.delivery-save');
        if (!saveBtn) return;
        const isNumeroValid = validateNumero();
        // Complemento e referencia sao opcionais: se vazios, são válidos; se preenchidos, aplicam validação de comprimento
        const isComplementoValid = complementoInput ? (complementoInput.value.trim() === '' ? true : validateRequiredFieldWithMinLength(complementoInput)) : true;
        const isReferenciaValid = referenciaInput ? (referenciaInput.value.trim() === '' ? true : validateRequiredFieldWithMinLength(referenciaInput)) : true;
        // Valida CEP: deve conter exatamente 8 dígitos (após remover não dígitos)
        const cepValRaw = (document.querySelector('.delivery-cep') || {}).value || '';
        const cepDigits = cepValRaw.replace(/[^0-9]/g, '');
        const isCepValid = cepDigits.length === 8;

        const allRequiredFieldsFilled = [
            cepValRaw,
            (document.querySelector('.delivery-estado') || {}).value,
            (document.querySelector('.delivery-cidade') || {}).value,
            (document.querySelector('.delivery-bairro') || {}).value,
            (document.querySelector('.delivery-rua') || {}).value,
            (document.querySelector('.delivery-numero') || {}).value
        ].every(v => v && v.trim() !== '');

        if (allRequiredFieldsFilled && isNumeroValid && isComplementoValid && isReferenciaValid && isCepValid) {
            saveBtn.disabled = false;
            saveBtn.style.opacity = '1';
            saveBtn.style.backgroundColor = '';
            saveBtn.style.cursor = 'pointer';
        } else {
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.6';
            saveBtn.style.backgroundColor = '#8ca1b7';
            saveBtn.style.cursor = 'not-allowed';
        }
    }

    ['.delivery-cep', '.delivery-estado', '.delivery-cidade', '.delivery-bairro', '.delivery-rua', '.delivery-numero', '.delivery-complemento', '.delivery-referencia'].forEach(selector => {
        const input = document.querySelector(selector);
        if (input && !input.dataset.listenerAttached) {
            input.dataset.listenerAttached = 'true';
            input.addEventListener('input', updateSaveButtonState);
        }
    });

    // CEP: remover erro ao digitar e esconder mensagem
    const cepInputLocal = document.querySelector('.delivery-cep');
    if (cepInputLocal && !cepInputLocal.dataset.cepInputListener) {
        cepInputLocal.dataset.cepInputListener = 'true';
        cepInputLocal.addEventListener('input', function() {
            this.classList.remove('input-error');
            const msg = document.querySelector('.delivery-cep-label .cep-error-message');
            if (msg) msg.style.display = 'none';
            updateSaveButtonState();
        });
    }

    function compareBairros(bairro1, bairro2) {
        if (!bairro1 || !bairro2) return false;
        const normalize = (str) => str.toLowerCase().replace(/\s+/g, ' ').trim();
        const b1 = normalize(bairro1);
        const b2 = normalize(bairro2);
        if (b1 === b2) return true;
        const words1 = new Set(b1.split(' '));
        const words2 = new Set(b2.split(' '));
        const commonWords = ['bairro', 'vila', 'jardim', 'parque', 'residencial'];
        commonWords.forEach(w => { words1.delete(w); words2.delete(w); });
        return Array.from(words1).some(word => Array.from(words2).includes(word));
    }

    async function tryAutocompleteCep() {
        const ufRaw = estadoInput ? estadoInput.value.trim() : '';
        const uf = getUfSigla(ufRaw);
        const cidade = cidadeInput ? cidadeInput.value.trim() : '';
        let rua = ruaInput ? ruaInput.value.trim() : '';
        const bairroInformado = document.querySelector('.delivery-bairro')?.value.trim() || '';

        if (!uf || !cidade || !rua || !bairroInformado) return;
        rua = autocompleteTipoRua(rua);

        const url = `https://viacep.com.br/ws/${encodeURIComponent(uf)}/${encodeURIComponent(cidade)}/${encodeURIComponent(rua)}/json/`;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Falha na requisição ao ViaCEP: ${res.statusText}`);
            const data = await res.json();
            if (data.erro) throw new Error("CEP não encontrado para o endereço.");
            
            let melhorMatch = null;
            if (Array.isArray(data)) {
                melhorMatch = data.find(endereco => compareBairros(bairroInformado, endereco.bairro)) || data[0];
            } else if (typeof data === 'object' && data.cep) {
                melhorMatch = data;
            }

            if (melhorMatch) {
                cidadeInput?.classList.remove('input-error');
                bairroInput?.classList.remove('input-error');
                ruaInput?.classList.remove('input-error');
                document.querySelector('.delivery-cep').value = melhorMatch.cep || '';
                document.querySelector('.delivery-bairro').value = melhorMatch.bairro || '';
                document.querySelector('.delivery-cidade').value = melhorMatch.localidade || '';
                document.querySelector('.delivery-estado').value = melhorMatch.uf || '';
                document.querySelector('.delivery-rua').value = melhorMatch.logradouro || '';
            } else {
                throw new Error("Nenhuma correspondência de endereço encontrada.");
            }
        } catch (e) {
            console.error('Erro na busca de endereço via ViaCEP:', e.message);
            cidadeInput?.classList.add('input-error');
            ruaInput?.classList.add('input-error');
            bairroInput?.classList.add('input-error');
        }
        updateSaveButtonState();
    }
    
    [cidadeInput, ruaInput, bairroInput].forEach(input => {
        if(input && !input.dataset.focusListener) {
            input.dataset.focusListener = 'true';
            input.addEventListener('focus', function() {
                cidadeInput.classList.remove('input-error');
                ruaInput.classList.remove('input-error');
                bairroInput.classList.remove('input-error');
            });
        }
    });

    window.updateSaveButtonState = updateSaveButtonState;
}

// Autocompletar CEP com ViaCEP.
async function onCepBlur(e) {
    // Normaliza para apenas dígitos
    let cepDigits = (e.target.value || '').replace(/[^0-9]/g, '');
    const cepInputEl = e.target;
    const errorMsgEl = document.querySelector('.delivery-cep-label .cep-error-message');

    // Se tiver menos que 8 números, marca como inválido e mostra mensagem sem alterar layout
    if (cepDigits.length < 8) {
        if (cepInputEl) cepInputEl.classList.add('input-error');
        if (errorMsgEl) errorMsgEl.style.display = 'block';
        return;
    }

    // Se tiver mais que 8 dígitos, corta para 8 (evita letras ou sobra de números)
    if (cepDigits.length > 8) cepDigits = cepDigits.slice(0, 8);

    // Formata como 12345-678 e coloca no input
    const formatted = cepDigits.slice(0,5) + '-' + cepDigits.slice(5);
    if (cepInputEl) cepInputEl.value = formatted;
    try {
        const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.erro) return;

        if (data.localidade) document.querySelector('.delivery-cidade').value = data.localidade;
        if (data.uf) document.querySelector('.delivery-estado').value = data.uf;
        if (data.bairro) document.querySelector('.delivery-bairro').value = data.bairro;
        if (data.logradouro) document.querySelector('.delivery-rua').value = data.logradouro;
        const cepInput = document.querySelector('.delivery-cep');
        const cepMsg = document.querySelector('.delivery-cep-label .cep-error-message');
        if (cepInput) cepInput.classList.remove('input-error');
        if (cepMsg) cepMsg.style.display = 'none';
        window.updateSaveButtonState();
    } catch (err) {
    }
}

// Salva o endereço e abre o modal de seleção.
function onSaveAddressClicked() {
    if (!_currentDeliveryContext) return;
    const { user, selected, enderecoDocRef } = _currentDeliveryContext;

    // A validação já é feita pelo botão, mas uma checagem final é boa prática.
    const numeroInput = document.querySelector('.delivery-numero');
    const numValue = numeroInput ? numeroInput.value.trim() : '';
    const parsedNum = parseInt(numValue, 10);
    if (isNaN(parsedNum) || parsedNum <= 0) {
        if (numeroInput) numeroInput.classList.add('input-error');
        return;
    }

    const data = {
        // Normaliza e formata o CEP antes de salvar: somente dígitos, formata 12345-678
        cep: (function() {
            const raw = (document.querySelector('.delivery-cep') || {}).value || '';
            const digits = raw.replace(/[^0-9]/g, '').slice(0,8);
            if (digits.length !== 8) return raw.trim();
            return digits.slice(0,5) + '-' + digits.slice(5);
        })(),
        estado: (document.querySelector('.delivery-estado') || {}).value.trim(),
        cidade: (document.querySelector('.delivery-cidade') || {}).value.trim(),
        bairro: (document.querySelector('.delivery-bairro') || {}).value.trim(),
        rua: (document.querySelector('.delivery-rua') || {}).value.trim(),
        numero: parsedNum,
        complemento: (document.querySelector('.delivery-complemento') || {}).value.trim(),
        referencia: (document.querySelector('.delivery-referencia') || {}).value.trim()
    };
    
    // Salva o endereço no Firestore.
    enderecoDocRef.set(data, { merge: true }).then(() => {
        closeModal('.delivery-address-modal-overlay');
        
        // Após salvar, busca todos os endereços novamente e abre o modal de seleção.
        const addressCol = db.collection('users').doc(user.uid).collection('address');
        addressCol.get().then(snapshot => {
            const addresses = [];
            snapshot.forEach(doc => addresses.push({ id: doc.id, ...doc.data() }));
            addresses.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
            openAddressSelectionModal(user, selected, addresses);
        });

    }).catch(err => {
        console.error('Erro ao salvar endereço:', err);
        alert('Erro ao salvar endereço. Tente novamente.');
    });
}

// Constrói e abre o modal de opções do item.
function openOptionsModal(user, selectedItemsArray, enderecoDocRef, addressData) {
    _currentDeliveryContext = { user, selected: selectedItemsArray, enderecoDocRef, addressData };
    const overlay = document.querySelector('.delivery-options-modal-overlay');
    if (!overlay) return;

    const container = overlay.querySelector('.delivery-options-body');
    container.innerHTML = '';

    // Renderiza as opções para cada item selecionado.
    selectedItemsArray.forEach((item) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'delivery-item-options delivery-item-row';
        wrapper.dataset.docId = item.docId;

        const leftCol = document.createElement('div');
        leftCol.className = 'delivery-item-left';
        const img = document.createElement('img');
        img.className = 'delivery-item-thumb';
        img.src = item.image || '';
        img.alt = item.name || 'Produto';
        leftCol.appendChild(img);

        const centerCol = document.createElement('div');
        centerCol.className = 'delivery-item-center';
        const nameEl = document.createElement('div');
        nameEl.className = 'delivery-item-name';
        nameEl.textContent = item.name || 'Produto';
        centerCol.appendChild(nameEl);

        const rightCol = document.createElement('div');
        rightCol.className = 'delivery-item-right';

        if (Array.isArray(item.opcoes) && item.opcoes.length > 0) {
            const label = document.createElement('label');
            label.className = 'opt-label';
            label.textContent = 'Opção:';
            const sel = document.createElement('select');
            sel.className = 'optacoes-single';
            sel.dataset.docId = item.docId;
            const emptyOpt = document.createElement('option'); emptyOpt.value = ''; emptyOpt.textContent = 'Escolha...'; sel.appendChild(emptyOpt);
            item.opcoes.forEach(opt => {
                const o = document.createElement('option'); o.value = opt; o.textContent = opt; sel.appendChild(o);
            });
            label.appendChild(sel);
            rightCol.appendChild(label);
        }

        if (Array.isArray(item['opcoes-retirar']) && item['opcoes-retirar'].length > 0) {
            const labelm = document.createElement('label');
            labelm.className = 'opt-label';
            labelm.textContent = 'Retirar opções:';
            const multiSel = document.createElement('select');
            multiSel.className = 'optacoes-multi-select';
            multiSel.multiple = true;
            multiSel.size = Math.min(4, item['opcoes-retirar'].length);
            multiSel.dataset.docId = item.docId;
            item['opcoes-retirar'].forEach(opt => {
                const o = document.createElement('option'); o.value = opt; o.textContent = opt; multiSel.appendChild(o);
            });
            labelm.appendChild(multiSel);
            rightCol.appendChild(labelm);
        }

        const infoDiv = document.createElement('div'); infoDiv.style.display = 'none';
        infoDiv.dataset.docId = item.docId;
        infoDiv.dataset.nome = item.name || '';
        infoDiv.dataset.imagemUrl = item.image || '';
        infoDiv.dataset.fastfood = item.fastfood || '';
        infoDiv.dataset.valor = (typeof item.price === 'number') ? item.price : (item.price || 0);

        wrapper.appendChild(leftCol);
        wrapper.appendChild(centerCol);
        wrapper.appendChild(rightCol);
        wrapper.appendChild(infoDiv);

        container.appendChild(wrapper);
    });

    const confirmBtn = document.querySelector('.options-confirm');
    confirmBtn.removeEventListener('click', onOptionsConfirmWrapper);
    confirmBtn.addEventListener('click', onOptionsConfirmWrapper);

    function updateConfirmButtonState() {
        if (!confirmBtn) return;
        confirmBtn.disabled = !areRequiredOptionsSelected();
    }

    function areRequiredOptionsSelected() {
        const containerLocal = overlay.querySelector('.delivery-options-body');
        if (!containerLocal) return true;
        let ok = true;
        containerLocal.querySelectorAll('.delivery-item-row').forEach(block => {
            const select = block.querySelector('select.optacoes-single');
            if (select && (!select.value || select.value === '')) {
                ok = false;
            }
        });
        return ok;
    }

    overlay.querySelectorAll('select.optacoes-single, select.optacoes-multi-select').forEach(sel => {
        sel.addEventListener('change', updateConfirmButtonState);
    });

    overlay.querySelectorAll('.optacoes-multi-select').forEach(sel => {
        sel.addEventListener('mousedown', function (e) {
            const target = e.target;
            if (target && target.tagName === 'OPTION') {
                e.preventDefault();
                target.selected = !target.selected;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    });

    updateConfirmButtonState();
    openModal('.delivery-options-modal-overlay');
}

// Wrapper para gerenciar o estado do botão de confirmação e chamar a lógica de verificação.
async function onOptionsConfirmWrapper() {
    const confirmBtn = document.querySelector('.options-confirm');
    if (!confirmBtn || confirmBtn.disabled) return;

    if (!areRequiredOptionsSelected()) {
        alert('Por favor selecione as opções obrigatórias antes de confirmar.');
        return;
    }

    showLoadingModal('Confirmando pedido...');
    
    try {
        await onOptionsConfirm();
    } catch (error) {
        hideLoadingModal();
    }
}

function areRequiredOptionsSelected() {
    const containerLocal = document.querySelector('.delivery-options-body');
    if (!containerLocal) return true;
    let ok = true;
    containerLocal.querySelectorAll('.delivery-item-row').forEach(block => {
        const select = block.querySelector('select.optacoes-single');
        if (select && (!select.value || select.value === '')) {
            ok = false;
        }
    });
    return ok;
}

/**
 * Função principal que é chamada ao confirmar o pedido.
 * Substitui o antigo console.log por um sistema completo de verificação.
 */
async function onOptionsConfirm() {
    if (!_currentDeliveryContext) return;
    const { user, addressData } = _currentDeliveryContext;

    // 1. Coleta os dados do modal
    const itemsPayload = [];
    const container = document.querySelector('.delivery-options-body');
    if (!container) return;

    container.querySelectorAll('.delivery-item-options').forEach(block => {
        const info = block.querySelector('div[data-doc-id]');
        const docId = info ? info.dataset.docId : null;
        if (!docId) return;

        const singleSel = block.querySelector('select.optacoes-single');
        const multiSel = block.querySelector('select.optacoes-multi-select');
        
        itemsPayload.push({
            docId,
            nome: info.dataset.nome || '',
            imagemUrl: info.dataset.imagemUrl || '',
            fastfood: info.dataset.fastfood || '',
            valor: Number(info.dataset.valor) || 0,
            opcoes: singleSel ? [singleSel.value] : [],
            'opcoes-retirar': multiSel ? Array.from(multiSel.selectedOptions).map(opt => opt.value) : []
        });
    });

    const now = new Date();
    const formattedAddress = `${addressData.rua}, ${addressData.numero} - ${addressData.bairro}`;
    const pedidoParaVerificar = {
        usuario: {
            displayName: user.displayName || user.email,
            photoUrl: user.photoURL,
            horario: now.toLocaleString(),
            endereco: formattedAddress,
            cidade: addressData.cidade,
            complemento: addressData.complemento,
            referencia: addressData.referencia
        },
        itens: itemsPayload,
        timestamp: now // Adiciona o timestamp para uso posterior
    };

    // 2. Inicia o processo de verificação
    await processDeliveryRequest(pedidoParaVerificar);
}

/**
 * Orquestra a verificação de cada item do pedido.
 * @param {object} pedido O objeto completo do pedido a ser verificado.
 */
async function processDeliveryRequest(pedido) {
    const { usuario, itens } = pedido;
    const successfulItems = [];
    const failedItems = [];

    // Geocodifica o endereço do usuário uma vez
    const userCoords = await geocodeAddress(`${usuario.endereco}, ${usuario.cidade}`);
    if (!userCoords) {
        alert('Não foi possível verificar seu endereço. Por favor, verifique os dados e tente novamente.');
        hideLoadingModal(); // Esconde o loading em caso de falha
        return;
    }

    // Normaliza a cidade para usar como ID no Firestore
    const cityId = normalizeCity(usuario.cidade);

    // Processa cada item sequencialmente
    for (const item of itens) {
        const result = await verifyItem(item, cityId, userCoords);
        if (result.success) {
            successfulItems.push(result.data);
        } else {
            failedItems.push({ docId: item.docId, reason: result.reason });
        }
    }

    // Finaliza o processo com base nos resultados
    if (failedItems.length > 0) {
        hideLoadingModal(); // Esconde o loading se houver erros
        console.warn("Falha na verificação. Itens com problema:", failedItems);
        showDeliveryErrors(failedItems);
    } else {
        // Todos os itens foram verificados com sucesso. Agora, criar o "Pedido de Entrega".
        await createDeliveryOrder(pedido, successfulItems);
    }
}


// =================================================================================
// === INÍCIO DO BLOCO DE CÁLCULO DE VIAGEM ========================================
// =================================================================================

/**
 * Calcula a distância em linha reta (Haversine) entre duas coordenadas.
 * @returns {number} A distância em quilômetros.
 */
function haversineDistance(coords1, coords2) {
    if (!coords1 || !coords2) return Infinity;
    const R = 6371; // Raio da Terra em km
    const dLat = (coords2.lat - coords1.lat) * Math.PI / 180;
    const dLon = (coords2.lon - coords1.lon) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(coords1.lat * Math.PI / 180) * Math.cos(coords2.lat * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}


// NOVA FUNÇÃO HELPER: Geocodifica múltiplos endereços em paralelo
async function geocodeAddressesInParallel(addresses) {
    const promises = addresses.map(addr => geocodeAddress(addr));
    return Promise.all(promises);
}

// NOVA FUNÇÃO HELPER: Calcula a rota e a distância total, AGORA COM LOGS
function calculateNearestNeighborRoute(waypoints) {
    if (waypoints.length === 0) return 0;
    
    // LOG:
    console.log("--- Calculando rota do Vizinho Mais Próximo ---");

    let unvisited = [...waypoints];
    let currentNode = unvisited.shift(); 
    let totalDistance = 0;

    // LOG:
    console.log(`📍 Ponto de partida: ${currentNode.address}`);

    while (unvisited.length > 0) {
        let nearestIndex = -1;
        let minDistance = Infinity;

        for (let i = 0; i < unvisited.length; i++) {
            const distance = haversineDistance(currentNode.coords, unvisited[i].coords);
            if (distance < minDistance) {
                minDistance = distance;
                nearestIndex = i;
            }
        }

        if (nearestIndex > -1) {
            const nextNode = unvisited[nearestIndex];
            // LOG:
            console.log(`  -> Próximo trecho: De "${currentNode.address}" para "${nextNode.address}"`);
            console.log(`     Distância do trecho: ${minDistance.toFixed(2)} km`);

            totalDistance += minDistance;
            currentNode = nextNode;
            unvisited.splice(nearestIndex, 1);

            // LOG:
            console.log(`     Distância acumulada: ${totalDistance.toFixed(2)} km`);
        } else {
            break;
        }
    }
    return totalDistance;
}


/**
 * Cria o "Pedido de Entrega" final no Firestore.
 * @param {object} pedidoOriginal O pedido que foi verificado.
 * @param {Array<object>} successfulItems Os itens que passaram na verificação.
 */
async function createDeliveryOrder(pedidoOriginal, successfulItems) {
    const { usuario, itens: originalItems } = pedidoOriginal;
    const user = auth.currentUser;
    if (!user) return;

    try {
        // LOG:
        console.groupCollapsed("DETALHES DO CÁLCULO DO VALOR DA VIAGEM");

        const PRECO_POR_KM = 3.00;
        let valorViagem = 0;

        const storeAddresses = [...new Set(successfulItems.map(item => item.loja_endereco))];
        const customerAddress = `${usuario.endereco}, ${usuario.cidade}`;
        
        // LOG:
        console.log("1. Endereços para a rota:", { lojas: storeAddresses, cliente: customerAddress });

        const allAddresses = [...storeAddresses, customerAddress];
        const allCoords = await geocodeAddressesInParallel(allAddresses);
        
        const storeCoords = allCoords.slice(0, storeAddresses.length);
        const customerCoords = allCoords[allCoords.length - 1];

        const waypoints = storeCoords.map((coords, i) => ({
            id: `store_${i}`,
            address: storeAddresses[i],
            coords: coords
        })).filter(wp => wp.coords);

        // LOG:
        console.log("2. Coordenadas geográficas encontradas:", { lojas: storeCoords, cliente: customerCoords });

        if (customerCoords && waypoints.length > 0) {
            const waypointsWithCustomer = [...waypoints, { id: 'customer', address: customerAddress, coords: customerCoords }];
            
            // LOG:
            console.log("3. Calculando a distância da rota...");
            const totalDistanceInKm = calculateNearestNeighborRoute(waypointsWithCustomer);
            console.log(`4. Distância total da rota calculada: ${totalDistanceInKm.toFixed(2)} km`);

            const valorBruto = totalDistanceInKm * PRECO_POR_KM;
            valorViagem = valorBruto;
            // LOG:
            console.log(`5. Cálculo do valor bruto: ${totalDistanceInKm.toFixed(2)} km * R$ ${PRECO_POR_KM.toFixed(2)} = R$ ${valorBruto.toFixed(2)}`);

        } else {
            console.warn("Não foi possível geocodificar o endereço do cliente ou das lojas. Usando valor de viagem padrão.");
            const valorTotalItens = successfulItems.reduce((sum, item) => sum + item.valor, 0);
            valorViagem = parseFloat((valorTotalItens * 0.15).toFixed(2));
        }
        
        if (valorViagem < 7.50) {
            // LOG:
            console.log(`6. Verificação do valor mínimo: Valor calculado (R$ ${valorViagem.toFixed(2)}) é menor que o mínimo (R$ 7.50). Ajustando.`);
            valorViagem = 7.50;
        } else {
            // LOG:
            console.log("6. Verificação do valor mínimo: Valor calculado está acima do mínimo.");
        }

        // LOG:
        console.log(`7. VALOR FINAL DA VIAGEM: R$ ${valorViagem.toFixed(2)}`);
        console.groupEnd();

        const horarioDoPedido = new Date(pedidoOriginal.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });

        const { endereco, cidade, complemento, referencia } = usuario;
        const mainAddress = `${endereco}, ${cidade}`;
        const enderecoAdd = complemento || referencia ? `${complemento || ''}, ${referencia || ''}`.trim().replace(/^,|,$/g, '') : '';

        const deliveryOrderPayload = {
            userId: user.uid,
            userInfo: {
                displayName: usuario.displayName,
                endereco: mainAddress,
                enderecoAdd: enderecoAdd,
                valorViagem: valorViagem,
                horarioDoPedido: horarioDoPedido,
            },
            itensPedido: successfulItems.map(item => {
                const originalItem = originalItems.find(orig => orig.nome === item.nome);
                return {
                    imagemUrl: originalItem ? originalItem.imagemUrl : '',
                    nomeDoItem: item.nome,
                    valor: item.valor,
                    'opcoes-retirar': item.opcoes_retiradas,
                    opcoes: item.opcoes_escolhidas,
                    fechaLoja: item.fecha_loja,
                    nomeLoja: item.loja_nome,
                    enderecoLoja: item.loja_endereco
                };
            }),
            status: 'pendente',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('pedidos').add(deliveryOrderPayload);

        showSuccessAndHideModal('Pedido confirmado!');
        closeModal('.delivery-options-modal-overlay');
        
        const docsToRemove = new Set(originalItems.map(i => i.docId));
        const batch = db.batch();
        docsToRemove.forEach(docId => {
            const docRef = db.collection('users').doc(user.uid).collection('carrinho').doc(docId);
            batch.delete(docRef);
        });
        await batch.commit();

        selectedItems.clear();
        
    } catch (error) {
        // LOG:
        console.groupEnd(); // Garante que o grupo de logs seja fechado em caso de erro
        console.error("Erro ao criar o pedido de entrega:", error);
        alert("Ocorreu um erro ao finalizar seu pedido. Por favor, tente novamente.");
        throw error;
    }
}

// =================================================================================
// === FIM DO BLOCO DE CÁLCULO DE VIAGEM ===========================================
// =================================================================================


/**
 * Verifica um único item: encontra lojas, calcula a mais próxima e checa se está aberta.
 * @returns {Promise<object>} Objeto com { success: boolean, data/reason: any }
 */
async function verifyItem(item, cityId, userCoords) {
    try {
        // 1. Busca lojas que fazem o item na cidade do usuário
        const storesQuery = await db.collection('cidades').doc(cityId).collection('lojas')
            .where('fastfoodId', '==', item.fastfood).get();

        if (storesQuery.empty) {
            return { success: false, reason: 'Nenhuma loja encontrada para este item.' };
        }

        const availableStores = [];
        storesQuery.forEach(doc => availableStores.push({ id: doc.id, ...doc.data() }));

        // 2. Encontra a loja mais próxima e loga as distâncias
        let closestStore = null;
        let minDistance = Infinity;
        const storeDistances = [];

        for (const store of availableStores) {
            const storeCoords = await geocodeAddress(`${store.endereco}, ${cityId}`);
            if (storeCoords) {
                const distance = haversineDistance(userCoords, storeCoords);
                storeDistances.push({ nome: store.nome, endereco: store.endereco, distancia: distance, id: store.id });
                if (distance < minDistance) {
                    minDistance = distance;
                    closestStore = store;
                }
            } else {
                storeDistances.push({ nome: store.nome, endereco: store.endereco, distancia: null, id: store.id });
            }
        }

        if (!closestStore) {
            return { success: false, reason: 'Não foi possível verificar a localização das lojas.' };
        }

        // 3. Verifica se a loja mais próxima está aberta e se há tempo para o preparo
        const storeOpenResult = isStoreOpen(closestStore.horarios);
        if (!storeOpenResult.isOpen) {
            return { success: false, reason: `A loja mais próxima (${closestStore.nome}) está fechada no momento.` };
        }

        // Validação de 30 minutos antes de fechar
        const now = new Date();
        const [closeHour, closeMinute] = storeOpenResult.closingTime.split(':').map(Number);
        const closingTime = new Date();
        closingTime.setHours(closeHour, closeMinute, 0, 0);

        const thirtyMinutesBeforeClosing = new Date(closingTime.getTime() - 30 * 60 * 1000);

        // COMENTAR ESTA LINHA PARA DESABILITAR A VERIFICAÇÃO DE 30 MINUTOS
        
        //if (now > thirtyMinutesBeforeClosing) {
        //    return { success: false, reason: `A loja (${closestStore.nome}) fecha às ${storeOpenResult.closingTime}. Pedidos devem ser feitos até 30 min antes.` };
        //}

        // 4. Sucesso! Retorna os dados para o pedido final
        return {
            success: true,
            data: {
                nome: item.nome,
                loja_nome: closestStore.nome,
                loja_endereco: closestStore.endereco,
                opcoes_escolhidas: item.opcoes,
                opcoes_retiradas: item['opcoes-retirar'],
                valor: item.valor,
                fecha_loja: storeOpenResult.closingTime // Adiciona o horário de fechamento
            }
        };

    } catch (error) {
        console.error("Erro interno ao verificar item:", item.nome, error);
        return { success: false, reason: 'Ocorreu um erro inesperado no sistema.' };
    }
}

/**
 * Converte um endereço em coordenadas geográficas usando a API Nominatim (OpenStreetMap).
 * @param {string} address O endereço completo.
 * @returns {Promise<{lat: number, lon: number}|null>}
 */
async function geocodeAddress(address) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data && data.length > 0) {
            return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        }
        return null;
    } catch (error) {
        console.error('Erro de geocodificação:', error);
        return null;
    }
}

/**
 * Verifica se uma loja está aberta com base no horário atual.
 * @param {object} horarios O mapa de horários do Firestore.
 * @returns {{isOpen: boolean, closingTime: string}}
 */

function isStoreOpen(horarios) {
    // PARA TESTES: DESCOMENTAR A LINHA ABAIXO PARA SIMULAR LOJA SEMPRE ABERTA
    return { isOpen: true, closingTime: '22:00' };

    // COMENTAR O CÓDIGO ABAIXO PARA DESABILITAR A VERIFICAÇÃO DE HORÁRIO
    /*
    if (!horarios) return { isOpen: false, closingTime: '' };
    const now = new Date();
    const dayOfWeek = now.getDay().toString(); // 0=Domingo, 1=Segunda, ..., 6=Sábado
    const todayHours = horarios[dayOfWeek];
    if (!todayHours || !todayHours.abre || !todayHours.fecha) {
        return { isOpen: false, closingTime: '' }; // Não abre hoje
    }
    const [openHour, openMinute] = todayHours.abre.split(':').map(Number);
    const [closeHour, closeMinute] = todayHours.fecha.split(':').map(Number);
    const openTime = new Date();
    openTime.setHours(openHour, openMinute, 0, 0);
    const closeTime = new Date();
    closeTime.setHours(closeHour, closeMinute, 0, 0);
    if (closeTime < openTime) {
        closeTime.setDate(closeTime.getDate() + 1);
    }
    const isOpen = now >= openTime && now <= closeTime;
    return { isOpen, closingTime: todayHours.fecha }; 

    */

}


/**
 * Normaliza o nome de uma cidade para o formato de ID do documento.
 * Ex: "São José dos Campos" -> "sao_jose_dos_campos"
 */
function normalizeCity(cityName) {
    return cityName
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/\s+/g, '_'); // Substitui espaços por underscores
}

/**
 * Exibe os erros de verificação no modal de entrega.
 * @param {Array<{docId: string, reason: string}>} failedItems
 */
function showDeliveryErrors(failedItems) {
    // Limpa erros anteriores
    document.querySelectorAll('.delivery-item-row.item-error').forEach(row => {
        row.classList.remove('item-error');
        const errorMsg = row.querySelector('.delivery-error-message');
        if (errorMsg) errorMsg.remove();
    });

    // Adiciona novos erros
    failedItems.forEach(failed => {
        const itemRow = document.querySelector(`.delivery-item-row[data-doc-id="${failed.docId}"]`);
        if (itemRow) {
            itemRow.classList.add('item-error');
            const reasonElement = document.createElement('div');
            reasonElement.className = 'delivery-error-message';
            reasonElement.textContent = failed.reason;
            itemRow.querySelector('.delivery-item-center').appendChild(reasonElement);
        }
    });
}



document.addEventListener('DOMContentLoaded', initCart);
// FINAL DO CÓDIGO