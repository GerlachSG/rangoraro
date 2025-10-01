document.addEventListener('DOMContentLoaded', function () {
    // --- ESTADO DA APLICAÇÃO ---
    let allSnacks = [];
    let filteredSnacks = [];
    let selectedSnack = null;
    let isSpinning = false;
    let isDraggingRoulette = false;
    let isDraggingSlider = false;
    let dragTarget = null;

    // --- CONSTANTES ---
    const MIN_PERCENT = 5;
    const MAX_PERCENT = 80;
    const MIN_SWEEP_ANGLE = (MIN_PERCENT / 100) * 360;
    const MAX_SWEEP_ANGLE = (MAX_PERCENT / 100) * 360;
    const ROULETTE_RADIUS = 90;
    const ROULETTE_CENTER = 100;
    const HANDLE_OFFSET_ANGLE = 5;
    let startAngle = 0;
    let sweepAngle = (MIN_PERCENT / 100) * 360;

    // --- ELEMENTOS DOM ---
    const priceInput = document.getElementById('price-input');
    const resultPercent = document.getElementById('result-percent');
    const maxPriceBtn = document.getElementById('max-price');
    const resetBtn = document.getElementById('reset-btn');
    const shortcutButtons = document.querySelectorAll('.shortcut');
    const rouletteContainer = document.querySelector('.roulette-container');
    const rouletteProgress = document.querySelector('.roulette-progress');
    const roulettePercent = document.getElementById('roulette-percent');
    const handleStart = document.querySelector('.handle-start');
    const handleEnd = document.querySelector('.handle-end');
    const rouletteArrow = document.querySelector('.roulette-arrow');
    const selectRangeBtn = document.getElementById('select-range');
    const demoBtn = document.getElementById('demo-btn');
    const previewImage = document.getElementById('preview-image-placeholder');
    const previewText = document.querySelector('.preview-text');
    const previewPrice = document.querySelector('.price');
    const previewMultiplier = document.querySelector('.multiplier');
    const productsContainer = document.querySelector('.products');
    const minPriceFilter = document.getElementById('min-price');
    const maxPriceFilter = document.getElementById('max-price-filter');
    const sortPriceDiv = document.querySelector('.sort-price');
    const searchInput = document.querySelector('.search-bar input');
    const resultSliderHandle = document.getElementById('result-slider-handle');
    const sliderTrack = document.querySelector('.slider-track');

    async function fetchItemsFromFirestore() {
        try {
            const itemsCollection = await db.collection('itens').get();
            if (itemsCollection.empty) {
                productsContainer.innerHTML = '<p>Nenhum item disponível no momento.</p>';
                return;
            }
            allSnacks = itemsCollection.docs.map(doc => {
                const data = doc.data();
                return { id: doc.id, name: data.nome, price: parseFloat(data.valor || 0), image: data.imagemUrl };
            });
            init();
        } catch (error) {
            console.error("Erro ao buscar itens do Firestore: ", error);
            productsContainer.innerHTML = '<p>Ocorreu um erro ao carregar os itens.</p>';
        }
    }

    function init() {
        applyFilters();
        addEventListeners();
        updateRouletteUI();
        updateChanceDisplays();
        updateResultSliderUI();
    }

    function addEventListeners() {
        priceInput.addEventListener('input', handlePriceInputChange);
        maxPriceBtn.addEventListener('click', handleMaxPriceClick);
        resetBtn.addEventListener('click', resetSelection);
        shortcutButtons.forEach(btn => btn.addEventListener('click', handleShortcutClick));
        selectRangeBtn.addEventListener('click', () => spinRoulette(false));
        demoBtn.addEventListener('click', () => spinRoulette(true));
        rouletteContainer.addEventListener('mousedown', startDragRoulette);
        rouletteContainer.addEventListener('touchstart', startDragRoulette, { passive: false });
        sliderTrack.addEventListener('mousedown', startDragSlider);
        resultSliderHandle.addEventListener('mousedown', startDragSlider);
        sliderTrack.addEventListener('touchstart', startDragSlider, { passive: false });
        resultSliderHandle.addEventListener('touchstart', startDragSlider, { passive: false });
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('touchend', endDrag);
        minPriceFilter.addEventListener('input', applyFilters);
        maxPriceFilter.addEventListener('input', applyFilters);
        searchInput.addEventListener('input', applyFilters);
        sortPriceDiv.addEventListener('click', toggleSortOrder);
    }

    function selectSnack(snack) {
        selectedSnack = snack;
        previewImage.style.backgroundImage = `url('${snack.image}')`;
        previewText.textContent = snack.name;
        document.querySelectorAll('.product-card').forEach(card => card.classList.remove('selected'));
        const selectedCard = document.querySelector(`[data-snack-id='${snack.id}']`);
        if (selectedCard) selectedCard.classList.add('selected');
        updatePriceFromChance();
        updateSpinButtonState();
    }

    function applyFilters() {
        const minPrice = parseFloat(minPriceFilter.value) || 0;
        const maxPrice = parseFloat(maxPriceFilter.value) || Infinity;
        const searchTerm = searchInput.value.toLowerCase();
        filteredSnacks = allSnacks.filter(snack =>
            snack.price >= minPrice &&
            snack.price <= maxPrice &&
            snack.name.toLowerCase().includes(searchTerm)
        );
        sortProducts();
        renderProducts();
    }

    let sortOrder = 'desc';
    function toggleSortOrder() {
        sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
        sortPriceDiv.textContent = sortOrder === 'desc' ? 'Preço: Maior para Menor' : 'Preço: Menor para Maior';
        applyFilters();
    }

    function sortProducts() {
        filteredSnacks.sort((a, b) => sortOrder === 'desc' ? b.price - a.price : a.price - b.price);
    }

    function renderProducts() {
        productsContainer.innerHTML = '';
        if (filteredSnacks.length === 0) {
             productsContainer.innerHTML = '<p style="color: #a0a0a0; grid-column: 1 / -1; text-align: center;">Nenhum item encontrado.</p>';
             return;
        }
        filteredSnacks.forEach(snack => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.dataset.snackId = snack.id;
            card.innerHTML = `
                <img src="${snack.image}" alt="${snack.name}">
                <div class="product-name">${snack.name}</div>
                <div class="product-price">R$${snack.price.toFixed(2).replace('.',',')}</div>
            `;
            card.addEventListener('click', () => selectSnack(snack));
            productsContainer.appendChild(card);
        });
    }

    function startDragRoulette(e) { if (isSpinning) return; const target = e.target; if ([handleStart, handleEnd, rouletteProgress].includes(target)) { e.preventDefault(); isDraggingRoulette = true; rouletteContainer.style.cursor = 'grabbing'; if (target === handleStart) dragTarget = 'start'; else if (target === handleEnd) dragTarget = 'end'; else if (target === rouletteProgress) dragTarget = 'progress'; } }
    
    function startDragSlider(e) { if (isSpinning) return; e.preventDefault(); isDraggingSlider = true; sliderTrack.style.cursor = 'grabbing'; updatePercentageFromSlider(e); }
    
    /**
     * ATUALIZADO: Chama updateSpinButtonState() para atualizar o texto do botão ao arrastar.
     */
    function drag(e) { 
        if (!isDraggingRoulette && !isDraggingSlider) return; 
        e.preventDefault(); 
        if (isDraggingRoulette) { 
            const rect = rouletteContainer.getBoundingClientRect(); 
            const centerX = rect.left + rect.width / 2; 
            const centerY = rect.top + rect.height / 2; 
            const clientX = e.touches ? e.touches[0].clientX : e.clientX; 
            const clientY = e.touches ? e.touches[0].clientY : e.clientY; 
            const angle = (Math.atan2(clientY - centerY, clientX - centerX) * 180 / Math.PI + 90 + 360) % 360; 
            if (dragTarget === 'end') { 
                let newSweepAngle = (angle - startAngle + 360) % 360; 
                sweepAngle = Math.max(MIN_SWEEP_ANGLE, Math.min(MAX_SWEEP_ANGLE, newSweepAngle)); 
            } else if (dragTarget === 'start') { 
                const endAngle = (startAngle + sweepAngle) % 360; 
                const originalSweep = sweepAngle; 
                startAngle = angle; 
                sweepAngle = (endAngle - startAngle + 360) % 360; 
                if (sweepAngle > MAX_SWEEP_ANGLE || sweepAngle < MIN_SWEEP_ANGLE) { 
                    sweepAngle = originalSweep; 
                    startAngle = (endAngle - sweepAngle + 360) % 360; 
                } 
            } else if (dragTarget === 'progress') { 
                startAngle = (angle - sweepAngle / 2 + 360) % 360; 
            } 
            updateRouletteUI(); 
        } else if (isDraggingSlider) { 
            updatePercentageFromSlider(e); 
        } 
        updateChanceDisplays(); 
        updatePriceFromChance(); 
        updateSpinButtonState(); // <-- CORRIGIDO
    }
    
    function endDrag() { isDraggingRoulette = false; isDraggingSlider = false; dragTarget = null; rouletteContainer.style.cursor = 'grab'; sliderTrack.style.cursor = 'grab'; }
    
    function getPointOnCircle(angle) { const angleInRadians = (angle - 90) * (Math.PI / 180); return { x: ROULETTE_CENTER + ROULETTE_RADIUS * Math.cos(angleInRadians), y: ROULETTE_CENTER + ROULETTE_RADIUS * Math.sin(angleInRadians) }; }
    
    function updateRouletteUI() { const endAngle = (startAngle + sweepAngle) % 360; const largeArcFlag = sweepAngle > 180 ? 1 : 0; const startPoint = getPointOnCircle(startAngle); const endPoint = getPointOnCircle(endAngle); const d = `M ${startPoint.x} ${startPoint.y} A ${ROULETTE_RADIUS} ${ROULETTE_RADIUS} 0 ${largeArcFlag} 1 ${endPoint.x} ${endPoint.y}`; rouletteProgress.setAttribute('d', d); const startHandleAngle = startAngle + HANDLE_OFFSET_ANGLE; const endHandleAngle = endAngle - HANDLE_OFFSET_ANGLE; handleStart.style.transform = `translate(-50%, -50%) rotate(${startHandleAngle}deg) translateY(-${ROULETTE_RADIUS}px) rotate(-${startHandleAngle}deg)`; handleEnd.style.transform = `translate(-50%, -50%) rotate(${endHandleAngle}deg) translateY(-${ROULETTE_RADIUS}px) rotate(-${endHandleAngle}deg)`; }
    
    function updateResultSliderUI() { const percent = (sweepAngle / 360) * 100; const handlePosition = ((percent - MIN_PERCENT) / (MAX_PERCENT - MIN_PERCENT)) * 100; resultSliderHandle.style.left = `calc(${handlePosition}% - ${resultSliderHandle.offsetWidth / 2}px)`; }
    
    /**
     * ATUALIZADO: Chama updateSpinButtonState() para atualizar o texto do botão ao usar o slider.
     */
    function updatePercentageFromSlider(e) { 
        const rect = sliderTrack.getBoundingClientRect(); 
        const clientX = e.touches ? e.touches[0].clientX : e.clientX; 
        let p = ((clientX - rect.left) / rect.width) * 100; p = Math.max(0, Math.min(100, p)); 
        let c = MIN_PERCENT + (p / 100) * (MAX_PERCENT - MIN_PERCENT); c = Math.max(MIN_PERCENT, Math.min(MAX_PERCENT, c)); 
        sweepAngle = (c / 100) * 360; 
        updateRouletteUI(); 
        updateResultSliderUI(); 
        updatePriceFromChance(); 
        updateSpinButtonState(); // <-- CORRIGIDO
    }
    
    function updateChanceDisplays() { const chancePercent = (sweepAngle / 360) * 100; const formattedPercent = `${chancePercent.toFixed(2).replace('.',',')}%`; resultPercent.textContent = formattedPercent; roulettePercent.textContent = formattedPercent; updateResultSliderUI(); }
    
    function updatePriceFromChance() { if (!selectedSnack) return; const chancePercent = (sweepAngle / 360) * 100; const price = (selectedSnack.price * chancePercent) / 100; priceInput.value = price.toFixed(2); updatePreviewInfo(); }
    
    function updateChanceFromPrice() { if (!selectedSnack) return; const price = parseFloat(priceInput.value) || 0; let chancePercent = (price / selectedSnack.price) * 100; chancePercent = Math.max(MIN_PERCENT, Math.min(MAX_PERCENT, chancePercent)); sweepAngle = (chancePercent / 100) * 360; updateRouletteUI(); updateChanceDisplays(); updatePreviewInfo(); }
    
    /**
     * ATUALIZADO: Corrigido erro de digitação de 'inputInput' para 'inputPrice'.
     */
    function updatePreviewInfo() { 
        if (selectedSnack) { 
            const inputPrice = parseFloat(priceInput.value) || 0;
            const multiplier = selectedSnack.price > 0 ? selectedSnack.price / Math.max(inputPrice, 0.01) : 0; 
            previewPrice.textContent = `R$${inputPrice.toFixed(2).replace('.',',')}`; 
            previewMultiplier.textContent = `x${multiplier.toFixed(2)}`; 
        } else { 
            previewPrice.textContent = 'R$0,00'; 
            previewMultiplier.textContent = 'x0.00'; 
        } 
    }
    
    function handlePriceInputChange() { if (selectedSnack) updateChanceFromPrice(); updateSpinButtonState(); }
    
    function handleMaxPriceClick() { if (selectedSnack) { const maxPriceValue = selectedSnack.price * (MAX_PERCENT / 100); priceInput.value = maxPriceValue.toFixed(2); handlePriceInputChange(); } }
    
    function handleShortcutClick(e) { const percent = parseInt(e.target.dataset.value, 10); sweepAngle = (percent / 100) * 360; sweepAngle = Math.max(MIN_SWEEP_ANGLE, Math.min(MAX_SWEEP_ANGLE, sweepAngle)); updateRouletteUI(); updateChanceDisplays(); updatePriceFromChance(); updateSpinButtonState(); }
    
    function resetSelection() { selectedSnack = null; startAngle = 0; sweepAngle = (MIN_PERCENT / 100) * 360; priceInput.value = '0.00'; previewImage.style.backgroundImage = ''; previewText.textContent = 'Selecione um Rango abaixo para começar'; document.querySelectorAll('.product-card').forEach(card => card.classList.remove('selected')); updateRouletteUI(); updateChanceDisplays(); updatePreviewInfo(); updateSpinButtonState(); }
    
    function updateSpinButtonState() { const price = parseFloat(priceInput.value) || 0; const enabled = selectedSnack && price > 0 && !isSpinning; selectRangeBtn.disabled = !enabled; demoBtn.disabled = isSpinning; if (enabled) { selectRangeBtn.textContent = `Girar por R$${price.toFixed(2).replace('.',',')}`; } else if (!selectedSnack) { selectRangeBtn.textContent = 'Selecione um item'; } else { selectRangeBtn.textContent = 'Girar'; } }
    
    async function spinRoulette(isDemo) {
        if (isSpinning || (!selectedSnack && !isDemo)) return;
        
        isSpinning = true;
        updateSpinButtonState();

        const spinCost = parseFloat(priceInput.value) || 0;
        if (!isDemo) {
            const user = auth.currentUser;
            if (!user) {
                if(typeof showAuthModal === 'function') showAuthModal();
                isSpinning = false;
                updateSpinButtonState();
                return;
            }

            try {
                const userRef = db.collection('users').doc(user.uid);
                await db.runTransaction(async (transaction) => {
                    const userDoc = await transaction.get(userRef);
                    if (!userDoc.exists) throw new Error("Usuário não encontrado.");
                    const userBalance = userDoc.data().balance || 0;
                    if (userBalance < spinCost) throw new Error('INSUFFICIENT_BALANCE');
                    transaction.update(userRef, { balance: firebase.firestore.FieldValue.increment(-spinCost) });
                });
            } catch (error) {
                if (error && error.message === 'INSUFFICIENT_BALANCE') {
                    if (typeof openDepositModal === 'function') {
                        openDepositModal();
                    } else {
                         alert("Saldo insuficiente para realizar este giro.");
                    }
                } else {
                    console.error("Erro ao debitar saldo:", error);
                    alert("Ocorreu um erro ao processar seu saldo.");
                }
                isSpinning = false; // <-- CORRIGIDO
                updateSpinButtonState(); // <-- CORRIGIDO
                return; 
            }
        }
        
        rouletteArrow.classList.add('show');
        const spins = 5 + Math.random() * 3;
        const finalAngle = Math.random() * 360;
        const totalRotation = (spins * 360) + finalAngle;
        rouletteArrow.style.transition = 'none';
        rouletteArrow.style.transform = 'rotate(0deg)';
        rouletteArrow.offsetHeight;
        rouletteArrow.style.transition = 'transform 4s cubic-bezier(0.25, 1, 0.5, 1)';
        rouletteArrow.style.transform = `rotate(${totalRotation}deg)`;
        setTimeout(() => {
            const computedStyle = window.getComputedStyle(rouletteArrow);
            const matrix = computedStyle.transform;
            let actualAngle = finalAngle;
            if (matrix !== 'none') {
                const values = matrix.split('(')[1].split(')')[0].split(',');
                actualAngle = (Math.atan2(values[1], values[0]) * (180 / Math.PI) + 360) % 360;
            }
            handleSpinResult(actualAngle, isDemo);
        }, 4100);
    }

    function fireConfetti() { const canvas = document.createElement('canvas'); canvas.style.position = 'fixed'; canvas.style.top = '0'; canvas.style.left = '0'; canvas.style.width = '100vw'; canvas.style.height = '100vh'; canvas.style.pointerEvents = 'none'; canvas.style.zIndex = '9999'; document.body.appendChild(canvas); const myConfetti = confetti.create(canvas, { resize: true, useWorker: true }); myConfetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } }).then(() => { if (canvas.parentNode) canvas.parentNode.removeChild(canvas); }); }
    
    function handleSpinResult(landedAngle, isDemo) {
        const endAngle = (startAngle + sweepAngle) % 360;
        let won = false;
        if (startAngle + sweepAngle > 360) {
            won = (landedAngle >= startAngle) || (landedAngle <= endAngle);
        } else {
            won = (landedAngle >= startAngle) && (landedAngle <= endAngle);
        }
        if (won && !isDemo) {
            fireConfetti();
            const user = auth.currentUser;
            if (selectedSnack && user) {
                const inputPrice = parseFloat(priceInput.value) || 0;
                const multiplier = selectedSnack.price > 0 ? (selectedSnack.price / Math.max(inputPrice, 0.01)).toFixed(2) : 0;
                const itemWon = { ...selectedSnack, paidPrice: inputPrice, multiplier: multiplier };
                if (typeof saveItemToInventory === 'function') saveItemToInventory(user.uid, itemWon);
                if (typeof registrarGanhoTroca === 'function') registrarGanhoTroca(itemWon);
            }
        }
        setTimeout(() => {
            isSpinning = false;
            rouletteArrow.classList.remove('show');
            rouletteArrow.style.transition = 'none';
            updateSpinButtonState();
        }, 1000);
    }

    fetchItemsFromFirestore();
});
