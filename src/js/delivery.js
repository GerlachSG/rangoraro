document.addEventListener("DOMContentLoaded", () => {
    // Inicializa o app quando o DOM estiver pronto
    const firebaseConfig = {
        apiKey: "AIzaSyA2vtEfyZ9y7JUVbjCHFoK2BpvbFVSE4yM",
        authDomain: "rangoraro-app.firebaseapp.com",
        projectId: "rangoraro-app",
        storageBucket: "rangoraro-app.firebasestorage.app",
        messagingSenderId: "828393845765",
        appId: "1:828393845765:web:49323f020de4ffb6e2586c"
    };
    if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
    // Instâncias de autenticação e banco de dados do Firebase
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Seletores dos elementos da interface
    const loadingScreen = document.getElementById("loading-screen");
    const loginScreen = document.getElementById("login-screen");
    const mainContent = document.getElementById("main-content");
    const googleLoginButton = document.getElementById("google-login-btn");
    const profilePic = document.getElementById("profile-pic");
    const logoutBtn = document.getElementById("logout-btn");
    const headerRight = document.querySelector(".header-right");
    const btnEntregas = document.getElementById("btn-entregas");
    const btnPedidosPendentes = document.getElementById("btn-pedidos-pendentes");
    const entregasView = document.getElementById("entregas-view");
    const pedidosPendentesView = document.getElementById("pedidos-pendentes-view");
    const activeDeliveryDisplay = document.getElementById("active-delivery-display");
    const waitingForOrders = document.getElementById("waiting-for-orders");
    const pendingOrdersList = document.getElementById("pending-orders-list");

    // Templates HTML usados para clonar elementos dinamicamente
    const pendingOrderCardTemplate = document.getElementById('pending-order-card-template');
    const deliveryViewTemplate = document.getElementById('delivery-view-template');
    const deliveryItemTemplate = document.getElementById('delivery-item-template');

    // Estado da aplicação mantido em memória
    let currentEntregador = null;
    let passedOrderIds = new Set();
    let listeners = [];
    let seenPendingOrderIds = new Set();
    let lastActiveOrderId = null;
    let entregadorStatus = "aguardando-ordem";
    let activeOrder = null;
    let pendingOrders = [];

    // Funções de autenticação rápida
    const loginComGoogle = () => { auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); };
    const logout = () => { auth.signOut(); };
    
    // Troca quais telas são visíveis (loading / login / main)
    function showScreen(screenName) {
        loadingScreen.style.display = screenName === "loading" ? "flex" : "none";
        loginScreen.style.display = screenName === "login" ? "flex" : "none";
        mainContent.style.display = screenName === "main" ? "flex" : "none";
        headerRight.style.display = screenName === "main" ? "flex" : "none";
    }

    // Alterna entre as abas 'entregas' e 'pedidos-pendentes'
    function switchView(viewName) {
        if (viewName === 'entregas') {
            entregasView.style.display = "block";
            pedidosPendentesView.style.display = "none";
            btnEntregas.classList.add("active");
            btnPedidosPendentes.classList.remove("active");
        } else {
            entregasView.style.display = "none";
            pedidosPendentesView.style.display = "block";
            btnEntregas.classList.remove("active");
            btnPedidosPendentes.classList.add("active");
        }
    }

    // Observador de estado de autenticação do Firebase
    auth.onAuthStateChanged(async (user) => {
        listeners.forEach(unsubscribe => unsubscribe());
        listeners = [];
        
        if (user) {
            showScreen("loading");
            const idTokenResult = await user.getIdTokenResult(true);
            
            if (idTokenResult.claims.role === "entregador") {
                currentEntregador = user;
                profilePic.src = user.photoURL;
                showScreen("main");
                switchView("entregas");
                initializeListeners(user.uid);
            } else {
                alert("Você não tem permissão para acessar esta página.");
                logout();
            }
        } else {
            currentEntregador = null;
            showScreen("login");
        }
    });

    // Função central que redesenha a UI com os dados atuais
    function updateUI() {
        renderEntregasView(activeOrder, pendingOrders);
        renderPedidosPendentes(pendingOrders);
    }

    // Formata timestamp do Firestore para uma string legível
    function formatTimestamp(timestamp) {
        return timestamp ? timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
    }

    // Renderiza a lista de pedidos pendentes
    function renderPedidosPendentes(orders) {
        pendingOrdersList.innerHTML = "";
        if (orders.length === 0) {
            pendingOrdersList.innerHTML = '<p class="placeholder-text">Nenhum pedido disponível.</p>';
            return;
        }

    orders.forEach(order => {
            const card = pendingOrderCardTemplate.content.cloneNode(true);
            card.querySelector(".order-user-name").textContent = order.userInfo.displayName;
            card.querySelector(".order-value").textContent = `R$ ${order.userInfo.valorViagem.toFixed(2).replace('.', ',')}`;
            card.querySelector(".order-address").textContent = order.userInfo.endereco;
            card.querySelector(".order-time").textContent = `Pedido às: ${formatTimestamp(order.createdAt)}`;
            
            const acceptBtn = card.querySelector(".btn-accept");
            acceptBtn.addEventListener("click", () => acceptOrder(order.id));
            
            if (entregadorStatus !== "aguardando-ordem") {
                acceptBtn.disabled = true;
                acceptBtn.textContent = "Ocupado";
            }
            
            const appended = pendingOrdersList.appendChild(card);
            if (!seenPendingOrderIds.has(order.id)) {
                seenPendingOrderIds.add(order.id);
                const el = appended.querySelector ? appended.querySelector('.order-card') : appended.getElementsByClassName('order-card')[0];
                if (el) {
                    el.classList.add('entering');
                    el.addEventListener('animationend', () => el.classList.remove('entering'), { once: true });
                }
            }
        });
    }

    // Renderiza a visualização de uma entrega ativa ou o próximo pedido disponível
    function renderEntregasView(currentActiveOrder, allPendingOrders) {
        activeDeliveryDisplay.innerHTML = "";
        const orderToShow = currentActiveOrder || allPendingOrders.find(p => !passedOrderIds.has(p.id));

        if (!orderToShow) {
            waitingForOrders.style.display = "block";
            return;
        }
        waitingForOrders.style.display = "none";
        
    // Determina se o entregador já aceitou o pedido
    const isAccepted = !!currentActiveOrder;
        const view = deliveryViewTemplate.content.cloneNode(true);
        const userInfo = orderToShow.userInfo;
        
        view.querySelector(".customer-name").textContent = userInfo.displayName;
        view.querySelector(".customer-address").textContent = userInfo.endereco;
        view.querySelector(".customer-address-add").textContent = userInfo.enderecoAdd || "Sem complemento.";
    view.querySelector(".customer-order-time").textContent = formatTimestamp(orderToShow.createdAt);
        view.querySelector(".travel-value").textContent = `R$ ${userInfo.valorViagem.toFixed(2).replace('.', ',')}`;

        const itemListContainer = view.querySelector(".item-list-container");
        const mainActionsFooter = view.querySelector(".main-actions-footer");
        let allItemsReady = true;

    // Gera linhas para cada item do pedido
    orderToShow.itensPedido.forEach((item, index) => {
            const itemRow = deliveryItemTemplate.content.cloneNode(true);
            itemRow.querySelector(".item-image").src = item.imagemUrl;
            itemRow.querySelector(".item-name").textContent = item.nomeDoItem;
            itemRow.querySelector(".item-store").textContent = `${item.nomeLoja} (fecha ${item.fechaLoja})`;
            const optionsContainer = itemRow.querySelector(".item-options");
            optionsContainer.innerHTML = '';

            if (item.opcoes && item.opcoes.length) {
                const group = document.createElement('div');
                group.className = 'opt-group';
                const title = document.createElement('strong');
                title.textContent = 'Opção única escolhida:';
                group.appendChild(title);
                const ul = document.createElement('ul');
                item.opcoes.forEach(opt => {
                    const li = document.createElement('li');
                    li.textContent = opt;
                    ul.appendChild(li);
                });
                group.appendChild(ul);
                optionsContainer.appendChild(group);
            }

            if (item['opcoes-retirar'] && item['opcoes-retirar'].length) {
                const group = document.createElement('div');
                group.className = 'opt-group';
                const title = document.createElement('strong');
                title.textContent = 'Retirar opções:';
                group.appendChild(title);
                const ul = document.createElement('ul');
                item['opcoes-retirar'].forEach(opt => {
                    const li = document.createElement('li');
                    li.textContent = opt;
                    ul.appendChild(li);
                });
                group.appendChild(ul);
                optionsContainer.appendChild(group);
            }

            const itemAction = itemRow.querySelector(".item-action");
            // Mostra controles dependendo do status do item quando o pedido foi aceito
            if (isAccepted) {
                const itemStatus = item.status || "pendente";
                let btn;
                switch (itemStatus) {
                    case "pendente":
                        allItemsReady = false;
                        btn = document.createElement("button");
                        btn.className = "btn btn-produzir";
                        btn.textContent = "Produzir";
                        btn.onclick = () => { updateItemStatus(orderToShow.id, index, "produzindo"); };
                        break;
                    case "produzindo":
                        allItemsReady = false;
                        btn = document.createElement("button");
                        btn.className = "btn btn-concluir";
                        btn.textContent = "Concluir";
                        btn.onclick = () => { const doneEl = document.createElement("button"); doneEl.className = "btn btn-done"; doneEl.innerHTML = '<i class="fa fa-check" aria-hidden="true"></i>'; doneEl.setAttribute('aria-label', 'Concluído'); doneEl.disabled = true; if (btn && btn.parentNode) btn.parentNode.replaceChild(doneEl, btn); updateItemStatus(orderToShow.id, index, "pronto"); };
                        break;
                    case "pronto":
                        const done = document.createElement("button");
                        done.className = "btn btn-done";
                        done.innerHTML = '<i class="fa fa-check" aria-hidden="true"></i>';
                        done.setAttribute('aria-label', 'Concluído');
                        done.disabled = true;
                        btn = done;
                        break;
                }
                if (btn) itemAction.appendChild(btn);
            }
            itemListContainer.appendChild(itemRow);
        });

    // Mostra ações principais dependendo se o pedido foi aceito
    if (isAccepted) {
            const deliverBtn = document.createElement("button");
            deliverBtn.className = "btn btn-main-deliver";
            deliverBtn.textContent = "Entregar Pedido";
            deliverBtn.onclick = () => completeDelivery(orderToShow);
            deliverBtn.disabled = !allItemsReady || orderToShow.status !== "entregando";
            if (!deliverBtn.disabled) {
                deliverBtn.textContent = "Confirmar Entrega";
            }
            mainActionsFooter.appendChild(deliverBtn);
    } else {
            const acceptBtn = document.createElement("button");
            acceptBtn.className = "btn btn-main-accept";
            acceptBtn.textContent = "Aceitar";
            acceptBtn.onclick = () => acceptOrder(orderToShow.id);
            if (entregadorStatus !== "aguardando-ordem") {
                acceptBtn.disabled = true;
            }

            const passBtn = document.createElement("button");
            passBtn.className = "btn btn-main-pass";
            passBtn.textContent = "Passar";
            passBtn.onclick = () => passOrder(orderToShow.id);
            mainActionsFooter.append(acceptBtn, passBtn);
        }

        activeDeliveryDisplay.appendChild(view);
        const activeId = orderToShow.id;
        if (activeId && activeId !== lastActiveOrderId) {
            lastActiveOrderId = activeId;
            const wrapper = activeDeliveryDisplay.querySelector('.delivery-details-card');
            if (wrapper) {
                wrapper.classList.add('entering');
                wrapper.addEventListener('animationend', () => wrapper.classList.remove('entering'), { once: true });
            }
        }
    }

    // Configura listeners em tempo real do Firestore (usuário, ativo, pendentes)
    function initializeListeners(uid) {
        const userStatusUnsub = db.collection("users").doc(uid).onSnapshot(doc => {
            entregadorStatus = doc.data()?.status || "aguardando-ordem";
            updateUI();
        });

        const activeOrderUnsub = db.collection("pedidos")
            .where("entregadorId", "==", uid)
            .where("status", "in", ["aceito", "produzindo", "entregando"])
            .onSnapshot(snapshot => {
                activeOrder = snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
                updateUI();
            });

        const pendingOrdersUnsub = db.collection("pedidos")
            .where("status", "==", "pendente")
            .orderBy("createdAt", "desc")
            .onSnapshot(snapshot => {
                pendingOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                updateUI();
            });
        // Guarda as funções de unsubscribe para limpar os listeners quando necessário
        listeners.push(userStatusUnsub, activeOrderUnsub, pendingOrdersUnsub);

    }

    // Tenta aceitar um pedido com uma transação segura
    async function acceptOrder(orderId) {
        if (entregadorStatus !== "aguardando-ordem") {
            alert("Você já está ocupado com outra entrega.");
            return;
        }

        const orderRef = db.collection("pedidos").doc(orderId);
        const userRef = db.collection("users").doc(currentEntregador.uid);
        
        try {
            await db.runTransaction(async (transaction) => {
                const orderDoc = await transaction.get(orderRef);
                if (!orderDoc.exists || orderDoc.data().status !== "pendente") {
                    throw "Este pedido não está mais disponível.";
                }

                const orderData = orderDoc.data();
                const itensComStatus = (orderData.itensPedido || []).map(it => ({ ...it, status: it.status || 'pendente' }));

                transaction.update(orderRef, {
                    status: "aceito",
                    entregadorId: currentEntregador.uid,
                    entregadorEmail: currentEntregador.email,
                    horaAceito: firebase.firestore.FieldValue.serverTimestamp(),
                    itensPedido: itensComStatus
                });

                transaction.update(userRef, { status: "ocupado" });
            });
        } catch (error) { console.error("Erro ao aceitar pedido:", error); alert(error.toString()); }
    }

    // Marca localmente um pedido como 'passado' para pular sua exibição
    function passOrder(orderId) { passedOrderIds.add(orderId); updateUI(); }

    // Atualiza o status de um item dentro do pedido usando transação
    async function updateItemStatus(orderId, itemIndex, newStatus) {
        const orderRef = db.collection("pedidos").doc(orderId);
        try {
            await db.runTransaction(async (t) => {
                const doc = await t.get(orderRef);
                const order = doc.data();
                const itens = [...order.itensPedido];

                itens[itemIndex].status = newStatus;

                const allItemsReady = itens.every(i => i.status === "pronto");
                const isAnyItemProducing = itens.some(i => i.status === "produzindo");

                let orderStatus = order.status;
                if (allItemsReady) {
                    orderStatus = "entregando";
                } else if (isAnyItemProducing) {
                    orderStatus = "produzindo";
                }
                
                t.update(orderRef, { itensPedido: itens, status: orderStatus });
            });
        } catch (error) { console.error("Erro ao atualizar status do item:", error); }
    }

    // Finaliza a entrega: grava em 'pedidos-entregues', remove de 'pedidos' e libera o entregador
    async function completeDelivery(order) {
        const orderRef = db.collection("pedidos").doc(order.id);
        const userRef = db.collection("users").doc(currentEntregador.uid);
        const deliveredOrderRef = db.collection("pedidos-entregues").doc(order.id);

        try {
            const batch = db.batch();
            batch.set(deliveredOrderRef, { ...order, status: "entregue", horaEntrega: firebase.firestore.FieldValue.serverTimestamp() });
            batch.delete(orderRef);
            batch.update(userRef, { status: "aguardando-ordem" });

            await batch.commit();
            passedOrderIds.clear();
        } catch (error) { console.error("Erro ao finalizar entrega:", error); alert("Não foi possível finalizar a entrega."); }
    }

    // Liga eventos dos botões da interface
    googleLoginButton.addEventListener("click", loginComGoogle);
    logoutBtn.addEventListener("click", logout);
    btnEntregas.addEventListener("click", () => switchView("entregas"));
    btnPedidosPendentes.addEventListener("click", () => switchView("pedidos-pendentes"));
});