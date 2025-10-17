// js/email-service.js
// Serviço de envio de emails usando Firebase Functions (SEGURO)

/**
 * Envia email de confirmação de entrega usando Firebase Function
 * @param {Object} orderData - Dados do pedido entregue
 * @param {string} recipientEmail - Email do destinatário
 * @param {string} recipientName - Nome do destinatário
 * @returns {Promise<boolean>} - Retorna true se enviado com sucesso
 */
async function sendDeliveryConfirmationEmail(orderData, recipientEmail, recipientName) {
    try {
        console.log('📧 Enviando email via Firebase Function...');
        console.log('📦 Pedido:', orderData.id);
        console.log('👤 Destinatário:', recipientEmail);

        const user = firebase.auth().currentUser;
        
        if (!user) {
            throw new Error("Usuário não autenticado");
        }

        // Pega o token de autenticação
        const idToken = await user.getIdToken();
        
    // Chama a Cloud Function (V2 - com suporte explícito a CORS preflight)
    const functionUrl = "https://us-central1-rangoraro-app.cloudfunctions.net/sendDeliveryEmailV2";
        
        const response = await fetch(functionUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${idToken}`
            },
            body: JSON.stringify({
                data: {
                    orderId: orderData.id,
                    recipientEmail: recipientEmail,
                    recipientName: recipientName
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Erro ao enviar email");
        }

        const result = await response.json();
        console.log('✅ Email enviado com sucesso!', result);
        return true;

    } catch (error) {
        console.error('❌ Erro ao enviar email de confirmação:', error);
        return false;
    }
}

/**
 * Envia email de confirmação de saque usando Firebase Function
 * @param {Object} withdrawData - Dados do saque
 * @param {string} recipientEmail - Email do destinatário
 * @param {string} recipientName - Nome do destinatário
 * @returns {Promise<boolean>} - Retorna true se enviado com sucesso
 */
async function sendWithdrawConfirmationEmail(withdrawData, recipientEmail, recipientName) {
    try {
        console.log('💰 Enviando email de confirmação de saque...');
        console.log('📧 Destinatário:', recipientEmail);
        console.log('💵 Valor:', withdrawData.valor);

        const user = firebase.auth().currentUser;
        
        if (!user) {
            throw new Error("Usuário não autenticado");
        }

        // Pega o token de autenticação
        const idToken = await user.getIdToken();
        
        // Chama a Cloud Function para saque
        const functionUrl = "https://us-central1-rangoraro-app.cloudfunctions.net/sendWithdrawEmailV2";
        
        const response = await fetch(functionUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${idToken}`
            },
            body: JSON.stringify({
                data: {
                    transactionId: withdrawData.id,
                    recipientEmail: recipientEmail,
                    recipientName: recipientName,
                    valor: withdrawData.valor,
                    pixType: withdrawData.pixType,
                    itens: withdrawData.itens
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Erro ao enviar email");
        }

        const result = await response.json();
        console.log('✅ Email de saque enviado com sucesso!', result);
        return true;

    } catch (error) {
        console.error('❌ Erro ao enviar email de confirmação de saque:', error);
        return false;
    }
}

/**
 * Registra avaliação do cliente no Firebase
 * @param {string} orderId - ID do pedido
 * @param {number} rating - Avaliação (1-5)
 * @param {string} comment - Comentário opcional
 */
async function registrarAvaliacaoFirebase(orderId, rating, comment = '') {
    try {
        const avaliacaoRef = db.collection('avaliacoes').doc(orderId);
        await avaliacaoRef.set({
            orderId: orderId,
            rating: rating,
            comment: comment,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            fonte: 'email'
        });
        
        console.log('Avaliação registrada com sucesso no Firebase');
        return true;
    } catch (error) {
        console.error('Erro ao registrar avaliação no Firebase:', error);
        return false;
    }
}

// Exporta as funções para uso em outros arquivos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        sendDeliveryConfirmationEmail,
        sendWithdrawConfirmationEmail,
        registrarAvaliacaoFirebase
    };
}
