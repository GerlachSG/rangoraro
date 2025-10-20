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
        

        const user = firebase.auth().currentUser;
        
        if (!user) {
            throw new Error("Usuário não autenticado");
        }

        // Salva os dados do saque para envio de email (fallback caso a Cloud Function não esteja disponível)
        const emailQueueRef = db.collection('email_queue').doc();
        await emailQueueRef.set({
            type: 'withdraw_confirmation',
            transactionId: withdrawData.id,
            recipientEmail: recipientEmail,
            recipientName: recipientName,
            valor: withdrawData.valor,
            pixType: withdrawData.pixType,
            itens: withdrawData.itens,
            userId: user.uid,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            attempts: 0
        });



        // Tenta enviar via Cloud Function (opcional - não bloqueia se falhar)
        try {
            const idToken = await user.getIdToken();
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

            if (response.ok) {
                const result = await response.json();
                
                // Marca como enviado na fila
                await emailQueueRef.update({ 
                    status: 'sent', 
                    sentAt: firebase.firestore.FieldValue.serverTimestamp() 
                });
                return true;
            } else {
                throw new Error('Cloud Function retornou erro');
            }
        } catch (fetchError) {
            console.warn('⚠️ Cloud Function indisponível, email será processado posteriormente:', fetchError.message);
            // Email ficará na fila para processamento posterior
            return true; // Retorna true porque o saque foi registrado com sucesso
        }

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
