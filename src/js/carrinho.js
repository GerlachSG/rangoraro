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
    const user = auth.currentUser;
    if (!user) {
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
            openAddressModal(user, enderecoDocRef, selected);
            return;
        }

        const doc = result; // firestore document snapshot
        const data = doc.exists ? doc.data() : null;
        if (!doc.exists || !isAddressComplete(data)) {
            openAddressModal(user, enderecoDocRef, selected);
        } else {
            openOptionsModal(user, selected, enderecoDocRef, data);
        }
    }).catch(err => {
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

    const html = `
    <div class="cart-modal-overlay delivery-address-modal-overlay delivery-modal-hidden">
        <div class="delivery-modal">
            <div class="delivery-header"><h3>Endereço de Entrega</h3><button class="delivery-close">&times;</button></div>
            <div class="delivery-body">
                <label for="delivery-cep">CEP<input id="delivery-cep" name="cep" type="text" class="delivery-cep" placeholder="00000-000" autocomplete="postal-code"></label>
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

    <div class="cart-modal-overlay delivery-options-modal-overlay delivery-modal-hidden">
        <div class="delivery-modal">
            <div class="delivery-header"><h3>Opções do Pedido</h3><button class="cart-close options-close">&times;</button></div>
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
        .loading-modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background-color: rgba(0, 0, 0, 0.6);
            display: flex; justify-content: center; align-items: center;
            z-index: 1002;
        }
        .loading-modal {
            background-color: var(--cor-fundo);
            padding: 30px 40px; border-radius: 12px;
            display: flex; flex-direction: column; align-items: center; gap: 20px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            border: 1px solid var(--cor-borda);
            min-width: 280px; /* Garante que o modal não mude de tamanho */
            text-align: center;
        }
        .loading-spinner {
            border: 5px solid var(--cor-fundo-secundario);
            border-top: 5px solid var(--cor-destaque);
            border-radius: 50%; width: 50px; height: 50px;
            animation: spin 1s linear infinite;
        }
        .loading-success {
            display: none; /* Hidden by default */
        }
        .success-checkmark {
            width: 55px;
            height: 55px;
            color: #28a745;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);


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

function showLoadingModal(message) {
    const overlay = document.querySelector('.loading-modal-overlay');
    if (overlay) {
        // Reset to loading state
        overlay.querySelector('.loading-spinner').style.display = 'block';
        overlay.querySelector('.loading-success').style.display = 'none';
        overlay.querySelector('.loading-message').textContent = message;
        overlay.style.display = 'flex';
    }
}

function showSuccessAndHideModal(message, duration = 3000) {
    const overlay = document.querySelector('.loading-modal-overlay');
    if (overlay) {
        // Switch to success state
        overlay.querySelector('.loading-spinner').style.display = 'none';
        overlay.querySelector('.loading-success').style.display = 'block';
        overlay.querySelector('.loading-message').textContent = message;

        // Hide after a delay
        setTimeout(() => {
            hideLoadingModal();
            closeCart(); // Fecha o modal do carrinho também
        }, duration);
    }
}

function hideLoadingModal() {
    const overlay = document.querySelector('.loading-modal-overlay');
    if (overlay) {
        overlay.style.display = 'none';
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
    document.body.classList.remove('modal-open');
}

// Open address modal and prefill if possible
let _currentDeliveryContext = null; // { user, selectedItems, enderecoRef }
function openAddressModal(user, enderecoDocRef, selected) {
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
    if (estadoInput) {
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
        if (input) {
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
        
        // Garante que o valor contém apenas dígitos
        const isInteger = /^\d+$/.test(numValue);
        const parsedNum = parseInt(numValue, 10);

        // Valida se é um número inteiro, positivo e com no máximo 4 dígitos.
        const isNumeroValid = isInteger && !isNaN(parsedNum) && parsedNum > 0 && numValue.length <= 4;

        if (numeroInput.dataset.touched === "true") {
            if (!isNumeroValid) {
                numeroInput.classList.add('input-error');
            } else {
                numeroInput.classList.remove('input-error');
            }
        }
        
        return isNumeroValid;
    }

    function validateRequiredFieldWithMinLength(input, minLength = 4) {
        if (!input) return false; // Should not happen if selector is correct
        const value = input.value.trim();
        
        // Only validate (and show error) if the field has been touched by the user
        if (input.dataset.touched === "true") {
            if (value.length < minLength) {
                input.classList.add('input-error');
                return false;
            }
        }
        
        // Always remove error if valid, regardless of touched state
        if (value.length >= minLength) {
            input.classList.remove('input-error');
        }
        
        return value.length >= minLength;
    }

    if (numeroInput) {
        numeroInput.addEventListener('input', (e) => {
            // Remove caracteres não numéricos (exceto dígitos)
            let value = e.target.value.replace(/[^\d]/g, '');
            
            // Limita o comprimento a 4 dígitos
            if (value.length > 4) {
                value = value.slice(0, 4);
            }
            
            // Atualiza o valor do campo
            e.target.value = value;

            numeroInput.dataset.touched = "true";
            validateNumero();
            updateSaveButtonState();
        });
    }
    if (complementoInput) {
        complementoInput.addEventListener('input', () => {
            complementoInput.dataset.touched = "true";
            validateRequiredFieldWithMinLength(complementoInput);
            updateSaveButtonState();
        });
    }
    if (referenciaInput) {
        referenciaInput.addEventListener('input', () => {
            referenciaInput.dataset.touched = "true";
            validateRequiredFieldWithMinLength(referenciaInput);
            updateSaveButtonState();
        });
    }

    function updateSaveButtonState() {
        const saveBtn = document.querySelector('.delivery-save');
        if (!saveBtn) return;

        const isNumeroValid = validateNumero();
        const isComplementoValid = validateRequiredFieldWithMinLength(complementoInput);
        const isReferenciaValid = validateRequiredFieldWithMinLength(referenciaInput);

        const allRequiredFieldsFilled = [
            (document.querySelector('.delivery-cep') || {}).value,
            (document.querySelector('.delivery-estado') || {}).value,
            (document.querySelector('.delivery-cidade') || {}).value,
            (document.querySelector('.delivery-bairro') || {}).value,
            (document.querySelector('.delivery-rua') || {}).value,
            (document.querySelector('.delivery-numero') || {}).value,
            (document.querySelector('.delivery-complemento') || {}).value,
            (document.querySelector('.delivery-referencia') || {}).value
        ].every(v => v && v.trim() !== '');

        if (allRequiredFieldsFilled && isNumeroValid && isComplementoValid && isReferenciaValid) {
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
        if (input) {
            input.addEventListener('input', updateSaveButtonState);
        }
    });

    // Função auxiliar para comparar similaridade de bairros
    function compareBairros(bairro1, bairro2) {
        if (!bairro1 || !bairro2) return false;
        
        // Normaliza os bairros (remove acentos, converte para minúsculas)
        const normalize = (str) => str.toLowerCase()
            .replace(/\s+/g, ' ').trim();
        
        const b1 = normalize(bairro1);
        const b2 = normalize(bairro2);
        
        // Verifica igualdade exata
        if (b1 === b2) return true;
        
        // Divide em palavras e verifica se todas as palavras de um estão no outro
        const words1 = new Set(b1.split(' '));
        const words2 = new Set(b2.split(' '));
        
        // Remove palavras comuns que não são relevantes para a comparação
        const commonWords = ['bairro', 'vila', 'jardim', 'parque', 'residencial'];
        commonWords.forEach(w => {
            words1.delete(w);
            words2.delete(w);
        });
        
        // Verifica se as palavras principais são as mesmas
        const array1 = Array.from(words1);
        const array2 = Array.from(words2);
        
        return array1.some(word => array2.includes(word));
    }

    async function tryAutocompleteCep() {
        const ufRaw = estadoInput ? estadoInput.value.trim() : '';
        const uf = getUfSigla(ufRaw);
        const cidade = cidadeInput ? cidadeInput.value.trim() : '';
        let rua = ruaInput ? ruaInput.value.trim() : '';
        const bairroInformado = document.querySelector('.delivery-bairro')?.value.trim() || '';

        if (!uf || !cidade || !rua || !bairroInformado) {
            return; 
        }

        rua = autocompleteTipoRua(rua);

        // Alterado para usar o ViaCEP diretamente
        const url = `https://viacep.com.br/ws/${encodeURIComponent(uf)}/${encodeURIComponent(cidade)}/${encodeURIComponent(rua)}/json/`;

        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();

                if (data.erro) {
                    throw new Error("CEP não encontrado para o endereço.");
                }
                
                let melhorMatch = null;
                if (Array.isArray(data)) {
                    // Se for uma lista, encontra a melhor correspondência de bairro
                    melhorMatch = data.find(endereco => compareBairros(bairroInformado, endereco.bairro)) || data[0];
                } else if (typeof data === 'object' && data.cep) {
                    // Se for um objeto único
                    melhorMatch = data;
                }

                if (melhorMatch) {
                    // Sucesso: preenche o formulário
                    cidadeInput?.classList.remove('input-error');
                    bairroInput?.classList.remove('input-error');
                    ruaInput?.classList.remove('input-error');
                    
                    document.querySelector('.delivery-cep').value = melhorMatch.cep || '';
                    document.querySelector('.delivery-bairro').value = melhorMatch.bairro || '';
                    document.querySelector('.delivery-cidade').value = melhorMatch.localidade || '';
                    document.querySelector('.delivery-estado').value = melhorMatch.uf || '';
                    document.querySelector('.delivery-rua').value = melhorMatch.logradouro || '';
                } else {
                    // Se não houver correspondência
                    throw new Error("Nenhuma correspondência de endereço encontrada.");
                }
            } else {
                // Erro na requisição
                throw new Error(`Falha na requisição ao ViaCEP: ${res.statusText}`);
            }
        } catch (e) {
            console.error('Erro na busca de endereço via ViaCEP:', e.message);
            // Adiciona classes de erro em caso de falha
            cidadeInput?.classList.add('input-error');
            ruaInput?.classList.add('input-error');
            bairroInput?.classList.add('input-error');
        }
        
        updateSaveButtonState();
    }
    // Remove estilo de erro quando o campo recebe foco
    cidadeInput && cidadeInput.addEventListener('focus', function() {
        this.classList.remove('input-error');
        ruaInput.classList.remove('input-error');
        bairroInput.classList.remove('input-error');
    });
    ruaInput && ruaInput.addEventListener('focus', function() {
        this.classList.remove('input-error');
        bairroInput.classList.remove('input-error');
        cidadeInput.classList.remove('input-error');
    });
    bairroInput && bairroInput.addEventListener('focus', function() {
        this.classList.remove('input-error');
        ruaInput.classList.remove('input-error');
        cidadeInput.classList.remove('input-error');
    });

    // Variável para controlar se algum campo está em foco
    let isAnyFieldFocused = false;

    // Eventos de focus e blur para controlar o estado
    [cidadeInput, ruaInput].forEach(input => {
        if (input) {
            input.addEventListener('focus', () => {
                isAnyFieldFocused = true;
            });
            input.addEventListener('blur', () => {
                setTimeout(() => {
                    // Verifica se nenhum campo está em foco antes de validar
                    if (!document.activeElement.matches('.delivery-body input[type="text"], .delivery-body select')) {
                        isAnyFieldFocused = false;
                        tryAutocompleteCep();
                    }
                }, 100); // Pequeno delay para garantir que o activeElement está atualizado
            });
        }
    });
    // Só permite salvar se todos os campos obrigatórios estiverem preenchidos
    
    estadoInput && estadoInput.addEventListener('input', updateSaveButtonState);
    cidadeInput && cidadeInput.addEventListener('input', updateSaveButtonState);
    bairroInput && bairroInput.addEventListener('input', updateSaveButtonState);
    ruaInput && ruaInput.addEventListener('input', updateSaveButtonState);
    document.querySelector('.delivery-cep') && document.querySelector('.delivery-cep').addEventListener('input', updateSaveButtonState);
    document.querySelector('.delivery-numero') && document.querySelector('.delivery-numero').addEventListener('input', updateSaveButtonState);
    _currentDeliveryContext = { user, selected, enderecoDocRef };
    const overlay = document.querySelector('.delivery-address-modal-overlay');
    if (!overlay) return;

    // Clear fields and reset validation state
    ['cep','estado','cidade','bairro','rua','numero','complemento','referencia'].forEach(k => {
        const el = document.querySelector('.delivery-' + k);
        if (el) {
            el.value = '';
            el.classList.remove('input-error');
            delete el.dataset.touched;
        }
    });

    // Try to prefill from firestore
    enderecoDocRef.get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            if (data) {
                if (data.cep) document.querySelector('.delivery-cep').value = data.cep;
                if (data.estado) document.querySelector('.delivery-estado').value = data.estado;
                if (data.cidade) document.querySelector('.delivery-cidade').value = data.cidade;
                if (data.bairro) document.querySelector('.delivery-bairro').value = data.bairro;
                if (data.rua) document.querySelector('.delivery-rua').value = data.rua;
                if (data.numero !== undefined && data.numero !== null) document.querySelector('.delivery-numero').value = String(data.numero);
                if (data.complemento) document.querySelector('.delivery-complemento').value = data.complemento;
                if (data.referencia) document.querySelector('.delivery-referencia').value = data.referencia;
            }
        }
        updateSaveButtonState();
    }).catch(() => {
        updateSaveButtonState();
    });

    // Wire CEP autocomplete
    const cepInput = document.querySelector('.delivery-cep');
    if (cepInput) {
        cepInput.removeEventListener('blur', onCepBlur);
        cepInput.addEventListener('blur', onCepBlur);
    }

    openModal('.delivery-address-modal-overlay');
    updateSaveButtonState();
}

// CEP autocomplete using ViaCEP (no key required) - fills all address fields
async function onCepBlur(e) {
    const cepRaw = e.target.value || '';
    const cep = cepRaw.replace(/[^0-9]/g, '');
    
    if (cep.length !== 8) {
        return;
    }

    const url = `https://viacep.com.br/ws/${cep}/json/`;
    
    try {
        const res = await fetch(url);
        if (!res.ok) {
            return;
        }

        const data = await res.json();
        if (data.erro) {
            return;
        }

        // Preenche todos os campos disponíveis
        if (data.localidade) document.querySelector('.delivery-cidade').value = data.localidade;
        if (data.uf) document.querySelector('.delivery-estado').value = data.uf;
        if (data.bairro) document.querySelector('.delivery-bairro').value = data.bairro;
        if (data.logradouro) document.querySelector('.delivery-rua').value = data.logradouro;
        
        // leave numero, complemento, referencia empty for user to fill
    } catch (err) {
        console.warn('Erro ao buscar CEP:', err);
    }
}

// Save address and proceed to options modal
function onSaveAddressClicked() {
    if (!_currentDeliveryContext) return;

    const numeroInput = document.querySelector('.delivery-numero');
    const numValue = numeroInput ? numeroInput.value.trim() : '';
    const parsedNum = parseInt(numValue, 10);
    const isNumeroValid = !isNaN(parsedNum) && parsedNum > 0;

    if (!isNumeroValid) {
        if (numeroInput) {
            numeroInput.classList.add('input-error');
        }
        // Não exibe mais o alerta, o feedback visual é suficiente
        return;
    }

    const { user, selected, enderecoDocRef } = _currentDeliveryContext;

    const data = {
        cep: (document.querySelector('.delivery-cep') || { value: '' }).value.trim(),
        estado: (document.querySelector('.delivery-estado') || { value: '' }).value.trim(),
        cidade: (document.querySelector('.delivery-cidade') || { value: '' }).value.trim(),
        bairro: (document.querySelector('.delivery-bairro') || { value: '' }).value.trim(),
        rua: (document.querySelector('.delivery-rua') || { value: '' }).value.trim(),
        numero: numValue, // Usar o valor já validado
        complemento: (document.querySelector('.delivery-complemento') || { value: '' }).value.trim(),
        referencia: (document.querySelector('.delivery-referencia') || { value: '' }).value.trim()
    };

    // A validação de campos vazios é tratada pelo estado do botão, mas mantemos como uma segurança extra
    if (!data.cep || !data.estado || !data.cidade || !data.bairro || !data.rua || !data.numero) {
        // Este alerta pode ser removido se o botão desabilitado for suficiente
        alert('Por favor preencha todos os campos obrigatórios.');
        return;
    }

    data.numero = parsedNum; // Salvar o número parseado

    enderecoDocRef.set(data, { merge: true }).then(() => {
        closeModal('.delivery-address-modal-overlay');
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
    if (!overlay) return;

    const container = overlay.querySelector('.delivery-options-body');
    container.innerHTML = '';

    // For each selected item, render option selectors if arrays exist on the item
    selectedItemsArray.forEach((item, idx) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'delivery-item-options delivery-item-row';
        // Add data-doc-id to the main wrapper for easier selection later
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

// Wrapper to manage button state and call the main verification logic
async function onOptionsConfirmWrapper() {
    const confirmBtn = document.querySelector('.options-confirm');
    if (!confirmBtn || confirmBtn.disabled) return;

    if (!areRequiredOptionsSelected()) {
        alert('Por favor selecione as opções obrigatórias antes de confirmar.');
        return;
    }

    showLoadingModal('Confirmando pedido...');
    
    try {
        await onOptionsConfirm(); // Call the actual logic
    } catch (error) {
        // Se onOptionsConfirm der erro, o modal de loading é escondido
        hideLoadingModal();
        // O erro já é logado e alertado dentro de createDeliveryOrder
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


// ===================================================================
// === NOVO SISTEMA DE VERIFICAÇÃO DE ENTREGA (INÍCIO) ===
// ===================================================================

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
        itens: itemsPayload
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
        console.warn("Falha na verificação. Itens com problema:", failedItems);
        showDeliveryErrors(failedItems);
        alert('Alguns itens do seu pedido não puderam ser processados. Verifique os avisos em vermelho.');
    } else {
        // Todos os itens foram verificados com sucesso. Agora, criar o "Pedido de Entrega".
        await createDeliveryOrder(pedido, successfulItems);
    }
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
        // 1. Calcular valor total e valor da viagem
        const valorTotalItens = successfulItems.reduce((sum, item) => sum + item.valor, 0);
        const valorViagem = parseFloat((valorTotalItens * 0.15).toFixed(2)); // 15% (0.15) do valor total dos itens

        // 2. Formatar horários
        const horarioDoPedido = new Date(pedidoOriginal.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });

        // 3. Formatar endereço do usuário
        const { endereco, cidade, complemento, referencia } = usuario;
        const mainAddress = `${endereco}, ${cidade}`;
        const enderecoAdd = complemento || referencia ? `${complemento || ''}, ${referencia || ''}` : '';


        // 4. Estruturar o payload do pedido
        const deliveryOrderPayload = {
            userId: user.uid, // Adiciona o ID do usuário para a regra de segurança
            userInfo: {
                displayName: usuario.displayName,
                endereco: mainAddress,
                enderecoAdd: enderecoAdd,
                valorViagem: valorViagem
            },
            itensPedido: successfulItems.map(item => {
                // Encontra o item original para pegar a imagemUrl
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
            status: 'pendente', // Status inicial do pedido
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // 5. Salvar no Firestore
        await db.collection('pedidos').add(deliveryOrderPayload);

        showSuccessAndHideModal('Pedido confirmado!');
        closeModal('.delivery-options-modal-overlay');

        /*
        // 6. Limpar itens do carrinho
        const docsToRemove = new Set(originalItems.map(i => i.docId));
        const batch = db.batch();
        docsToRemove.forEach(docId => {
            const docRef = db.collection('users').doc(user.uid).collection('carrinho').doc(docId);
            batch.delete(docRef);
        });
        await batch.commit();

        selectedItems.clear();
        updateCartUI();
        */

    } catch (error) {
        console.error("Erro ao criar o pedido de entrega:", error);
        alert("Ocorreu um erro ao finalizar seu pedido. Por favor, tente novamente.");
        throw error; // Propaga o erro para o wrapper
    }
}

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

        storeDistances.forEach(s => {
            if (s.distancia !== null) {
                console.log(`- ${s.nome}: ${s.distancia.toFixed(2)} km`);
            } else {
                console.log(`- ${s.nome}: Distância não encontrada`);
            }
        });

        if (closestStore) {
            const closest = storeDistances.find(s => s.nome === closestStore.nome && s.endereco === closestStore.endereco);
            if (closest && closest.distancia !== null) {
                console.log(`Loja escolhida: ${closestStore.nome} (${closest.distancia.toFixed(2)} km)`);
            } else {
                console.log(`Loja escolhida: ${closestStore.nome} (distância não encontrada)`);
            }
        } else {
            console.log(`[LOG] Nenhuma loja com coordenadas válidas encontrada para o item '${item.nome}'.`);
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

        if (now > thirtyMinutesBeforeClosing) {
            return { success: false, reason: `A loja (${closestStore.nome}) fecha às ${storeOpenResult.closingTime}. Pedidos devem ser feitos até 30 min antes.` };
        }

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
 * Calcula a distância em linha reta (Haversine) entre duas coordenadas.
 * @returns {number} A distância em quilômetros.
 */
function haversineDistance(coords1, coords2) {
    const R = 6371; // Raio da Terra em km
    const dLat = (coords2.lat - coords1.lat) * Math.PI / 180;
    const dLon = (coords2.lon - coords1.lon) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(coords1.lat * Math.PI / 180) * Math.cos(coords2.lat * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Verifica se uma loja está aberta com base no horário atual.
 * @param {object} horarios O mapa de horários do Firestore.
 * @returns {{isOpen: boolean, closingTime: string}}
 */

function isStoreOpen(horarios) {
    
    // PARA TESTES: DESCOMENTAR A LINHA ABAIXO PARA SIMULAR LOJA SEMPRE ABERTA
    //return { isOpen: true, closingTime: '22:00' };

    // COMENTAR O CÓDIGO ABAIXO PARA DESABILITAR A VERIFICAÇÃO DE HORÁRIO
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

// ===================================================================
// === NOVO SISTEMA DE VERIFICAÇÃO DE ENTREGA (FIM) ===
// ===================================================================

document.addEventListener('DOMContentLoaded', initCart);
// FINAL DO CÓDIGO