// js/delivery.js

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
    const authCodeOverlay = document.getElementById('auth-code-verification-overlay');
    const authCodeInputs = authCodeOverlay.querySelectorAll('.auth-code-input');
    const btnCancelAuthCode = document.getElementById('btn-cancel-auth-code');
    const btnConfirmAuthCode = document.getElementById('btn-confirm-auth-code');
    const authCodeStatus = document.getElementById('auth-code-status-overlay');

    // Templates HTML
    const pendingOrderCardTemplate = document.getElementById('pending-order-card-template');
    const deliveryViewTemplate = document.getElementById('delivery-view-template');
    const deliveryItemTemplate = document.getElementById('delivery-item-template');
    const authCodeDisplayTemplate = document.getElementById('auth-code-display-template');

    // Estado da aplicação
    let currentEntregador = null;
    let passedOrderIds = new Set();
    let listeners = [];
    let seenPendingOrderIds = new Set();
    let lastActiveOrderId = null;
    let entregadorStatus = "aguarding-ordem";
    let activeOrder = null;
    let pendingOrders = [];
    let entregadorCoords = null;
    let entregadorEnderecoAtual = null;
    let lastStoreAddress = null;

    // Funções de autenticação
    const loginComGoogle = () => { auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); };
    const logout = () => { auth.signOut(); };

    function showScreen(screenName) {
        loadingScreen.style.display = screenName === "loading" ? "flex" : "none";
        loginScreen.style.display = screenName === "login" ? "flex" : "none";
        mainContent.style.display = screenName === "main" ? "flex" : "none";
        headerRight.style.display = screenName === "main" ? "flex" : "none";
    }

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

    async function getAddressFromCoords(lat, lon) {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data && data.address) {
                const addr = data.address;
                const road = addr.road || '';
                const houseNumber = addr.house_number || '';
                const suburb = addr.suburb || '';
                const city = addr.city || addr.town || addr.village || '';
                let finalAddress = road;
                if (houseNumber) finalAddress += `, ${houseNumber}`;
                if (suburb) finalAddress += ` - ${suburb}`;
                if (city) finalAddress += `, ${city}`;
                if (road && city) return finalAddress;
                return data.display_name;
            }
            throw new Error("Não foi possível encontrar detalhes do endereço.");
        } catch (error) {
            console.error("Erro de geocodificação reversa:", error);
            return `${lat},${lon}`;
        }
    }

    function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function openGoogleMapsRoute(origin, destination) {
        const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
        window.open(url, '_blank');
    }

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

    function updateUI() {
        renderEntregasView(activeOrder, pendingOrders);
        renderPedidosPendentes(pendingOrders);
    }

    function formatTimestamp(timestamp) {
        return timestamp ? timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
    }

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
            pendingOrdersList.appendChild(card);
            if (!seenPendingOrderIds.has(order.id)) {
                 seenPendingOrderIds.add(order.id);
                 const elToAnimate = pendingOrdersList.lastElementChild.querySelector('.order-card');
                 if(elToAnimate) {
                    elToAnimate.classList.add('entering');
                    elToAnimate.addEventListener('animationend', () => elToAnimate.classList.remove('entering'), { once: true });
                 }
            }
        });
    }

    function renderEntregasView(currentActiveOrder, allPendingOrders) {
        activeDeliveryDisplay.innerHTML = "";
        const orderToShow = currentActiveOrder || allPendingOrders.find(p => !passedOrderIds.has(p.id));

        if (!orderToShow) {
            waitingForOrders.style.display = "block";
            return;
        }
        waitingForOrders.style.display = "none";

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
        const locationOverlay = view.querySelector('.location-update-overlay');

        if (isAccepted) {
            if (orderToShow.authCodigo) {
                // SE O PEDIDO TEM CÓDIGO, SIGNIFICA QUE O ENTREGADOR ESTÁ A CAMINHO DO CLIENTE
                const itemListWrapper = view.querySelector('.item-list-wrapper');
                itemListWrapper.innerHTML = `<div class="auth-delivery-prompt">
                    <h4>Aguardando confirmação</h4>
                    <p>Ao chegar no local, peça ao cliente o código de 4 dígitos para finalizar a entrega.</p>
                </div>`;
                
                const deliverBtn = document.createElement("button");
                deliverBtn.className = "btn btn-main-deliver";
                deliverBtn.textContent = "Finalizar Entrega";
                deliverBtn.onclick = () => showAuthCodeVerification(orderToShow);
                mainActionsFooter.appendChild(deliverBtn);

            } else if (!entregadorCoords) {
                // SE NÃO TEM COORDENADAS, PEDE A LOCALIZAÇÃO
                locationOverlay.style.display = 'flex';
                const btnUpdate = view.querySelector('#btn-update-location-overlay');
                const statusSpan = view.querySelector('#location-status-overlay');
                btnUpdate.onclick = () => {
                    statusSpan.textContent = 'Obtendo coordenadas...';
                    navigator.geolocation.getCurrentPosition(async (position) => {
                        try {
                            entregadorCoords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
                            statusSpan.textContent = 'Convertendo para endereço...';
                            entregadorEnderecoAtual = await getAddressFromCoords(position.coords.latitude, position.coords.longitude);
                            statusSpan.textContent = 'Salvando endereço...';
                            if (currentEntregador) {
                                const userRef = db.collection("users").doc(currentEntregador.uid);
                                await userRef.update({ 'endereco-atual': entregadorEnderecoAtual });
                            }
                            statusSpan.textContent = 'Localização obtida!';
                            setTimeout(() => updateUI(), 500);
                        } catch (error) {
                            console.error("Erro ao atualizar a localização no DB:", error);
                            statusSpan.textContent = 'Erro ao salvar localização.';
                        }
                    }, (geoError) => {
                        console.error("Erro de Geolocalização:", geoError);
                        statusSpan.textContent = 'Erro ao obter sua posição.';
                    });
                };
            } else {
                // ETAPA DE COLETA DOS ITENS
                locationOverlay.style.display = 'none';
                const firstUnfinishedItemIndex = orderToShow.itensPedido.findIndex(item => item.status !== 'pronto');

                orderToShow.itensPedido.forEach((item, index) => {
                    if (index > firstUnfinishedItemIndex && firstUnfinishedItemIndex !== -1) return;
                    const itemRow = deliveryItemTemplate.content.cloneNode(true);
                    itemRow.querySelector(".item-image").src = item.imagemUrl;
                    itemRow.querySelector(".item-name").textContent = item.nomeDoItem;
                    itemRow.querySelector(".item-store").textContent = `${item.nomeLoja} (fecha ${item.fechaLoja})`;
                    const itemAction = itemRow.querySelector(".item-action");
                    const itemStatus = item.status || "pendente";
                    let btn;
                    switch (itemStatus) {
                        case "pendente":
                            btn = document.createElement("button");
                            btn.className = "btn btn-produzir";
                            btn.textContent = "Gerar Rota";
                            btn.onclick = function() {
                                this.textContent = 'Aguarde...'; this.disabled = true;
                                const origin = lastStoreAddress || `${entregadorCoords.latitude},${entregadorCoords.longitude}`;
                                const destination = `${item.nomeLoja}, ${userInfo.endereco.split(',').slice(-2).join(',')}`;
                                openGoogleMapsRoute(origin, destination);
                                updateItemStatus(orderToShow.id, index, "produzindo");
                            };
                            break;
                        case "produzindo":
                            btn = document.createElement("button");
                            btn.className = "btn btn-concluir";
                            btn.textContent = "Coletado";
                            btn.onclick = () => {
                                lastStoreAddress = `${item.nomeLoja}, ${userInfo.endereco.split(',').slice(-2).join(',')}`;
                                updateItemStatus(orderToShow.id, index, "pronto");
                            };
                            break;
                        case "pronto":
                            const done = document.createElement("button");
                            done.className = "btn btn-done";
                            done.innerHTML = '<i class="fa fa-check" aria-hidden="true"></i>';
                            done.disabled = true; btn = done;
                            break;
                    }
                    if (btn) itemAction.appendChild(btn);
                    if (index === firstUnfinishedItemIndex) {
                        itemRow.querySelector('.item-row').classList.add('item-enter-anim');
                    }
                    itemListContainer.appendChild(itemRow);
                });

                if (firstUnfinishedItemIndex === -1) {
                    const routeToCustomerBtn = document.createElement("button");
                    routeToCustomerBtn.className = "btn btn-main-deliver";
                    routeToCustomerBtn.textContent = "Gerar Rota até Cliente";
                    routeToCustomerBtn.onclick = function() {
                        this.textContent = 'Gerando...'; this.disabled = true;
                        const origin = lastStoreAddress || `${entregadorCoords.latitude},${entregadorCoords.longitude}`;
                        const destination = userInfo.endereco;
                        openGoogleMapsRoute(origin, destination);
                        generateAndSetAuthCode(orderToShow.id);
                    };
                    mainActionsFooter.appendChild(routeToCustomerBtn);
                }
            }
        } else {
            // SE O PEDIDO NÃO FOI ACEITO AINDA
            const acceptBtn = document.createElement("button");
            acceptBtn.className = "btn btn-main-accept";
            acceptBtn.textContent = "Aceitar";
            acceptBtn.onclick = () => acceptOrder(orderToShow.id);
            if (entregadorStatus !== "aguardando-ordem") { acceptBtn.disabled = true; }
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

    function initializeListeners(uid) {
        const userStatusUnsub = db.collection("users").doc(uid).onSnapshot(doc => {
            entregadorStatus = doc.data()?.status || "aguardando-ordem";
            updateUI();
        });
        const activeOrderUnsub = db.collection("pedidos")
            .where("entregadorId", "==", uid)
            .where("status", "in", ["aceito", "produzindo", "entregando"])
            .onSnapshot(snapshot => {
                if (snapshot.empty) {
                    activeOrder = null;
                    entregadorCoords = null;
                    entregadorEnderecoAtual = null;
                    lastStoreAddress = null;
                } else {
                    activeOrder = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
                }
                updateUI();
            });
        const pendingOrdersUnsub = db.collection("pedidos")
            .where("status", "==", "pendente")
            .orderBy("createdAt", "desc")
            .onSnapshot(snapshot => {
                pendingOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                updateUI();
            });
        listeners.push(userStatusUnsub, activeOrderUnsub, pendingOrdersUnsub);
    }

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
                const itensComStatus = (orderData.itensPedido || []).map(it => ({ ...it, status: 'pendente' }));
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

    function passOrder(orderId) { passedOrderIds.add(orderId); updateUI(); }

    async function updateItemStatus(orderId, itemIndex, newStatus) {
        const orderRef = db.collection("pedidos").doc(orderId);
        try {
            await db.runTransaction(async (t) => {
                const doc = await t.get(orderRef);
                const order = doc.data();
                const itens = [...order.itensPedido];
                itens[itemIndex].status = newStatus;
                t.update(orderRef, { itensPedido: itens });
            });
        } catch (error) { console.error("Erro ao atualizar status do item:", error); }
    }

    async function generateAndSetAuthCode(orderId) {
        const orderRef = db.collection("pedidos").doc(orderId);
        const codigo = Math.floor(1000 + Math.random() * 9000);
        try {
            await orderRef.update({
                authCodigo: codigo,
                status: "entregando"
            });
        } catch (error) {
            console.error("Erro ao gerar código de autenticação:", error);
            alert("Não foi possível gerar o código. Tente novamente.");
        }
    }

    function showAuthCodeVerification(order) {
        authCodeOverlay.classList.add('active');
        authCodeInputs.forEach(input => input.value = '');
        authCodeInputs[0].focus();
        authCodeStatus.textContent = '';

        const confirmHandler = () => {
            const enteredCode = Array.from(authCodeInputs).map(input => input.value).join('');
            if (enteredCode.length === 4) {
                if (parseInt(enteredCode, 10) === order.authCodigo) {
                    authCodeStatus.textContent = 'Código correto! Finalizando...';
                    authCodeStatus.style.color = 'var(--cor-verde)';
                    completeDelivery(order);
                    hideAuthCodeVerification();
                } else {
                    authCodeStatus.textContent = 'Código incorreto. Tente novamente.';
                    authCodeStatus.style.color = 'var(--cor-vermelho)';
                    authCodeInputs.forEach(input => input.value = '');
                    authCodeInputs[0].focus();
                }
            } else {
                authCodeStatus.textContent = 'Por favor, preencha os 4 dígitos.';
                authCodeStatus.style.color = 'var(--cor-vermelho)';
            }
        };

        const cancelHandler = () => hideAuthCodeVerification();

        btnConfirmAuthCode.replaceWith(btnConfirmAuthCode.cloneNode(true));
        document.getElementById('btn-confirm-auth-code').addEventListener('click', confirmHandler);
        
        btnCancelAuthCode.replaceWith(btnCancelAuthCode.cloneNode(true));
        document.getElementById('btn-cancel-auth-code').addEventListener('click', cancelHandler);
    }

    function hideAuthCodeVerification() {
        authCodeOverlay.classList.remove('active');
    }

    authCodeInputs.forEach((input, index) => {
        input.addEventListener('input', () => {
            if (input.value && index < authCodeInputs.length - 1) {
                authCodeInputs[index + 1].focus();
            }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === "Backspace" && !input.value && index > 0) {
                authCodeInputs[index - 1].focus();
            }
        });
    });

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

    googleLoginButton.addEventListener("click", loginComGoogle);
    logoutBtn.addEventListener("click", logout);
    btnEntregas.addEventListener("click", () => switchView("entregas"));
    btnPedidosPendentes.addEventListener("click", () => switchView("pedidos-pendentes"));
});