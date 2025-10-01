// js/deposit.js

function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

function openDepositModal() {
    const modal = document.getElementById('deposit-modal-overlay');
    if (modal) modal.style.display = 'flex';
}

function closeDepositModal() {
    const modal = document.getElementById('deposit-modal-overlay');
    if (modal) modal.style.display = 'none';
    document.dispatchEvent(new CustomEvent('depositModalClosed'));
}

function showProcessingModal(state) {
    const modal = document.getElementById('processing-modal-overlay');
    if (!modal) return;
    const spinner = modal.querySelector('.spinner');
    const successIcon = modal.querySelector('.success-icon');
    const text = modal.querySelector('p');

    if (state === 'processing') {
        spinner.style.display = 'block';
        successIcon.style.display = 'none';
        text.textContent = 'Confirmando transação...';
    } else {
        spinner.style.display = 'none';
        successIcon.style.display = 'block';
        text.textContent = 'Transação confirmada!';
    }
    modal.style.display = 'flex';
}

function closeProcessingModal() {
    const modal = document.getElementById('processing-modal-overlay');
    if (modal) modal.style.display = 'none';
}

function initDepositSystem() {
    if (document.getElementById('deposit-modal-overlay')) {
        return;
    }

    const modalsHTML = `
        <div id="deposit-modal-overlay" class="deposit-modal-overlay" style="display: none;">
            <div class="deposit-modal">
                <button id="close-deposit-modal" class="close-button">&times;</button>
                <h2>Realizar um Depósito</h2>
                <div class="payment-methods">
                     <div class="method-group">
                        <p class="group-title">Bancos e Cartões</p>
                        <div class="options">
                            <button class="option-btn active">PIX</button>
                        </div>
                    </div>
                </div>
                <div class="amount-section">
                    <label for="deposit-amount-input">Valor do Depósito</label>
                    <div class="amount-input-wrapper">
                        <span>R$</span>
                        <input type="text" id="deposit-amount-input" value="0,00" placeholder="0,00">
                    </div>
                </div>
                <div class="referral-section">
                    <div class="referral-input-wrapper">
                        <input type="text" id="referral-code-input" placeholder="Código de Indicação (Opcional)">
                        <div id="referral-valid-icon" class="referral-valid-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />
                            </svg>
                        </div>
                    </div>
                    <p id="bonus-message" class="bonus-message" style="display: none;"></p>
                    <p id="final-amount-display" class="final-amount-display">Você vai receber R$ 0,00</p>
                </div>
                <button id="confirm-deposit-btn" class="confirm-btn">Confirmar Depósito</button>
                <p id="deposit-status" class="status-message"></p>
            </div>
        </div>
        <div id="processing-modal-overlay" class="processing-modal-overlay" style="display: none;">
            <div class="processing-modal">
                <div class="spinner"></div>
                <div class="success-icon" style="display: none;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                <p>Confirmando transação...</p>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalsHTML);

    const depositOverlay = document.getElementById('deposit-modal-overlay');
    const depositAmountInput = document.getElementById('deposit-amount-input');
    const referralCodeInput = document.getElementById('referral-code-input');
    const bonusMessage = document.getElementById('bonus-message');
    const depositStatus = document.getElementById('deposit-status');
    const finalAmountDisplay = document.getElementById('final-amount-display');
    const validIcon = document.getElementById('referral-valid-icon');
    const confirmDepositBtn = document.getElementById('confirm-deposit-btn');
    
    let validatedCode = { code: null, bonus: 0 };

    const updateFinalAmountDisplay = () => {
        const amountStr = depositAmountInput.value.replace(/\D/g, '').padStart(3, '0').slice(-8);
        const reais = amountStr.slice(0, -2);
        const centavos = amountStr.slice(-2);
        const amount = parseFloat(`${reais}.${centavos}`) || 0;
        const bonusAmount = amount * (validatedCode.bonus / 100);
        const finalAmount = amount + bonusAmount;
        finalAmountDisplay.textContent = `Você vai receber R$ ${finalAmount.toFixed(2).replace('.', ',')}`;
    };
    
    const validateCode = async () => {
        const code = referralCodeInput.value.trim().toUpperCase();
        if (!code) {
            validatedCode = { code: null, bonus: 0 };
            validIcon.classList.remove('visible');
            bonusMessage.style.display = 'none';
            updateFinalAmountDisplay();
            return;
        }
        if (code === validatedCode.code) return;
        try {
            const codeRef = db.collection('referral_codes').doc(code);
            const doc = await codeRef.get();
            if (doc.exists && doc.data().is_active) {
                const bonusPercent = doc.data().bonus_percent || 0;
                validatedCode = { code: code, bonus: bonusPercent };
                validIcon.classList.add('visible');
                bonusMessage.textContent = `+${bonusPercent}% de Bônus!`;
                bonusMessage.className = 'bonus-message success';
            } else {
                validatedCode = { code: null, bonus: 0 };
                validIcon.classList.remove('visible');
                bonusMessage.textContent = 'Código inválido!';
                bonusMessage.className = 'bonus-message error';
            }
        } catch (error) {
            console.error("Erro ao validar código:", error);
            validatedCode = { code: null, bonus: 0 };
            validIcon.classList.remove('visible');
            bonusMessage.textContent = 'Erro ao verificar código.';
            bonusMessage.className = 'bonus-message error';
        }
        bonusMessage.style.display = 'block';
        updateFinalAmountDisplay();
    };
    
    document.getElementById('close-deposit-modal').addEventListener('click', closeDepositModal);

    // --- CÓDIGO ADICIONADO ---
    // Adiciona o listener para fechar o modal ao clicar no fundo (overlay)
    depositOverlay.addEventListener('click', (event) => {
        // Se o elemento clicado for o próprio overlay (o fundo), fecha o modal.
        // Isso evita que o modal feche se o clique for em algum conteúdo interno.
        if (event.target === depositOverlay) {
            closeDepositModal();
        }
    });
    // --- FIM DO CÓDIGO ADICIONADO ---

    depositAmountInput.addEventListener('input', () => {
        let value = depositAmountInput.value.replace(/\D/g, '');
        if (value) {
            value = value.padStart(3, '0');
            const reais = value.slice(0, -2);
            const centavos = value.slice(-2);
            depositAmountInput.value = `${parseInt(reais, 10).toLocaleString('pt-BR')},${centavos}`;
        } else {
            depositAmountInput.value = '0,00';
        }
        updateFinalAmountDisplay();
    });
    
    referralCodeInput.addEventListener('input', debounce(validateCode, 500));

    confirmDepositBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) {
            depositStatus.textContent = 'Você precisa estar logado para depositar.';
            return;
        }
        const amountStr = depositAmountInput.value.replace(/\./g, '').replace(',', '.');
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) {
            depositStatus.textContent = 'Por favor, insira um valor válido.';
            return;
        }
        depositStatus.textContent = '';
        showProcessingModal('processing');
        const bonusAmount = amount * (validatedCode.bonus / 100);
        const finalAmount = amount + bonusAmount;
        const batch = db.batch();
        const transactionRef = db.collection("transactions").doc();
        batch.set(transactionRef, {
            userId: user.uid,
            userName: user.displayName,
            userPhoto: user.photoURL,
            type: "deposit",
            amount: amount,
            bonusAmount: bonusAmount,
            finalAmount: finalAmount,
            referralCode: validatedCode.code || null,
            status: "completed",
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        const userRef = db.collection("users").doc(user.uid);
        batch.update(userRef, {
            balance: firebase.firestore.FieldValue.increment(finalAmount)
        });
        try {
            await batch.commit();
            showProcessingModal('success');
            setTimeout(() => {
                closeProcessingModal();
                closeDepositModal();
            }, 2000);
        } catch (error) {
            console.error("### ERRO AO PROCESSAR DEPÓSITO ###:", error);
            depositStatus.textContent = 'Ocorreu um erro. Verifique o console.';
            closeProcessingModal();
        }
    });

    updateFinalAmountDisplay();
}

document.addEventListener('DOMContentLoaded', initDepositSystem);

