// rifa.js (CORRIGIDO)
document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DO DOM ---
    const userAvatar = document.getElementById('user-avatar');
    const userDisplayName = document.getElementById('user-display-name');
    const userTicketCount = document.getElementById('user-ticket-count');

    let unsubscribeRaffleListener = null; // Para parar de ouvir quando o usuário deslogar

    /**
     * Atualiza a UI com as informações do usuário logado.
     * @param {object} user - O objeto do usuário do Firebase Auth.
     */
    function setupRaffleListener(user) {
        const userRef = db.collection('users').doc(user.uid);

        // Ouve por atualizações em tempo real no documento do usuário
        unsubscribeRaffleListener = userRef.onSnapshot(doc => {
            if (doc.exists) {
                const userData = doc.data();
                userAvatar.src = userData.photoURL || 'https://cdn.jsdelivr.net/gh/eduardoamjunior/cdn-rangoraro@main/icon/profile-pic.svg';
                userDisplayName.textContent = userData.displayName || 'Usuário';
                userTicketCount.textContent = userData.raffleTickets || 0;
            } else {
                // Documento do usuário ainda não existe (pode acontecer com novos logins)
                console.log("Documento do usuário não encontrado, exibindo padrão.");
                setLoggedOutState();
            }
        }, error => {
            console.error("Erro ao ouvir dados da rifa: ", error);
            setLoggedOutState();
        });
    }

    /**
     * Reseta a UI para o estado de deslogado.
     */
    function setLoggedOutState() {
        userAvatar.src = 'https://cdn.jsdelivr.net/gh/eduardoamjunior/cdn-rangoraro@main/icon/profile-pic.svg';
        userDisplayName.textContent = 'Faça login';
        userTicketCount.textContent = '0';
        if (unsubscribeRaffleListener) {
            unsubscribeRaffleListener(); // Para de ouvir o listener anterior
            unsubscribeRaffleListener = null;
        }
    }

    // Monitora o estado de autenticação do usuário
    auth.onAuthStateChanged(user => {
        if (user) {
            // Se o usuário está logado, busca e ouve seus dados
            setupRaffleListener(user);
        } else {
            // Se o usuário deslogou, reseta a UI
            setLoggedOutState();
        }
    });
}); // <--- ESTA LINHA FOI ADICIONADA PARA CORRIGIR O CÓDIGO