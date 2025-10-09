
// Lógica de inicialização (seu código original)
try { const state = localStorage.getItem('rango_auth_state'); if (state && document.body) { document.body.classList.add('auth-ready', state); }} catch (e) {}
if (!document.body) { document.addEventListener('DOMContentLoaded', () => { try { const state = localStorage.getItem('rango_auth_state'); if (state) document.body.classList.add('auth-ready', state); } catch (e) {} }); }

if (!window.__RANGO_FirebaseInitialized) {
    window.__RANGO_FirebaseInitialized = true;
    window.firebaseConfig = {
        apiKey: "AIzaSyA2vtEfyZ9y7JUVbjCHFoK2BpvbFVSE4yM",
        authDomain: "rangoraro-app.firebaseapp.com",
        projectId: "rangoraro-app",
        storageBucket: "rangoraro-app.firebasestorage.app",
        messagingSenderId: "828393845765",
        appId: "1:828393845765:web:49323f020de4ffb6e2586c"
    };
    // USA A SINTAXE V8 COMPAT QUE SEU SITE JÁ USA
    firebase.initializeApp(window.firebaseConfig);
    window.auth = firebase.auth();
    window.db = firebase.firestore();
    window.googleProvider = new firebase.auth.GoogleAuthProvider();
}

function loginComGoogle() {
    auth.signInWithPopup(googleProvider)
        .then((result) => {
            const user = result.user;
            const userRef = db.collection('users').doc(user.uid);
            userRef.get().then((doc) => {
                if (!doc.exists) {
                    userRef.set({
                        displayName: user.displayName,
                        email: user.email,
                        photoURL: user.photoURL,
                        balance: 0,
                        role: 'user', // Garante que novos usuários tenham o cargo
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            });
        }).catch((error) => {
            console.error("Erro durante o login com Google:", error);
        });
}

function logout() {
    auth.signOut().catch((error) => {
        console.error("Erro ao fazer logout:", error);
    });
}

// Objeto global para compartilhar o estado
window.rangoState = { user: null };

auth.onAuthStateChanged(user => {
    // Destrói o widget para evitar duplicatas ao re-logar
    if (window.RangoSupportWidget) {
        window.RangoSupportWidget.destroy();
    }

    document.body.classList.remove('logged-in', 'logged-out');
    if (user) {
        const userRef = db.collection('users').doc(user.uid);
        userRef.onSnapshot(doc => {
            if (doc.exists) {
                const userData = doc.data();
                userData.uid = user.uid;
                window.rangoState.user = userData;

                document.body.classList.add('auth-ready', 'logged-in');
                try { localStorage.setItem('rango_auth_state', 'logged-in'); } catch (e) {}
                updateUIForLoggedInUser(userData);

                // Chama o widget de suporte
                if (window.RangoSupportWidget) {
                    window.RangoSupportWidget.init();
                }
            } 
        });
    } else {
        window.rangoState.user = null;
        document.body.classList.add('auth-ready', 'logged-out');
        try { localStorage.setItem('rango_auth_state', 'logged-out'); } catch (e) {}
        updateUIForLoggedOutUser();
    }
});


/**
 * Atualiza a interface para um usuário logado
 * @param {object} userData - Os dados do usuário vindos do Firestore
 */
function updateUIForLoggedInUser(userData) {
    const userInfo = document.querySelector('.header-right');
    if (!userInfo) return;

    const balanceDiv = userInfo.querySelector('.balance');
    const profilePicDiv = userInfo.querySelector('.profile-pic');
    const balanceValue = (typeof userData.balance === 'number') ? userData.balance : 0;

    // Logic to show balance or "Deposit" button
    if (balanceValue > 0) {
        balanceDiv.innerHTML = `R$ ${balanceValue.toFixed(2).replace('.', ',')}`;
        balanceDiv.onclick = () => {
            if (typeof openDepositModal === 'function') openDepositModal();
        };
    } else {
        balanceDiv.innerHTML = `<button class="btn-deposit">Depositar</button>`;
        const depositBtn = balanceDiv.querySelector('.btn-deposit');
        if (depositBtn) {
            depositBtn.onclick = () => {
                if (typeof openDepositModal === 'function') openDepositModal();
            };
        }
    }
    
    if (userData.photoURL) {
        profilePicDiv.style.backgroundImage = `url('${userData.photoURL}')`;
    } else {
        profilePicDiv.style.backgroundImage = '';
    }
}


/**
 * Atualiza a interface para um usuário deslogado
 */
function updateUIForLoggedOutUser() {
    const loginButtons = document.querySelector('.header-buttons');
    if (!loginButtons) return;

    const loginBtn = loginButtons.querySelector('.btn-outline');
    const registerBtn = loginButtons.querySelector('.btn-primary');

    if (loginBtn) loginBtn.onclick = () => showAuthModal(true);
    if (registerBtn) registerBtn.onclick = () => showAuthModal(false);
}

// Funções de controle do modal de autenticação
function showAuthModal(isLogin = true) {
    const overlay = document.querySelector('.auth-modal-overlay');
    const modal = document.querySelector('.auth-modal');
    const title = modal.querySelector('h2');
    const mainContainer = document.querySelector('.main-container');

    title.textContent = isLogin ? 'Bem-vindo de Volta' : 'Bem-vindo ao RangoRaro';
    overlay.style.display = 'flex';
    mainContainer.classList.add('blur');

    overlay.addEventListener('click', function(event) {
        if (event.target === overlay) {
            closeAuthModal();
        }
    });
}

function closeAuthModal() {
    const overlay = document.querySelector('.auth-modal-overlay');
    const mainContainer = document.querySelector('.main-container');

    overlay.style.display = 'none';
    mainContainer.classList.remove('blur');
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