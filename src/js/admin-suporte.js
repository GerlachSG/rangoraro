document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const loginBtn = document.getElementById('login-btn'), authScreen = document.getElementById('auth-screen'), dashboard = document.getElementById('support-dashboard');
    const chatListContent = document.querySelector('.chat-list-content'), messagesArea = document.getElementById('messages-area'), replyArea = document.getElementById('reply-area');
    const replyInput = document.getElementById('reply-input'), replyBtn = document.getElementById('reply-btn');
    const chatView = document.getElementById('chat-view');
    const chatViewHeader = document.getElementById('chat-view-header'), chatUserName = document.getElementById('chat-user-name'), closeChatBtn = document.getElementById('close-chat-btn');
    const confirmModal = document.getElementById('confirm-modal');
    const modalConfirm = document.getElementById('modal-confirm');
    const modalCancel = document.getElementById('modal-cancel');
    const welcomeScreen = document.getElementById('welcome-screen');
    
    // Control Buttons
    const minimizeBtn = document.getElementById('minimize-chat');
    const closeCurrentBtn = document.getElementById('close-current-chat');
    const logoutBtn = document.getElementById('logout-btn');

    // Templates
    const loadingChatListTemplate = document.getElementById('loading-chat-list');
    const loadingMessagesTemplate = document.getElementById('loading-messages');
    const errorStateTemplate = document.getElementById('error-state');

    let currentChatId = null, currentUser = null, messageListener = null;

    loginBtn.onclick = () => loginComGoogle();

    auth.onAuthStateChanged((user) => {
        if (user) {
            user.getIdTokenResult(true).then((idTokenResult) => {
                console.log('Claims do usuário:', idTokenResult.claims); // Log para debug
                if (idTokenResult.claims.support) {
                    currentUser = user;
                    authScreen.style.display = 'none';
                    dashboard.style.display = 'flex';
                    welcomeScreen.style.display = 'flex';
                    chatView.classList.remove('active');
                    loadOpenChats();
                } else {
                    console.error('Usuário não tem claim de suporte:', user.uid); // Log para debug
                    alert('Acesso negado. Apenas para a equipe de suporte.');
                    logout();
                }
            }).catch(error => {
                console.error("Erro ao verificar credenciais:", error);
                logout();
            });
        } else {
            authScreen.style.display = 'flex';
            dashboard.style.display = 'none';
            welcomeScreen.style.display = 'none';
            chatView.classList.remove('active');
            currentUser = null;
            currentChatId = null;
            if (messageListener) messageListener();
            messageListener = null;
        }
    });

    function showLoading(element, template) {
        const clone = template.content.cloneNode(true);
        element.innerHTML = '';
        element.appendChild(clone);
    }

    function showError(element, error, retryCallback) {
        const clone = errorStateTemplate.content.cloneNode(true);
        element.innerHTML = '';
        element.appendChild(clone);
        const retryBtn = element.querySelector('.retry-btn');
        if (retryBtn && retryCallback) {
            retryBtn.onclick = retryCallback;
        }
    }

    function showEmptyState() {
        messagesArea.innerHTML = `
            <div class="empty-state fade-in">
                <div class="icon">🦗</div>
                <div class="message">Cri cri cri...</div>
                <div class="submessage">Selecione uma conversa para começar o atendimento</div>
            </div>
        `;
    }

    function loadOpenChats() {
        showLoading(chatListContent, loadingChatListTemplate);
        
        db.collection('support_chats').where('status', '==', 'open').orderBy('lastUpdated', 'desc').onSnapshot(querySnapshot => {
            chatListContent.innerHTML = '<h2>Conversas Ativas</h2>';
            if (querySnapshot.empty) {
                chatListContent.innerHTML += `
                    <div class="empty-state fade-in">
                        <div class="icon">📭</div>
                        <div class="message">Nenhuma conversa ativa</div>
                        <div class="submessage">Aguardando novos atendimentos</div>
                    </div>
                `;
                return;
            }
            querySnapshot.forEach(doc => {
                const chat = doc.data(), chatItem = document.createElement('div');
                chatItem.className = 'chat-item fade-in';
                chatItem.dataset.chatId = doc.id;
                chatItem.dataset.userName = chat.userName;
                chatItem.innerHTML = `<strong>${chat.userName}</strong><small>${chat.lastMessage}</small>`;
                chatItem.onclick = () => loadChat(doc.id, chat.userName);
                chatListContent.appendChild(chatItem);
            });
        }, error => {
            console.error("Erro ao carregar chats:", error);
            showError(chatListContent, error, loadOpenChats);
        });
    }

    // Função para formatar data
    function formatDate(timestamp) {
        if (!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return new Intl.DateTimeFormat('pt-BR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    // Função para formatar valores monetários
    function formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    }

    async function loadUserInfo(userId) {
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                
                // Atualizar avatar e nome
                document.getElementById('user-avatar').src = userData.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
                document.getElementById('chat-user-name').textContent = userData.displayName;
                
                // Atualizar metadados
                document.getElementById('user-email').textContent = userData.email;
                document.getElementById('user-id').textContent = userId;
                
                // Atualizar estatísticas
                document.getElementById('user-balance').textContent = formatCurrency(userData.balance);
                document.getElementById('user-tickets').textContent = userData.raffleTickets || 0;
                document.getElementById('user-created-at').textContent = formatDate(userData.createdAt);
                
                // Adicionar título com informação completa nos elementos que podem ter texto truncado
                document.getElementById('user-email').title = userData.email;
                document.getElementById('user-id').title = userId;
            }
        } catch (error) {
            console.error('Erro ao carregar informações do usuário:', error);
        }
    }

    async function loadChat(chatId, userName) {
        currentChatId = chatId;
        replyArea.style.display = 'flex';
        chatViewHeader.style.display = 'flex';
        chatUserName.textContent = `Carregando informações...`;
        
        // Carregar informações do chat para obter o userId
        try {
            const chatDoc = await db.collection('support_chats').doc(chatId).get();
            if (chatDoc.exists) {
                const chatData = chatDoc.data();
                await loadUserInfo(chatData.userId);
            }
        } catch (error) {
            console.error('Erro ao carregar chat:', error);
        }

        if (messageListener) messageListener();
        messageListener = db.collection('support_chats').doc(chatId).collection('messages').orderBy('timestamp').onSnapshot(snapshot => {
            messagesArea.innerHTML = '';
            snapshot.forEach(doc => {
                const msg = doc.data(), msgDiv = document.createElement('div');
                msgDiv.className = `message ${msg.senderId === currentUser.uid ? 'support' : 'user'}`;
                msgDiv.textContent = msg.text;
                messagesArea.appendChild(msgDiv);
            });
            messagesArea.scrollTop = messagesArea.scrollHeight;
        });
        document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
        document.querySelector(`.chat-item[data-chat-id="${chatId}"]`).classList.add('active');
    }
    
    async function sendReply() {
        const text = replyInput.value.trim();
        if (text && currentChatId && currentUser) {
            replyInput.value = '';
            const chatRef = db.collection('support_chats').doc(currentChatId);
            await chatRef.collection('messages').add({ text: text, senderId: currentUser.uid, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
            await chatRef.update({ lastMessage: text, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() });
        }
    }

    function showConfirmModal() {
        confirmModal.classList.add('active');
    }

    function hideConfirmModal() {
        confirmModal.classList.remove('active');
    }

    async function closeChat() {
        if (!currentChatId) return;
        
        try {
            const chatRef = db.collection('support_chats').doc(currentChatId);

            // 1. Envia uma mensagem de sistema para o usuário
            await chatRef.collection('messages').add({
                text: 'A conversa foi encerrada pelo nosso suporte. Por favor, avalie o atendimento abaixo.',
                type: 'system-closed', // Tipo especial para o widget do usuário identificar
                senderId: 'system',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 2. Atualiza o status da conversa
            await chatRef.update({ status: 'closed' });

            // 3. Atualiza a interface do admin
            showEmptyState();
            replyArea.style.display = 'none';
            chatViewHeader.style.display = 'none';
            currentChatId = null;

            // 4. Esconde o modal
            hideConfirmModal();
        } catch (error) {
            console.error('Erro ao fechar chat:', error);
            showError(messagesArea, error, () => closeChat());
        }
    }

    // Event Listeners
    // Chat controls
    function minimizeChat() {
        if (!currentChatId) return;
        chatView.classList.add('minimized');
    }

    function maximizeChat() {
        chatView.classList.remove('minimized');
    }

    function closeCurrentChat() {
        if (!currentChatId) return;
        
        // Limpar listener e estado atual
        if (messageListener) {
            messageListener();
            messageListener = null;
        }
        currentChatId = null;
        
        // Resetar UI
        chatView.classList.remove('active');
        welcomeScreen.style.display = 'flex';
        messagesArea.innerHTML = '';
        minimizeBtn.disabled = true;
        
        // Remover estado ativo da lista
        document.querySelectorAll('.chat-item').forEach(item => 
            item.classList.remove('active')
        );
    }

    async function loadChat(chatId, userName) {
        try {
            currentChatId = chatId;
            
            // Configurar a UI inicial
            welcomeScreen.style.display = 'none';
            chatView.classList.add('active');
            chatView.classList.remove('minimized');
            replyArea.style.display = 'flex';
            chatUserName.textContent = 'Carregando informações...';
            minimizeBtn.disabled = false;
            messagesArea.innerHTML = '';
            
            // Carregar dados do chat
            const chatDoc = await db.collection('support_chats').doc(chatId).get();
            if (!chatDoc.exists) {
                throw new Error('Chat não encontrado');
            }
            
            const chatData = chatDoc.data();
            await loadUserInfo(chatData.userId);
            
            // Configurar listener de mensagens
            if (messageListener) {
                messageListener();
            }
            
            messageListener = db.collection('support_chats')
                .doc(chatId)
                .collection('messages')
                .orderBy('timestamp')
                .onSnapshot(snapshot => {
                    snapshot.docChanges().forEach(change => {
                        if (change.type === 'added') {
                            const msg = change.doc.data();
                            const msgDiv = document.createElement('div');
                            msgDiv.className = `message ${msg.senderId === currentUser.uid ? 'support' : 'user'}`;
                            msgDiv.textContent = msg.text;
                            messagesArea.appendChild(msgDiv);
                        }
                    });
                    messagesArea.scrollTop = messagesArea.scrollHeight;
                }, error => {
                    console.error('Erro ao escutar mensagens:', error);
                    showError(messagesArea, error);
                });
            
            // Atualizar UI do chat list
            document.querySelectorAll('.chat-item').forEach(item => 
                item.classList.remove('active')
            );
            const selectedChat = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
            if (selectedChat) {
                selectedChat.classList.add('active');
            }
        } catch (error) {
            console.error('Erro ao carregar chat:', error);
            showError(messagesArea, error);
            closeCurrentChat();
        }
    }

    // Event Listeners
    replyBtn.onclick = sendReply;
    replyInput.onkeyup = (e) => { if (e.key === 'Enter') sendReply(); };
    closeChatBtn.onclick = showConfirmModal;
    modalConfirm.onclick = closeChat;
    modalCancel.onclick = hideConfirmModal;
    loginBtn.onclick = () => loginComGoogle();
    
    minimizeBtn.onclick = minimizeChat;
    closeCurrentBtn.onclick = closeCurrentChat;
    logoutBtn.onclick = () => {
        if (confirm('Tem certeza que deseja sair?')) {
            logout();
        }
    };

    // Restore maximized state when clicking on chat header
    chatViewHeader.addEventListener('click', maximizeChat);
    
    // Fechar modal ao clicar fora
    confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) {
            hideConfirmModal();
        }
    });

    // Initialize control buttons state
    minimizeBtn.disabled = true;
    closeCurrentBtn.disabled = true;
});