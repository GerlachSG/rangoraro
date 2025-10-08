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

    // Templates HTML
    const pendingOrderCardTemplate = document.getElementById('pending-order-card-template');
    const deliveryViewTemplate = document.getElementById('delivery-view-template');
    const deliveryItemTemplate = document.getElementById('delivery-item-template');
    
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
    let finalRouteGenerated = false;

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
                
                if (road && city) {
                    return finalAddress;
                } else {
                    return data.display_name;
                }
            }
            throw new Error("Não foi possível encontrar detalhes do endereço.");
        } catch (error) {
            console.error("Erro de geocodificação reversa:", error);
            return `${lat},${lon}`;
        }
    }


    async function getCoordsFromAddress(address) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data && data.length > 0) {
                return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
            }
            throw new Error("Endereço não encontrado.");
        } catch (error) {
            console.error("Erro de geocodificação:", error);
            return null;
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
            if (!entregadorCoords) {
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
                                await userRef.update({
                                    'endereco-atual': entregadorEnderecoAtual
                                });
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
                            btn.onclick = function() { // Usando function() para ter acesso ao 'this'
                                // **ALTERADO: Desabilita o botão para evitar clique duplo**
                                this.textContent = 'Aguarde...';
                                this.disabled = true;

                                // **ALTERADO: Usa as coordenadas exatas para máxima precisão**
                                const origin = lastStoreAddress || `${entregadorCoords.latitude},${entregadorCoords.longitude}`;
                                const destination = `${item.nomeLoja}, ${userInfo.endereco.split(',').slice(-2).join(',')}`;
                                
                                openGoogleMapsRoute(origin, destination);
                                console.log(`Item ${item.nomeDoItem} pedido para a loja ${item.nomeLoja}`);
                                
                                // Atualiza o status no banco de dados. A UI será redesenhada pelo listener.
                                updateItemStatus(orderToShow.id, index, "produzindo");
                            };
                            break;
                        case "produzindo":
                            btn = document.createElement("button");
                            btn.className = "btn btn-concluir";
                            btn.textContent = "Concluir";
                            btn.onclick = () => {
                                lastStoreAddress = `${item.nomeLoja}, ${userInfo.endereco.split(',').slice(-2).join(',')}`;
                                updateItemStatus(orderToShow.id, index, "pronto");
                            };
                            break;
                        case "pronto":
                            const done = document.createElement("button");
                            done.className = "btn btn-done";
                            done.innerHTML = '<i class="fa fa-check" aria-hidden="true"></i>';
                            done.disabled = true;
                            btn = done;
                            break;
                    }
                    if (btn) itemAction.appendChild(btn);
                    
                    if (index === firstUnfinishedItemIndex) {
                        itemRow.querySelector('.item-row').classList.add('item-enter-anim');
                    }

                    itemListContainer.appendChild(itemRow);
                });

                if (firstUnfinishedItemIndex === -1) {
                    if (finalRouteGenerated) {
                        const deliverBtn = document.createElement("button");
                        deliverBtn.className = "btn btn-main-deliver";
                        deliverBtn.textContent = "Entregar Pedido";
                        
                        deliverBtn.onclick = () => {
                            const itemList = activeDeliveryDisplay.querySelector('.item-list-container');
                            const footer = activeDeliveryDisplay.querySelector('.main-actions-footer');
                            if (itemList) itemList.style.display = 'none';
                            if (footer) footer.style.display = 'none';

                            const overlay = activeDeliveryDisplay.querySelector('.location-update-overlay');
                            const title = activeDeliveryDisplay.querySelector('#location-overlay-title');
                            const text = activeDeliveryDisplay.querySelector('#location-overlay-text');
                            
                            title.textContent = "Confirmação Final";
                            text.textContent = "Atualize sua localização para confirmar que está no endereço do cliente.";
                            overlay.style.display = 'flex';

                            const btnUpdate = activeDeliveryDisplay.querySelector('#btn-update-location-overlay');
                            const statusSpan = activeDeliveryDisplay.querySelector('#location-status-overlay');
                            
                            btnUpdate.onclick = async () => {
                                 statusSpan.textContent = 'Verificando...';
                                 navigator.geolocation.getCurrentPosition(async (position) => {
                                    const currentCoords = { lat: position.coords.latitude, lon: position.coords.longitude };
                                    const customerCoords = await getCoordsFromAddress(userInfo.endereco);

                                    if (customerCoords) {
                                        const distance = getDistanceFromLatLonInKm(currentCoords.lat, currentCoords.lon, customerCoords.latitude, customerCoords.longitude);
                                        // Considera-se "no local" se estiver a até 300 metros (0.3 km)
                                        if (distance <= 0.3) {
                                            completeDelivery(orderToShow);
                                        } else {
                                            alert(`Você está a ${distance.toFixed(2)}km de distância. Aproxime-se do cliente para finalizar.`);
                                            statusSpan.textContent = 'Muito distante.';
                                        }
                                    } else {
                                        alert("Não foi possível verificar a localização do cliente.");
                                        statusSpan.textContent = 'Erro ao verificar.';
                                    }

                                 }, (error) => {
                                    statusSpan.textContent = 'Erro ao obter sua localização.';
                                 });
                            };
                        };
                        mainActionsFooter.appendChild(deliverBtn);

                    } else {
                        const routeToCustomerBtn = document.createElement("button");
                        routeToCustomerBtn.className = "btn btn-main-deliver";
                        routeToCustomerBtn.textContent = "Gerar Rota até Cliente";
                        routeToCustomerBtn.onclick = function() { // Usando function() para ter acesso ao 'this'
                            // **ALTERADO: Desabilita o botão para evitar clique duplo**
                            this.textContent = 'Aguarde...';
                            this.disabled = true;

                            // **ALTERADO: Usa as coordenadas exatas para máxima precisão**
                            const origin = `${entregadorCoords.latitude},${entregadorCoords.longitude}`;
                            const destination = userInfo.endereco;
                            
                            openGoogleMapsRoute(origin, destination);
                            finalRouteGenerated = true;
                            
                            // A UI será atualizada pelo listener do Firestore, mas podemos forçar uma atualização
                            // para que o botão "Entregar Pedido" apareça imediatamente.
                            setTimeout(() => updateUI(), 100);
                        };
                        mainActionsFooter.appendChild(routeToCustomerBtn);
                    }
                }
            }
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
                    finalRouteGenerated = false;
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
                const allItemsReady = itens.every(i => i.status === "pronto");
                let orderStatus = allItemsReady ? "entregando" : "produzindo";
                t.update(orderRef, { itensPedido: itens, status: orderStatus });
            });
        } catch (error) { console.error("Erro ao atualizar status do item:", error); }
    }

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