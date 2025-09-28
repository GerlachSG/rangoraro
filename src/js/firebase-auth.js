// js/firebase-auth.js

// Small immediate-run logic: apply last-known auth state (from localStorage)
// to the <body> as early as possible so the header doesn't flicker between pages.
try {
    const state = localStorage.getItem('rango_auth_state'); // 'logged-in' or 'logged-out'
    if (state && typeof document !== 'undefined' && document.body) {
        document.body.classList.add('auth-ready', state);
    }
} catch (e) {
    // ignore
}

// If this script somehow runs before <body> exists, try again on DOMContentLoaded
if (typeof document !== 'undefined' && !document.body) {
    document.addEventListener('DOMContentLoaded', () => {
        try {
            const state = localStorage.getItem('rango_auth_state');
            if (state) document.body.classList.add('auth-ready', state);
        } catch (e) {}
    });
}

// Evita múltiplas inicializações se o script for incluído mais de uma vez
if (!window.__RANGO_FirebaseInitialized) {
    window.__RANGO_FirebaseInitialized = true;

    // Cole aqui o objeto de configuração que você copiou do Firebase
    window.firebaseConfig = {
        apiKey: "AIzaSyA2vtEfyZ9y7JUVbjCHFoK2BpvbFVSE4yM",
        authDomain: "rangoraro-app.firebaseapp.com",
        projectId: "rangoraro-app",
        storageBucket: "rangoraro-app.firebasestorage.app",
        messagingSenderId: "828393845765",
        appId: "1:828393845765:web:49323f020de4ffb6e2586c",
        measurementId: "G-JGE2R3HTQ2"
    };

    // Inicializa o Firebase
    firebase.initializeApp(window.firebaseConfig);

    // Referências para os serviços de Autenticação e Firestore
    window.auth = firebase.auth();
    window.db = firebase.firestore();
    window.googleProvider = new firebase.auth.GoogleAuthProvider();

}

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
// To avoid header flicker between pages, we set a body class from the last-known
// auth state (stored in localStorage) immediately on script load. When the real
// auth state is available, we'll replace the class with the resolved one.
try {
    const last = localStorage.getItem('rango_auth_state'); // 'logged-in' | 'logged-out'
    if (last) {
        document.body.classList.add('auth-ready', last);
    }
} catch (e) { /* ignore localStorage errors */ }

auth.onAuthStateChanged(user => {
    // Remove any previous logged-in/out class and set auth-ready with the current state
    document.body.classList.remove('logged-in', 'logged-out');
    if (user) {
        document.body.classList.add('auth-ready', 'logged-in');
        try { localStorage.setItem('rango_auth_state', 'logged-in'); } catch (e) {}

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
        document.body.classList.add('auth-ready', 'logged-out');
        try { localStorage.setItem('rango_auth_state', 'logged-out'); } catch (e) {}
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
    // Do not toggle visibility here; visibility is controlled by body.auth-ready classes
    // We'll only update inner content (balance/profile) so the UI swaps without flicker
    if (!loginButtons && !userInfo) return;

    const balanceDiv = userInfo.querySelector('.balance');
    const profilePicDiv = userInfo.querySelector('.profile-pic');

    // Atualiza o saldo (só atualiza o conteúdo)
    if (typeof userData.balance === 'number' && userData.balance > 0) {
        balanceDiv.innerHTML = `R$ ${userData.balance.toFixed(2).replace('.', ',')}`;
    } else {
        // Se o saldo for 0 ou indefinido, transforma em um botão "Depositar"
        balanceDiv.innerHTML = `<button class="btn-deposit">Depositar</button>`;
    }

    // Atualiza a foto de perfil
    if (userData.photoURL) {
        profilePicDiv.style.backgroundImage = `url('${userData.photoURL}')`;
    } else {
        profilePicDiv.style.backgroundImage = '';
    }

    // Adiciona funcionalidade de logout ao clicar na foto
    profilePicDiv.style.cursor = 'pointer';
    profilePicDiv.onclick = logout;
}

/**
 * Atualiza a interface para um usuário deslogado
 */
function updateUIForLoggedOutUser() {
    const loginButtons = document.querySelector('.header-buttons');
    const userInfo = document.querySelector('.header-right');
    // Do not toggle visibility here; body classes decide which block is visible.
    if (!loginButtons && !userInfo) return;

    const loginBtn = loginButtons.querySelector('.btn-outline');
    const registerBtn = loginButtons.querySelector('.btn-primary');

    if (loginBtn) loginBtn.onclick = () => showAuthModal(true);
    if (registerBtn) registerBtn.onclick = () => showAuthModal(false);

    // Clear any user-specific visuals when logged out
    if (userInfo) {
        const balanceDiv = userInfo.querySelector('.balance');
        const profilePicDiv = userInfo.querySelector('.profile-pic');
        if (balanceDiv) balanceDiv.innerHTML = 'R$ 0,00';
        if (profilePicDiv) profilePicDiv.style.backgroundImage = '';
    }
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