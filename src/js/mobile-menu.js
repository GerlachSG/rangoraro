// ========================================= //
// MENU MOBILE
// ========================================= //
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const mobileSidebar = document.querySelector('.mobile-sidebar');
    const sidebarOverlay = document.querySelector('.mobile-sidebar-overlay');
    const mobileWrapper = document.querySelector('.mobile-actions-wrapper');
    const headerRight = document.querySelector('.header-right');
    
    console.log('Mobile Menu Script Loaded', {
        menuToggle: !!menuToggle,
        mobileSidebar: !!mobileSidebar,
        sidebarOverlay: !!sidebarOverlay,
        mobileWrapper: !!mobileWrapper,
        headerRight: !!headerRight,
        width: window.innerWidth
    });
    
    // Função para forçar visibilidade do header-right no mobile
    function forceHeaderRightVisibility() {
        if (window.innerWidth <= 768 && headerRight) {
            headerRight.style.display = 'flex';
            headerRight.style.visibility = 'visible';
            headerRight.style.opacity = '1';
            
            // Também força visibilidade dos elementos internos
            const cart = headerRight.querySelector('.cart');
            const balance = headerRight.querySelector('.balance');
            const profilePic = headerRight.querySelector('.profile-pic');
            
            if (cart) {
                cart.style.display = 'flex';
                cart.style.visibility = 'visible';
                cart.style.opacity = '1';
            }
            if (balance) {
                balance.style.display = 'flex';
                balance.style.visibility = 'visible';
                balance.style.opacity = '1';
            }
            
            console.log('Header-right forçado a aparecer', {
                cart: !!cart,
                balance: !!balance,
                profilePic: !!profilePic
            });
        }
    }
    
    // Move header-right para dentro do wrapper no mobile
    if (window.innerWidth <= 768 && mobileWrapper && headerRight) {
        mobileWrapper.insertBefore(headerRight, mobileWrapper.firstChild);
        forceHeaderRightVisibility();
    }
    
    // Força visibilidade após 100ms para garantir que sobrescreve qualquer JS
    setTimeout(forceHeaderRightVisibility, 100);
    setTimeout(forceHeaderRightVisibility, 500);
    setTimeout(forceHeaderRightVisibility, 1000);
    
    // FORÇA CONTÍNUA - roda a cada 500ms para garantir que os elementos continuem visíveis NO MOBILE
    setInterval(() => {
        if (window.innerWidth <= 768) {
            // Mobile: força visibilidade
            if (headerRight) {
                headerRight.style.display = 'flex';
                headerRight.style.visibility = 'visible';
                headerRight.style.opacity = '1';
            }
            
            const mobileWrapper = document.querySelector('.mobile-actions-wrapper');
            const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
            
            if (mobileWrapper) {
                mobileWrapper.style.display = 'flex';
                mobileWrapper.style.visibility = 'visible';
                mobileWrapper.style.opacity = '1';
            }
            
            if (mobileMenuToggle) {
                mobileMenuToggle.style.display = 'flex';
                mobileMenuToggle.style.visibility = 'visible';
                mobileMenuToggle.style.opacity = '1';
                
                // Também força as barrinhas
                const spans = mobileMenuToggle.querySelectorAll('span');
                spans.forEach(span => {
                    span.style.display = 'block';
                    span.style.visibility = 'visible';
                    span.style.opacity = '1';
                });
            }
        } else {
            // Desktop: esconde elementos mobile
            const mobileWrapper = document.querySelector('.mobile-actions-wrapper');
            const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
            const mobileAuthButtons = document.querySelector('.mobile-auth-buttons');
            
            if (mobileWrapper) mobileWrapper.style.display = 'none';
            if (mobileMenuToggle) mobileMenuToggle.style.display = 'none';
            if (mobileAuthButtons) mobileAuthButtons.style.display = 'none';
        }
    }, 500);
    
    // Função para ajustar layout baseado no tamanho da tela
    function adjustLayout() {
        const navCenter = document.querySelector('.nav-center');
        const headerButtons = document.querySelector('.header-buttons');
        const mobileAuthButtons = document.querySelector('.mobile-auth-buttons');
        const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
        const header = document.querySelector('.header');
        
        if (window.innerWidth <= 768) {
            // Mobile: move header-right para dentro do wrapper
            if (mobileWrapper && headerRight && !mobileWrapper.contains(headerRight)) {
                mobileWrapper.insertBefore(headerRight, mobileWrapper.firstChild);
            }
            
            // Não altera visibilidade dos botões aqui - deixa o onAuthStateChanged cuidar disso
        } else {
            // Desktop: move header-right de volta para posição original
            if (header && headerRight && mobileWrapper && mobileWrapper.contains(headerRight)) {
                header.insertBefore(headerRight, mobileWrapper);
            }
            
            // Remove todos os estilos inline que podem ter sido aplicados
            if (navCenter) navCenter.removeAttribute('style');
            if (headerButtons) headerButtons.removeAttribute('style');
            if (headerRight) headerRight.removeAttribute('style');
            if (mobileWrapper) mobileWrapper.removeAttribute('style');
            if (mobileAuthButtons) mobileAuthButtons.removeAttribute('style');
            if (mobileMenuToggle) mobileMenuToggle.removeAttribute('style');
        }
    }
    
    // Ajusta layout inicial
    adjustLayout();
    
    // Reposiciona ao redimensionar
    window.addEventListener('resize', adjustLayout);
    
    if (menuToggle && mobileSidebar && sidebarOverlay) {
        menuToggle.addEventListener('click', () => {
            const isActive = mobileSidebar.classList.contains('active');
            
            if (!isActive) {
                // Fecha apenas os outros menus (não o mobile menu)
                // Fecha todos os profile menus
                document.querySelectorAll('.profile-menu').forEach(menu => {
                    menu.classList.remove('is-active');
                });
                
                // Fecha o widget de suporte se estiver aberto
                const supportWidget = document.getElementById('rango-chat-widget-container');
                if (supportWidget && supportWidget.classList.contains('open')) {
                    supportWidget.classList.remove('open');
                }
                
                // Fecha o modal de carrinho se estiver aberto
                const cartModal = document.querySelector('.cart-modal-overlay');
                if (cartModal && cartModal.style.display === 'flex') {
                    cartModal.style.display = 'none';
                    document.body.classList.remove('modal-open');
                }
                
                // Fecha o modal de depósito se estiver aberto
                const depositModal = document.getElementById('deposit-modal-overlay');
                if (depositModal && depositModal.style.display === 'flex') {
                    depositModal.style.display = 'none';
                }
                
                // Abre o menu mobile
                mobileSidebar.classList.add('active');
                sidebarOverlay.classList.add('active');
                menuToggle.classList.add('active');
                document.body.style.overflow = 'hidden';
            } else {
                // Fecha o menu
                mobileSidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
                menuToggle.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
        
        sidebarOverlay.addEventListener('click', () => {
            mobileSidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
            menuToggle.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
    
    // Atualiza info do mobile sidebar quando usuário loga
    if (typeof auth !== 'undefined') {
        auth.onAuthStateChanged((user) => {
            console.log('Auth state changed:', {
                user: !!user,
                width: window.innerWidth,
                headerRight: !!headerRight
            });
            
            // FORÇA visibilidade do header-right toda vez que auth state muda
            forceHeaderRightVisibility();
            
            const mobileProfilePic = document.querySelector('.mobile-profile-pic');
            const mobileUserName = document.querySelector('.mobile-user-name');
            const mobileAddressBtn = document.getElementById('mobile-address-btn');
            const mobileOrdersBtn = document.getElementById('mobile-orders-btn');
            const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
            const mobileAuthButtons = document.querySelector('.mobile-auth-buttons');
            const mobileSidebarHeader = document.querySelector('.mobile-sidebar-header');
            
            if (user && mobileProfilePic && mobileUserName) {
                // Usuário logado
                mobileProfilePic.style.backgroundImage = `url(${user.photoURL})`;
                mobileUserName.textContent = user.displayName || 'Usuário';
                
                // Mostra header do menu e botões de ação
                if (mobileSidebarHeader) mobileSidebarHeader.style.display = 'flex';
                if (mobileAddressBtn) {
                    mobileAddressBtn.style.display = 'block';
                    // Garante que o event listener está ativo
                    mobileAddressBtn.onclick = async () => {
                        console.log('Botão Alterar Endereço clicado');
                        
                        // Fecha o menu mobile primeiro
                        mobileSidebar.classList.remove('active');
                        sidebarOverlay.classList.remove('active');
                        menuToggle.classList.remove('active');
                        document.body.style.overflow = '';
                        
                        // Garante que os modais existem
                        if (typeof ensureDeliveryModals === 'function') {
                            ensureDeliveryModals();
                        }
                        
                        // Busca endereços do usuário
                        if (typeof db !== 'undefined' && user) {
                            const userRef = db.collection('users').doc(user.uid);
                            const addressCol = userRef.collection('address');
                            
                            try {
                                const snapshot = await addressCol.get();
                                
                                if (snapshot.empty) {
                                    // Nenhum endereço: cria o primeiro
                                    console.log('Nenhum endereço cadastrado, abrindo formulário');
                                    const firstAddressRef = addressCol.doc('endereco-1');
                                    
                                    // Usa a mesma função do carrinho
                                    if (typeof openAddressModal === 'function') {
                                        openAddressModal(user, [], firstAddressRef);
                                    }
                                } else {
                                    // Tem endereços: monta a lista e abre seleção
                                    console.log('Endereços encontrados:', snapshot.size);
                                    const addresses = [];
                                    snapshot.forEach(doc => {
                                        addresses.push({ id: doc.id, ...doc.data() });
                                    });
                                    // Ordena os endereços
                                    addresses.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
                                    
                                    // Usa a mesma função do carrinho
                                    if (typeof openAddressSelectionModal === 'function') {
                                        openAddressSelectionModal(user, [], addresses);
                                    }
                                }
                            } catch (error) {
                                console.error('Erro ao verificar endereços:', error);
                                alert('Erro ao carregar endereços. Tente novamente.');
                            }
                        }
                    };
                }
                if (mobileOrdersBtn) {
                    mobileOrdersBtn.style.display = 'block';
                    // Garante que o event listener está ativo
                    mobileOrdersBtn.onclick = () => {
                        mobileSidebar.classList.remove('active');
                        sidebarOverlay.classList.remove('active');
                        menuToggle.classList.remove('active');
                        document.body.style.overflow = '';
                        
                        if (typeof openMyOrdersModal === 'function') {
                            openMyOrdersModal(user);
                        } else {
                            const ordersModalOverlay = document.getElementById('my-orders-modal-overlay');
                            if (ordersModalOverlay) {
                                ordersModalOverlay.style.display = 'flex';
                            }
                        }
                    };
                }
                if (mobileLogoutBtn) {
                    mobileLogoutBtn.style.display = 'block';
                    // Garante que o event listener está ativo
                    mobileLogoutBtn.onclick = () => {
                        auth.signOut().then(() => {
                            mobileSidebar.classList.remove('active');
                            sidebarOverlay.classList.remove('active');
                            menuToggle.classList.remove('active');
                            document.body.style.overflow = '';
                            window.location.reload();
                        });
                    };
                }
                
                // Esconde botões de login/registro no header
                if (mobileAuthButtons) mobileAuthButtons.style.display = 'none';
                
                // Garante que header-right (carrinho/depositar/avatar) apareça no mobile quando logado
                if (window.innerWidth <= 768 && headerRight) {
                    headerRight.style.display = 'flex';
                    headerRight.style.visibility = 'visible';
                    headerRight.style.opacity = '1';
                    console.log('Header-right visível (usuário logado)');
                }
                
            } else {
                // Usuário deslogado
                
                // Esconde header do menu (foto, nome, botões de ação)
                if (mobileSidebarHeader) mobileSidebarHeader.style.display = 'none';
                if (mobileAddressBtn) mobileAddressBtn.style.display = 'none';
                if (mobileOrdersBtn) mobileOrdersBtn.style.display = 'none';
                if (mobileLogoutBtn) mobileLogoutBtn.style.display = 'none';
                
                // Mostra botões de login/registro no header
                if (mobileAuthButtons) mobileAuthButtons.style.display = 'flex';
                
                // Garante que header-right (carrinho/depositar) apareça no mobile mesmo deslogado
                if (window.innerWidth <= 768 && headerRight) {
                    headerRight.style.display = 'flex';
                    headerRight.style.visibility = 'visible';
                    headerRight.style.opacity = '1';
                    console.log('Header-right visível (usuário deslogado)');
                }
            }
        });
    }
    
    // Event listeners para botões de login/registrar FORA do menu
    const mobileLoginBtnOutside = document.querySelector('.mobile-auth-buttons .mobile-login-btn');
    const mobileRegisterBtnOutside = document.querySelector('.mobile-auth-buttons .mobile-register-btn');
    
    if (mobileLoginBtnOutside) {
        mobileLoginBtnOutside.addEventListener('click', () => {
            if (typeof showAuthModal === 'function') {
                showAuthModal(true);
            }
        });
    }
    
    if (mobileRegisterBtnOutside) {
        mobileRegisterBtnOutside.addEventListener('click', () => {
            if (typeof showAuthModal === 'function') {
                showAuthModal(false);
            }
        });
    }
});
