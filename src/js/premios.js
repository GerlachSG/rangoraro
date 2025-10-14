document.addEventListener('DOMContentLoaded', () => {

    // --- ELEMENTOS DO DOM ---
    // Perfil
    const userAvatar = document.getElementById('user-avatar');
    const usernameElem = document.getElementById('username');
    const userXpElem = document.getElementById('user-xp');
    const userLevelElem = document.getElementById('user-level');
    const progressFill = document.getElementById('progress-fill');
    const progressPercentage = document.getElementById('progress-percentage');

    // --- FUNÇÕES ---

    /**
     * Atualiza a UI com os dados reais do usuário do Firebase.
     * @param {object} userData - Dados do usuário do Firestore.
     */
    function updateUserProfile(userData) {
        if (!userData) {
            // Se não há dados (usuário deslogado), mostra estado padrão
            usernameElem.textContent = 'Faça login para começar';
            userXpElem.textContent = '0 XP';
            userAvatar.src = 'https://cdn.jsdelivr.net/gh/eduardoamjunior/cdn-rangoraro@main/icon/profile-pic.svg';
            userLevelElem.textContent = 'LEVEL 0';
            progressFill.style.width = '0%';
            progressPercentage.textContent = '0%';
            return;
        }

        // Usa o XPSystem para calcular o nível corretamente
        const totalXP = userData.xp || 0;
        const levelData = window.XPSystem ? window.XPSystem.getLevelFromXP(totalXP) : { level: 1, currentLevelXP: 0, xpForNextLevel: 100, progress: 0 };

        usernameElem.textContent = userData.displayName || 'Usuário';
        userXpElem.textContent = `${totalXP.toLocaleString('pt-BR')} XP`;
        userAvatar.src = userData.photoURL || 'https://cdn.jsdelivr.net/gh/eduardoamjunior/cdn-rangoraro@main/icon/profile-pic.svg';
        userLevelElem.textContent = `LEVEL ${levelData.level}`;
        progressFill.style.width = `${levelData.progress}%`;
        progressPercentage.textContent = `${Math.floor(levelData.progress)}%`;
    }

    /**
     * Lida com o estado do usuário (logado ou deslogado)
     */
    auth.onAuthStateChanged(async user => {
        if (user) {
            try {
                // Busca dados reais do usuário no Firestore
                const userDoc = await db.collection('users').doc(user.uid).get();
                
                if (userDoc.exists) {
                    const firestoreData = userDoc.data();
                    const userData = {
                        displayName: user.displayName,
                        photoURL: user.photoURL,
                        xp: firestoreData.xp || 0,
                        level: firestoreData.level || 1
                    };
                    updateUserProfile(userData);
                } else {
                    // Usuário existe no Auth mas não no Firestore
                    updateUserProfile({
                        displayName: user.displayName,
                        photoURL: user.photoURL,
                        xp: 0,
                        level: 1
                    });
                }
            } catch (error) {
                console.error('Erro ao carregar dados do usuário:', error);
                updateUserProfile(null);
            }
        } else {
            // Usuário deslogado
            updateUserProfile(null);
        }
    });

});
