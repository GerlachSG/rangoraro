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
        console.error('Erro ao adicionar item ao carrinho:', error);
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
    console.log('requestDelivery called. selectedItems size:', selectedItems.size);
    const user = auth.currentUser;
    if (!user) {
        console.warn('Usuário não logado - não é possível solicitar entrega.');
        alert('Para solicitar entrega você precisa estar logado.');
        return;
    }

    const selected = cartItems.filter(item => selectedItems.has(item.docId));

    // Ensure delivery modals exist in DOM
    ensureDeliveryModals();

    // Check if user has address document
    const userRef = db.collection('users').doc(user.uid);
    const addressCol = userRef.collection('address');
    const enderecoDocRef = addressCol.doc('endereco');

    // Use Promise.race to fallback to address modal if Firestore get() stalls or fails
    const getPromise = enderecoDocRef.get();
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({ __timeout: true }), 2000));

    Promise.race([getPromise, timeoutPromise]).then(result => {
        if (result && result.__timeout) {
            console.warn('Leitura de endereço demorou/estourou timeout — abrindo modal de endereço como fallback');
            openAddressModal(user, enderecoDocRef, selected);
            return;
        }

        const doc = result; // firestore document snapshot
        const data = doc.exists ? doc.data() : null;
        console.log('Endereco document snapshot received. exists:', doc.exists, 'data:', data);
        if (!doc.exists || !isAddressComplete(data)) {
            openAddressModal(user, enderecoDocRef, selected);
        } else {
            openOptionsModal(user, selected, enderecoDocRef, data);
        }
    }).catch(err => {
        console.error('Erro ao ler endereço do usuário (catch):', err);
        // fallback: open address modal so user can input
        openAddressModal(user, enderecoDocRef, selected);
    });
}

// Helper: check address completeness
function isAddressComplete(data) {
    if (!data) return false;
    if (!data.cep || !data.cidade || !data.bairro || !data.rua) return false;
    // numero must be an integer > 0
    const num = data.numero;
    if (num === undefined || num === null) return false;
    const parsed = parseInt(num, 10);
    return !isNaN(parsed) && parsed > 0;
}

// Ensure modals markup added only once
let _deliveryModalsInjected = false;
function ensureDeliveryModals() {
    if (_deliveryModalsInjected) return;
    console.log('ensureDeliveryModals: injecting delivery modals into DOM');

    const html = `
    <div class="cart-modal-overlay delivery-address-modal-overlay delivery-modal-hidden">
        <div class="delivery-modal">
            <div class="delivery-header"><h3>Endereço de Entrega</h3><button class="delivery-close">&times;</button></div>
            <div class="delivery-body">
                <label for="delivery-cep">CEP<input id="delivery-cep" name="cep" type="text" class="delivery-cep" placeholder="00000-000" autocomplete="postal-code"></label>
                <label for="delivery-cidade">Cidade<input id="delivery-cidade" name="cidade" type="text" class="delivery-cidade" autocomplete="address-level2"></label>
                <label for="delivery-bairro">Bairro<input id="delivery-bairro" name="bairro" type="text" class="delivery-bairro" autocomplete="address-level3"></label>
                <label for="delivery-rua">Rua<input id="delivery-rua" name="rua" type="text" class="delivery-rua" autocomplete="street-address"></label>
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

    <div class="cart-modal-overlay delivery-options-modal-overlay delivery-modal-hidden">
        <div class="delivery-modal">
            <div class="delivery-header"><h3>Opções do Pedido</h3><button class="cart-close options-close">&times;</button></div>
            <div class="delivery-body delivery-options-body">
                <!-- options will be injected here -->
            </div>
            <div class="delivery-actions">
                <button class="btn btn-secondary options-cancel">Cancelar</button>
                <button class="btn btn-primary options-confirm">Confirmar e Enviar</button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    console.log('ensureDeliveryModals: injected');

    // Wire up basic buttons
    document.querySelector('.delivery-close').addEventListener('click', () => closeModal('.delivery-address-modal-overlay'));
    document.querySelector('.delivery-cancel').addEventListener('click', () => closeModal('.delivery-address-modal-overlay'));
    document.querySelector('.delivery-save').addEventListener('click', onSaveAddressClicked);

    document.querySelector('.options-close').addEventListener('click', () => closeModal('.delivery-options-modal-overlay'));
    document.querySelector('.options-cancel').addEventListener('click', () => closeModal('.delivery-options-modal-overlay'));

    // Close when clicking outside (overlay)
    const addrOverlay = document.querySelector('.delivery-address-modal-overlay');
    if (addrOverlay) {
        addrOverlay.addEventListener('click', e => { if (e.target === addrOverlay) closeModal('.delivery-address-modal-overlay'); });
    }
    const optOverlay = document.querySelector('.delivery-options-modal-overlay');
    if (optOverlay) {
        optOverlay.addEventListener('click', e => { if (e.target === optOverlay) closeModal('.delivery-options-modal-overlay'); });
    }

    _deliveryModalsInjected = true;
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
    document.body.classList.remove('modal-open');
}

// Open address modal and prefill if possible
let _currentDeliveryContext = null; // { user, selectedItems, enderecoRef }
function openAddressModal(user, enderecoDocRef, selected) {
    console.log('openAddressModal called');
    _currentDeliveryContext = { user, selected, enderecoDocRef };
    const overlay = document.querySelector('.delivery-address-modal-overlay');
    if (!overlay) return;

    // Clear fields
    ['cep','cidade','bairro','rua','numero','complemento','referencia'].forEach(k => {
        const el = document.querySelector('.delivery-' + k);
        if (el) el.value = '';
    });

    // Try to prefill from firestore
    enderecoDocRef.get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            if (data) {
                if (data.cep) document.querySelector('.delivery-cep').value = data.cep;
                if (data.cidade) document.querySelector('.delivery-cidade').value = data.cidade;
                if (data.bairro) document.querySelector('.delivery-bairro').value = data.bairro;
                if (data.rua) document.querySelector('.delivery-rua').value = data.rua;
                if (data.numero !== undefined && data.numero !== null) document.querySelector('.delivery-numero').value = String(data.numero);
                if (data.complemento) document.querySelector('.delivery-complemento').value = data.complemento;
                if (data.referencia) document.querySelector('.delivery-referencia').value = data.referencia;
            }
        }
    }).catch(() => {});

    // Wire CEP autocomplete
    const cepInput = document.querySelector('.delivery-cep');
    if (cepInput) {
        cepInput.removeEventListener('blur', onCepBlur);
        cepInput.addEventListener('blur', onCepBlur);
    }

    openModal('.delivery-address-modal-overlay');
}

// CEP autocomplete using ViaCEP (no key required) - only fills cidade, bairro, rua
function onCepBlur(e) {
    const cepRaw = e.target.value || '';
    const cep = cepRaw.replace(/[^0-9]/g, '');
    if (cep.length !== 8) return;

    const url = `https://viacep.com.br/ws/${cep}/json/`;
    fetch(url).then(res => res.json()).then(data => {
        if (data && !data.erro) {
            if (data.localidade) document.querySelector('.delivery-cidade').value = data.localidade;
            if (data.bairro) document.querySelector('.delivery-bairro').value = data.bairro;
            if (data.logradouro) document.querySelector('.delivery-rua').value = data.logradouro;
            // leave numero, complemento, referencia empty for user to fill
        }
    }).catch(err => {
        console.warn('Erro ao buscar CEP:', err);
    });
}

// Save address and proceed to options modal
function onSaveAddressClicked() {
    if (!_currentDeliveryContext) return;
    const { user, selected, enderecoDocRef } = _currentDeliveryContext;

    const data = {
        cep: (document.querySelector('.delivery-cep') || { value: '' }).value.trim(),
        cidade: (document.querySelector('.delivery-cidade') || { value: '' }).value.trim(),
        bairro: (document.querySelector('.delivery-bairro') || { value: '' }).value.trim(),
        rua: (document.querySelector('.delivery-rua') || { value: '' }).value.trim(),
        numero: (document.querySelector('.delivery-numero') || { value: '' }).value.trim(),
        complemento: (document.querySelector('.delivery-complemento') || { value: '' }).value.trim(),
        referencia: (document.querySelector('.delivery-referencia') || { value: '' }).value.trim()
    };

    // Basic validation: required fields
    if (!data.cep || !data.cidade || !data.bairro || !data.rua || data.numero === '') {
        alert('Por favor preencha CEP, cidade, bairro, rua e número.');
        return;
    }

    // Convert numero to integer
    const numeroParsed = parseInt(data.numero.replace(/[^0-9]/g, ''), 10);
    if (isNaN(numeroParsed) || numeroParsed <= 0) {
        alert('Número inválido. Insira um número válido.');
        return;
    }
    data.numero = numeroParsed;

    enderecoDocRef.set(data, { merge: true }).then(() => {
        closeModal('.delivery-address-modal-overlay');
        // proceed to options modal using saved address
        openOptionsModal(user, selected, enderecoDocRef, data);
    }).catch(err => {
        console.error('Erro ao salvar endereço:', err);
        alert('Erro ao salvar endereço. Tente novamente.');
    });
}

// Build and open options modal
function openOptionsModal(user, selectedItemsArray, enderecoDocRef, addressData) {
    _currentDeliveryContext = { user, selected: selectedItemsArray, enderecoDocRef, addressData };
    const overlay = document.querySelector('.delivery-options-modal-overlay');
    console.log('openOptionsModal called. selectedItemsArray length:', (selectedItemsArray || []).length);
    if (!overlay) return;

    const container = overlay.querySelector('.delivery-options-body');
    container.innerHTML = '';

    // For each selected item, render option selectors if arrays exist on the item
    selectedItemsArray.forEach((item, idx) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'delivery-item-options delivery-item-row';

    // Left column: image only (fixed to the left)
    const leftCol = document.createElement('div');
    leftCol.className = 'delivery-item-left';
    const img = document.createElement('img');
    img.className = 'delivery-item-thumb';
    img.src = item.image || '';
    img.alt = item.name || 'Produto';
    leftCol.appendChild(img);

    // Center column: name (top-aligned)
    const centerCol = document.createElement('div');
    centerCol.className = 'delivery-item-center';
    const nameEl = document.createElement('div');
    nameEl.className = 'delivery-item-name';
    nameEl.textContent = item.name || 'Produto';
    centerCol.appendChild(nameEl);

        // Right column: options (single + multiple)
        const rightCol = document.createElement('div');
        rightCol.className = 'delivery-item-right';

        // opcoes (single choice)
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

        // opcoes-retirar (multiple choice) rendered as a select[multiple] to match visual style
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

        // hidden fields for item basic info
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

    // Wire confirm button
    const confirmBtn = document.querySelector('.options-confirm');
    // Disable confirm by default; it will be enabled when all required selects are filled
    confirmBtn.removeEventListener('click', onOptionsConfirm);
    confirmBtn.addEventListener('click', event => {
        // final guard: validate required selects before running confirm
        if (!areRequiredOptionsSelected()) {
            alert('Por favor selecione as opções obrigatórias antes de confirmar.');
            return;
        }
        onOptionsConfirm();
    });

    // Add listeners to inputs to toggle confirm button state
    function updateConfirmButtonState() {
        if (!confirmBtn) return;
        confirmBtn.disabled = !areRequiredOptionsSelected();
        if (confirmBtn.disabled) confirmBtn.classList.remove('btn-primary');
        else confirmBtn.classList.add('btn-primary');
    }

    function areRequiredOptionsSelected() {
        const containerLocal = overlay.querySelector('.delivery-options-body');
        if (!containerLocal) return true;
        let ok = true;
        containerLocal.querySelectorAll('.delivery-item-row').forEach(block => {
            const select = block.querySelector('select.optacoes-single');
            if (select) {
                if (!select.value || select.value === '') ok = false;
            }
        });
        return ok;
    }

    // wire change handlers
    overlay.querySelectorAll('select.optacoes-single').forEach(sel => {
        sel.addEventListener('change', updateConfirmButtonState);
    });
    overlay.querySelectorAll('.optacoes-multi-select').forEach(sel => {
        sel.addEventListener('change', updateConfirmButtonState);

        // Allow click-to-toggle on multiple select options (no Shift/Ctrl needed)
        sel.addEventListener('mousedown', function (e) {
            const target = e.target;
            if (target && target.tagName === 'OPTION') {
                e.preventDefault(); // prevent default multi-select behavior
                // toggle selection
                target.selected = !target.selected;
                // notify change
                const evt = new Event('change', { bubbles: true });
                sel.dispatchEvent(evt);
            }
        });
    });

    // Initial state
    updateConfirmButtonState();

    openModal('.delivery-options-modal-overlay');
}

function onOptionsConfirm() {
    if (!_currentDeliveryContext) return;
    const { user, selected, enderecoDocRef, addressData } = _currentDeliveryContext;

    const itemsPayload = [];
    const container = document.querySelector('.delivery-options-body');
    if (!container) return;

    // iterate each delivery-item-options block
    container.querySelectorAll('.delivery-item-options').forEach(block => {
        const info = block.querySelector('div[data-doc-id]');
        const docId = info ? info.dataset.docId : null;
        const nome = info ? info.dataset.nome : '';
        const imagemUrl = info ? info.dataset.imagemUrl : '';
        const fastfood = info ? info.dataset.fastfood : '';
        const valor = info ? Number(info.dataset.valor) : 0;

        const singleSel = block.querySelector('select.optacoes-single');
        const single = singleSel ? singleSel.value : null;

        const multi = [];
        const multiSel = block.querySelector('select.optacoes-multi-select');
        if (multiSel) {
            Array.from(multiSel.selectedOptions || []).forEach(opt => multi.push(opt.value));
        }

    itemsPayload.push({ docId, nome, imagemUrl, fastfood, valor, 'opcoes': single ? [single] : [], 'opcoes-retirar': multi });
    });

    // Build organized console log with address embedded into usuario
    const now = new Date();
    const formattedAddress = addressData ? `${addressData.rua || ''}${addressData.numero ? ', ' + addressData.numero : ''}${addressData.bairro ? ' - ' + addressData.bairro : ''}` : null;
    const userInfo = {
        displayName: user.displayName || user.email || 'Usuário',
        photoUrl: user.photoURL || null,
        horario: now.toLocaleString(),
        endereco: formattedAddress,
        cidade: addressData && addressData.cidade ? addressData.cidade : '',
        complemento: addressData && addressData.complemento ? addressData.complemento : '',
        referencia: addressData && addressData.referencia ? addressData.referencia : ''
    };

    const output = {
        usuario: userInfo,
        itens: itemsPayload
    };

    console.log('Pedido pra Verificar:', output);

    // Close modal after confirming
    closeModal('.delivery-options-modal-overlay');
    // Optionally clear selection
    // selectedItems.clear(); updateCartUI();
}

document.addEventListener('DOMContentLoaded', initCart);