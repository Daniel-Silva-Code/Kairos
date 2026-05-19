const { Client, Databases } = Appwrite;

const client = new Client()
    .setEndpoint('https://syd.cloud.appwrite.io/v1')
    .setProject('69e0dbe500145c5ba8c3');

const databases = new Databases(client);
const DB_ID = "69e0def3001636121611";
const COL_FROTA = "lifrota";

async function vincularLifrota() {
    try {
        const response = await databases.listDocuments(DB_ID, COL_FROTA);
        const cardsExistentes = document.querySelectorAll('.vtr-card');
        if (cardsExistentes.length === 0) return;
        const modeloHTML = cardsExistentes[0].outerHTML;
        const marcador = document.createElement('div');
        cardsExistentes[0].parentNode.insertBefore(marcador, cardsExistentes[0]);
        cardsExistentes.forEach(card => card.remove());
        let htmlFinal = "";
        response.documents.forEach(doc => {
            htmlFinal += modeloHTML
                .replace(/{status}/g, doc.status || "")
                .replace(/{fabricante}/g, doc.fabricante || "")
                .replace(/{placa}/g, doc.placa || "")
                .replace(/{ncombust}/g, doc.ncombust || "")
                .replace(/{diariobordo}/g, doc.diariobordo || "")
                .replace(/{cartaoabast}/g, doc.cartaoabast || "");
        });
        marcador.insertAdjacentHTML('afterend', htmlFinal);
        marcador.remove();
    } catch (error) {
        console.error("Erro ao vincular lifrota:", error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    vincularLifrota();
});

//--------------------------------------------------------
const COL_PENDENCIA_KPI = "lipendenciaskpi";

// Função auxiliar para formatar a data: hh:mm - dd/mm/yyyy
function formatarDataHora(stringData) {
    if (!stringData) return "";
    const data = new Date(stringData);
    
    const horas = String(data.getHours()).padStart(2, '0');
    const minutos = String(data.getMinutes()).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0'); // Meses começam em 0
    const ano = data.getFullYear();

    return `${horas}:${minutos} - ${dia}/${mes}/${ano}`;
}

async function vincularStatusPendencias() {
    try {
        const response = await databases.listDocuments(DB_ID, COL_PENDENCIA_KPI);
        const containerLista = document.querySelector('.list');
        if (!containerLista) return;

        const itemModelo = containerLista.querySelector('div'); 
        if (!itemModelo) return;

        const htmlModelo = itemModelo.outerHTML;
        containerLista.innerHTML = "";

        response.documents.forEach(doc => {
            let novoItem = htmlModelo
                .replace(/{status}/g, doc.status || "")
                .replace(/{tipo}/g, doc.tipo || "")
                .replace(/{sistema}/g, doc.sistema || "")
                .replace(/{ordem}/g, doc.ordem || "")
                .replace(/{relato}/g, doc.relato || "")
                .replace(/{acao}/g, doc.acao || "")
                .replace(/{responsavel}/g, doc.responsavel || "")
                .replace(/{sigla}/g, doc.sigla || "")
                // Aplicando a formatação nas datas aqui:
                .replace(/{modificacao}/g, formatarDataHora(doc.modificado))
                .replace(/{data-criacao}/g, formatarDataHora(doc.criado))
                .replace(/{descritivo}/g, doc.descricao || ""); 
            
            containerLista.insertAdjacentHTML('beforeend', novoItem);
        });

    } catch (error) {
        console.error("Erro ao vincular dados da lista de pendências:", error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    vincularStatusPendencias();
});
function formatarDataHora(stringData) {
    if (!stringData) return "";
    const data = new Date(stringData);
    
    // Usamos os métodos getUTC para ignorar o fuso horário local do navegador
    const horas = String(data.getUTCHours()).padStart(2, '0');
    const minutos = String(data.getUTCMinutes()).padStart(2, '0');
    const dia = String(data.getUTCDate()).padStart(2, '0');
    const mes = String(data.getUTCMonth() + 1).padStart(2, '0'); 
    const ano = data.getUTCFullYear();

    return `${horas}:${minutos} - ${dia}/${mes}/${ano}`;
}

//-----------------------------------------------------
const COL_EQUIPAMENTOS = "liequipamentos";

async function vincularEquipamentos() {
    try {
        const response = await databases.listDocuments(DB_ID, COL_EQUIPAMENTOS);
        
        // 1. Localizamos o card de equipamento (modelo)
        const cardModelo = document.querySelector('.equip-card');
        if (!cardModelo) return;

        const containerPai = cardModelo.parentElement;
        const htmlModelo = cardModelo.outerHTML;

        // 2. Marcador para manter a posição original no HTML
        const marcador = document.createElement('div');
        containerPai.insertBefore(marcador, cardModelo);

        // 3. Removemos todos os cards estáticos atuais (.equip-card e .equip-card.red)
        containerPai.querySelectorAll('.equip-card').forEach(card => card.remove());

        let htmlFinal = "";

        // 4. Geramos os novos cards
        response.documents.forEach(doc => {
            // Substituímos os valores entre {}
            let novoHtml = htmlModelo
                .replace(/{sigla}/g, doc.sigla || "")
                .replace(/{equipamento}/g, doc.detalhe || "") 
                .replace(/{Sistema}/g, doc.sistema || "")     
                .replace(/{Status}/g, doc.statusFuncionamento || "");

            // Criamos um elemento temporário para manipular as classes
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = novoHtml;
            const novoCard = tempDiv.firstElementChild;

            // 5. Lógica de cores: Adiciona ou remove a classe 'red' conforme o status
            if (doc.statusFuncionamento === "Inoperante") {
                novoCard.classList.add('red');
            } else {
                novoCard.classList.remove('red');
            }

            htmlFinal += novoCard.outerHTML;
        });

        // 6. Inserimos os cards processados no local correto
        marcador.insertAdjacentHTML('afterend', htmlFinal);
        marcador.remove();

    } catch (error) {
        console.error("Erro ao vincular equipamentos:", error);
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    vincularEquipamentos();
    // Chame aqui suas outras funções: vincularStatusPendencias(); etc.
});

//--------------------------------------------------
const COL_EPC = "liepc";

async function vincularMetricEPC() {
    try {
        const response = await databases.listDocuments(DB_ID, COL_EPC);
        const total = response.total;
        
        let contagemNormal = 0;
        let contagemAtencao = 0;
        let contagemFaltando = 0;

        response.documents.forEach(doc => {
            const statusVindoDoBanco = doc.status;
            if (statusVindoDoBanco === "Normal") {
                contagemNormal++;
            } else if (statusVindoDoBanco === "Atenção") {
                contagemAtencao++;
            } else if (statusVindoDoBanco === "Faltando") {
                contagemFaltando++;
            }
        });

        const indisponiveis = contagemAtencao + contagemFaltando;
        const disponiveis = total - indisponiveis;
        const porcentagem = total > 0 ? (disponiveis / total) * 100 : 0;
        const valorDisponibilidade = `${porcentagem.toFixed(1)}%`;

        const metricas = document.querySelectorAll('.metric-item');

        metricas.forEach(item => {
            const spanNome = item.querySelector('span');
            if (!spanNome) return;

            const nomeRegiao = spanNome.innerText.trim();

            if (nomeRegiao === "EPC") {
                // 1. Atualizamos todos os textos primeiro
                let htmlInner = item.innerHTML;
                htmlInner = htmlInner.replace(/{normal}/g, contagemNormal);
                htmlInner = htmlInner.replace(/{atencao}/g, contagemAtencao);
                htmlInner = htmlInner.replace(/{faltando}/g, contagemFaltando);
                htmlInner = htmlInner.replace(/{disponibilidade}/g, valorDisponibilidade);
                
                // Aplicamos o novo HTML
                item.innerHTML = htmlInner;

                // 2. AGORA ajustamos a barra de progresso
                // Como o HTML foi reiniciado acima, buscamos o elemento da barra novamente
                const barraProgresso = item.querySelector('.metric-bar-fill');
                if (barraProgresso) {
                    // Define a largura da barra conforme a porcentagem calculada
                    barraProgresso.style.width = valorDisponibilidade;
                }
            }
        });

    } catch (error) {
        console.error("Erro ao processar métricas EPC e Disponibilidade:", error);
    }
}

//---------------------------------------------
const COL_INSTRUMENTOS = "liinstrumentos";

async function vincularMetricInstrumentos() {
    try {
        // 1. Buscamos todos os documentos da coleção liinstrumentos
        const response = await databases.listDocuments(DB_ID, COL_INSTRUMENTOS);
        const total = response.total;
        
        // 2. Variáveis de contagem
        let contagemNormal = 0;
        let contagemAtencao = 0;
        let contagemFaltando = 0;

        // 3. Processamos os dados para contagem
        response.documents.forEach(doc => {
            const statusVindoDoBanco = doc.status;
            
            if (statusVindoDoBanco === "Normal") {
                contagemNormal++;
            } else if (statusVindoDoBanco === "Atenção") {
                contagemAtencao++;
            } else if (statusVindoDoBanco === "Faltando") {
                contagemFaltando++;
            }
        });

        // 4. Cálculo da Disponibilidade
        const indisponiveis = contagemAtencao + contagemFaltando;
        const disponiveis = total - indisponiveis;
        const porcentagem = total > 0 ? (disponiveis / total) * 100 : 0;
        const valorDisponibilidade = `${porcentagem.toFixed(1)}%`;

        // 5. Localizamos o bloco específico de "Instrumentos"
        const metricas = document.querySelectorAll('.metric-item');

        metricas.forEach(item => {
            const spanNome = item.querySelector('span');
            if (!spanNome) return;

            const nomeRegiao = spanNome.innerText.trim();

            if (nomeRegiao === "Instrumentos") {
                // Primeiro atualizamos o HTML interno com os novos valores
                let htmlInner = item.innerHTML;
                htmlInner = htmlInner.replace(/{normal}/g, contagemNormal);
                htmlInner = htmlInner.replace(/{atencao}/g, contagemAtencao);
                htmlInner = htmlInner.replace(/{faltando}/g, contagemFaltando);
                htmlInner = htmlInner.replace(/{disponibilidade}/g, valorDisponibilidade);
                
                item.innerHTML = htmlInner;

                // AGORA atualizamos a barra de progresso dentro deste bloco
                const barraProgresso = item.querySelector('.metric-bar-fill');
                if (barraProgresso) {
                    barraProgresso.style.width = valorDisponibilidade;
                }
            }
        });

    } catch (error) {
        console.error("Erro ao processar métricas Instrumentos:", error);
    }
}

// Registro no carregamento
document.addEventListener('DOMContentLoaded', () => {
    vincularMetricEPC();
    vincularMetricInstrumentos();
});
//------------------------------------------------
const COL_FERRAMENTAS = "liferramentas";

async function vincularMetricFerramentas() {
    try {
        // 1. Buscamos todos os documentos da coleção liferramentas
        const response = await databases.listDocuments(DB_ID, COL_FERRAMENTAS);
        const total = response.total;
        
        // 2. Variáveis de contagem
        let contagemNormal = 0;
        let contagemAtencao = 0;
        let contagemFaltando = 0;

        // 3. Processamos os dados para contagem
        response.documents.forEach(doc => {
            const statusVindoDoBanco = doc.status;
            
            if (statusVindoDoBanco === "Normal") {
                contagemNormal++;
            } else if (statusVindoDoBanco === "Atenção") {
                contagemAtencao++;
            } else if (statusVindoDoBanco === "Faltando") {
                contagemFaltando++;
            }
        });

        // 4. Cálculo da Disponibilidade
        const indisponiveis = contagemAtencao + contagemFaltando;
        const disponiveis = total - indisponiveis;
        const porcentagem = total > 0 ? (disponiveis / total) * 100 : 0;
        const valorDisponibilidade = `${porcentagem.toFixed(1)}%`;

        // 5. Localizamos o bloco específico de "Ferramentas"
        const metricas = document.querySelectorAll('.metric-item');

        metricas.forEach(item => {
            const spanNome = item.querySelector('span');
            if (!spanNome) return;

            const nomeRegiao = spanNome.innerText.trim();

            // Verificamos se o span é exatamente "Ferramentas"
            if (nomeRegiao === "Ferramentas") {
                // Atualizamos o conteúdo de texto
                let htmlInner = item.innerHTML;
                htmlInner = htmlInner.replace(/{normal}/g, contagemNormal);
                htmlInner = htmlInner.replace(/{atencao}/g, contagemAtencao);
                htmlInner = htmlInner.replace(/{faltando}/g, contagemFaltando);
                htmlInner = htmlInner.replace(/{disponibilidade}/g, valorDisponibilidade);
                
                item.innerHTML = htmlInner;

                // ATUALIZAÇÃO DA BARRA DE PROGRESSO
                // Buscamos o elemento da barra após o innerHTML ser resetado
                const barraProgresso = item.querySelector('.metric-bar-fill');
                if (barraProgresso) {
                    barraProgresso.style.width = valorDisponibilidade;
                }
            }
        });

    } catch (error) {
        console.error("Erro ao processar métricas Ferramentas:", error);
    }
}

// Registro no carregamento
document.addEventListener('DOMContentLoaded', () => {
    vincularMetricEPC();
    vincularMetricInstrumentos();
    vincularMetricFerramentas();
});

//-----------------------------------
const COL_INSUMO = "liinsumo";

async function vincularMetricInsumo() {
    try {
        // 1. Buscamos todos os documentos da coleção liinsumo
        const response = await databases.listDocuments(DB_ID, COL_INSUMO);
        const total = response.total;
        
        // 2. Variáveis de contagem
        let contagemNormal = 0;
        let contagemAtencao = 0;
        let contagemFaltando = 0;

        // 3. Processamos os dados para contagem
        response.documents.forEach(doc => {
            const statusVindoDoBanco = doc.status;
            
            if (statusVindoDoBanco === "Normal") {
                contagemNormal++;
            } else if (statusVindoDoBanco === "Atenção") {
                contagemAtencao++;
            } else if (statusVindoDoBanco === "Faltando") {
                contagemFaltando++;
            }
        });

        // 4. Cálculo da Disponibilidade
        const indisponiveis = contagemAtencao + contagemFaltando;
        const disponiveis = total - indisponiveis;
        const porcentagem = total > 0 ? (disponiveis / total) * 100 : 0;
        const valorDisponibilidade = `${porcentagem.toFixed(1)}%`;

        // 5. Localizamos o bloco específico de "Insumo"
        const metricas = document.querySelectorAll('.metric-item');

        metricas.forEach(item => {
            const spanNome = item.querySelector('span');
            if (!spanNome) return;

            const nomeRegiao = spanNome.innerText.trim().toLowerCase();

            // Verificamos se o span é "insumo" (usando toLowerCase para evitar erro de digitação)
            if (nomeRegiao === "insumos") {
                let htmlInner = item.innerHTML;
                
                // Substituímos as contagens e a disponibilidade
                htmlInner = htmlInner.replace(/{normal}/g, contagemNormal);
                htmlInner = htmlInner.replace(/{atencao}/g, contagemAtencao);
                htmlInner = htmlInner.replace(/{faltando}/g, contagemFaltando);
                htmlInner = htmlInner.replace(/{disponibilidade}/g, valorDisponibilidade);
                
                item.innerHTML = htmlInner;

                // ATUALIZAÇÃO DA BARRA DE PROGRESSO
                // Buscamos o elemento da barra após o innerHTML ser resetado
                const barraProgresso = item.querySelector('.metric-bar-fill');
                if (barraProgresso) {
                    barraProgresso.style.width = valorDisponibilidade;
                }
            }
        });

    } catch (error) {
        console.error("Erro ao processar métricas Insumo:", error);
    }
}

// Registro no carregamento (Adicionando à sua lista atual)
document.addEventListener('DOMContentLoaded', () => {
    vincularMetricEPC();
    vincularMetricInstrumentos();
    vincularMetricFerramentas();
    vincularMetricInsumo();
});

//-------------------------------------
const COL_TAREFAS = "litarefas";

async function vincularTarefas() {
    try {
        const response = await databases.listDocuments(DB_ID, COL_TAREFAS);
        
        // 1. Localizamos o card dentro da seção de tarefas
        // Certifique-se de que o card individual tenha a classe '.tarefa-card' ou ajuste abaixo
        const cardModelo = document.querySelector('.tarefa-card');
        if (!cardModelo) return;

        const containerPai = cardModelo.parentElement;
        const htmlModelo = cardModelo.outerHTML;

        // 2. Marcador para manter a posição
        const marcador = document.createElement('div');
        containerPai.insertBefore(marcador, cardModelo);

        // 3. Limpamos os cards estáticos
        containerPai.querySelectorAll('.tarefa-card').forEach(card => card.remove());

        let htmlFinal = "";

        // 4. Geramos a lista baseada no banco
        response.documents.forEach(doc => {
            htmlFinal += htmlModelo
                .replace(/{descritivo}/g, doc.descritivo || "")
                .replace(/{status}/g, doc.status || "");
        });

        // 5. Inserimos os novos cards
        marcador.insertAdjacentHTML('afterend', htmlFinal);
        marcador.remove();

    } catch (error) {
        console.error("Erro ao vincular tarefas:", error);
    }
}

// Registro no carregamento
document.addEventListener('DOMContentLoaded', () => {
    // ... suas outras funções (vincularMetricEPC, etc)
    vincularTarefas();
});

//--------------------------
// Exemplo para a coleção de Equipamentos
client.subscribe(`databases.${DB_ID}.collections.${COL_EQUIPAMENTOS}.documents`, response => {
    console.log("Mudança detectada nos Equipamentos!");
    vincularEquipamentos(); // Chama a função que já criamos para atualizar os cards
});

// Exemplo para a coleção EPC
client.subscribe(`databases.${DB_ID}.collections.${COL_EPC}.documents`, response => {
    console.log("Mudança detectada no EPC!");
    vincularMetricEPC(); // Atualiza os números e a barra de progresso
});