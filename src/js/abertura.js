// DOM elements (declared in outer scope so other functions can access them)
let speedToggleButton, openButton, openButtonContent, demoButton, itemsTrack, rouletteArea, productsGrid, boxTitleElement, boxItemCountElement, boxImageElement;
// State variables promoted to outer scope so other functions can access them
let isSpinning = false;
let currentStage = 1;
let pacoteAtual = null;
// Expose iniciarAbertura so other functions (outside DOMContentLoaded) can call it
let iniciarAbertura;

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DO DOM ---
    speedToggleButton = document.getElementById('speed-toggle');
    openButton = document.querySelector('.btn-open');
    openButtonContent = openButton ? openButton.querySelector('.button-content') : null;
    demoButton = document.querySelector('.btn-side');
    itemsTrack = document.querySelector('.items-track');
    rouletteArea = document.querySelector('.roulette-area');
    productsGrid = document.querySelector('.products');
    boxTitleElement = document.querySelector('.box-title');
    boxItemCountElement = document.querySelector('.box-item-count');
    boxImageElement = document.querySelector('.box-image');

    // --- ELEMENTOS DO SISTEMA PROVABLY FAIR ---
    const serverSeedHashElement = document.getElementById('server-seed-hash');
    const clientSeedInputElement = document.getElementById('client-seed-input');
    const nonceElement = document.getElementById('nonce');
    const lastServerSeedElement = document.getElementById('last-server-seed');

    // --- VARIÁVEIS DE ESTADO ---
    const TOTAL_ROULETTE_ITEMS = 70;
    const WINNER_POSITION = 62;
    // Guarda o ref da última transação de abrir pacote para poder completar/refund depois
    let lastOpeningTxRef = null;
    // Guard para evitar reentrância/execução duplicada
    let lastOpenCalledAt = 0;

    // --- LÓGICA PROVABLY FAIR ---
    let serverSeed, clientSeed, nonce;

    function generateRandomSeed() {
        return CryptoJS.lib.WordArray.random(16).toString();
    }

    function setupProvablyFair() {
        // Adicionamos esta verificação no início
        if (!clientSeedInputElement) {
            console.warn("Elementos do 'Provably Fair' não encontrados no HTML. A funcionalidade não será iniciada.");
            return; // Para a execução da função aqui se o campo não existir
        }

        serverSeed = generateRandomSeed();
        clientSeed = clientSeedInputElement.value || generateRandomSeed();
        clientSeedInputElement.value = clientSeed;
        nonce = 0;

        if (serverSeedHashElement) serverSeedHashElement.textContent = CryptoJS.SHA256(serverSeed).toString();
        if (nonceElement) nonceElement.textContent = nonce;
        if (lastServerSeedElement) lastServerSeedElement.textContent = '???';
    }

    function getProvablyFairRandomGenerator(spinNonce) {
        const combinedSeed = `${serverSeed}-${clientSeed}-${spinNonce}`;
        let hmac = CryptoJS.HmacSHA512(combinedSeed, serverSeed).toString();
        
        let currentIndex = 0;

        return () => {
            if (currentIndex + 8 > hmac.length) {
                hmac = CryptoJS.SHA256(hmac).toString();
                currentIndex = 0;
            }
            const hex = hmac.substring(currentIndex, currentIndex + 8);
            currentIndex += 8;
            const decimal = parseInt(hex, 16);
            return decimal / 0x100000000;
        };
    }

    if (clientSeedInputElement) {
        clientSeedInputElement.addEventListener('change', () => {
            clientSeed = clientSeedInputElement.value;
            console.log("Semente do cliente atualizada. Uma nova semente do servidor será gerada para o próximo giro.");
            setupProvablyFair(); 
        });
    }

    // --- LÓGICA DE CARREGAMENTO DE DADOS DO FIREBASE ---

    /**
     * Pega o ID do pacote da URL (ex: ?pacote=palhacada).
     */
    function getUrlParameter(name) {
        name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
        var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
        var results = regex.exec(location.search);
        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    }
    
    async function carregarPacoteDaAbertura() {
        const pacoteId = getUrlParameter('pacote');
        if (!pacoteId) {
            document.body.innerHTML = '<h1>Erro: Pacote não especificado na URL.</h1>';
            return;
        }
        try {
            const pacoteRef = firebase.firestore().collection('pacotes').doc(pacoteId);
            const pacoteDoc = await pacoteRef.get();
            if (!pacoteDoc.exists) {
                document.body.innerHTML = `<h1>Erro: Pacote "${pacoteId}" não encontrado.</h1>`;
                return;
            }

            const pacoteData = pacoteDoc.data();
            const itensConfig = pacoteData.itens || [];
            if (itensConfig.length === 0) {
                document.body.innerHTML = `<h1>Erro: O pacote "${pacoteId}" não possui itens.</h1>`;
                return;
            }

            const itensIDs = itensConfig.map(itemConf => itemConf.itemId);
            const itemPromises = itensIDs.map(id => firebase.firestore().collection('itens').doc(id).get());
            const itemDocs = await Promise.all(itemPromises);

            // Combina os dados base do item com a chance E raridade do pacote
            const itensDoPacote = itemDocs.map((doc, index) => {
                if (doc.exists) {
                    const dadosBaseDoItem = { id: doc.id, ...doc.data() };
                    // Pega a chance e a raridade do pacote
                    dadosBaseDoItem.chance = itensConfig[index].chance;
                    dadosBaseDoItem.raridade = itensConfig[index].raridade; 
                    return dadosBaseDoItem;
                }
                return null;
            }).filter(item => item !== null);

            pacoteAtual = {
                id: pacoteId, // Adiciona o ID do pacote
                ...pacoteData,
                qtdItens: itensDoPacote.length,
                itens: itensDoPacote
            };
            
            inicializarPagina();

        } catch (error) {
            console.error("Erro ao buscar dados do Firestore: ", error);
            document.body.innerHTML = '<h1>Ocorreu um erro ao carregar os dados.</h1>';
        }
    }

    /**
     * Agrupa todas as funções que preparam a página depois que os dados são carregados.
     */
    function inicializarPagina() {
        if (!pacoteAtual) return;
        
        itensComunsParaRoleta = pacoteAtual.itens.filter(item => !highTiers.includes(item.raridade));

        calcularProbabilidadesPorTier();
        carregarInfoDoPacote(pacoteAtual);
        preencherGridDeProdutos();
        preencherRoleta(null, itensComunsParaRoleta);
        setupProvablyFair();
    }

    // --- DADOS (agora dinâmicos) ---
    // pacoteAtual is declared in outer scope
    const highTiers = ['epico', 'lendario'];
    let itensComunsParaRoleta = [];
    const tiersDeProbabilidade = [];

    // --- FUNÇÕES DE LÓGICA E RENDERIZAÇÃO ---
    const calcularProbabilidadesPorTier = () => {
        const tiers = { comum: 0, incomum: 0, raro: 0, especial: 0 };
        pacoteAtual.itens.forEach(item => {
            if (highTiers.includes(item.raridade)) tiers.especial += item.chance;
            else tiers[item.raridade] += item.chance;
        });
        tiersDeProbabilidade.length = 0;
        tiersDeProbabilidade.push({ nome: 'Comum', chance: tiers.comum, raridade: 'comum', imagemUrl: '--' });
        tiersDeProbabilidade.push({ nome: 'Incomum', chance: tiers.incomum, raridade: 'incomum', imagemUrl: '--' });
        tiersDeProbabilidade.push({ nome: 'Raro', chance: tiers.raro, raridade: 'raro', imagemUrl: '--' });
        tiersDeProbabilidade.push({ nome: 'Épico ou Superior', chance: tiers.especial, raridade: 'especial', imagemUrl: 'https://cdn.jsdelivr.net/gh/eduardoamjunior/cdn-rangoraro@main/especial.png' });
    };

    const carregarInfoDoPacote = (pacote) => {
        if (boxTitleElement) boxTitleElement.textContent = pacote.nome;
        if (boxItemCountElement) boxItemCountElement.textContent = `Contém ${pacote.qtdItens} itens`;
        if (boxImageElement) boxImageElement.src = pacote.imagemUrl;
        const priceTag = openButton.querySelector('.price-tag');
        if (priceTag) priceTag.textContent = `R$ ${pacote.preco.toFixed(2).replace('.', ',')}`;
    };

    const criarProductCardHTML = (item) => `<div class="product-card" data-rarity="${item.raridade}"><div class="product-content"><span class="product-percentage">${item.chance.toFixed(2)}%</span><div class="image-container"><div class="rarity-glow"></div><img class="product-image" src="${item.imagemUrl}" alt="${item.nome}"></div><h3 class="product-name">${item.nome}</h3><p class="product-price">R$ ${parseFloat(item.valor || 0).toFixed(2).replace('.', ',')}</p></div></div>`;
    const criarItemBoxHTML = (item) => `<div class="item-box" data-rarity="${item.raridade}"><img class="item-image" src="${item.imagemUrl}" alt="${item.nome}"><div class="item-info"><p class="item-name">${item.nome}</p><p class="item-price">${item.valor ? `R$ ${parseFloat(item.valor || 0).toFixed(2).replace('.', ',')}` : ''}</p></div></div>`;

    const preencherGridDeProdutos = () => {
        if (!productsGrid || !pacoteAtual.itens) return;
        const itensOrdenados = [...pacoteAtual.itens].sort((a, b) => {
            const raridadeOrder = { 'lendario': 0, 'epico': 1, 'raro': 2, 'incomum': 3, 'comum': 4 };
            if (raridadeOrder[a.raridade] !== raridadeOrder[b.raridade]) return raridadeOrder[a.raridade] - raridadeOrder[b.raridade];
            return b.valor - a.valor;
        });
        productsGrid.innerHTML = itensOrdenados.map(criarProductCardHTML).join('');
    };

    const preencherRoleta = (itemVencedor = null, listaDeFundo = tiersDeProbabilidade) => {
        if (!itemsTrack) return;
        let visualItems = [];
        if (listaDeFundo.length === 0) return;

        const specialTierItem = tiersDeProbabilidade.find(t => t.raridade === 'especial');
        const isFirstStageAnimation = (listaDeFundo === itensComunsParaRoleta && specialTierItem);

        const getNextVisualItem = () => {
            if (isFirstStageAnimation && Math.random() < 0.15) { 
                return specialTierItem;
            }
            return listaDeFundo[Math.floor(Math.random() * listaDeFundo.length)];
        };

        if (itemVencedor) {
            for (let i = 0; i < WINNER_POSITION; i++) {
                visualItems.push(getNextVisualItem());
            }
            visualItems.push(itemVencedor);
            for (let i = WINNER_POSITION + 1; i < TOTAL_ROULETTE_ITEMS; i++) {
                visualItems.push(getNextVisualItem());
            }
        } else {
            for (let i = 0; i < TOTAL_ROULETTE_ITEMS; i++) {
                visualItems.push(getNextVisualItem());
            }
        }

        itemsTrack.innerHTML = visualItems.map(criarItemBoxHTML).join('');
    };

    const sortearTier = (random) => {
        let randomPercent = random() * 100;
        for (const tier of tiersDeProbabilidade) {
            randomPercent -= tier.chance;
            if (randomPercent <= 0) return tier;
        }
        return tiersDeProbabilidade[0];
    };

    const sortearItemDoTier = (tierRaridade, random) => {
        const itensDoTier = pacoteAtual.itens.filter(item => {
            if (tierRaridade === 'especial') return highTiers.includes(item.raridade);
            return item.raridade === tierRaridade;
        });
        if (itensDoTier.length === 0) return null;
        let totalChanceNoTier = itensDoTier.reduce((sum, item) => sum + item.chance, 0);
        let randomValue = random() * totalChanceNoTier;
        for (const item of itensDoTier) {
            randomValue -= item.chance;
            if (randomValue <= 0) return item;
        }
        return itensDoTier[itensDoTier.length - 1];
    };
    
    const dispararConfetes = (targetElement) => {
        if (!targetElement) return;
        const oldScript = document.querySelector('script[src*="canvas-confetti"]');
        if (oldScript) {
            oldScript.remove();
        }
        const newScript = document.createElement('script');
        newScript.onload = () => {
            const rect = targetElement.getBoundingClientRect();
            const origin = {
                x: (rect.left + rect.width / 2) / window.innerWidth,
                y: (rect.top + rect.height / 2) / window.innerHeight
            };
            confetti({
                particleCount: 200,
                spread: 100,
                origin: origin,
                startVelocity: 45,
                gravity: 1.2,
                ticks: 250,
                zIndex: 1001
            });
        };
        newScript.src = '../js/lib/canvas-confetti.min.js';
        document.body.appendChild(newScript);
    };

    const animarRoleta = (itemVencedor, itemFinal, isDemo, onComplete) => {
        const allItems = Array.from(itemsTrack.querySelectorAll('.item-box'));
        if (!rouletteArea || allItems.length <= WINNER_POSITION) { isSpinning = false; if (onComplete) onComplete(null); return; }
        const targetItem = allItems[WINNER_POSITION];
        const itemWidth = targetItem.offsetWidth;
        const rouletteWidth = rouletteArea.offsetWidth;
        if (itemWidth === 0 || rouletteWidth === 0) { isSpinning = false; if (onComplete) onComplete(null); return; }
        const itemCenterInTrack = targetItem.offsetLeft + (itemWidth / 2);
        const rouletteCenter = rouletteWidth / 2;
        const finalTranslateX = itemCenterInTrack - rouletteCenter;
        const offsetDirection = Math.random() < 0.5 ? -1 : 1;
        const offsetAmount = itemWidth * (Math.random() * 0.2 + 0.2);
        const nearMissTranslateX = finalTranslateX + (offsetAmount * offsetDirection);
        const isFast = speedToggleButton && speedToggleButton.classList.contains('active');
        const mainSpinDuration = isFast ? 2500 : 4800;
        const correctionDuration = isFast ? 500 : 800;
        itemsTrack.style.transition = `transform ${mainSpinDuration}ms cubic-bezier(0.25, 1, 0.5, 1)`;
        itemsTrack.style.transform = `translateX(-${nearMissTranslateX}px)`;
        setTimeout(() => {
            itemsTrack.style.transition = `transform ${correctionDuration}ms cubic-bezier(0.55, 0.055, 0.675, 0.19)`;
            itemsTrack.style.transform = `translateX(-${finalTranslateX}px)`;
        }, mainSpinDuration);
        setTimeout(() => {
            const itemRevelado = itemFinal || itemVencedor;
            if (itemFinal && targetItem) {
                const img = targetItem.querySelector('.item-image');
                const name = targetItem.querySelector('.item-name');
                const price = targetItem.querySelector('.item-price');
                if (img) { img.src = itemFinal.imagemUrl; img.alt = itemFinal.nome; }
                if (name) name.textContent = itemFinal.nome;
                if (price) price.textContent = `R$ ${itemFinal.valor.toFixed(2).replace('.', ',')}`;
                targetItem.setAttribute('data-rarity', itemFinal.raridade);
                
                // Registra o ganho, adiciona ao carrinho e dispara confete apenas se não for demo e for item final
                if (!isDemo) {
                    // Registra o ganho no sistema de recentes
                    if (typeof registrarGanho === 'function') {
                        const packageInfo = pacoteAtual ? {
                            id: pacoteAtual.id,
                            nome: pacoteAtual.nome,
                            imagem: pacoteAtual.imagemUrl, // Campo correto é imagemUrl
                            preco: pacoteAtual.preco
                        } : null;
                        
                        console.log('🎁 Registrando ganho com pacote:', packageInfo); // DEBUG
                        
                        registrarGanho(
                            {
                                id: itemFinal.id,
                                name: itemFinal.nome,
                                price: itemFinal.valor,
                                image: itemFinal.imagemUrl,
                                rarity: itemFinal.raridade
                            },
                            packageInfo
                        );
                    }

                    // Também adiciona ao carrinho do usuário (compatível com a função usada em trocas.js)
                    if (typeof addToCart === 'function') {
                        addToCart({
                            id: itemFinal.id,
                            name: itemFinal.nome,
                            price: itemFinal.valor,
                            image: itemFinal.imagemUrl,
                            fastfood: itemFinal.fastfood,
                            opcoes: Array.isArray(itemFinal.opcoes) ? itemFinal.opcoes.slice() : undefined,
                            'opcoes-retirar': Array.isArray(itemFinal['opcoes-retirar']) ? itemFinal['opcoes-retirar'].slice() : undefined
                        });
                    }

                    // Dispara confete ao ganhar um item cujo valor é maior que o valor de abertura do pacote atual
                    if ( (itemFinal.valor > pacoteAtual.preco) && !targetItem.__confettiFired ) {
                        targetItem.__confettiFired = true;
                        try { dispararConfetes(targetItem); } catch (e) { console.error('Erro ao disparar confetes:', e); }
                    }
                }
            }
            targetItem.classList.add('revealed');
            if (onComplete) onComplete(targetItem);
        }, mainSpinDuration + correctionDuration);
    };

    const prepararSegundoEstagio = () => {
        currentStage = 2;
        isSpinning = false;
        openButton.classList.add('special');
        if(openButtonContent) openButtonContent.innerHTML = "ABRIR ITEM ESPECIAL";
        openButton.classList.remove('disabled');
    };

    const resetarParaPrimeiroEstagio = () => {
        currentStage = 1;
        const priceTag = `<span class="price-tag">R$ ${pacoteAtual.preco.toFixed(2).replace('.',',')}</span>`;
        if(openButtonContent) openButtonContent.innerHTML = `Abrir ${priceTag}`;
        openButton.classList.remove('special');
        openButton.classList.remove('disabled');
    };

    iniciarAbertura = async (isDemo = false) => {
        const now = Date.now();
        if (now - lastOpenCalledAt < 2000) {
            console.warn('iniciarAbertura chamado rapidamente novamente — ignorando para evitar duplicação.');
            return;
        }
        lastOpenCalledAt = now;
        if (isSpinning) return;

        // Se não for demo, verifica se está logado
        if (!isDemo && !auth.currentUser) {
            showAuthModal();
            return;
        }

        // Define o preço do pacote (necessário para XP depois)
        const price = (pacoteAtual && typeof pacoteAtual.preco === 'number') ? pacoteAtual.preco : (pacoteAtual && pacoteAtual.preco ? Number(pacoteAtual.preco) : 0);

    // Se não for demo E estivermos no estágio 1, verifica saldo e debita o preço do pacote dentro de uma transaction
    // (não debitar ao abrir item especial no estágio 2)
    if (!isDemo && currentStage === 1) {
            try {
                const user = auth.currentUser;
                const userRef = firebase.firestore().collection('users').doc(user.uid);

                // Pre-cria a ref da transação para podermos atualizá-la depois
                const txRef = firebase.firestore().collection('transactions').doc();
                lastOpeningTxRef = txRef;

                await firebase.firestore().runTransaction(async tx => {
                    const userDoc = await tx.get(userRef);
                    const balance = (userDoc.exists && userDoc.data().balance) ? Number(userDoc.data().balance) : 0;
                    if (balance < price) {
                        throw new Error('INSUFFICIENT_BALANCE');
                    }

                    // Debita o saldo
                    tx.update(userRef, { balance: firebase.firestore.FieldValue.increment(-price) });

                    const ticketsToAdd = Math.floor(price);
                        if (ticketsToAdd > 0) {
                            tx.update(userRef, { raffleTickets: firebase.firestore.FieldValue.increment(ticketsToAdd) });
                        }

                    // Registra uma entrada de transação para auditoria usando a ref pré-criada
                    tx.set(txRef, {
                        userId: user.uid,
                        type: 'open_package',
                        packageId: pacoteAtual && pacoteAtual.id ? pacoteAtual.id : null,
                        amount: price,
                        status: 'debited',
                        ticketsGenerated: ticketsToAdd,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });

                console.log(`Saldo debitado: R$ ${price} do usuário ${auth.currentUser.uid}`);
            } catch (err) {
                if (err && err.message === 'INSUFFICIENT_BALANCE') {
                    console.warn('Saldo insuficiente para abrir o pacote');
                    // Prefer opening the deposit modal so the user can top up and try again
                    if (typeof openDepositModal === 'function') {
                        openDepositModal();
                    } else {
                        alert('Saldo insuficiente. Faça um depósito para abrir este pacote.');
                    }
                    // reset UI state
                    if (openButtonContent) openButtonContent.innerHTML = `Abrir <span class="price-tag">R$ ${pacoteAtual.preco.toFixed(2).replace('.', ',')}</span>`;
                    openButton.classList.remove('disabled');
                    isSpinning = false;
                    updateOpenButtonState();
                    return;
                }
                console.error('Erro ao debitar saldo do usuário:', err);
                alert('Ocorreu um erro ao processar o pagamento. Tente novamente.');
                return;
            }
        }

        // Marca que está girando e bloqueia o botão apenas após o débito
        isSpinning = true;
        openButton.classList.add('disabled');

        try {
            nonce++;
            if (nonceElement) nonceElement.textContent = nonce;
            const random = getProvablyFairRandomGenerator(nonce);
            const oldServerSeed = serverSeed;
            itemsTrack.style.transition = 'opacity 0.2s ease-out';
            itemsTrack.style.opacity = 0;
            setTimeout(() => {
                let itemVencedorRoleta = null;
                let itemFinalRevelado = null;
                let needsSecondStage = false;
                let listaDeFundoParaRoleta;
                if (currentStage === 1) {
                    const tierVencedor = sortearTier(random);
                    listaDeFundoParaRoleta = itensComunsParaRoleta;
                    if (tierVencedor.raridade === 'especial') {
                        needsSecondStage = true;
                        itemVencedorRoleta = tiersDeProbabilidade.find(t => t.raridade === 'especial');
                        itemFinalRevelado = null;
                    } else {
                        itemFinalRevelado = sortearItemDoTier(tierVencedor.raridade, random);
                        itemVencedorRoleta = itemFinalRevelado;
                    }
                } else {
                    const itensEspeciais = pacoteAtual.itens.filter(item => highTiers.includes(item.raridade));
                    itemFinalRevelado = sortearItemDoTier('especial', random);
                    itemVencedorRoleta = itemFinalRevelado;
                    listaDeFundoParaRoleta = itensEspeciais;
                }
                preencherRoleta(itemVencedorRoleta, listaDeFundoParaRoleta);
                itemsTrack.style.transition = 'none';
                itemsTrack.style.transform = 'translateX(0)';
                itemsTrack.offsetHeight;
                itemsTrack.style.transition = 'opacity 0.2s ease-in';
                itemsTrack.style.opacity = 1;
                setTimeout(() => {
                    // Passa isDemo como parâmetro para animarRoleta
                    animarRoleta(itemVencedorRoleta, itemFinalRevelado, isDemo, async (revealedElement) => {
                        // Atualiza seed e interface
                        if (lastServerSeedElement) lastServerSeedElement.textContent = oldServerSeed;
                        serverSeed = generateRandomSeed();
                        if (serverSeedHashElement) serverSeedHashElement.textContent = CryptoJS.SHA256(serverSeed).toString();

                        // Se tivermos uma transação de abertura pendente, marque como completed e anexe info do item ganho
                        if (lastOpeningTxRef) {
                            try {
                                const wonItem = itemFinalRevelado || itemVencedorRoleta || null;
                                const updateData = {
                                    status: 'completed',
                                    completedAt: firebase.firestore.FieldValue.serverTimestamp()
                                };
                                
                                // Adicionar campos do item ganho apenas se existirem
                                if (wonItem) {
                                    if (wonItem.id) updateData.wonItemId = wonItem.id;
                                    if (wonItem.nome || wonItem.name) updateData.wonItemName = wonItem.nome || wonItem.name;
                                    if (wonItem.valor || wonItem.price) updateData.wonItemValue = wonItem.valor || wonItem.price;
                                }
                                
                                await lastOpeningTxRef.update(updateData);

                                // ✨ ADICIONA XP APÓS ABRIR PACOTE
                                if (!isDemo && window.XPSystem && auth.currentUser) {
                                    const xpGanho = XPSystem.calculateXP('pacote', price);
                                    const result = await XPSystem.addXP(auth.currentUser.uid, xpGanho, `Abriu pacote (R$ ${price.toFixed(2)})`);
                                    
                                    // Notificação de XP desabilitada
                                    // if (result) {
                                    //     XPSystem.showXPNotification(xpGanho, 'Pacote aberto');
                                    // }
                                }

                            } catch (err) {
                                console.error('Erro ao marcar transação de abertura como completed:', err);
                            } finally {
                                lastOpeningTxRef = null;
                            }
                        }

                        if (needsSecondStage) {
                            setTimeout(prepararSegundoEstagio, 1000);
                        } else {
                            if (currentStage === 2) {
                                setTimeout(() => {
                                    resetarParaPrimeiroEstagio();
                                    isSpinning = false;
                                }, 1500);
                            } else {
                                isSpinning = false;
                                openButton.classList.remove('disabled');
                            }
                        }
                    });
                }, 100);
            }, 200);
        } catch (err) {
            console.error('Erro durante o processo de abertura:', err);
            // Tenta reembolsar o usuário caso tenhamos debitado
            try {
                if (lastOpeningTxRef) {
                    // marca transação como refund
                    await lastOpeningTxRef.update({ status: 'refunded', refundedAt: firebase.firestore.FieldValue.serverTimestamp() });
                    // reembolsa saldo
                    const userRef = firebase.firestore().collection('users').doc(auth.currentUser.uid);
                    await userRef.update({ balance: firebase.firestore.FieldValue.increment(pacoteAtual.preco) });
                    lastOpeningTxRef = null;
                }
            } catch (refundErr) {
                console.error('Erro ao tentar reembolsar o usuário automaticamente:', refundErr);
            }

            alert('Ocorreu um erro durante a abertura. Seu saldo foi reembolsado quando possível.');
            isSpinning = false;
            openButton.classList.remove('disabled');
        }
    };

    if (speedToggleButton) { speedToggleButton.addEventListener('click', () => speedToggleButton.classList.toggle('active')); }
    // openButton.onclick é definido por updateOpenButtonState (evita listeners duplicados)
    if (demoButton) { demoButton.addEventListener('click', () => iniciarAbertura(true)); }

    // --- INICIALIZAÇÃO DA PÁGINA ---
    carregarPacoteDaAbertura();
});

function updateOpenButtonState() {
    const userLoggedIn = auth.currentUser !== null;

    // O botão demo sempre está disponível
    if (demoButton) {
        demoButton.disabled = isSpinning;
    }

    // O botão principal de abrir precisa de login
    if (openButton) {
        if (!userLoggedIn) {
            openButton.classList.remove('disabled');
            openButton.onclick = () => showAuthModal();
            const priceTag = `<span class="price-tag">R$ ${pacoteAtual?.preco.toFixed(2).replace('.',',') || '0,00'}</span>`;
            openButtonContent.innerHTML = `Login para Abrir ${priceTag}`;
        } else {
            openButton.onclick = () => iniciarAbertura(false);
            if (isSpinning) {
                openButton.classList.add('disabled');
            } else {
                openButton.classList.remove('disabled');
                const priceTag = `<span class="price-tag">R$ ${pacoteAtual?.preco.toFixed(2).replace('.',',') || '0,00'}</span>`;
                openButtonContent.innerHTML = currentStage === 2 ? "ABRIR ITEM ESPECIAL" : `Abrir ${priceTag}`;
            }
        }
    }
}

// Adicione os listeners para atualizar o estado quando o status de autenticação mudar
document.addEventListener('DOMContentLoaded', () => {
    // ...existing initialization code...

    // Adiciona listener para mudanças no estado de autenticação
    auth.onAuthStateChanged(user => {
        updateOpenButtonState();
    });
});
