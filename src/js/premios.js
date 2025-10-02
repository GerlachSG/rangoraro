document.addEventListener('DOMContentLoaded', () => {

    // --- ELEMENTOS DO DOM ---
    // Perfil
    const userAvatar = document.getElementById('user-avatar');
    const usernameElem = document.getElementById('username');
    const userLevelElem = document.getElementById('user-level');
    const progressFill = document.getElementById('progress-fill');
    const progressPercentage = document.getElementById('progress-percentage');
    
    // Recompensas
    const dailyRewardBtn = document.querySelector('#daily-reward .btn-recompensa');
    const weeklyRewardBtn = document.querySelector('#weekly-reward .btn-recompensa');
    const monthlyRewardBtn = document.querySelector('#monthly-reward .btn-recompensa');

    // Pacotes Gratuitos
    const freePacksGrid = document.getElementById('free-packs-grid');

    // --- DADOS MOCK (Exemplo de pacotes) ---
    // Estes dados podem vir do Firebase no futuro
    const freePacks = [
        { level: 2,  img: 'https://i.imgur.com/Lz3XR8k.png' },
        { level: 10, img: 'https://i.imgur.com/uSti3d1.png' },
        { level: 20, img: 'https://i.imgur.com/H1n8G08.png' },
        { level: 30, img: 'https://i.imgur.com/fL239i7.png' },
        { level: 40, img: 'https://i.imgur.com/LzC0csh.png' }
    ];

    // --- FUNÇÕES ---

    /**
     * Atualiza a UI com os dados do usuário.
     * @param {object} userData - Dados do usuário do Firebase.
     */
    function updateUserProfile(userData) {
        if (!userData) {
            // Se não há dados (usuário deslogado), mostra estado padrão
            usernameElem.textContent = 'Faça login para começar';
            userAvatar.src = 'https://cdn.jsdelivr.net/gh/eduardoamjunior/cdn-rangoraro@main/icon/profile-pic.svg';
            userLevelElem.textContent = 'LEVEL 0';
            progressFill.style.width = '0%';
            progressPercentage.textContent = '0%';
            return;
        }

        const xpForNextLevel = userData.level * 100; // Exemplo: Nível 1 precisa de 100xp, Nível 2 de 200xp, etc.
        const progress = xpForNextLevel > 0 ? (userData.xp / xpForNextLevel) * 100 : 0;

        usernameElem.textContent = `Welcome, ${userData.displayName || 'Usuário'}`;
        userAvatar.src = userData.photoURL || 'https://cdn.jsdelivr.net/gh/eduardoamjunior/cdn-rangoraro@main/icon/profile-pic.svg';
        userLevelElem.textContent = `LEVEL ${userData.level || 0}`;
        progressFill.style.width = `${progress}%`;
        progressPercentage.textContent = `${Math.floor(progress)}%`;
    }

    /**
     * Renderiza os pacotes gratuitos na tela, mostrando quais estão bloqueados/desbloqueados.
     * @param {number} userLevel - O nível atual do usuário.
     */
    function renderFreePacks(userLevel = 0) {
        freePacksGrid.innerHTML = ''; // Limpa a grade
        freePacks.forEach(pack => {
            const isLocked = userLevel < pack.level;
            const packCard = document.createElement('div');
            packCard.className = `free-pack-card ${isLocked ? 'locked' : ''}`;
            
            packCard.innerHTML = `
                <img src="${pack.img}" alt="Pacote Nível ${pack.level}">
                <div class="pack-info">
                    ${isLocked ? '<i class="fas fa-lock lock-icon"></i>' : ''}
                    <span>Nível Gratuito ${pack.level}</span>
                </div>
            `;
            
            if (!isLocked) {
                packCard.onclick = () => alert(`Você abriu o pacote do nível ${pack.level}!`);
            }
            
            freePacksGrid.appendChild(packCard);
        });
    }

    /**
     * Lida com o estado do usuário (logado ou deslogado)
     */
    auth.onAuthStateChanged(async user => {
        if (user) {
            // Simulação de dados do usuário, já que não temos o backend completo.
            // NO SEU PROJETO REAL, VOCÊ VAI PEGAR ESSES DADOS DO FIRESTORE.
            const mockUserData = {
                displayName: user.displayName,
                photoURL: user.photoURL,
                level: 5, // Nível de exemplo
                xp: 30    // XP de exemplo
            };

            updateUserProfile(mockUserData);
            renderFreePacks(mockUserData.level);
            
            // Lógica de exemplo para os botões de recompensa
            dailyRewardBtn.textContent = "Reivindicar";
            dailyRewardBtn.disabled = false;
            weeklyRewardBtn.textContent = "Nada para Reivindicar";
            monthlyRewardBtn.textContent = "Nada para Reivindicar";
        } else {
            // Usuário deslogado
            updateUserProfile(null);
            renderFreePacks(0);

            // Desabilita todos os botões
            [dailyRewardBtn, weeklyRewardBtn, monthlyRewardBtn].forEach(btn => {
                btn.textContent = 'Faça Login';
                btn.disabled = true;
            });
        }
    });

});
