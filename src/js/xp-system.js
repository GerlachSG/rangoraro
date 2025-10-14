/**
 * Sistema de XP e Níveis - RangoRaro
 * Gerencia experiência, níveis e recompensas dos usuários
 */

const XPSystem = {
    /**
     * Calcula o XP total necessário para atingir um nível específico
     */
    getXPForLevel(level) {
        if (level <= 1) return 0;
        let totalXP = 0;
        for (let i = 1; i < level; i++) {
            totalXP += this.getXPRequiredForLevel(i);
        }
        return totalXP;
    },

    /**
     * Calcula quanto XP é necessário para passar de um nível para o próximo
     */
    getXPRequiredForLevel(level) {
        return level * 100 + (level - 1) * 50;
    },

    /**
     * Calcula o nível baseado no XP total
     */
    getLevelFromXP(totalXP) {
        let level = 1;
        let xpNeeded = 0;
        
        while (totalXP >= xpNeeded + this.getXPRequiredForLevel(level)) {
            xpNeeded += this.getXPRequiredForLevel(level);
            level++;
        }
        
        return {
            level,
            currentLevelXP: totalXP - xpNeeded,
            xpForNextLevel: this.getXPRequiredForLevel(level),
            progress: ((totalXP - xpNeeded) / this.getXPRequiredForLevel(level)) * 100
        };
    },

    /**
     * Adiciona XP ao usuário e retorna se subiu de nível
     */
    async addXP(userId, xpAmount, reason = 'Atividade') {
        if (!userId || xpAmount <= 0) return null;

        try {
            const userRef = db.collection('users').doc(userId);
            const userDoc = await userRef.get();
            
            if (!userDoc.exists) {
                console.error('Usuário não encontrado');
                return null;
            }

            const userData = userDoc.data();
            const currentXP = userData.xp || 0;
            const currentLevel = userData.level || 1;
            const newXP = currentXP + xpAmount;
            
            // Calcular novo nível
            const levelData = this.getLevelFromXP(newXP);
            const leveledUp = levelData.level > currentLevel;
            
            // Atualizar dados no Firestore
            await userRef.update({
                xp: newXP,
                level: levelData.level,
                totalXpEarned: firebase.firestore.FieldValue.increment(xpAmount),
                lastXpGain: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Registrar no histórico
            await db.collection('users').doc(userId).collection('xp_history').add({
                amount: xpAmount,
                reason,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                oldXP: currentXP,
                newXP: newXP,
                oldLevel: currentLevel,
                newLevel: levelData.level
            });

            console.log(`✨ +${xpAmount} XP (${reason})`);

            return {
                leveledUp,
                oldLevel: currentLevel,
                newLevel: levelData.level,
                currentXP: newXP,
                xpGained: xpAmount,
                levelData
            };

        } catch (error) {
            console.error('Erro ao adicionar XP:', error);
            return null;
        }
    },

    /**
     * Mostra notificação de XP ganho
     */
    showXPNotification(xpAmount, reason) {
        // Animação flutuante no header ao lado da foto
        const headerRight = document.querySelector('.header-right');
        
        if (headerRight) {
            const xpFloat = document.createElement('div');
            xpFloat.className = 'xp-float-header';
            xpFloat.innerHTML = `
                <span class="xp-value">+${xpAmount}</span>
                <span class="xp-label">XP Ganho</span>
            `;
            xpFloat.style.position = 'fixed';
            
            // Posiciona ao lado da foto
            const profilePic = headerRight.querySelector('.profile-pic');
            
            if (profilePic) {
                const rect = profilePic.getBoundingClientRect();
                xpFloat.style.top = `${rect.top + rect.height / 2}px`;
                xpFloat.style.left = `${rect.right + 15}px`;
                xpFloat.style.transform = 'translateY(-50%)';
            }
            
            document.body.appendChild(xpFloat);

            // Remove após a animação (2s)
            setTimeout(() => {
                if (xpFloat.parentNode) {
                    xpFloat.remove();
                }
            }, 2000);
        }
    },

    /**
     * Mostra modal simples de level up (sem recompensas)
     */
    showLevelUpModal(oldLevel, newLevel) {
        const modal = document.createElement('div');
        modal.className = 'level-up-modal-overlay';
        modal.innerHTML = `
            <div class="level-up-modal">
                <div class="level-up-content">
                    <div class="level-up-icon">🎉</div>
                    <h2>SUBIU DE NÍVEL!</h2>
                    <div class="level-display">
                        <span class="old-level">Nível ${oldLevel}</span>
                        <span class="arrow">→</span>
                        <span class="new-level">Nível ${newLevel}</span>
                    </div>
                    <button class="claim-btn" onclick="this.closest('.level-up-modal-overlay').remove()">
                        Continuar
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Animação e auto-fechar
        setTimeout(() => modal.classList.add('show'), 10);
        setTimeout(() => {
            if (document.body.contains(modal)) modal.remove();
        }, 3000);
    },

    /**
     * Sem recompensas por enquanto
     */
    getLevelRewards(level) {
        return []; // Apenas XP e níveis, sem recompensas ainda
    },

    /**
     * Calcula XP baseado no valor gasto
     * Apenas pacotes e trocas dão XP
     * 1 XP = R$ 1 gasto
     */
    calculateXP(action, value = 0) {
        if (action === 'pacote' || action === 'troca') {
            return Math.floor(value); // 1 XP por R$ 1 gasto
        }
        return 0;
    }
};

// Exportar para uso global
window.XPSystem = XPSystem;
