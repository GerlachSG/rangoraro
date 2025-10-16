// js/suporte-widget.js

if (!window.RangoSupportWidget) {
    window.RangoSupportWidget = {
        currentUser: null, currentView: 'home', viewHistory: [], viewData: {}, chatListener: null,

        init: function() {
            if (document.getElementById('rango-chat-bubble')) return;
            this.currentUser = window.rangoState.user;
            if (!this.currentUser) return;
            this.injectCSS(); this.createWidgetHTML(); this.setupEventListeners(); this.navigateTo('home');
        },
        destroy: function() {
            if (this.chatListener) this.chatListener();
            const bubble = document.getElementById('rango-chat-bubble');
            const widget = document.getElementById('rango-chat-widget-container');
            if (bubble) bubble.remove();
            if (widget) widget.remove();
        },
        navigateTo: function(viewName, data = {}) {
            if (this.currentView !== 'navigating_back') { this.viewHistory.push({ view: this.currentView, data: this.viewData }); }
            this.currentView = viewName; this.viewData = data;
            const contentArea = document.getElementById('rango-page-content');
            const headerTitle = document.getElementById('rango-header-title');
            const backButton = document.getElementById('rango-header-back');
            contentArea.innerHTML = '<div class="loader">Carregando...</div>';
            backButton.style.display = this.viewHistory.length > 1 ? 'block' : 'none';
            headerTitle.textContent = (viewName === 'home') ? `Olá, ${this.currentUser.displayName.split(' ')[0]}!` : (data.title || 'Suporte');
            this.updateActiveNav(viewName);
            const renderMap = {
                'home': this.renderHomeView, 'help': this.renderHelpView, 'articles': this.renderArticlesView,
                'article': this.renderArticleView, 'messages': this.renderMessagesView, 'chat': this.renderChatView
            };
            if (renderMap[viewName]) { renderMap[viewName].call(this, contentArea, data); }
        },
        navigateBack: function() {
            if (this.viewHistory.length <= 1) { this.viewHistory = []; this.navigateTo('home'); return; }
            const previousState = this.viewHistory.pop();
            this.currentView = 'navigating_back';
            this.navigateTo(previousState.view, previousState.data);
        },
        updateActiveNav: function(viewName) {
            document.querySelectorAll('.rango-nav-button').forEach(btn => btn.classList.remove('active'));
            let activeBtnId = 'nav-home';
            if (viewName.includes('help') || viewName.includes('article')) activeBtnId = 'nav-help';
            else if (viewName.includes('message') || viewName.includes('chat')) activeBtnId = 'nav-messages';
            document.getElementById(activeBtnId)?.classList.add('active');
        },
        renderHomeView: function(container) {
            container.innerHTML = `<h3>Como podemos te ajudar hoje?</h3><div class="rango-home-buttons"><button id="btn-help" class="rango-action-button"><span>Buscar ajuda</span><span class="icon">🔍</span></button><button id="btn-messages" class="rango-action-button"><span>Minhas conversas</span><span class="icon">💬</span></button></div>`;
            document.getElementById('btn-help').onclick = () => this.navigateTo('help', { title: 'Ajuda' });
            document.getElementById('btn-messages').onclick = () => this.navigateTo('messages', { title: 'Minhas Conversas' });
        },
        renderHelpView: async function(container) {
            try {
                const querySnapshot = await db.collection('help_collections').orderBy('order').get();
                if (querySnapshot.empty) { container.innerHTML = '<p>Nenhum tópico de ajuda encontrado no momento.</p>'; return; }
                let html = '<div class="collection-list">';
                querySnapshot.forEach(doc => { const c = doc.data(); html += `<div class="collection-item" data-id="${doc.id}" data-title="${c.title}"><div><strong>${c.title}</strong><small>${c.description}</small></div><span>❯</span></div>`; });
                container.innerHTML = html + '</div>';
                container.querySelectorAll('.collection-item').forEach(item => item.onclick = () => this.navigateTo('articles', { title: item.dataset.title, collectionId: item.dataset.id }));
            } catch (e) { container.innerHTML = 'Erro ao carregar tópicos de ajuda.'; console.error(e); }
        },
        renderArticlesView: async function(container, data) {
            try {
                const snapshot = await db.collection('help_collections').doc(data.collectionId).collection('articles').orderBy('order').get();
                if (snapshot.empty) { container.innerHTML = '<p>Nenhum artigo encontrado nesta categoria.</p>'; return; }
                let html = '<div class="article-list">';
                snapshot.forEach(doc => html += `<div class="article-item" data-id="${doc.id}" data-title="${doc.data().title}">${doc.data().title}</div>`);
                container.innerHTML = html + '</div>';
                container.querySelectorAll('.article-item').forEach(item => item.onclick = () => this.navigateTo('article', { title: item.dataset.title, collectionId: data.collectionId, articleId: item.dataset.id }));
            } catch (e) { container.innerHTML = 'Erro ao carregar artigos.'; console.error(e); }
        },
        renderArticleView: async function(container, data) {
            try {
                const doc = await db.collection('help_collections').doc(data.collectionId).collection('articles').doc(data.articleId).get();
                container.innerHTML = doc.exists ? `<div class="article-content">${doc.data().content}</div>` : 'Artigo não encontrado.';
            } catch (e) { container.innerHTML = 'Erro ao carregar artigo.'; console.error(e); }
        },
        formatDate: function(timestamp) {
            if (!timestamp) return '';
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            const now = new Date();
            const diff = now - date;
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            if (days === 0) return 'Hoje';
            if (days === 1) return 'Ontem';
            if (days < 7) return `${days} dias atrás`;
            return date.toLocaleDateString('pt-BR');
        },
        renderMessagesView: async function(container) {
            try {
                // Buscar conversas do usuário onde ele é participante
                const chatsQuery = await db.collection('support_chats')
                    .where('userId', '==', this.currentUser.uid)
                    .orderBy('lastUpdated', 'desc')
                    .get();
                
                let html = '<div class="messages-list">';
                let hasActiveChat = false;
                let activeChats = [];
                let closedChats = [];
                
                if (!chatsQuery.empty) {
                    chatsQuery.forEach(doc => {
                        const chatData = doc.data();
                        if (chatData.status === 'open') {
                            hasActiveChat = true;
                            activeChats.push({ id: doc.id, data: chatData });
                        } else {
                            closedChats.push({ id: doc.id, data: chatData });
                        }
                    });
                }
                
                // Mostrar conversas ativas
                if (activeChats.length > 0) {
                    activeChats.forEach(chat => {
                        const dateStr = this.formatDate(chat.data.lastUpdated);
                        html += `<div class="chat-preview-item" data-id="${chat.id}">
                            <div class="chat-info">
                                <strong>Conversa com Suporte</strong>
                                <small>${chat.data.lastMessage || 'Clique para continuar'}</small>
                            </div>
                            <div class="chat-meta">
                                <span class="chat-date">${dateStr}</span>
                                <span class="status-open">Aberta</span>
                            </div>
                        </div>`;
                    });
                }
                
                // Mostrar conversas fechadas
                if (closedChats.length > 0) {
                    html += '<div style="margin-top:15px;padding-top:15px;border-top:1px solid #333;">';
                    html += '<small style="color:#888;display:block;margin-bottom:10px;">Conversas anteriores:</small>';
                    closedChats.forEach(chat => {
                        const dateStr = this.formatDate(chat.data.lastUpdated);
                        const rating = chat.data.rating ? '⭐'.repeat(chat.data.rating) : '';
                        html += `<div class="chat-preview-item closed" data-id="${chat.id}">
                            <div class="chat-info">
                                <strong>Conversa finalizada</strong>
                                <small>${chat.data.lastMessage || 'Ver conversa'}</small>
                                ${rating ? `<small class="rating-display">${rating}</small>` : ''}
                            </div>
                            <div class="chat-meta">
                                <span class="chat-date">${dateStr}</span>
                                <span class="status-closed">Resolvida</span>
                            </div>
                        </div>`;
                    });
                    html += '</div>';
                }
                
                if (!hasActiveChat && closedChats.length === 0) {
                    html += '<p>Nenhuma conversa iniciada.</p>';
                }
                
                const buttonText = hasActiveChat ? "Ir para Conversa Ativa" : "Iniciar Nova Conversa";
                container.innerHTML = html + `</div><button id="open-chat-btn" class="rango-send-message-button">${buttonText}</button>`;
                
                // Event listeners para as conversas
                container.querySelectorAll('.chat-preview-item').forEach(item => {
                    item.onclick = () => this.navigateTo('chat', { 
                        title: 'Chat de Suporte', 
                        chatId: item.dataset.id 
                    });
                });
                
                // Botão principal
                container.querySelector('#open-chat-btn').onclick = () => {
                    if (hasActiveChat) {
                        this.navigateTo('chat', { title: 'Chat de Suporte', chatId: activeChats[0].id });
                    } else {
                        this.createNewChat();
                    }
                };
                
            } catch (e) {
                // Se erro de permissão, tentar buscar via localStorage como fallback
                if (e.code === 'permission-denied') {
                    console.log('Usando fallback via localStorage');
                    this.renderMessagesViewFallback(container);
                } else {
                    container.innerHTML = 'Ocorreu um erro ao carregar suas conversas.';
                    console.error("Erro em renderMessagesView:", e);
                }
            }
        },
        
        renderMessagesViewFallback: async function(container) {
            // Versão alternativa que busca chats individualmente do localStorage
            const userChats = JSON.parse(localStorage.getItem(`rango_chats_${this.currentUser.uid}`) || '[]');
            let html = '<div class="messages-list">';
            let hasActiveChat = false;
            let activeChats = [];
            let closedChats = [];
            
            for (const chatId of userChats) {
                try {
                    const doc = await db.collection('support_chats').doc(chatId).get();
                    if (doc.exists) {
                        const chatData = doc.data();
                        if (chatData.userId === this.currentUser.uid) {
                            if (chatData.status === 'open') {
                                hasActiveChat = true;
                                activeChats.push({ id: chatId, data: chatData });
                            } else {
                                closedChats.push({ id: chatId, data: chatData });
                            }
                        }
                    }
                } catch (e) {
                    console.log('Chat não acessível:', chatId);
                }
            }
            
            // Renderizar UI igual ao método principal
            if (activeChats.length > 0) {
                activeChats.forEach(chat => {
                    const dateStr = this.formatDate(chat.data.lastUpdated);
                    html += `<div class="chat-preview-item" data-id="${chat.id}">
                        <div class="chat-info">
                            <strong>Conversa com Suporte</strong>
                            <small>${chat.data.lastMessage || 'Clique para continuar'}</small>
                        </div>
                        <div class="chat-meta">
                            <span class="chat-date">${dateStr}</span>
                            <span class="status-open">Aberta</span>
                        </div>
                    </div>`;
                });
            }
            
            if (closedChats.length > 0) {
                html += '<div style="margin-top:15px;padding-top:15px;border-top:1px solid #333;">';
                html += '<small style="color:#888;display:block;margin-bottom:10px;">Conversas anteriores:</small>';
                closedChats.forEach(chat => {
                    const dateStr = this.formatDate(chat.data.lastUpdated);
                    const rating = chat.data.rating ? '⭐'.repeat(chat.data.rating) : '';
                    html += `<div class="chat-preview-item closed" data-id="${chat.id}">
                        <div class="chat-info">
                            <strong>Conversa finalizada</strong>
                            <small>${chat.data.lastMessage || 'Ver conversa'}</small>
                            ${rating ? `<small class="rating-display">${rating}</small>` : ''}
                        </div>
                        <div class="chat-meta">
                            <span class="chat-date">${dateStr}</span>
                            <span class="status-closed">Resolvida</span>
                        </div>
                    </div>`;
                });
                html += '</div>';
            }
            
            if (!hasActiveChat && closedChats.length === 0) {
                html += '<p>Nenhuma conversa iniciada.</p>';
            }
            
            const buttonText = hasActiveChat ? "Ir para Conversa Ativa" : "Iniciar Nova Conversa";
            container.innerHTML = html + `</div><button id="open-chat-btn" class="rango-send-message-button">${buttonText}</button>`;
            
            container.querySelectorAll('.chat-preview-item').forEach(item => {
                item.onclick = () => this.navigateTo('chat', { 
                    title: 'Chat de Suporte', 
                    chatId: item.dataset.id 
                });
            });
            
            container.querySelector('#open-chat-btn').onclick = () => {
                if (hasActiveChat) {
                    this.navigateTo('chat', { title: 'Chat de Suporte', chatId: activeChats[0].id });
                } else {
                    this.createNewChat();
                }
            };
        },
        
        createNewChat: async function() {
            try {
                // Gerar ID único para o chat
                const chatId = 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                
                const chatData = {
                    userId: this.currentUser.uid,
                    userName: this.currentUser.displayName,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'open',
                    lastMessage: '',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                // Tentar criar no Firestore
                await db.collection('support_chats').doc(chatId).set(chatData);
                
                // Salvar ID do chat no localStorage
                const userChats = JSON.parse(localStorage.getItem(`rango_chats_${this.currentUser.uid}`) || '[]');
                if (!userChats.includes(chatId)) {
                    userChats.push(chatId);
                    localStorage.setItem(`rango_chats_${this.currentUser.uid}`, JSON.stringify(userChats));
                }
                
                this.navigateTo('chat', { title: 'Chat de Suporte', chatId: chatId });
                
            } catch (e) {
                console.error("Erro ao criar novo chat:", e);
                
                // Se falhar por permissão, mostrar mensagem apropriada
                if (e.code === 'permission-denied') {
                    alert('Não foi possível criar uma nova conversa. Por favor, entre em contato com o suporte através do email.');
                } else {
                    alert('Erro ao criar conversa. Por favor, tente novamente.');
                }
            }
        },
        
        renderChatView: function(container, data) {
            container.innerHTML = `
                <div id="chat-messages" class="chat-messages-area"></div>
                <div id="rating-area" class="rating-area" style="display:none;">
                    <p>Como foi seu atendimento?</p>
                    <div class="stars" id="rating-stars">
                        <span class="star" data-rating="1">☆</span>
                        <span class="star" data-rating="2">☆</span>
                        <span class="star" data-rating="3">☆</span>
                        <span class="star" data-rating="4">☆</span>
                        <span class="star" data-rating="5">☆</span>
                    </div>
                    <div id="rating-feedback" class="thank-you" style="display:none;margin-top:10px;">Obrigado pela avaliação!</div>
                </div>
                <div class="chat-input-area" id="chat-input-area">
                    <input type="text" id="chat-input" placeholder="Digite sua mensagem...">
                    <button id="send-chat-btn">➤</button>
                </div>`;
            
            const messagesArea = container.querySelector('#chat-messages');
            const input = container.querySelector('#chat-input');
            const sendBtn = container.querySelector('#send-chat-btn');
            const inputArea = container.querySelector('#chat-input-area');
            const ratingArea = container.querySelector('#rating-area');
            const stars = container.querySelectorAll('.star');
            let chatStatus = 'open';
            let hasRated = false;
            
            // Limpar listener anterior
            if (this.chatListener) this.chatListener();
            
            // Verificar status do chat
            db.collection('support_chats').doc(data.chatId).get().then(doc => {
                if (doc.exists) {
                    const chatData = doc.data();
                    chatStatus = chatData.status || 'open';
                    hasRated = !!chatData.rating;
                    
                    // Verificar se o usuário é o dono do chat
                    if (chatData.userId !== this.currentUser.uid) {
                        messagesArea.innerHTML = '<div class="chat-message system">Você não tem permissão para acessar esta conversa.</div>';
                        inputArea.style.display = 'none';
                        return;
                    }
                    
                    if (chatStatus === 'closed') {
                        inputArea.style.display = 'none';
                        if (!hasRated) {
                            ratingArea.style.display = 'block';
                            // Configurar estrelas para avaliação
                            stars.forEach(star => {
                                star.onclick = async () => {
                                    if (hasRated) return;
                                    const rating = parseInt(star.dataset.rating);
                                    
                                    // Atualizar visual das estrelas
                                    stars.forEach((s, idx) => {
                                        if (idx < rating) {
                                            s.textContent = '★';
                                            s.classList.add('filled');
                                        }
                                    });
                                    
                                    // Salvar avaliação
                                    try {
                                        await db.collection('support_chats').doc(data.chatId).update({
                                            rating: rating,
                                            ratedAt: firebase.firestore.FieldValue.serverTimestamp()
                                        });
                                        
                                        hasRated = true;
                                        document.getElementById('rating-feedback').style.display = 'block';
                                        
                                        // Esconder estrelas após 2 segundos
                                        setTimeout(() => {
                                            ratingArea.style.display = 'none';
                                        }, 2000);
                                    } catch (e) {
                                        console.error('Erro ao salvar avaliação:', e);
                                    }
                                };
                            });
                        } else if (chatData.rating) {
                            // Mostrar avaliação já feita
                            stars.forEach((s, idx) => {
                                if (idx < chatData.rating) {
                                    s.textContent = '★';
                                    s.classList.add('filled');
                                }
                            });
                            document.getElementById('rating-feedback').style.display = 'block';
                            setTimeout(() => {
                                ratingArea.style.display = 'none';
                            }, 1000);
                        }
                    }
                } else {
                    messagesArea.innerHTML = '<div class="chat-message system">Conversa não encontrada.</div>';
                    inputArea.style.display = 'none';
                }
            }).catch(e => {
                console.error('Erro ao verificar status do chat:', e);
                messagesArea.innerHTML = '<div class="chat-message system">Erro ao carregar conversa.</div>';
                inputArea.style.display = 'none';
            });
            
            // Listener para mensagens
            try {
                this.chatListener = db.collection('support_chats').doc(data.chatId)
                    .collection('messages').orderBy('timestamp')
                    .onSnapshot(snapshot => {
                        messagesArea.innerHTML = '';
                        snapshot.forEach(doc => {
                            const msg = doc.data();
                            const msgDiv = document.createElement('div');
                            
                            if (msg.type === 'system-closed') {
                                msgDiv.className = 'chat-message system';
                                msgDiv.textContent = msg.text;
                                
                                // Quando receber mensagem de encerramento, atualizar UI
                                chatStatus = 'closed';
                                inputArea.style.display = 'none';
                                if (!hasRated) {
                                    ratingArea.style.display = 'block';
                                }
                            } else {
                                msgDiv.className = `chat-message ${msg.senderId === this.currentUser.uid ? 'sent' : 'received'}`;
                                msgDiv.textContent = msg.text;
                            }
                            
                            messagesArea.appendChild(msgDiv);
                        });
                        messagesArea.scrollTop = messagesArea.scrollHeight;
                    }, error => {
                        console.error("Erro no listener do chat:", error);
                        if (error.code === 'permission-denied') {
                            messagesArea.innerHTML = '<div class="chat-message system">Sem permissão para acessar mensagens.</div>';
                            inputArea.style.display = 'none';
                        }
                    });
            } catch (e) {
                console.error('Erro ao configurar listener:', e);
            }
            
            // Função para enviar mensagem
            const sendMessage = async () => {
                if (chatStatus === 'closed') return;
                
                const text = input.value.trim();
                if (text) {
                    input.value = '';
                    
                    try {
                        const chatRef = db.collection('support_chats').doc(data.chatId);
                        
                        // Atualizar informações do chat
                        await chatRef.update({
                            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                            lastMessage: text
                        });
                        
                        // Adicionar mensagem
                        await chatRef.collection('messages').add({
                            text: text,
                            senderId: this.currentUser.uid,
                            timestamp: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    } catch (e) {
                        console.error('Erro ao enviar mensagem:', e);
                        if (e.code === 'permission-denied') {
                            alert('Sem permissão para enviar mensagens.');
                        } else {
                            alert('Erro ao enviar mensagem. Tente novamente.');
                        }
                        input.value = text; // Restaurar texto se falhar
                    }
                }
            };
            
            sendBtn.onclick = sendMessage;
            input.onkeyup = (e) => { if(e.key === 'Enter') sendMessage(); };
        },
        
        createWidgetHTML: function() {
            const bubble = document.createElement('div');
            bubble.id = 'rango-chat-bubble';
            bubble.innerHTML = `<img src="https://cdn.jsdelivr.net/gh/eduardoamjunior/cdn-rangoraro@main/icon/logo.svg" alt="Suporte" style="width:32px;height:32px;">`;
            const widgetContainer = document.createElement('div');
            widgetContainer.id = 'rango-chat-widget-container';
            widgetContainer.innerHTML = `<div id="rango-widget-header"><button id="rango-header-back">❮</button><span id="rango-header-title"></span><button id="rango-header-close">×</button></div><main id="rango-page-content"></main><footer class="rango-widget-nav"><button id="nav-home" class="rango-nav-button active"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg><span>Home</span></button><button id="nav-help" class="rango-nav-button"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg><span>Ajuda</span></button><button id="nav-messages" class="rango-nav-button"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg><span>Mensagens</span></button></footer>`;
            document.body.appendChild(bubble);
            document.body.appendChild(widgetContainer);
        },
        setupEventListeners: function() {
            const bubble = document.getElementById('rango-chat-bubble');
            const widgetContainer = document.getElementById('rango-chat-widget-container');
            document.getElementById('rango-header-close').onclick = () => widgetContainer.classList.remove('open');
            document.getElementById('rango-header-back').onclick = () => this.navigateBack();
            bubble.onclick = () => { 
                // Fecha outros menus antes de abrir o widget
                if (typeof closeAllMenus === 'function') {
                    closeAllMenus();
                }
                
                widgetContainer.classList.add('open'); 
                this.viewHistory = []; 
                this.navigateTo('home'); 
            };
            document.getElementById('nav-home').onclick = () => this.navigateTo('home');
            document.getElementById('nav-help').onclick = () => this.navigateTo('help', { title: 'Ajuda' });
            document.getElementById('nav-messages').onclick = () => this.navigateTo('messages', { title: 'Minhas Conversas' });
        },
        injectCSS: function() {
            if (document.getElementById('rango-widget-styles')) return;
            const css =`#rango-chat-bubble{position:fixed;bottom:25px;right:25px;width:60px;height:60px;background-color:#3b82f6;color:#FFFFFF;border-radius:50%;display:flex;justify-content:center;align-items:center;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.2);transition:transform .2s ease-in-out;z-index:9999}#rango-chat-bubble:hover{transform:scale(1.1)}#rango-chat-widget-container{position:fixed;bottom:100px;right:25px;width:400px;height:700px;background-color:#1a1a1a;border-radius:15px;box-shadow:0 8px 24px rgba(0,0,0,0.2);overflow:hidden;display:flex;flex-direction:column;transform:scale(.95);opacity:0;pointer-events:none;transition:opacity .2s ease-in-out,transform .2s ease-in-out;z-index:10000;color:#fff;font-family:sans-serif}#rango-chat-widget-container.open{transform:scale(1);opacity:1;pointer-events:auto}#rango-widget-header{display:flex;justify-content:space-between;align-items:center;padding:15px;background:#111;border-bottom:1px solid #333;flex-shrink:0}#rango-header-title{font-weight:700;font-size:16px;text-align:center;flex:1;margin:0 10px}#rango-header-back,#rango-header-close{background:0 0;border:none;color:#fff;font-size:24px;cursor:pointer;width:30px}#rango-page-content{flex:1;display:flex;flex-direction:column;overflow-y:auto;padding:20px}.rango-widget-nav{display:flex;justify-content:space-around;padding:10px 0;background-color:#000;border-top:1px solid #333;flex-shrink:0}.rango-nav-button{background:0 0;border:none;color:#888;display:flex;flex-direction:column;align-items:center;font-size:12px;cursor:pointer;flex:1}.rango-nav-button svg{width:24px;height:24px;stroke-width:1.5;margin-bottom:4px;stroke:currentColor;fill:none}.rango-nav-button.active{color:#3b82f6}.rango-home-buttons{margin-top:20px}.rango-action-button{width:100%;padding:15px;border-radius:12px;border:1px solid #555;background-color:#333;color:#fff;font-size:16px;text-align:left;margin-bottom:10px;cursor:pointer;display:flex;justify-content:space-between;align-items:center}.collection-item,.article-item,.chat-preview-item{padding:15px;border-bottom:1px solid #333;cursor:pointer;display:flex;justify-content:space-between;align-items:center}.collection-item:hover,.article-item:hover,.chat-preview-item:hover{background:#222}.chat-preview-item.closed{opacity:0.8}.chat-info{flex:1;min-width:0}.chat-info strong{display:block;margin-bottom:4px}.chat-info small{display:block;color:#aaa;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.chat-meta{display:flex;flex-direction:column;align-items:flex-end;gap:4px}.chat-date{color:#888;font-size:12px}.chat-section{margin-bottom:20px}.chat-section h4{color:#888;font-size:14px;margin-bottom:10px;text-transform:uppercase}.rating-display{color:#f39c12;font-size:12px;margin-top:4px}.collection-item small{color:#aaa;display:block;margin-top:4px}.article-content h1,.article-content h2{margin-bottom:10px}.article-content p{line-height:1.6;color:#ccc}.chat-messages-area{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px}.chat-message{padding:8px 12px;border-radius:18px;max-width:75%;word-wrap:break-word;line-height:1.4}.chat-message.sent{background-color:#3b82f6;color:#fff;align-self:flex-end}.chat-message.received{background-color:#3a3b3c;color:#fff;align-self:flex-start}.chat-message.system{background:0 0;color:#aaa;font-style:italic;text-align:center;max-width:100%;align-self:center;padding:10px;border-top:1px solid #333;border-bottom:1px solid #333;margin:10px 0}.chat-input-area{display:flex;padding-top:10px;border-top:1px solid #333}.rating-area{padding:20px 0 0;text-align:center;border-top:1px solid #333;margin-top:10px}.rating-area p{margin-bottom:15px;color:#ccc}.stars{display:flex;justify-content:center;gap:10px;font-size:30px}.star{cursor:pointer;color:#555;transition:color .2s}.star:hover,.star.filled{color:#f39c12}.thank-you{font-weight:700;color:#2ecc71}.status-closed{color:#e74c3c;font-size:12px;font-weight:700}.status-open{color:#2ecc71;font-size:12px;font-weight:700}#chat-input{flex:1;background:#3a3b3c;border:none;border-radius:20px;padding:10px 15px;color:#fff;font-size:16px}#send-chat-btn{background:#3b82f6;color:#fff;border:none;border-radius:50%;width:40px;height:40px;margin-left:10px;cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center}.rango-send-message-button{width:100%;padding:15px;background:#3b82f6;color:#fff;border:none;border-radius:8px;font-size:16px;cursor:pointer;margin-top:20px}@media(max-width:768px){#rango-chat-widget-container{bottom:0;right:0;left:0;top:0;width:100%;height:100%;max-width:100%;max-height:100%;border-radius:0}#rango-chat-widget-container.open{transform:scale(1);opacity:1}}`;
            const style = document.createElement('style'); style.id = 'rango-widget-styles'; style.textContent = css; document.head.appendChild(style);
        }
    };
}
