document.addEventListener('DOMContentLoaded', async () => {
    const gradePacotes = document.querySelector('.grade-pacotes');
    const ALLOWED_PACKAGES = ['palhacada', 'orei', 'labaguet', 'almossar', 'ocoronel'];

    async function carregarPacotesDoFirebase() {
        try {
            const snapshot = await db.collection('pacotes').get();
            gradePacotes.innerHTML = '';

            const pacotesOrdenados = [];
            snapshot.forEach(doc => {
                // Só inclui os pacotes que estão na lista permitida
                if (ALLOWED_PACKAGES.includes(doc.id)) {
                    const pacoteData = doc.data();
                    pacotesOrdenados.push({
                        id: doc.id,
                        ...pacoteData
                    });
                }
            });

            // Ordena os pacotes na mesma ordem da lista ALLOWED_PACKAGES
            pacotesOrdenados.sort((a, b) => 
                ALLOWED_PACKAGES.indexOf(a.id) - ALLOWED_PACKAGES.indexOf(b.id)
            );

            pacotesOrdenados.forEach(pacote => {
                const pacoteElement = document.createElement('a');
                pacoteElement.href = `abertura.html?pacote=${pacote.id}`;
                pacoteElement.className = 'pacote-wrapper';
                
                pacoteElement.innerHTML = `
                    <div class="pack" 
                         style="background-image: url('${pacote.imagemUrl}')"
                         data-tilt 
                         data-tilt-glare 
                         data-tilt-max-glare="0.6">
                    </div>
                    <div class="price">R$ ${pacote.preco.toFixed(2).replace('.',',')}</div>
                `;
                
                gradePacotes.appendChild(pacoteElement);
            });

            // Inicializa o efeito tilt nos novos elementos
            VanillaTilt.init(document.querySelectorAll(".pack"), {
                max: 15,
                speed: 1000,
                glare: true,
                "max-glare": 0.1,
                transition: true,
                easing: "cubic-bezier(.03,.98,.52,.99)"
            });

        } catch (error) {
            console.error("Erro ao carregar pacotes:", error);
            gradePacotes.innerHTML = '<p>Erro ao carregar os pacotes.</p>';
        }
    }

    carregarPacotesDoFirebase();
});
