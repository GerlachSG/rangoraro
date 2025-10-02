// --- ELEMENTOS DO DOM ---
const gradePacotes = document.getElementById('grade-pacotes');
const pesquisaInput = document.getElementById('pesquisaInput');
const ordenarSelect = document.getElementById('ordenarSelect');

// --- VARIÁVEL GLOBAL PARA ARMAZENAR OS PACOTES ---
// A lista agora começa vazia e será preenchida pelo Firebase.
let todosOsPacotes = [];

/**
 * NOVA FUNÇÃO: Busca todos os pacotes da coleção 'pacotes' no Firestore.
 */
async function carregarPacotesDoFirebase() {
    // Mostra uma mensagem de carregamento para o usuário
    gradePacotes.innerHTML = '<p class="carregando-resultado">Carregando pacotes...</p>';

    try {
        const snapshot = await db.collection('pacotes').get();
        
        // Limpa a lista antes de preencher
        todosOsPacotes = []; 

        snapshot.forEach(doc => {
            // Para cada documento, pegamos os dados e o ID
            const pacoteData = doc.data();
            todosOsPacotes.push({
                id: doc.id,
                nome: pacoteData.nome,
                preco: pacoteData.preco,
                imagemUrl: pacoteData.imagemUrl
            });
        });

        // Após carregar tudo, chama a função para exibir os pacotes na tela
        atualizarPacotes();

    } catch (error) {
        console.error("Erro ao buscar pacotes do Firestore: ", error);
        gradePacotes.innerHTML = '<p class="nenhum-resultado">Ocorreu um erro ao carregar os pacotes.</p>';
    }
}


a
/**
 * Função para renderizar (desenhar) os pacotes na tela.
 * (Esta função não precisa de mudanças)
 */
function renderizarPacotes(pacotesParaRenderizar) {
    gradePacotes.innerHTML = ''; // Limpa a grade

    if (pacotesParaRenderizar.length === 0) {
        gradePacotes.innerHTML = '<p class="nenhum-resultado">Nenhum pacote encontrado.</p>';
        return;
    }

    pacotesParaRenderizar.forEach(pacote => {
        const pacoteElemento = document.createElement('div');
        pacoteElemento.className = 'pacote-wrapper';

        const precoFormatado = `R$ ${parseFloat(pacote.preco || 0).toFixed(2).replace('.', ',')}`;

        pacoteElemento.innerHTML = `
            <a href="abertura.html?pacote=${pacote.id}" class="pacote-link">
                <div class="pack" style="background-image: url('${pacote.imagemUrl}')" data-tilt data-tilt-glare data-tilt-max-glare="0.6"></div>
                <div class="price">${precoFormatado}</div>
            </a>
        `;
        gradePacotes.appendChild(pacoteElemento);
    });

    VanillaTilt.init(document.querySelectorAll(".pack"), {
        max: 15,
        speed: 1000,
        glare: true,
        "max-glare": 0.1,
    });
}


/**
 * Função para filtrar e ordenar os pacotes.
 * (Pequeno ajuste para usar a lista do Firebase)
 */
function atualizarPacotes() {
    // Agora a filtragem parte da lista 'todosOsPacotes', que veio do Firebase
    let pacotesFiltrados = [...todosOsPacotes];
    const termoPesquisa = pesquisaInput.value.toLowerCase();

    // 1. Filtrar por pesquisa
    if (termoPesquisa) {
        pacotesFiltrados = pacotesFiltrados.filter(pacote => 
            pacote.nome.toLowerCase().includes(termoPesquisa)
        );
    }

    // 2. Ordenar
    const tipoOrdenacao = ordenarSelect.value;
    if (tipoOrdenacao === 'menor-preco') {
        pacotesFiltrados.sort((a, b) => a.preco - b.preco);
    } else if (tipoOrdenacao === 'maior-preco') {
        pacotesFiltrados.sort((a, b) => b.preco - a.preco);
    }

    renderizarPacotes(pacotesFiltrados);
}

// Adiciona os 'escutadores' de eventos para a pesquisa e o dropdown
pesquisaInput.addEventListener('input', atualizarPacotes);
ordenarSelect.addEventListener('change', atualizarPacotes);

// Renderização inicial agora chama a função que busca os dados no Firebase
document.addEventListener('DOMContentLoaded', () => {
    carregarPacotesDoFirebase();
});