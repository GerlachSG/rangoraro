// js/config.js

// --- NOVO: Array para guardar as funções de 'unsubscribe' dos listeners ---
let myOrdersListeners = [];

document.addEventListener('DOMContentLoaded', () => {
    // A inicialização do Firebase e Auth já deve ocorrer no script principal da página.
    // Presumindo que 'auth' e 'db' são variáveis globais ou estão acessíveis.
    auth.onAuthStateChanged(user => {
        if (user) {
            initializeProfileMenu(user);
        }
    });
});

/**
 * --- NOVA FUNÇÃO ---
 * Desconecta todos os listeners de pedidos para evitar sobrecarga.
 */
function unsubscribeMyOrdersListeners() {
    myOrdersListeners.forEach(unsubscribe => unsubscribe());
    myOrdersListeners = [];
}

/**
 * Fecha todos os menus dropdown e o menu mobile
 */
function closeAllMenus() {
    // Fecha todos os profile menus
    document.querySelectorAll('.profile-menu').forEach(menu => {
        menu.classList.remove('is-active');
    });
    
    // Fecha o menu mobile se estiver aberto
    const mobileSidebar = document.querySelector('.mobile-sidebar');
    const sidebarOverlay = document.querySelector('.mobile-sidebar-overlay');
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    
    if (mobileSidebar && mobileSidebar.classList.contains('active')) {
        mobileSidebar.classList.remove('active');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        if (menuToggle) menuToggle.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    // Fecha o widget de suporte se estiver aberto
    const supportWidget = document.getElementById('rango-chat-widget-container');
    if (supportWidget && supportWidget.classList.contains('open')) {
        supportWidget.classList.remove('open');
    }
    
    // Fecha o modal de carrinho se estiver aberto
    const cartModal = document.querySelector('.cart-modal-overlay');
    if (cartModal && cartModal.style.display === 'flex') {
        cartModal.style.display = 'none';
        document.body.classList.remove('modal-open');
    }
    
    // Fecha o modal de depósito se estiver aberto
    const depositModal = document.getElementById('deposit-modal-overlay');
    if (depositModal && depositModal.style.display === 'flex') {
        depositModal.style.display = 'none';
    }
}

function initializeProfileMenu(user) {
    const profilePic = document.querySelector('.header-right .profile-pic');
    if (!profilePic || document.querySelector('.profile-menu')) return;
    const profileContainer = document.createElement('div');
    profileContainer.className = 'profile-menu';
    const parent = profilePic.parentNode;
    parent.insertBefore(profileContainer, profilePic);
    profileContainer.appendChild(profilePic);
    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown-menu';
    dropdown.innerHTML = `
        <a href="#" id="change-address-btn">Alterar endereço</a>
        <a href="#" id="my-orders-btn">Meus pedidos</a>
        <a href="#" id="logout-btn-dropdown">Log Out</a>
    `;
    profileContainer.appendChild(dropdown);
    const handleLogout = () => auth.signOut().catch(error => console.error("Erro ao fazer logout:", error));
    document.getElementById('change-address-btn').addEventListener('click', e => { e.preventDefault(); profileContainer.classList.remove('is-active'); openAddressManagementModal(user); });
    document.getElementById('my-orders-btn').addEventListener('click', e => { e.preventDefault(); profileContainer.classList.remove('is-active'); openMyOrdersModal(user); });
    document.getElementById('logout-btn-dropdown').addEventListener('click', e => { e.preventDefault(); handleLogout(); });
    
    profilePic.addEventListener('click', e => { 
        e.stopPropagation(); 
        const wasActive = profileContainer.classList.contains('is-active');
        closeAllMenus();
        if (!wasActive) {
            profileContainer.classList.add('is-active');
        }
    });
    
    document.addEventListener('click', e => { if (!profileContainer.contains(e.target)) profileContainer.classList.remove('is-active'); });
}

async function openAddressManagementModal(user) {
    if (typeof ensureDeliveryModals !== 'function') {
        console.error("A função 'ensureDeliveryModals' do carrinho.js não foi encontrada.");
        return;
    }
    ensureDeliveryModals();
    const userRef = db.collection('users').doc(user.uid);
    const addressCol = userRef.collection('address');
    try {
        const snapshot = await addressCol.get();
        if (snapshot.empty) {
            const firstAddressRef = addressCol.doc('endereco-1');
            openAddressModal(user, [], firstAddressRef);
        } else {
            const addresses = [];
            snapshot.forEach(doc => addresses.push({ id: doc.id, ...doc.data() }));
            addresses.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
            openAddressSelectionModalForManagement(user, addresses);
        }
    } catch (err) {
        console.error("Erro ao buscar endereços para gerenciamento:", err);
        alert("Ocorreu um erro ao carregar seus endereços.");
    }
}
function openAddressSelectionModalForManagement(user, addresses) {
    const overlay = document.querySelector('.delivery-address-selection-modal-overlay');
    if (!overlay) return;
    const container = overlay.querySelector('.delivery-address-list');
    container.innerHTML = '';
    addresses.forEach(addr => {
        const addrElement = document.createElement('div');
        addrElement.className = 'address-option';
        const detailsSpan = `<span>${addr.bairro}, ${addr.cidade} - ${addr.estado.toUpperCase()}</span>`;
        let extraInfo = addr.complemento || addr.referencia || '';
        const extraSpan = extraInfo ? `<span class="address-option-extra">(${extraInfo})</span>` : '';
        addrElement.innerHTML = `<div class="address-option-details"><strong>${addr.rua}, ${addr.numero}</strong>${detailsSpan}${extraSpan}</div>`;
        addrElement.addEventListener('click', () => {
            closeModal('.delivery-address-selection-modal-overlay');
            const addressRef = db.collection('users').doc(user.uid).collection('address').doc(addr.id);
            openAddressModal(user, [], addressRef);
        });
        container.appendChild(addrElement);
    });
    if (addresses.length < 5) {
        const addButton = document.createElement('div');
        addButton.className = 'address-option add-new-address';
        addButton.innerHTML = '<strong>Adicionar Novo Endereço</strong>';
        addButton.addEventListener('click', () => {
            const nextAddressNumber = addresses.length + 1;
            const nextDocId = `endereco-${nextAddressNumber}`;
            const newAddressRef = db.collection('users').doc(user.uid).collection('address').doc(nextDocId);
            closeModal('.delivery-address-selection-modal-overlay');
            openAddressModal(user, [], newAddressRef);
        });
        container.appendChild(addButton);
    }
    openModal('.delivery-address-selection-modal-overlay');
}

function openMyOrdersModal(user) {
    if (!document.getElementById('my-orders-modal-overlay')) {
        const modalHTML = `
            <div class="cart-modal-overlay" id="my-orders-modal-overlay" style="display: none;">
                <div class="delivery-modal" id="my-orders-modal">
                    <div class="delivery-header"><h3>Meus Pedidos</h3><button class="delivery-close" id="my-orders-close-btn">&times;</button></div>
                    <nav class="view-switcher">
                        <button id="btn-inprogress-orders" class="view-btn active">Em Andamento</button>
                        <button id="btn-delivered-orders" class="view-btn">Entregues</button>
                    </nav>
                    <div class="delivery-body" id="my-orders-body">
                        <div id="inprogress-orders-view"></div>
                        <div id="delivered-orders-view" style="display: none;"></div>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const closeAndUnsubscribe = () => {
            document.getElementById('my-orders-modal-overlay').style.display = 'none';
            unsubscribeMyOrdersListeners(); 
        };
        
        document.getElementById('my-orders-close-btn').addEventListener('click', closeAndUnsubscribe);
        document.getElementById('my-orders-modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'my-orders-modal-overlay') closeAndUnsubscribe();
        });
        document.getElementById('btn-inprogress-orders').addEventListener('click', () => switchMyOrdersView('inprogress'));
        document.getElementById('btn-delivered-orders').addEventListener('click', () => switchMyOrdersView('delivered'));
    }

    unsubscribeMyOrdersListeners(); 
    
    document.getElementById('my-orders-modal-overlay').style.display = 'flex';
    document.getElementById('inprogress-orders-view').innerHTML = '<div class="loading-spinner" style="margin: auto;"></div>';
    document.getElementById('delivered-orders-view').innerHTML = '<div class="loading-spinner" style="margin: auto;"></div>';

    const inProgressUnsub = db.collection('pedidos').where('userId', '==', user.uid)
        .onSnapshot(async (snapshot) => {
            const inProgressOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            const entregadorIds = [...new Set(inProgressOrders.map(o => o.entregadorId).filter(id => id))];
            const entregadorLocations = {};
            if (entregadorIds.length > 0) {
                try {
                    const entregadoresDocs = await Promise.all(entregadorIds.map(id => db.collection('users').doc(id).get()));
                    entregadoresDocs.forEach(doc => {
                        if (doc.exists) entregadorLocations[doc.id] = doc.data()['endereco-atual'] || 'Localização indisponível';
                    });
                } catch (error) {
                    console.warn('Não foi possível carregar dados dos entregadores:', error);
                }
            }
            renderOrderList(document.getElementById('inprogress-orders-view'), inProgressOrders, entregadorLocations, 'Você não tem pedidos em andamento.');
        }, error => {
            console.error("Erro no listener de pedidos em andamento:", error);
            document.getElementById('inprogress-orders-view').innerHTML = '<p class="placeholder-text">Erro ao carregar pedidos.</p>';
        });

    const deliveredUnsub = db.collection('pedidos-entregues').where('userId', '==', user.uid).limit(10)
        .onSnapshot((snapshot) => {
            const deliveredOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => (b.horaEntrega?.toMillis() || 0) - (a.horaEntrega?.toMillis() || 0));
            renderOrderList(document.getElementById('delivered-orders-view'), deliveredOrders, {}, 'Você não tem pedidos entregues.');
        }, error => {
            console.error("Erro no listener de pedidos entregues:", error);
            document.getElementById('delivered-orders-view').innerHTML = '<p class="placeholder-text">Erro ao carregar histórico.</p>';
        });
    
    myOrdersListeners.push(inProgressUnsub, deliveredUnsub);
    switchMyOrdersView('inprogress');
}

function switchMyOrdersView(viewName) {
    const inProgressView = document.getElementById('inprogress-orders-view');
    const deliveredView = document.getElementById('delivered-orders-view');
    const btnInProgress = document.getElementById('btn-inprogress-orders');
    const btnDelivered = document.getElementById('btn-delivered-orders');

    if (viewName === 'inprogress') {
        inProgressView.style.display = 'block';
        deliveredView.style.display = 'none';
        btnInProgress.classList.add('active');
        btnDelivered.classList.remove('active');
    } else {
        inProgressView.style.display = 'none';
        deliveredView.style.display = 'block';
        btnInProgress.classList.remove('active');
        btnDelivered.classList.add('active');
    }
}

function renderOrderList(container, orders, locations, emptyMessage) {
    container.innerHTML = '';
    if (orders.length === 0) {
        container.innerHTML = `<p class="placeholder-text">${emptyMessage}</p>`;
        return;
    }

    const styleId = 'my-orders-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #my-orders-modal .delivery-body { display: block; overflow-y: auto; }
            .placeholder-text { text-align: center; color: var(--cor-texto-secundario); padding: 40px 0; }
            .order-details-card { background: var(--cor-fundo-secundario); border-radius: 10px; padding: 15px; margin-top: 15px; border: 1px solid var(--cor-borda); width: 100%; box-sizing: border-box; }
            .order-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--cor-borda); }
            .order-status { font-weight: bold; text-transform: capitalize; }
            .order-status.pendente { color: #fd7e14; } .order-status.aceito, .order-status.produzindo { color: #007bff; }
            .order-status.entregando { color: #2196F3; } .order-status.entregue { color: #28a745; }
            .order-item-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
            .order-item-img { width: 50px; height: 50px; border-radius: 5px; object-fit: contain; }
            .order-item-name { flex: 1; font-size: 0.9rem; }
            .order-item-status { font-size: 0.8rem; color: var(--cor-texto-secundario); min-width: 60px; text-align: right; }
            .entregador-location { font-size: 0.85rem; margin-top: 12px; color: #a0a0a0; border-top: 1px dashed var(--cor-borda); padding-top: 10px; }
            .customer-auth-code-wrapper { margin-top: 15px; padding: 15px; background-color: rgba(0,0,0,0.2); border-radius: 8px; text-align: center; }
            .customer-auth-code-wrapper .auth-code-label { font-size: 0.8rem; color: var(--cor-texto-secundario); margin-bottom: 8px; text-transform: uppercase; }
            .customer-auth-code-wrapper .auth-code-display { display: flex; justify-content: center; gap: 8px; }
            .customer-auth-code-wrapper .auth-code-digit { width: 40px; height: 50px; background-color: var(--cor-fundo-principal); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; font-weight: bold; }
            .customer-auth-code-wrapper .auth-code-info { font-size: 0.75rem; color: var(--cor-texto-secundario); margin-top: 10px; }
        `;
        document.head.appendChild(style);
    }
    
    orders.forEach(order => {
        const card = document.createElement('div');
        card.className = 'order-details-card';
        const statusClass = order.status.toLowerCase().replace(' ', '-');
        const orderDate = order.createdAt ? order.createdAt.toDate().toLocaleDateString('pt-BR') : 'Data indisponível';
        const isDelivered = order.status === 'entregue';

        // Adiciona a hora de entrega para pedidos entregues
        let dateDisplay = orderDate;
        if (isDelivered && order.horaEntrega) {
            const entregaDate = order.horaEntrega.toDate();
            dateDisplay = `${entregaDate.toLocaleDateString('pt-BR')} às ${entregaDate.toLocaleTimeString('pt-BR')}`;
        }

        let entregadorHTML = '';
        if (!isDelivered && order.entregadorId && locations[order.entregadorId]) {
            entregadorHTML = `<div class="entregador-location">📍 Entregador: ${locations[order.entregadorId]}</div>`;
        }

        // Capitaliza o status dos itens
        let itemsHTML = (order.itensPedido || []).map(item => {
            const itemStatus = item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1).toLowerCase() : '';
            const statusHTML = isDelivered ? '<div class="order-item-status"></div>' : `<div class="order-item-status">${itemStatus}</div>`;
            return `
                <div class="order-item-row">
                    <img src="${item.imagemUrl}" class="order-item-img" alt="${item.nomeDoItem}">
                    <div class="order-item-name">${item.nomeDoItem}</div>
                    ${statusHTML}
                </div>`;
        }).join('');
        
        // Mostra o código apenas para pedidos não entregues
        let authCodeHTML = '';
        if (order.authCodigo && !isDelivered) {
            const codeString = order.authCodigo.toString();
            authCodeHTML = `
                <div class="customer-auth-code-wrapper">
                    <p class="auth-code-label">Código de Entrega</p>
                    <div class="auth-code-display">
                        <span class="auth-code-digit">${codeString[0]}</span>
                        <span class="auth-code-digit">${codeString[1]}</span>
                        <span class="auth-code-digit">${codeString[2]}</span>
                        <span class="auth-code-digit">${codeString[3]}</span>
                    </div>
                    <p class="auth-code-info">Informe este código ao entregador para confirmar o recebimento.</p>
                </div>
            `;
        }

        // Capitaliza o status do pedido
        const capitalizedStatus = order.status.charAt(0).toUpperCase() + order.status.slice(1).toLowerCase();
        
        card.innerHTML = `
            <div class="order-header">
                <span>Pedido em: <strong>${dateDisplay}</strong></span>
                <span class="order-status ${statusClass}">${capitalizedStatus}</span>
            </div>
            ${itemsHTML}
            ${entregadorHTML}
            ${authCodeHTML}`; // Adiciona o bloco do código (se existir)
        container.appendChild(card);
    });
}