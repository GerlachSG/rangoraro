// Este script é exclusivo para a página admin.html

document.addEventListener("DOMContentLoaded", () => {
    // --- Inicialização do Firebase (garante que está disponível) ---
    const firebaseConfig = {
        apiKey: "AIzaSyA2vtEfyZ9y7JUVbjCHFoK2BpvbFVSE4yM",
        authDomain: "rangoraro-app.firebaseapp.com",
        projectId: "rangoraro-app",
        storageBucket: "rangoraro-app.firebasestorage.app",
        messagingSenderId: "828393845765",
        appId: "1:828393845765:web:49323f020de4ffb6e2586c"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- Seletores de Tela e Dashboard ---
    const loadingScreen = document.getElementById("loading-screen");
    const loginScreen = document.getElementById("login-screen");
    const mainContent = document.getElementById("main-content");
    const googleLoginButton = document.getElementById("google-login-btn");
    const totalDepositsCard = document.getElementById("total-deposits");
    const totalCirculatedCard = document.getElementById("total-circulated");
    const periodSelector = document.getElementById("period-selector");

    // Variável para guardar a função de "parar de ouvir" o listener anterior
    let unsubscribeDashboardListener = null;

    /**
     * Inicia o processo de login com o Google.
     */
    function loginAdminComGoogle() {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).catch(error => {
            console.error("Erro durante o login:", error);
            loadingScreen.style.display = "none";
            loginScreen.style.display = "flex";
        });
    }
    
    /**
     * ATUALIZADO: Agora escuta por mudanças em tempo real (onSnapshot).
     */
    function listenToDashboardData(period) {
        if (!totalDepositsCard || !totalCirculatedCard) return;

        // Se já existe um "espião" anterior, remove ele antes de criar um novo
        if (unsubscribeDashboardListener) {
            unsubscribeDashboardListener();
        }

        totalDepositsCard.textContent = "Carregando...";
        totalCirculatedCard.textContent = "Carregando...";

        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);

        switch (period) {
            case "3days": startDate.setDate(startDate.getDate() - 3); break;
            case "7days": startDate.setDate(startDate.getDate() - 7); break;
            case "1month": startDate.setMonth(startDate.getMonth() - 1); break;
            case "6months": startDate.setMonth(startDate.getMonth() - 6); break;
        }
        
        const transactionsQuery = db.collection("transactions")
            .where("timestamp", ">=", startDate);
            
        // Cria o novo "espião" em tempo real
        unsubscribeDashboardListener = transactionsQuery.onSnapshot(snapshot => {
            let totalDeposits = 0;
            snapshot.forEach(doc => {
                const transaction = doc.data();
                if (transaction.type === "deposit") {
                    totalDeposits += transaction.finalAmount || 0;
                }
            });

            totalDepositsCard.textContent = `R$ ${totalDeposits.toFixed(2).replace('.', ',')}`;
            totalCirculatedCard.textContent = `R$ ${totalDeposits.toFixed(2).replace('.', ',')}`;

        }, error => {
            console.error("Erro ao escutar dados do dashboard:", error);
            totalDepositsCard.textContent = "Erro de permissão";
            totalCirculatedCard.textContent = "Erro de permissão";
        });
    }

    // Listener de autenticação
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            loadingScreen.style.display = "flex";
            loginScreen.style.display = "none";
            
            const idTokenResult = await user.getIdTokenResult(true); 
            const userIsAdmin = idTokenResult.claims.admin === true;

            if (userIsAdmin) {
                loadingScreen.style.display = "none";
                mainContent.style.display = "flex";
                
                const currentPeriod = periodSelector ? periodSelector.value : "today";
                listenToDashboardData(currentPeriod);
            } else {
                alert("Você não tem permissão para acessar esta página.");
                auth.signOut();
            }
        } else {
            loadingScreen.style.display = "none";
            loginScreen.style.display = "flex";
            mainContent.style.display = "none";

            // Se o usuário deslogou, para o listener para não consumir recursos
            if (unsubscribeDashboardListener) {
                unsubscribeDashboardListener();
            }
        }
    });

    // Listeners do Dashboard
    if (periodSelector) {
        periodSelector.addEventListener("change", (e) => listenToDashboardData(e.target.value));
    }
    if (googleLoginButton) {
        googleLoginButton.addEventListener("click", loginAdminComGoogle);
    }
});

