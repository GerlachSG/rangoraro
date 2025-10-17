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

        // Chama a Cloud Function que envia o email de forma segura
        const sendEmail = firebase.functions().httpsCallable('sendDeliveryEmail');
        
        const result = await sendEmail({
            orderId: orderData.id,
            recipientEmail: recipientEmail,
            recipientName: recipientName
        });

        if (result.data.success) {
            console.log('✅ Email enviado com sucesso!', result.data);
            return true;
        } else {
            console.error('❌ Erro ao enviar email:', result.data);
            return false;
        }

    } catch (error) {
        console.error('❌ Erro ao enviar email de confirmação:', error);
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
        registrarAvaliacaoFirebase
    };
}
