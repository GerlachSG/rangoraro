// Arquivo: functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Inicializa o app do admin para que as funções possam acessar o Firestore
admin.initializeApp();

// Pega a referência do Firestore
const db = admin.firestore();

/**
 * Cloud Function chamada quando um usuário ganha um item de um PACOTE.
 * Ela enriquece os dados com informações do usuário e salva na coleção 'ganhosRecentes'.
 */
exports.registerPackageWin = functions.https.onCall(async (data, context) => {
  // 1. Validação: Garante que o usuário está logado.
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "Você precisa estar logado para registrar um ganho.",
    );
  }

  // 2. Validação: Garante que os dados necessários foram enviados pelo cliente.
  const {itemId, itemNome, itemPreco, itemImagem, itemRaridade} = data;
  if (!itemId || !itemNome || itemPreco === undefined || !itemImagem) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Dados do item incompletos.",
    );
  }

  const userId = context.auth.uid;

  try {
    // 3. Busca os dados do usuário (nome e foto) no Firestore.
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Usuário não encontrado.");
    }
    const userData = userDoc.data();

    // 4. Monta o objeto final do ganho.
    const ganho = {
      itemId: itemId,
      itemNome: itemNome,
      itemPreco: itemPreco,
      itemImagem: itemImagem,
      itemRaridade: itemRaridade || "comum",
      userId: userId,
      userNome: userData.displayName || "Usuário Anônimo",
      userFoto: userData.photoURL || "URL_DA_IMAGEM_PADRAO", // Coloque uma URL de imagem padrão aqui
      timestamp: admin.firestore.FieldValue.serverTimestamp(), // Usa o timestamp do servidor
    };

    // 5. Escreve o novo documento na coleção 'ganhosRecentes'.
    await db.collection("ganhosRecentes").add(ganho);

    // 6. Retorna uma mensagem de sucesso para o cliente.
    return {status: "success", message: "Ganho de pacote registrado com sucesso!"};
  } catch (error) {
    console.error("Erro ao registrar ganho de pacote:", error);
    throw new functions.https.HttpsError(
        "internal",
        "Ocorreu um erro interno ao registrar seu ganho.",
    );
  }
});

/**
 * Cloud Function chamada quando um usuário ganha uma TROCA.
 * Ela enriquece os dados e salva na coleção 'ganhosTrocas'.
 */
exports.registerTradeWin = functions.https.onCall(async (data, context) => {
    // 1. Validação: Garante que o usuário está logado.
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "Você precisa estar logado para registrar uma troca.",
        );
    }

    // 2. Validação: Garante que os dados necessários foram enviados.
    const {itemId, itemNome, valorPago, multiplicador, itemImagem} = data;
    if (!itemId || !itemNome || valorPago === undefined || !multiplicador || !itemImagem) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Dados da troca incompletos.",
        );
    }
    const userId = context.auth.uid;

    try {
        // 3. Busca os dados do usuário.
        const userRef = db.collection("users").doc(userId);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError("not-found", "Usuário não encontrado.");
        }
        const userData = userDoc.data();

        // 4. Monta o objeto final da troca.
        const ganhoTroca = {
            itemId: itemId,
            itemNome: itemNome,
            valorPago: valorPago,
            multiplicador: multiplicador,
            itemImagem: itemImagem,
            userId: userId,
            userNome: userData.displayName || "Usuário Anônimo",
            userFoto: userData.photoURL || "URL_DA_IMAGEM_PADRAO", // Coloque uma URL de imagem padrão aqui
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        };

        // 5. Escreve o documento na coleção 'ganhosTrocas'.
        await db.collection("ganhosTrocas").add(ganhoTroca);

        // 6. Retorna sucesso.
        return {status: "success", message: "Ganho de troca registrado com sucesso!"};
    } catch (error) {
        console.error("Erro ao registrar ganho de troca:", error);
        throw new functions.https.HttpsError(
            "internal",
            "Ocorreu um erro interno ao registrar sua troca.",
        );
    }
});