// Este script é exclusivo para a página admin.html

document.addEventListener("DOMContentLoaded", () => {
    // --- Inicialização do Firebase (garante que está disponível) ---
    const firebaseConfig = {
        apiKey: "AIzaSyA2vtEfyZ9y7JUVbjCHFoK2BpvbFVSE4yM",
        authDomain: "rangoraro-app.firebaseapp.com",
        projectId: "rangoraro-app",
        storageBucket: "rangoraro-app.firebasestorage.app",
        messagingSenderId: "828393845765",
        appId: "1:828393845765:web:49323f020de4ffb6e2586c"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const auth = firebase.auth();
    const db = firebase.firestore();
    // Cache de nomes de usuários (id -> displayName) para resolver entregadorId
    const userNameCache = new Map();
    (function primeUserNameCache(){
        try {
            db.collection('users').onSnapshot(s=>{ s.forEach(d=>{ const u=d.data(); if(u.displayName) userNameCache.set(d.id, u.displayName); }); });
        } catch(e){ console.warn('Falha ao montar cache de nomes', e); }
    })();

    // --- Seletores de Tela e Dashboard ---
    const loadingScreen = document.getElementById("loading-screen");
    const loginScreen = document.getElementById("login-screen");
    const mainContent = document.getElementById("main-content");
    const googleLoginButton = document.getElementById("google-login-btn");
    const totalDepositsCard = document.getElementById("total-deposits");
    const totalCirculatedCard = document.getElementById("total-circulated");
    const totalDeliveryCostCard = document.getElementById("total-delivery-cost");
    const totalProfitCard = document.getElementById("total-profit");
    const totalWithdrawalsCard = document.getElementById("total-withdrawals");
    // Profit breakdown elements
    const bd = {
        panel: document.getElementById('profit-breakdown'),
        btn: document.getElementById('btn-profit-breakdown'),
        deposits: document.getElementById('bd-deposits'),
        delivery: document.getElementById('bd-delivery-cost'),
        withdrawals: document.getElementById('bd-withdrawals'),
        profit: document.getElementById('bd-profit-final')
    };
    // KPI Elements
    const el = (id) => document.getElementById(id);
    const KPI = {
        totalUsers: el('kpi-total-users'),
        totalUsersSub: el('kpi-total-users-sub'),
        newUsers: el('kpi-new-users'),
        newUsersSub: el('kpi-new-users-sub'),
        activeUsers: el('kpi-active-users'),
        activeUsersSub: el('kpi-active-users-sub'),
        avgDeposit: el('kpi-avg-deposit'),
        avgDepositSub: el('kpi-avg-deposit-sub'),
        referralUsage: el('kpi-referral-usage'),
        referralUsageSub: el('kpi-referral-usage-sub'),
        openOrders: el('kpi-open-orders'),
        openOrdersSub: el('kpi-open-orders-sub'),
        deliveryTime: el('kpi-delivery-time'),
        deliveryTimeSub: el('kpi-delivery-time-sub'),
        payoutEntregadores: el('kpi-payout-entregadores'),
        payoutEntregadoresSub: el('kpi-payout-entregadores-sub'),
        totalBalance: el('kpi-total-balance'),
        totalBalanceSub: el('kpi-total-balance-sub')
    };
    // Lists
    const LISTS = {
        latestDeposits: el('list-latest-deposits'),
        latestWithdrawals: el('list-latest-withdrawals'),
        recentOrders: el('list-recent-orders'),
        recentDrops: el('list-recent-drops'),
        openChats: el('list-open-chats')
    };
    // Charts placeholders
    const CHART_CANVAS = {
        deposits: el('chart-deposits'),
        ordersStatus: el('chart-orders-status'),
    // topFastfoods removido
        profit: el('chart-profit')
    };
    const KPI_SUPPORT = {
        openChats: el('kpi-open-chats'),
        openChatsSub: el('kpi-open-chats-sub'),
        supportTime: el('kpi-support-time'),
        supportTimeSub: el('kpi-support-time-sub'),
        supportRating: el('kpi-support-rating'),
        supportRatingSub: el('kpi-support-rating-sub')
    };

    // Chart instances
    const charts = {};
    function ensureChart(key, type, config) {
        if (!CHART_CANVAS[key]) return null;
        if (typeof Chart === 'undefined') { console.warn('Chart.js ainda não carregado, adiando criação de', key); return null; }
        if (charts[key]) { charts[key].data = config.data; charts[key].options = config.options; charts[key].update(); return charts[key]; }
        charts[key] = new Chart(CHART_CANVAS[key].getContext('2d'), { type, ...config });
        return charts[key];
    }
    const periodSelector = document.getElementById("period-selector");

    // Variável para guardar a função de "parar de ouvir" o listener anterior
    let unsubscribeDashboardListener = null;
    const unsubscribers = [];
    function clearUnsubs() {
        if (unsubscribeDashboardListener) { unsubscribeDashboardListener(); unsubscribeDashboardListener = null; }
        while (unsubscribers.length) { try { unsubscribers.pop()(); } catch(e) {} }
    }

    // Função para atualizar card de entregas
    function updateDeliveryCard(count, avgRating, ratingCount) {
        const totalDeliveriesEl = document.getElementById('total-deliveries');
        const avgRatingValueEl = document.getElementById('avg-rating-value');
        const avgRatingSubEl = document.getElementById('avg-rating-sub');
        const deliveriesSubEl = document.getElementById('kpi-deliveries-sub');
        
        if(totalDeliveriesEl) totalDeliveriesEl.textContent = count;
        if(deliveriesSubEl) deliveriesSubEl.textContent = 'no período';
        
        if(avgRatingValueEl) {
            if(ratingCount > 0) {
                avgRatingValueEl.textContent = avgRating.toFixed(1) + ' ⭐';
                if(avgRatingSubEl) avgRatingSubEl.textContent = ratingCount + ' avaliações';
            } else {
                avgRatingValueEl.textContent = '0.0 ⭐';
                if(avgRatingSubEl) avgRatingSubEl.textContent = 'sem avaliações';
            }
        }
    }

    // Util helpers
    const formatBRL = (v) => `R$ ${Number(v||0).toFixed(2).replace('.', ',')}`;
    const percent = (num, den) => den > 0 ? ( (num/den)*100 ).toFixed(1) + '%' : '0%';
    const durationHMM = (ms) => {
        if(!ms) return '--:--';
        const m = Math.round(ms/60000); const h = Math.floor(m/60); const rm = m%60; return (h>0? h.toString().padStart(2,'0')+':':'00:') + rm.toString().padStart(2,'0');
    };

    function setSkeletonKPI() { Object.values(KPI).forEach(elm => { if(elm) elm.textContent = '…'; }); }
    function pushList(listEl, rows, mapper) {
        if(!listEl) return; listEl.innerHTML='';
        rows.forEach(r=>{ const li=document.createElement('li'); li.innerHTML = mapper(r); listEl.appendChild(li); });
        if(!rows.length) listEl.innerHTML='<li><span style="opacity:.5">Sem dados</span></li>';
    }

    /**
     * Inicia o processo de login com o Google.
     */
    function loginAdminComGoogle() {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).catch(error => {
            console.error("Erro durante o login:", error);
            loadingScreen.style.display = "none";
            loginScreen.style.display = "flex";
        });
    }
    
    /**
     * ATUALIZADO: Agora escuta por mudanças em tempo real (onSnapshot).
     */
    function computeStartDate(period) {
        const start = new Date(); start.setHours(0,0,0,0);
        switch(period){
            case '3days': start.setDate(start.getDate()-3); break;
            case '7days': start.setDate(start.getDate()-7); break;
            case '1month': start.setMonth(start.getMonth()-1); break;
            case '6months': start.setMonth(start.getMonth()-6); break;
        }
        return start;
    }

    let __lastDepositsValue = 0;
    let __lastDeliveryCostValue = 0;
    let __lastWithdrawalsValue = 0;
    // Métrica de carrinho removida
    function recomputeProfit(){
        if(!totalProfitCard) return;
        const lucro = __lastDepositsValue - __lastDeliveryCostValue - __lastWithdrawalsValue;
        totalProfitCard.textContent = formatBRL(lucro);
        if(bd.deposits) bd.deposits.textContent = formatBRL(__lastDepositsValue);
        if(bd.delivery) bd.delivery.textContent = '- ' + formatBRL(__lastDeliveryCostValue);
        if(bd.withdrawals) bd.withdrawals.textContent = '- ' + formatBRL(__lastWithdrawalsValue);
        if(bd.profit) bd.profit.textContent = formatBRL(lucro);
    }
    function listenFinancial(period){
        if(totalDepositsCard) totalDepositsCard.textContent = 'Carregando...';
        if(totalCirculatedCard) totalCirculatedCard.textContent = 'Carregando...';
        const startDate = computeStartDate(period);
        // Query só de depósitos (exclui open_package e outros tipos)
        let usedTypeFilter = true; // para sabermos se caímos em fallback
        let qDeposits = db.collection('transactions')
            .where('type','==','deposit')
            .where('timestamp','>=',startDate);
        const qWithdrawals = db.collection('transactions')
            .where('timestamp','>=',startDate);
        let withdrawalsUnsub = null;

        function handleDepositsSnapshot(snap){
            let deposits=0, depositCount=0, referralCount=0;
            const latest=[]; const depositsByDay={};
            snap.forEach(d=>{
                const t=d.data();
                if(!usedTypeFilter){ // fallback: precisamos filtrar client-side
                    if(t.type !== 'deposit') return;
                }
                deposits += t.finalAmount||t.amount||0; depositCount++;
                if(t.referralCode) referralCount++;
                latest.push(t);
                if(t.timestamp?.toDate){ const dt = t.timestamp.toDate(); const key = dt.getDate().toString().padStart(2,'0') + '/' + (dt.getMonth()+1).toString().padStart(2,'0'); depositsByDay[key] = (depositsByDay[key]||0) + (t.finalAmount||t.amount||0); }
            });
            latest.sort((a,b)=> (b.timestamp?.toMillis?.()||0)-(a.timestamp?.toMillis?.()||0));
            pushList(LISTS.latestDeposits, latest.slice(0,6), t=>`<span>${t.userName||'Usuário'}</span><span class='meta'>${formatBRL(t.finalAmount||t.amount||0)}</span>`);
            if(totalDepositsCard) totalDepositsCard.textContent = formatBRL(deposits);
            if(totalCirculatedCard) totalCirculatedCard.textContent = formatBRL(deposits); // placeholder
            __lastDepositsValue = deposits;
            if(KPI.avgDeposit) KPI.avgDeposit.textContent = formatBRL(depositCount? (deposits/depositCount):0);
            if(KPI.avgDepositSub) KPI.avgDepositSub.textContent = depositCount+ ' depósitos';
            if(KPI.referralUsage) KPI.referralUsage.textContent = percent(referralCount, depositCount||1);
            if(KPI.referralUsageSub) KPI.referralUsageSub.textContent = referralCount + ' c/ código';

            // Chart de depósitos por dia
            const dayLabels = Object.keys(depositsByDay).sort((a,b)=>{ const [da,ma]=a.split('/').map(Number); const [db,mb]=b.split('/').map(Number); return ma===mb? da-db : ma-mb; });
            if(dayLabels.length){
                const dataVals = dayLabels.map(k=> Number(depositsByDay[k].toFixed(2)) );
                ensureChart('deposits','line',{
                    data:{ labels: dayLabels, datasets:[{ label:'Depósitos', data: dataVals, tension:.3, borderColor:'#4ade80', backgroundColor:'rgba(74,222,128,.15)', fill:true, pointRadius:3, pointHoverRadius:5 }]},
                    options:{ plugins:{ legend:{display:false}}, scales:{ x:{ grid:{color:'rgba(255,255,255,0.05)'}}, y:{ grid:{color:'rgba(255,255,255,0.05)'}, ticks:{ callback:v=>'R$ '+v } } } }
                });
            }
            recomputeProfit();
        }
        unsubscribeDashboardListener = qDeposits.onSnapshot(handleDepositsSnapshot, err=>{
            if(err?.code === 'failed-precondition' || /index/i.test(err?.message||'')){
                console.warn('[Deposits] Faltando índice composto (type,timestamp). Fazendo fallback sem filtro type. Crie o índice para eficiência.');
                usedTypeFilter = false;
                qDeposits = db.collection('transactions').where('timestamp','>=',startDate);
                unsubscribeDashboardListener = qDeposits.onSnapshot(handleDepositsSnapshot, e2=>{
                    console.error('finance deposits fallback error', e2);
                    if(totalDepositsCard) totalDepositsCard.textContent = 'Erro';
                });
            } else {
                console.error('finance deposits error', err);
                if(totalDepositsCard) totalDepositsCard.textContent = 'Erro';
            }
        });

        // Saques em listener separado (não mistura com depósitos / open_package)
        withdrawalsUnsub = qWithdrawals.onSnapshot(snap=>{
            let withdrawals=0; 
            const withdrawalsList = [];
            snap.forEach(d=>{ 
                const t=d.data(); 
                if(['withdraw','saque'].includes((t.type||'').toLowerCase())) {
                    withdrawals += (t.finalAmount||t.amount||0);
                    withdrawalsList.push(t);
                }
            });
            
            // Ordena por timestamp (mais recentes primeiro)
            withdrawalsList.sort((a,b)=> (b.timestamp?.toMillis?.()||0)-(a.timestamp?.toMillis?.()||0));
            
            // Popula a lista de últimos saques
            pushList(LISTS.latestWithdrawals, withdrawalsList.slice(0,6), t=>`<span>${t.userName||'Usuário'}</span><span class='meta'>${formatBRL(t.finalAmount||t.amount||0)}</span>`);
            
            __lastWithdrawalsValue = withdrawals; 
            if(totalWithdrawalsCard) totalWithdrawalsCard.textContent = formatBRL(withdrawals); 
            if(bd.withdrawals) bd.withdrawals.textContent = '- ' + formatBRL(withdrawals); 
            
            recomputeProfit();
        });
        unsubscribers.push(()=>{ if(withdrawalsUnsub) withdrawalsUnsub(); });
    }

    function listenUsers(period){
        const startDate = computeStartDate(period);
        const q = db.collection('users').where('createdAt','>=',startDate);
        const unsub = q.onSnapshot(snap=>{
            const newCount = snap.size;
            if(KPI.newUsers) KPI.newUsers.textContent = newCount;
            if(KPI.newUsersSub) KPI.newUsersSub.textContent = 'desde ' + startDate.toLocaleDateString('pt-BR');
        });
        unsubscribers.push(unsub);

        // saldo total / média (full scan — otimizar com cloud function no futuro)
        const unsubAll = db.collection('users').onSnapshot(snap=>{
            let totalBalance=0; let count=0; snap.forEach(d=>{ const u=d.data(); totalBalance += (u.balance||0); count++; });
            if(KPI.totalBalance) KPI.totalBalance.textContent = formatBRL(totalBalance);
            if(KPI.totalBalanceSub) KPI.totalBalanceSub.textContent = 'Média ' + formatBRL(count? totalBalance/count:0);
            // Total de usuários (independente do filtro de período)
            if(KPI.totalUsers) KPI.totalUsers.textContent = count;
            if(KPI.totalUsersSub) KPI.totalUsersSub.textContent = 'cadastrados';
        });
        unsubscribers.push(unsubAll);

        // usuários ativos (critério: fez pedido ou depósito no período)
        const activeSet = new Set();
        const qTrans = db.collection('transactions').where('timestamp','>=',startDate);
        const uTrans = qTrans.onSnapshot(s=>{ s.forEach(d=> activeSet.add(d.data().userId)); updateActive(); });
        unsubscribers.push(uTrans);
        const qOrders = db.collection('pedidos-entregues').where('horaEntrega','>=',startDate);
        const uOrders = qOrders.onSnapshot(s=>{ s.forEach(d=> activeSet.add(d.data().userId)); updateActive(); });
        unsubscribers.push(uOrders);
        function updateActive(){ if(KPI.activeUsers) KPI.activeUsers.textContent = activeSet.size; if(KPI.activeUsersSub) KPI.activeUsersSub.textContent = 'no período'; }
    }

    function listenOrders(period){
        const startDate = computeStartDate(period);
        // Para pedidos abertos queremos TODOS (independente do filtro de período) => query sem filtro de data
        const qActiveAll = db.collection('pedidos');
        // Estruturas para gráficos agregados
        const statusAgg = {}; // status -> count
    // fastfoodAgg removido
    let totalDeliveryCost = 0; // acumulado período
        function updateCharts(){
            // Status chart
            const stLabels = Object.keys(statusAgg);
            if(stLabels.length){
                ensureChart('ordersStatus','bar',{
                    data:{
                        labels: stLabels,
                        datasets:[{
                            label:'Pedidos',
                            data: stLabels.map(k=>statusAgg[k]),
                            backgroundColor: stLabels.map(()=> '#60a5fa')
                        }]
                    },
                    options:{
                        plugins:{ legend:{display:false}},
                        scales:{
                            x:{ grid:{display:false}},
                            y:{ grid:{color:'rgba(255,255,255,0.05)'}, beginAtZero:true }
                        }
                    }
                });
            }
            // Top fastfoods removido
            if(totalDeliveryCostCard) totalDeliveryCostCard.textContent = formatBRL(totalDeliveryCost);
            __lastDeliveryCostValue = totalDeliveryCost;
            recomputeProfit();
        }
        const unsubA = qActiveAll.onSnapshot(snap=>{
            const open = snap.size; if(KPI.openOrders) KPI.openOrders.textContent = open; if(KPI.openOrdersSub) KPI.openOrdersSub.textContent = 'ativos';
            snap.forEach(d=>{ const o=d.data(); statusAgg[o.status||'desconhecido'] = (statusAgg[o.status||'desconhecido']||0)+1; });
            updateCharts();
        });
        unsubscribers.push(unsubA);

        // entregues para tempo médio e custos - COM FILTRO DE DATA
        const qDelivered = db.collection('pedidos-entregues').where('horaEntrega','>=',startDate);
        const unsubD = qDelivered.onSnapshot(snap=>{
            let totalDur=0, count=0; let totalTravelPayout=0; let deliveryCostPeriod=0; 
            
            // Buscar avaliações para calcular média
            const orderIds = [];
            snap.forEach(d=>{ 
                const o=d.data();
                orderIds.push(d.id);
                
                if(o.horaAceito?.toMillis && o.horaEntrega?.toMillis){ 
                    totalDur += (o.horaEntrega.toMillis()-o.horaAceito.toMillis()); 
                    count++; 
                }
                // status agregado para entregues
                statusAgg['entregue'] = (statusAgg['entregue']||0)+1;
                
                // PAGO A ENTREGADORES: valorViagem está dentro de userInfo!
                const custoViagem = o.userInfo?.valorViagem || 0;
                if(custoViagem > 0) {
                }
                totalTravelPayout += custoViagem;
                
                // Custos totais (viagem + itens) para lucro
                let somaItens = 0;
                if(Array.isArray(o.itensPedido)){
                    o.itensPedido.forEach(it=>{ somaItens += (it.valor || it.preco || it.price || 0); });
                }
                deliveryCostPeriod += (custoViagem + somaItens);
            });
            
            // Atualiza valores globais
            totalDeliveryCost = deliveryCostPeriod;
            
            // Busca avaliações e calcula média
            if(orderIds.length > 0) {
                let totalRating = 0;
                let ratingCount = 0;
                
                // Busca todas as avaliações dos pedidos do período
                orderIds.forEach(orderId => {
                    db.collection('avaliacoes').doc(orderId).get().then(doc => {
                        if(doc.exists) {
                            const rating = doc.data().rating;
                            if(rating) {
                                totalRating += rating;
                                ratingCount++;
                            }
                        }
                        
                        // Atualiza UI quando terminar de buscar
                        const avgRating = ratingCount > 0 ? (totalRating / ratingCount) : 0;
                        updateDeliveryCard(count, avgRating, ratingCount);
                    });
                });
            } else {
                updateDeliveryCard(count, 0, 0);
            }
            
            // Atualiza KPIs
            if(KPI.deliveryTime) KPI.deliveryTime.textContent = durationHMM(count? totalDur/count:0);
            if(KPI.deliveryTimeSub) KPI.deliveryTimeSub.textContent = count + ' entregues';
            if(KPI.payoutEntregadores){
                KPI.payoutEntregadores.textContent = formatBRL(totalTravelPayout);
                if(KPI.payoutEntregadoresSub) KPI.payoutEntregadoresSub.textContent = count? ('Média ' + formatBRL(totalTravelPayout/count)) : '—';
            }
            
            pushList(LISTS.recentOrders, snap.docs.sort((a,b)=> (b.data().horaEntrega?.toMillis?.()||0)-(a.data().horaEntrega?.toMillis?.()||0)).slice(0,6), d=>`<span>${d.data().userInfo?.displayName||'Usuário'}</span><span class='meta'>${(d.data().itensPedido?.length||0)} itens</span>`);
            updateCharts();
        }, err => {
            console.error('Erro ao buscar pedidos-entregues:', err);
            if(err.code === 9 || err.message?.includes('index')) {
                console.warn('⚠️ Índice necessário! Criando query alternativa sem filtro de data...');
                // Fallback: buscar todos e filtrar manualmente
                const qAll = db.collection('pedidos-entregues');
                const unsubFallback = qAll.onSnapshot(snap=>{
                    let totalDur=0, count=0; let totalTravelPayout=0; let deliveryCostPeriod=0;
                    snap.forEach(d=>{
                        const o=d.data();
                        // Filtro manual por data
                        if(!o.horaEntrega || o.horaEntrega.toMillis() < startDate.toMillis()) return;
                        
                        if(o.horaAceito?.toMillis && o.horaEntrega?.toMillis){
                            totalDur += (o.horaEntrega.toMillis()-o.horaAceito.toMillis());
                            count++;
                        }
                        const custoViagem = o.userInfo?.valorViagem || 0;
                        totalTravelPayout += custoViagem;
                        let somaItens = 0;
                        if(Array.isArray(o.itensPedido)){
                            o.itensPedido.forEach(it=>{ somaItens += (it.valor || it.preco || it.price || 0); });
                        }
                        deliveryCostPeriod += (custoViagem + somaItens);
                    });
                    totalDeliveryCost = deliveryCostPeriod;
                    if(KPI.deliveryTime) KPI.deliveryTime.textContent = durationHMM(count? totalDur/count:0);
                    if(KPI.deliveryTimeSub) KPI.deliveryTimeSub.textContent = count + ' entregues';
                    if(KPI.payoutEntregadores){
                        KPI.payoutEntregadores.textContent = formatBRL(totalTravelPayout);
                        if(KPI.payoutEntregadoresSub) KPI.payoutEntregadoresSub.textContent = count? ('Média ' + formatBRL(totalTravelPayout/count)) : '—';
                    }
                    updateCharts();
                });
                unsubscribers.push(unsubFallback);
            }
        });
        unsubscribers.push(unsubD);
    }


    function listenSupport(period){
        // Chats abertos deve ser independente do filtro de período
        const q = db.collection('support_chats');
        const unsub = q.onSnapshot(snap=>{
            const open=[]; 
            let totalResolution=0; 
            let closedCount=0;
            let totalRating=0;
            let ratedCount=0;
            
            snap.forEach(d=>{ 
                const c=d.data(); 
                
                // Chats abertos
                if(c.status==='open') open.push(c); 
                
                // Tempo médio de resolução
                if(c.status==='closed' && c.createdAt?.toMillis && c.lastUpdated?.toMillis){ 
                    totalResolution += (c.lastUpdated.toMillis() - c.createdAt.toMillis()); 
                    closedCount++; 
                }
                
                // Rating médio
                if(c.rating && typeof c.rating === 'number' && c.rating > 0) {
                    totalRating += c.rating;
                    ratedCount++;
                }
            });
            
            // Lista de chats abertos
            pushList(LISTS.openChats, open.slice(0,6), c=>`<span>${c.userName||'Usuário'}</span><span class='meta'>${(c.lastMessage||'...').slice(0,20)}</span>`);
            
            // KPI: Chats abertos
            if(KPI_SUPPORT.openChats) KPI_SUPPORT.openChats.textContent = open.length;
            if(KPI_SUPPORT.openChatsSub) KPI_SUPPORT.openChatsSub.textContent = 'ativos';
            
            // KPI: Tempo médio de resposta
            if(closedCount>0){
                const avg = totalResolution/closedCount;
                if(KPI_SUPPORT.supportTime) KPI_SUPPORT.supportTime.textContent = durationHMM(avg);
                if(KPI_SUPPORT.supportTimeSub) KPI_SUPPORT.supportTimeSub.textContent = closedCount + ' resolvidos';
            }
            
            // KPI: Rating médio
            if(ratedCount > 0) {
                const avgRating = totalRating / ratedCount;
                if(KPI_SUPPORT.supportRating) {
                    KPI_SUPPORT.supportRating.textContent = avgRating.toFixed(1) + ' ⭐';
                }
                if(KPI_SUPPORT.supportRatingSub) {
                    KPI_SUPPORT.supportRatingSub.textContent = ratedCount + ' avaliações';
                }
            } else {
                if(KPI_SUPPORT.supportRating) KPI_SUPPORT.supportRating.textContent = '—';
                if(KPI_SUPPORT.supportRatingSub) KPI_SUPPORT.supportRatingSub.textContent = 'sem avaliações';
            }
        });
        unsubscribers.push(unsub);
    }

    function listenAll(period){
        clearUnsubs();
        setSkeletonKPI();
        listenFinancial(period);
        listenUsers(period);
        listenOrders(period);
        listenSupport(period);
        // listenCartEstimate removido
    }

    // listenCartEstimate removido

    // Listener de autenticação
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            loadingScreen.style.display = "flex";
            loginScreen.style.display = "none";
            
            const idTokenResult = await user.getIdTokenResult(true); 
            const claims = idTokenResult.claims || {};
            const userIsAdmin = (claims.admin === true) || (claims.role === 'admin') || (claims.isAdmin === true);

            if (userIsAdmin) {
                loadingScreen.style.display = "none";
                mainContent.style.display = "flex";
                
                const currentPeriod = periodSelector ? periodSelector.value : 'today';
                listenAll(currentPeriod);
            } else {
                alert("Você não tem permissão para acessar esta página.");
                auth.signOut();
            }
        } else {
            loadingScreen.style.display = "none";
            loginScreen.style.display = "flex";
            mainContent.style.display = "none";
            clearUnsubs();
        }
    });

    // Listeners do Dashboard
    if (periodSelector) {
        periodSelector.addEventListener('change', (e)=> listenAll(e.target.value));
    }
    if (googleLoginButton) {
        googleLoginButton.addEventListener("click", loginAdminComGoogle);
    }

    if(bd.btn && bd.panel){
        // Garante iniciar fechado sempre
        bd.btn.setAttribute('aria-expanded','false');
        if(bd.panel) bd.panel.hidden = true;
        bd.btn.addEventListener('click', ()=>{
            const expanded = bd.btn.getAttribute('aria-expanded') === 'true';
            bd.btn.setAttribute('aria-expanded', String(!expanded));
            if(expanded){ bd.panel.hidden = true; } else { bd.panel.hidden = false; }
        });
    }

    // ========== RATING MODAL LOGIC ==========
    const ratingModal = document.getElementById('rating-modal');
    const ratingModalClose = document.getElementById('rating-modal-close');
    const deliveryRatingCard = document.getElementById('delivery-rating-card');
    const supportRatingCard = document.getElementById('support-rating-card');
    
    let allRatings = [];
    let currentFilter = 'all';
    let currentRatingType = 'delivery';

    // Open modal
    function openRatingModal(type) {
        currentRatingType = type;
        const title = type === 'delivery' ? 'Avaliações de Entregas' : 'Avaliações de Suporte';
        document.getElementById('rating-modal-title').textContent = title;
        ratingModal.style.display = 'block';
        loadRatings(type);
    }

    // Close modal
    function closeRatingModal() {
        ratingModal.style.display = 'none';
        allRatings = [];
        currentFilter = 'all';
    }

    // Load ratings from Firestore
    async function loadRatings(type) {
        try {
            const collection = type === 'delivery' ? 'avaliacoes' : 'support_chats';
            const snapshot = await db.collection(collection).get();
            
            allRatings = [];
            const ratingCounts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
            let totalRating = 0;
            
            snapshot.forEach(doc => {
                const data = doc.data();
                let rating, comment, timestamp, orderId;
                
                if(type === 'delivery') {
                    rating = data.rating;
                    comment = data.comentario;
                    timestamp = data.timestamp;
                    orderId = doc.id;
                } else {
                    rating = data.rating;
                    comment = data.lastMessage || 'Sem comentário';
                    timestamp = data.lastUpdated;
                    orderId = doc.id;
                }
                
                if(rating && rating >= 1 && rating <= 5) {
                    allRatings.push({
                        rating,
                        comment: comment || 'Sem comentário',
                        timestamp,
                        orderId
                    });
                    ratingCounts[rating]++;
                    totalRating += rating;
                }
            });
            
            // Sort by most recent
            allRatings.sort((a, b) => {
                const aTime = a.timestamp?.toMillis?.() || 0;
                const bTime = b.timestamp?.toMillis?.() || 0;
                return bTime - aTime;
            });
            
            // Update summary
            const total = allRatings.length;
            const avgRating = total > 0 ? (totalRating / total) : 0;
            
            document.getElementById('rating-avg-number').textContent = avgRating.toFixed(1);
            document.getElementById('rating-avg-stars').textContent = '⭐'.repeat(Math.round(avgRating));
            document.getElementById('rating-avg-total').textContent = `${total} avaliações`;
            
            // Update breakdown bars
            for(let i = 1; i <= 5; i++) {
                const count = ratingCounts[i];
                const percentage = total > 0 ? (count / total * 100) : 0;
                document.getElementById(`bar-${i}`).style.width = percentage + '%';
                document.getElementById(`count-${i}`).textContent = count;
            }
            
            // Display ratings
            displayRatings(allRatings);
            
        } catch(error) {
            console.error('Erro ao carregar avaliações:', error);
            document.getElementById('rating-list').innerHTML = '<div class="rating-empty">Erro ao carregar avaliações</div>';
        }
    }

    // Display ratings in list
    function displayRatings(ratings) {
        const ratingList = document.getElementById('rating-list');
        
        if(ratings.length === 0) {
            ratingList.innerHTML = '<div class="rating-empty">Nenhuma avaliação encontrada</div>';
            return;
        }
        
        ratingList.innerHTML = ratings.map(r => {
            const date = r.timestamp?.toDate?.() || new Date();
            const dateStr = date.toLocaleDateString('pt-BR', {day: '2-digit', month: 'short', year: 'numeric'});
            const stars = '⭐'.repeat(r.rating);
            
            return `
                <div class="rating-item">
                    <div class="rating-item-header">
                        <div class="rating-item-stars">${stars}</div>
                        <div class="rating-item-date">${dateStr}</div>
                    </div>
                    <div class="rating-item-comment">${r.comment}</div>
                    <div class="rating-item-order">Pedido: ${r.orderId.substring(0, 8)}</div>
                </div>
            `;
        }).join('');
    }

    // Filter ratings
    function filterRatings(filterValue) {
        currentFilter = filterValue;
        
        // Update active button
        document.querySelectorAll('.rating-filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if(btn.dataset.filter === filterValue) {
                btn.classList.add('active');
            }
        });
        
        // Filter and display
        const filtered = filterValue === 'all' 
            ? allRatings 
            : allRatings.filter(r => r.rating === parseInt(filterValue));
        
        displayRatings(filtered);
    }

    // Event listeners
    if(deliveryRatingCard) {
        deliveryRatingCard.addEventListener('click', () => openRatingModal('delivery'));
    }
    
    if(supportRatingCard) {
        supportRatingCard.addEventListener('click', () => openRatingModal('support'));
    }
    
    if(ratingModalClose) {
        ratingModalClose.addEventListener('click', closeRatingModal);
    }
    
    if(ratingModal) {
        ratingModal.addEventListener('click', (e) => {
            if(e.target === ratingModal) closeRatingModal();
        });
    }
    
    // Filter button listeners
    document.querySelectorAll('.rating-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            filterRatings(btn.dataset.filter);
        });
    });
});

/*
============================
 SUGESTÃO DE ÍNDICES FIRESTORE
============================
Queries atuais usam apenas simples where(field >= startDate) que requerem índice simples automático.
Se futuramente adicionar ordenações ou múltiplos filtros, considerar:
1) transactions: index composto (timestamp ASC, type ASC) para filtrar por período e tipo.
2) users: (createdAt ASC) já automático. Se adicionar orderBy(createdAt) com startAt/endAt ok.
3) pedidos: (createdAt ASC, status ASC) se filtrar por status + período simultaneamente.
4) pedidos-entregues: (horaEntrega ASC) simples; composto (horaEntrega ASC, fastfoodNome ASC) se quiser ranking por fastfood dentro de período via query.
5) support_chats: (lastUpdated ASC, status ASC) para filtrar por status e ordenar por lastUpdated.
6) ganhosRecentes: (timestamp ASC, itemRaridade ASC) para métricas de raridade filtradas por período.
7) ganhosTrocas: (timestamp ASC) simples.

Boas práticas:
- Evitar múltiplos onSnapshot pesados: já usamos filtros por período para reduzir carga.
- Para métricas históricas longas (ex: > 6 meses) considerar Cloud Functions que mantenham coleções agregadas (ex: daily_financial, daily_orders).
- Para top fastfoods e depósitos diários, pagamentos antigos podem ser agregados offline e apenas delta em tempo real.
*/

