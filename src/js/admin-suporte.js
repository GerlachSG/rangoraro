document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('login-btn'), authScreen = document.getElementById('auth-screen'), dashboard = document.getElementById('support-dashboard');
    const chatList = document.getElementById('chat-list'), messagesArea = document.getElementById('messages-area'), replyArea = document.getElementById('reply-area');
    const replyInput = document.getElementById('reply-input'), replyBtn = document.getElementById('reply-btn');
    const chatViewHeader = document.getElementById('chat-view-header'), chatUserName = document.getElementById('chat-user-name'), closeChatBtn = document.getElementById('close-chat-btn');

    let currentChatId = null, currentUser = null, messageListener = null;

    loginBtn.onclick = () => loginComGoogle();

    auth.onAuthStateChanged((user) => {
        if (user) {
            // Força a atualização do token para pegar as novas credenciais
            user.getIdTokenResult(true).then((idTokenResult) => {
                // Verifica a credencial que criamos com o script
                if (idTokenResult.claims.support) {
                    currentUser = user;
                    authScreen.style.display = 'none';
                    dashboard.style.display = 'flex';
                    loadOpenChats();
                } else {
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
        }
    });

    function loadOpenChats() {
        db.collection('support_chats').where('status', '==', 'open').orderBy('lastUpdated', 'desc').onSnapshot(querySnapshot => {
            chatList.innerHTML = '<h2>Conversas Ativas</h2>';
            if (querySnapshot.empty) {
                chatList.innerHTML += '<p>Nenhuma conversa ativa.</p>';
                return;
            }
            querySnapshot.forEach(doc => {
                const chat = doc.data(), chatItem = document.createElement('div');
                chatItem.className = 'chat-item';
                chatItem.dataset.chatId = doc.id;
                chatItem.dataset.userName = chat.userName;
                chatItem.innerHTML = `<strong>${chat.userName}</strong><small>${chat.lastMessage}</small>`;
                chatItem.onclick = () => loadChat(doc.id, chat.userName);
                chatList.appendChild(chatItem);
            });
        }, error => {
            console.error("Erro ao carregar chats:", error);
            chatList.innerHTML = '<h2>Erro ao carregar conversas</h2><p>Verifique as regras de segurança e se o usuário tem a credencial de suporte.</p>';
        });
    }

    function loadChat(chatId, userName) {
        currentChatId = chatId;
        replyArea.style.display = 'flex';
        chatViewHeader.style.display = 'flex';
        chatUserName.textContent = `Conversa com ${userName}`;
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

    async function closeChat() {
        if (currentChatId && confirm('Tem certeza que deseja resolver esta conversa?')) {
            await db.collection('support_chats').doc(currentChatId).update({ status: 'closed' });
            messagesArea.innerHTML = '<p>Conversa resolvida. Selecione outra.</p>';
            replyArea.style.display = 'none';
            chatViewHeader.style.display = 'none';
            currentChatId = null;
        }
    }

    replyBtn.onclick = sendReply;
    replyInput.onkeyup = (e) => { if (e.key === 'Enter') sendReply(); };
    closeChatBtn.onclick = closeChat;
});