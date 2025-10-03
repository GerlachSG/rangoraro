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
        // SUBSTITUA PELA VERSÃO CORRIGIDA
        renderArticleView: async function(container, data) {
            try {
                const doc = await db.collection('help_collections').doc(data.collectionId).collection('articles').doc(data.articleId).get();
                container.innerHTML = doc.exists ? `<div class="article-content">${doc.data().content}</div>` : 'Artigo não encontrado.'; // <<< CORRIGIDO (sem parênteses)
            } catch (e) { 
                container.innerHTML = 'Erro ao carregar artigo.'; 
                console.error(e); 
            }
        },
        // SUBSTITUA PELA VERSÃO CORRIGIDA
        renderMessagesView: async function(container) {
            try {
                const doc = await db.collection('support_chats').doc(this.currentUser.uid).get();
                let html = '<div class="messages-list">';
                const hasChat = doc.exists; // <<< CORRIGIDO (sem parênteses)

                if (hasChat) {
                    html += `<div class="chat-preview-item"><strong>Conversa com Suporte</strong><small>Última: ${doc.data().lastMessage}</small></div>`;
                } else {
                    html += '<p>Nenhuma conversa iniciada.</p>';
                }
                
                const buttonText = hasChat ? "Abrir Conversa" : "Iniciar Nova Conversa";
                container.innerHTML = html + `</div><button id="open-chat-btn" class="rango-send-message-button">${buttonText}</button>`;
                
                container.querySelector('#open-chat-btn').onclick = () => this.navigateTo('chat', { title: 'Chat de Suporte', chatId: this.currentUser.uid });
                
            } catch(e) { 
                // Este erro agora só deve aparecer se for realmente um problema de permissão
                container.innerHTML = 'Erro ao carregar conversas. Verifique as regras de segurança do Firestore.'; 
                console.error("Erro em renderMessagesView:", e); 
            }
        },
        renderChatView: function(container, data) {
            container.innerHTML = `<div id="chat-messages" class="chat-messages-area"></div><div class="chat-input-area"><input type="text" id="chat-input" placeholder="Digite sua mensagem..."><button id="send-chat-btn">➤</button></div>`;
            const messagesArea = container.querySelector('#chat-messages'), input = container.querySelector('#chat-input'), sendBtn = container.querySelector('#send-chat-btn');
            if (this.chatListener) this.chatListener();
            this.chatListener = db.collection('support_chats').doc(data.chatId).collection('messages').orderBy('timestamp').onSnapshot(snapshot => {
                messagesArea.innerHTML = '';
                snapshot.forEach(doc => { const msg = doc.data(), msgDiv = document.createElement('div'); msgDiv.className = `chat-message ${msg.senderId === this.currentUser.uid ? 'sent' : 'received'}`; msgDiv.textContent = msg.text; messagesArea.appendChild(msgDiv); });
                messagesArea.scrollTop = messagesArea.scrollHeight;
            }, error => console.error("Erro no listener do chat:", error));
            const sendMessage = async () => {
                const text = input.value.trim();
                if (text) {
                    input.value = '';
                    const chatRef = db.collection('support_chats').doc(data.chatId);
                    await chatRef.set({ userId: this.currentUser.uid, userName: this.currentUser.displayName, lastUpdated: firebase.firestore.FieldValue.serverTimestamp(), status: 'open', lastMessage: text }, { merge: true });
                    await chatRef.collection('messages').add({ text: text, senderId: this.currentUser.uid, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
                }
            };
            sendBtn.onclick = sendMessage;
            input.onkeyup = (e) => { if(e.key === 'Enter') sendMessage(); };
        },
        createWidgetHTML: function() {
            const bubble = document.createElement('div');
            bubble.id = 'rango-chat-bubble';
            bubble.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
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
            bubble.onclick = () => { widgetContainer.classList.add('open'); this.viewHistory = []; this.navigateTo('home'); };
            document.getElementById('nav-home').onclick = () => this.navigateTo('home');
            document.getElementById('nav-help').onclick = () => this.navigateTo('help', { title: 'Ajuda' });
            document.getElementById('nav-messages').onclick = () => this.navigateTo('messages', { title: 'Minhas Conversas' });
        },
        injectCSS: function() {
            if (document.getElementById('rango-widget-styles')) return;
            const css =`#rango-chat-bubble{position:fixed;bottom:25px;right:25px;width:60px;height:60px;background-color:#FF6B6B;color:#FFFFFF;border-radius:50%;display:flex;justify-content:center;align-items:center;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.2);transition:transform .2s ease-in-out;z-index:1000}#rango-chat-bubble:hover{transform:scale(1.1)}#rango-chat-widget-container{position:fixed;bottom:100px;right:25px;width:400px;height:700px;background-color:#1a1a1a;border-radius:15px;box-shadow:0 8px 24px rgba(0,0,0,0.2);overflow:hidden;display:flex;flex-direction:column;transform:scale(.95);opacity:0;pointer-events:none;transition:opacity .2s ease-in-out,transform .2s ease-in-out;z-index:1001;color:#fff;font-family:sans-serif}#rango-chat-widget-container.open{transform:scale(1);opacity:1;pointer-events:auto}#rango-widget-header{display:flex;justify-content:space-between;align-items:center;padding:15px;background:#111;border-bottom:1px solid #333;flex-shrink:0}#rango-header-title{font-weight:700;font-size:16px;text-align:center;flex:1;margin:0 10px}#rango-header-back,#rango-header-close{background:0 0;border:none;color:#fff;font-size:24px;cursor:pointer;width:30px}#rango-page-content{flex:1;display:flex;flex-direction:column;overflow-y:auto;padding:20px}.rango-widget-nav{display:flex;justify-content:space-around;padding:10px 0;background-color:#000;border-top:1px solid #333;flex-shrink:0}.rango-nav-button{background:0 0;border:none;color:#888;display:flex;flex-direction:column;align-items:center;font-size:12px;cursor:pointer;flex:1}.rango-nav-button svg{width:24px;height:24px;stroke-width:1.5;margin-bottom:4px;stroke:currentColor;fill:none}.rango-nav-button.active{color:#007bff}.rango-home-buttons{margin-top:20px}.rango-action-button{width:100%;padding:15px;border-radius:12px;border:1px solid #555;background-color:#333;color:#fff;font-size:16px;text-align:left;margin-bottom:10px;cursor:pointer;display:flex;justify-content:space-between;align-items:center}.collection-item,.article-item{padding:15px;border-bottom:1px solid #333;cursor:pointer;display:flex;justify-content:space-between;align-items:center}.collection-item:hover,.article-item:hover{background:#222}.collection-item small{color:#aaa;display:block;margin-top:4px}.article-content h1,.article-content h2{margin-bottom:10px}.article-content p{line-height:1.6;color:#ccc}.chat-messages-area{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px}.chat-message{padding:8px 12px;border-radius:18px;max-width:75%;word-wrap:break-word;line-height:1.4}.chat-message.sent{background-color:#007bff;color:#fff;align-self:flex-end}.chat-message.received{background-color:#3a3b3c;color:#fff;align-self:flex-start}.chat-input-area{display:flex;padding-top:10px;border-top:1px solid #333}#chat-input{flex:1;background:#3a3b3c;border:none;border-radius:20px;padding:10px 15px;color:#fff;font-size:16px}#send-chat-btn{background:#007bff;color:#fff;border:none;border-radius:50%;width:40px;height:40px;margin-left:10px;cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center}.rango-send-message-button{width:100%;padding:15px;background:#007bff;color:#fff;border:none;border-radius:8px;font-size:16px;cursor:pointer;margin-top:20px}`;
            const style = document.createElement('style'); style.id = 'rango-widget-styles'; style.textContent = css; document.head.appendChild(style);
        }
    };
}