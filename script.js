// ============================================================================
// 1. CONFIGURAÇÕES INICIAIS E CONEXÃO (APPWRITE)
// ============================================================================
const { Client, Databases, Query } = Appwrite; 

const client = new Client()
    .setEndpoint('https://syd.cloud.appwrite.io/v1')
    .setProject('69e0dbe500145c5ba8c3');

const databases = new Databases(client);
const DB_ID = "69e0def3001636121611";

// Constantes das Coleções
const COL_FROTA = "lifrota";
const COL_PENDENCIA_KPI = "lipendenciaskpi";
const COL_EQUIPAMENTOS = "liequipamentos";
const COL_EPC = "liepc";
const COL_INSTRUMENTOS = "liinstrumentos";
const COL_FERRAMENTAS = "liferramentas";
const COL_INSUMO = "liinsumo";
const COL_TAREFAS = "litarefas";
const COL_MANUTENCAO_MEF = "limanutencaomef";

// ============================================================================
// 2. VARIÁVEIS DE ESTADO E MEMÓRIA DE LAYOUT (EVITA QUEBRA NO REALTIME)
// ============================================================================
let linhaAtiva = 9; // Controla qual linha (8 ou 9) está filtrando o painel inteiro

const templates = {
    frota: "",
    pendencias: "",
    equipamentos: "",
    epc: "",
    instrumentos: "",
    ferramentas: "",
    insumo: "",
    tarefas: "",
    bases: ""
};

const containers = {
    frota: null,
    pendencias: null,
    equipamentos: null,
    tarefas: null,
    bases: null
};

// ============================================================================
// 3. FUNÇÕES AUXILIARES E GERENCIAMENTO DE TEMA (CSS VARIABLES)
// ============================================================================
function formatarDataHora(stringData) {
    if (!stringData) return "";
    const data = new Date(stringData);
    
    const horas = String(data.getUTCHours()).padStart(2, '0');
    const minutes = String(data.getUTCMinutes()).padStart(2, '0');
    const dia = String(data.getUTCDate()).padStart(2, '0');
    const mes = String(data.getUTCMonth() + 1).padStart(2, '0'); 
    const ano = data.getUTCFullYear();

    return `${horas}:${minutes} - ${dia}/${mes}/${ano}`;
}

function inicializarTemplatesEmMemoria() {
    const cardFrota = document.querySelector('.vtr-card');
    if (cardFrota) {
        templates.frota = cardFrota.outerHTML;
        containers.frota = cardFrota.parentNode;
    }

    const containerLista = document.querySelector('.list');
    if (containerLista) {
        const itemModelo = containerLista.querySelector('div');
        if (itemModelo) templates.pendencias = itemModelo.outerHTML;
        containers.pendencias = containerLista;
    }

    const cardEquip = document.querySelector('.equip-card');
    if (cardEquip) {
        templates.equipamentos = cardEquip.outerHTML;
        containers.equipamentos = cardEquip.parentElement;
    }

    const cardTarefa = document.querySelector('.tarefa-card');
    if (cardTarefa) {
        templates.tarefas = cardTarefa.outerHTML;
        containers.tarefas = cardTarefa.parentElement;
    }

    const containerOpcoes = document.querySelector('.select-opcoes');
    if (containerOpcoes) {
        containers.bases = containerOpcoes;
    }

    document.querySelectorAll('.metric-item').forEach(item => {
        const span = item.querySelector('span');
        if (span) {
            const nome = span.innerText.trim().toLowerCase();
            if (nome === "epc") templates.epc = item.innerHTML;
            else if (nome === "instrumentos") templates.instrumentos = item.innerHTML;
            else if (nome === "ferramentas") templates.ferramentas = item.innerHTML;
            else if (nome === "insumos") templates.insumo = item.innerHTML;
        }
    });

    templates.bases = '<div class="opcao" data-value="{base}">{base}</div>';
}

function mudarTemaLinha(linha) {
    const root = document.documentElement;
    
    if (linha === 8) {
        root.style.setProperty('--primary-bg', '#7A7A7A');
        root.style.setProperty('--sidebar-bg', '#5C5C5C');
        root.style.setProperty('--accent-teal', '#7A7A7A');
        root.style.setProperty('--status-blue', '#5C5C5C');
    } else {
        root.style.setProperty('--primary-bg', '#03D2D3');
        root.style.setProperty('--sidebar-bg', '#02A0A1');
        root.style.setProperty('--accent-teal', '#03D2D3');
        root.style.setProperty('--status-blue', '#02A0A1');
    }
}

function configurarBotoesLinha() {
    const containerLinhas = document.querySelector('.line-circles');
    if (!containerLinhas) return;

    containerLinhas.addEventListener('click', (e) => {
        const circuloClicado = e.target.closest('.circle');
        if (!circuloClicado || circuloClicado.classList.contains('active')) return;

        containerLinhas.querySelectorAll('.circle').forEach(c => c.classList.remove('active'));
        circuloClicado.classList.add('active'); 

        linhaAtiva = parseInt(circuloClicado.textContent.trim());
        mudarTemaLinha(linhaAtiva);
        recarregarDadosPainel();
    });
}

function recarregarDadosPainel() {
    vincularLifrota();
    vincularStatusPendencias();
    vincularEquipamentos();
    vincularTarefas();
    vincularBasesDropdown();
    
    processarMetricaBloco(COL_EPC, "EPC", "epc");
    processarMetricaBloco(COL_INSTRUMENTOS, "Instrumentos", "instrumentos");
    processarMetricaBloco(COL_FERRAMENTAS, "Ferramentas", "ferramentas");
    processarMetricaBloco(COL_INSUMO, "insumos", "insumo");
}

// ============================================================================
// 4. FUNÇÕES DE RENDERIZAÇÃO E VÍNCULO DE DADOS
// ============================================================================

async function vincularLifrota() {
    try {
        const response = await databases.listDocuments(DB_ID, COL_FROTA, [
            Query.equal('linha', String(linhaAtiva))
        ]);
        if (!containers.frota || !templates.frota) return;

        containers.frota.querySelectorAll('.vtr-card').forEach(card => card.remove());

        let htmlFinal = "";
        response.documents.forEach(doc => {
            htmlFinal += templates.frota
                .replace(/{status}/g, doc.status || "")
                .replace(/{fabricante}/g, doc.fabricante || "")
                .replace(/{placa}/g, doc.placa || "")
                .replace(/{sigla}/g, doc.posicionamento || "")
                .replace(/{ncombust}/g, doc.ncombust || "")
                .replace(/{diariobordo}/g, doc.diariobordo || "")
                .replace(/{cartaoabast}/g, doc.cartaoabast || "");
        });

        containers.frota.insertAdjacentHTML('beforeend', htmlFinal);
    } catch (error) {
        console.error(`Erro ao carregar [${COL_FROTA}]:`, error);
    }
}

async function vincularStatusPendencias() {
    try {
        const response = await databases.listDocuments(DB_ID, COL_PENDENCIA_KPI, [
            Query.equal('linha', String(linhaAtiva))
        ]);
        if (!containers.pendencias || !templates.pendencias) return;

        containers.pendencias.innerHTML = "";

        response.documents.forEach(doc => {
            let novoItem = templates.pendencias
                .replace(/{status}/g, doc.status || "")
                .replace(/{tipo}/g, doc.tipo || "")
                .replace(/{sistema}/g, doc.sistema || "")
                .replace(/{ordem}/g, doc.ordem || "")
                .replace(/{relato}/g, doc.relato || "")
                .replace(/{acao}/g, doc.acao || "")
                .replace(/{responsavel}/g, doc.responsavel || "")
                .replace(/{sigla}/g, doc.sigla || "")
                .replace(/{modificacao}/g, formatarDataHora(doc.modificado))
                .replace(/{data-criacao}/g, formatarDataHora(doc.criado))
                .replace(/{descritivo}/g, doc.descricao || ""); 
            
            containers.pendencias.insertAdjacentHTML('beforeend', novoItem);
        });
    } catch (error) {
        console.error(`Erro ao carregar [${COL_PENDENCIA_KPI}]:`, error);
    }
}

async function vincularEquipamentos() {
    try {
        const response = await databases.listDocuments(DB_ID, COL_EQUIPAMENTOS, [
            Query.equal('linha', String(linhaAtiva))
        ]);
        if (!containers.equipamentos || !templates.equipamentos) return;

        containers.equipamentos.querySelectorAll('.equip-card').forEach(card => card.remove());

        let htmlFinal = "";
        response.documents.forEach(doc => {
            let novoHtml = templates.equipamentos
                .replace(/{sigla}/g, doc.sigla || "")
                .replace(/{equipamento}/g, doc.detalhe || "") 
                .replace(/{Sistema}/g, doc.sistema || "")     
                .replace(/{Status}/g, doc.statusFuncionamento || "");

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = novoHtml;
            const novoCard = tempDiv.firstElementChild;

            if (doc.statusFuncionamento === "Inoperante") {
                novoCard.classList.add('red');
            } else {
                novoCard.classList.remove('red');
            }

            htmlFinal += novoCard.outerHTML;
        });

        containers.equipamentos.insertAdjacentHTML('beforeend', htmlFinal);
    } catch (error) {
        console.error(`Erro ao carregar [${COL_EQUIPAMENTOS}]:`, error);
    }
}

async function processarMetricaBloco(colecao, nomeFiltroHTML, chaveTemplate) {
    try {
        const response = await databases.listDocuments(DB_ID, colecao, [
            Query.equal('linha', String(linhaAtiva))
        ]);
        const total = response.total;
        
        let contagemNormal = 0, contagemAtencao = 0, contagemFaltando = 0;

        response.documents.forEach(doc => {
            if (doc.status === "Normal") contagemNormal++;
            else if (doc.status === "Atenção") contagemAtencao++;
            else if (doc.status === "Faltando") contagemFaltando++;
        });

        const indisponiveis = contagemAtencao + contagemFaltando;
        const porcentagem = total > 0 ? ((total - indisponiveis) / total) * 100 : 0;
        const valorDisponibilidade = `${porcentagem.toFixed(1)}%`;

        const item = Array.from(document.querySelectorAll('.metric-item')).find(el => {
            const span = el.querySelector('span');
            return span && span.innerText.trim().toLowerCase() === nomeFiltroHTML.toLowerCase();
        });

        if (item && templates[chaveTemplate]) {
            item.innerHTML = templates[chaveTemplate]
                .replace(/{normal}/g, contagemNormal)
                .replace(/{atencao}/g, contagemAtencao)
                .replace(/{faltando}/g, contagemFaltando)
                .replace(/{disponibilidade}/g, valorDisponibilidade);

            const barraProgresso = item.querySelector('.metric-bar-fill');
            if (barraProgresso) {
                barraProgresso.style.width = valorDisponibilidade;
            }
        }
    } catch (error) {
        console.error(`Erro na métrica [${nomeFiltroHTML}]:`, error);
    }
}

async function vincularTarefas() {
    try {
        const response = await databases.listDocuments(DB_ID, COL_TAREFAS, [
            Query.equal('linha', String(linhaAtiva))
        ]);
        if (!containers.tarefas || !templates.tarefas) return;

        containers.tarefas.querySelectorAll('.tarefa-card').forEach(card => card.remove());

        let htmlFinal = "";
        response.documents.forEach(doc => {
            htmlFinal += templates.tarefas
                .replace(/{descritivo}/g, doc.descritivo || "")
                .replace(/{status}/g, doc.status || "");
        });

        containers.tarefas.insertAdjacentHTML('beforeend', htmlFinal);
    } catch (error) {
        console.error(`Erro ao carregar [${COL_TAREFAS}]:`, error);
    }
}

async function vincularBasesDropdown() {
    try {
        const response = await databases.listDocuments(DB_ID, COL_MANUTENCAO_MEF, [
            Query.equal('linha', String(linhaAtiva))
        ]);
        if (!containers.bases || !templates.bases) return;

        containers.bases.innerHTML = "";
        const basesUnicas = new Set();

        response.documents.forEach(doc => {
            const nomeBase = doc.base;
            if (!nomeBase || basesUnicas.has(nomeBase)) return;
            basesUnicas.add(nomeBase);

            let novoItem = templates.bases.replace(/{base}/g, nomeBase);
            containers.bases.insertAdjacentHTML('beforeend', novoItem);
        });
    } catch (error) {
        console.error(`Erro ao carregar [${COL_MANUTENCAO_MEF}]:`, error);
    }
}

// ============================================================================
// 5. INSCRIÇÕES EM TEMPO REAL (REALTIME)
// ============================================================================
client.subscribe(`databases.${DB_ID}.collections.${COL_EQUIPAMENTOS}.documents`, () => vincularEquipamentos());
client.subscribe(`databases.${DB_ID}.collections.${COL_EPC}.documents`, () => processarMetricaBloco(COL_EPC, "EPC", "epc"));
client.subscribe(`databases.${DB_ID}.collections.${COL_MANUTENCAO_MEF}.documents`, () => vincularBasesDropdown());

// ============================================================================
// 6. DISPARO DE CARREGAMENTO ÚNICO INICIAL
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    inicializarTemplatesEmMemoria(); 
    configurarBotoesLinha();          
    recarregarDadosPainel();          
    configurarNavegacaoAbas();        // <--- ATIVA O CONTROLE DE ABAS AQUI!
});

// ============================================================================
// 7. LÓGICA DE INTERAÇÃO DO SELECT CUSTOMIZADO
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
  const select = document.querySelector(".select-customizado");
  if (!select) return;

  const gatilho = select.querySelector(".select-gatilho");
  const textoGatilho = gatilho.querySelector("span");
  const containerOpcoes = select.querySelector(".select-opcoes");

  gatilho.addEventListener("click", () => {
    select.classList.toggle("aberto");
  });

  containerOpcoes.addEventListener("click", (e) => {
    const opcao = e.target.closest(".opcao");
    if (!opcao) return;

    textoGatilho.textContent = opcao.textContent;
    select.classList.remove("aberto");

    const valorSelecionado = opcao.getAttribute("data-value");
    console.log("Base Selecionada do Banco:", valorSelecionado);
  });

  document.addEventListener("click", (e) => {
    if (!select.contains(e.target)) {
      select.classList.remove("aberto");
    }
  });
});

// ============================================================================
// 8. CONTROLADOR DE NAVEGAÇÃO DE ABAS (VIEWS) - NOVO!
// ============================================================================
function configurarNavegacaoAbas() {
    const barraNav = document.querySelector('.external-nav');
    if (!barraNav) return;

    barraNav.addEventListener('click', (e) => {
        const circuloClicado = e.target.closest('.circulo-nav');
        if (!circuloClicado || circuloClicado.classList.contains('ativo')) return;

        // 1. Altera o estado ativo dos círculos no menu flutuante
        barraNav.querySelectorAll('.circulo-nav').forEach(c => c.classList.remove('ativo'));
        circuloClicado.classList.add('ativo');

        // 2. Localiza o ícone interno para saber qual janela abrir
        const icone = circuloClicado.querySelector('i');
        if (!icone) return;

        // 3. Oculta todas as janelas do main-container removendo o .active
        document.querySelectorAll('.painel-view').forEach(view => view.classList.remove('active'));

        // 4. Identifica o ícone e exibe a tela correspondente
        if (icone.classList.contains('fi-rr-stats')) {
            document.getElementById('view-stats').classList.add('active');
        } else if (icone.classList.contains('fi-rr-apps')) {
            document.getElementById('view-apps').classList.add('active');
        } else if (icone.classList.contains('fi-rr-settings')) {
            document.getElementById('view-settings').classList.add('active');
        } else if (icone.classList.contains('fi-rr-user')) {
            document.getElementById('view-user').classList.add('active');
        }
    });
}