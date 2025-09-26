// js/firebase-auth.js

// Cole aqui o objeto de configuração que você copiou do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyA2vtEfyZ9y7JUVbjCHFoK2BpvbFVSE4yM",
    authDomain: "rangoraro-app.firebaseapp.com",
    projectId: "rangoraro-app",
    storageBucket: "rangoraro-app.firebasestorage.app",
    messagingSenderId: "828393845765",
    appId: "1:828393845765:web:49323f020de4ffb6e2586c",
    measurementId: "G-JGE2R3HTQ2"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);

// Referências para os serviços de Autenticação e Firestore
const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

/**
 * Função para realizar o login com o Google
 */
function loginComGoogle() {
    auth.signInWithPopup(googleProvider)
        .then((result) => {
            const user = result.user;
            // Verifica se é um novo usuário para criar seu documento no Firestore
            const userRef = db.collection('users').doc(user.uid);
            userRef.get().then((doc) => {
                if (!doc.exists) {
                    // Novo usuário: cria o perfil com saldo inicial 0
                    userRef.set({
                        displayName: user.displayName,
                        email: user.email,
                        photoURL: user.photoURL,
                        balance: 0,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            });
        }).catch((error) => {
            console.error("Erro durante o login com Google:", error);
        });
}

/**
 * Função para realizar o logout
 */
function logout() {
    auth.signOut().catch((error) => {
        console.error("Erro ao fazer logout:", error);
    });
}

/**
 * Observador do estado de autenticação.
 * Esta é a função mais importante: ela reage a logins e logouts
 * e atualiza a interface do usuário de acordo.
 */
auth.onAuthStateChanged(user => {
    if (user) {
        // --- USUÁRIO ESTÁ LOGADO ---
        const userRef = db.collection('users').doc(user.uid);
        // Escuta por atualizações em tempo real no documento do usuário (ex: saldo)
        userRef.onSnapshot(doc => {
            if (doc.exists) {
                const userData = doc.data();
                updateUIForLoggedInUser(userData);
            }
        });
    } else {
        // --- USUÁRIO ESTÁ DESLOGADO ---
        updateUIForLoggedOutUser();
    }
});

/**
 * Atualiza a interface para um usuário logado
 * @param {object} userData - Os dados do usuário vindos do Firestore (incluindo o saldo)
 */
function updateUIForLoggedInUser(userData) {
    // Encontra os elementos do header
    const loginButtons = document.querySelector('.header-buttons');
    const userInfo = document.querySelector('.header-right');

    if (loginButtons) loginButtons.style.display = 'none';
    if (userInfo) {
        userInfo.style.display = 'flex'; // Garante que a seção do usuário esteja visível

        const balanceDiv = userInfo.querySelector('.balance');
        const profilePicDiv = userInfo.querySelector('.profile-pic');

        // Atualiza o saldo
        if (userData.balance > 0) {
            balanceDiv.innerHTML = `R$ ${userData.balance.toFixed(2).replace('.', ',')}`;
        } else {
            // Se o saldo for 0, transforma em um botão "Depositar"
            balanceDiv.innerHTML = `<button class="btn-deposit">Depositar</button>`;
        }

        // Atualiza a foto de perfil
        if (userData.photoURL) {
            profilePicDiv.style.backgroundImage = `url('${userData.photoURL}')`;
        }

        // Adiciona funcionalidade de logout ao clicar na foto
        profilePicDiv.style.cursor = 'pointer';
        profilePicDiv.onclick = logout;
    }
}

/**
 * Atualiza a interface para um usuário deslogado
 */
function updateUIForLoggedOutUser() {
    const loginButtons = document.querySelector('.header-buttons');
    const userInfo = document.querySelector('.header-right');

    if (loginButtons) {
        loginButtons.style.display = 'flex';
        const loginBtn = loginButtons.querySelector('.btn-outline');
        const registerBtn = loginButtons.querySelector('.btn-primary');
        
        if (loginBtn) loginBtn.onclick = () => showAuthModal(true);
        if (registerBtn) registerBtn.onclick = () => showAuthModal(false);
    }
    if (userInfo) userInfo.style.display = 'none';
}

// Adiciona as novas funções para controle do modal
function showAuthModal(isLogin = true) {
    const overlay = document.querySelector('.auth-modal-overlay');
    const modal = document.querySelector('.auth-modal');
    const title = modal.querySelector('h2');
    const mainContainer = document.querySelector('.main-container'); // Get the main container

    title.textContent = isLogin ? 'Bem-vindo de Volta' : 'Bem-vindo ao RangoRaro';
    overlay.style.display = 'flex';
    mainContainer.classList.add('blur'); // Add blur class to main container

    // Add event listener to close the modal when clicking outside the modal
    overlay.addEventListener('click', function(event) {
        if (event.target === overlay) {
            closeAuthModal();
        }
    });
}

function closeAuthModal() {
    const overlay = document.querySelector('.auth-modal-overlay');
    const mainContainer = document.querySelector('.main-container'); // Get the main container

    overlay.style.display = 'none';
    mainContainer.classList.remove('blur'); // Remove blur class from main container
}

function handleGoogleLogin() {
    const checkbox = document.querySelector('#age-check');
    if (!checkbox.checked) {
        alert('Você precisa confirmar que tem pelo menos 18 anos para continuar.');
        return;
    }
    loginComGoogle();
    closeAuthModal();
}