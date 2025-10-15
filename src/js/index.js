const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors");

// Inicializa o app do admin
admin.initializeApp();
const db = admin.firestore();

// --- Configuração do CORS ---
const allowedOrigins = [
  "http://127.0.0.1:5500",
  "https://gerlachsg.github.io",
];

const corsHandler = cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Não permitido pela política de CORS"));
    }
  },
});

// --- FUNÇÃO DE REGISTRO DE GANHO DE PACOTE (ATUALIZADA COM DADOS DO PACOTE) ---
exports.registerPackageWin = functions.https.onRequest((request, response) => {
  corsHandler(request, response, async () => {
    if (!request.headers.authorization || !request.headers.authorization.startsWith("Bearer ")) {
      return response.status(401).send("Unauthorized");
    }
    const idToken = request.headers.authorization.split("Bearer ")[1];
    try {
      const decodedIdToken = await admin.auth().verifyIdToken(idToken);
      const userId = decodedIdToken.uid;
      const data = request.body.data;
      
      // Dados do item
      const {itemId, itemNome, itemPreco, itemImagem, itemRaridade} = data;
      
      // NOVO: Dados do pacote
      const {pacoteId, pacoteNome, pacoteImagem, pacotePreco} = data;
      
      if (!itemId || !itemNome || itemPreco === undefined || !itemImagem) {
        return response.status(400).send("Bad Request: Dados do item incompletos.");
      }
      
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        return response.status(404).send("Not Found: Usuário não encontrado.");
      }
      
      const userData = userDoc.data();
      
      const ganho = {
        itemId, 
        itemNome, 
        itemPreco, 
        itemImagem,
        itemRaridade: itemRaridade || "comum",
        userId,
        userNome: userData.displayName || "Usuário Anônimo",
        userFoto: userData.photoURL || "https://cdn.jsdelivr.net/gh/eduardoamjunior/cdn-rangoraro@main/icon/logo.svg",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        // NOVO: Informações do pacote
        pacoteId: pacoteId || null,
        pacoteNome: pacoteNome || null,
        pacoteImagem: pacoteImagem || null,
        pacotePreco: pacotePreco || null,
      };
      
      await db.collection("ganhosRecentes").add(ganho);
      return response.send({data: {status: "success"}});
    } catch (error) {
      console.error("Erro em registerPackageWin:", error);
      return response.status(401).send("Unauthorized: Token inválido.");
    }
  });
});

// --- FUNÇÃO DE REGISTRO DE GANHO DE TROCA (MANTIDA IGUAL) ---
exports.registerTradeWin = functions.https.onRequest((request, response) => {
  corsHandler(request, response, async () => {
    if (!request.headers.authorization || !request.headers.authorization.startsWith("Bearer ")) {
      return response.status(401).send("Unauthorized");
    }
    const idToken = request.headers.authorization.split("Bearer ")[1];
    try {
      const decodedIdToken = await admin.auth().verifyIdToken(idToken);
      const userId = decodedIdToken.uid;
      const data = request.body.data;
      const {itemId, itemNome, valorPago, multiplicador, itemImagem} = data;
      
      if (!itemId || !itemNome || valorPago === undefined || !multiplicador || !itemImagem) {
        return response.status(400).send("Bad Request: Dados da troca incompletos.");
      }
      
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        return response.status(404).send("Not Found: Usuário não encontrado.");
      }
      
      const userData = userDoc.data();
      
      const ganhoTroca = {
        itemId, 
        itemNome, 
        valorPago, 
        multiplicador, 
        itemImagem,
        userId,
        userNome: userData.displayName || "Usuário Anônimo",
        userFoto: userData.photoURL || "https://cdn.jsdelivr.net/gh/eduardoamjunior/cdn-rangoraro@main/icon/logo.svg",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      };
      
      await db.collection("ganhosTrocas").add(ganhoTroca);
      return response.send({data: {status: "success"}});
    } catch (error) {
      console.error("Erro em registerTradeWin:", error);
      return response.status(401).send("Unauthorized: Token inválido.");
    }
  });
});

// --- FUNÇÃO DO DASHBOARD DE ADMIN ---
exports.getDashboardData = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Autenticação é necessária.");
    }
    
    const adminRef = db.collection("admins").doc(context.auth.uid);
    const adminDoc = await adminRef.get();
    
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError("permission-denied", "Você precisa ser um admin para executar esta ação.");
    }

    const period = data.period || "today";
    const startDate = new Date();

    switch (period) {
      case "today": startDate.setHours(0, 0, 0, 0); break;
      case "3days": startDate.setDate(startDate.getDate() - 3); break;
      case "7days": startDate.setDate(startDate.getDate() - 7); break;
      case "1month": startDate.setMonth(startDate.getMonth() - 1); break;
      case "6months": startDate.setMonth(startDate.getMonth() - 6); break;
    }

    const startTimestamp = admin.firestore.Timestamp.fromDate(startDate);
    const snapshot = await db.collection("transactions")
        .where("timestamp", ">=", startTimestamp)
        .get();

    let totalDeposits = 0;
    const totalWithdrawals = 0;
    const totalDeliveries = 0;
    
    snapshot.forEach((doc) => {
      const transaction = doc.data();
      if (transaction.type === "deposit") {
        totalDeposits += transaction.finalAmount || 0;
      }
    });

    return {
      totalDeposits,
      totalCirculated: totalDeposits,
      totalWithdrawals,
      totalDeliveries,
    };
  } catch (error) {
    console.error("Erro fatal na função getDashboardData:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Ocorreu um erro inesperado no servidor.", error.message);
  }
});