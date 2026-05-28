// ============================================================================
// 1. CONFIGURAÇÕES INICIAIS E CONEXÃO (APPWRITE)
// ============================================================================
const { Client, Databases, Query, ID } = Appwrite; 

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
const COL_ESTACAO = "liestacao"; 

// ============================================================================
// 2. VARIÁVEIS DE ESTADO E MEMÓRIA DE LAYOUT (EVITA QUEBRA NO REALTIME)
// ============================================================================
let linhaAtiva = 9; 
let baseSelecionada = null; 
let filtroStatusEquip = "Todos"; 
let tagsSelecionadas = []; 
let idPendenciaEmEdicao = null; 

const templates = {
    frota: "",
    pendencias: "",
    equipamentos: "",
    epc: "",
    instrumentos: "",
    ferramentas: "",
    insumo: "",
    tarefas: "",
    bases: "",
    siglas: "" 
};

const containers = {
    frota: null,
    pendencias: null,
    equipamentos: null,
    tarefas: null,
    bases: null,
    siglas: null 
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
        const itemModelo = containerLista.querySelector('.card');
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

    const tagModelo = document.querySelector('.sigla-tag');
    if (tagModelo) {
        templates.siglas = tagModelo.outerHTML;
        containers.siglas = tagModelo.parentElement; 
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
        
        baseSelecionada = null;
        const selectGatilhoSpan = document.querySelector(".select-gatilho span");
        if (selectGatilhoSpan) selectGatilhoSpan.textContent = "Todas as Bases";

        filtroStatusEquip = "Todos";
        document.querySelectorAll('.btn-filter-equip').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-status') === 'Todos') btn.classList.add('active');
        });

        tagsSelecionadas = [];

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
    vincularSiglasEstacao(); 
    
    processarMetricaBloco(COL_EPC, "EPC", "epc");
    processarMetricaBloco(COL_INSTRUMENTOS, "Instrumentos", "instrumentos");
    processarMetricaBloco(COL_FERRAMENTAS, "Ferramentas", "ferramentas");
    processarMetricaBloco(COL_INSUMO, "insumos", "insumo");
}

// ============================================================================
// 4. FUNÇÕES DE RENDERIZAÇÃO E FILTRAGEM ENCADEADA DE DADOS
// ============================================================================

async function vincularSiglasEstacao() {
    try {
        if (!containers.siglas || !templates.siglas) return;

        let documentosEstacaoValidos = [];

        if (baseSelecionada) {
            const resMEF = await databases.listDocuments(DB_ID, COL_MANUTENCAO_MEF, [
                Query.equal('linha', String(linhaAtiva)),
                Query.equal('base', baseSelecionada)
            ]);
            const siglasEquipesMEF = resMEF.documents.map(doc => doc.sigla).filter(Boolean);

            if (siglasEquipesMEF.length > 0) {
                const resEstacoes = await databases.listDocuments(DB_ID, COL_ESTACAO, [
                    Query.equal('linha', String(linhaAtiva)),
                    Query.equal('MEF', siglasEquipesMEF)
                ]);
                documentosEstacaoValidos = resEstacoes.documents;
            }
        } else {
            const response = await databases.listDocuments(DB_ID, COL_ESTACAO, [
                Query.equal('linha', String(linhaAtiva))
            ]);
            documentosEstacaoValidos = response.documents;
        }

        let htmlFinal = "";
        documentosEstacaoValidos.forEach(doc => {
            const dadoSigla = doc.sigla || doc.Sigla || "";
            htmlFinal += templates.siglas.replace(/{sigla}/gi, dadoSigla);
        });
        containers.siglas.innerHTML = htmlFinal;

        containers.siglas.querySelectorAll('.sigla-tag').forEach(tagEl => {
            const siglaTxt = tagEl.textContent.trim();
            
            if (tagsSelecionadas.includes(siglaTxt)) {
                tagEl.classList.add('active');
            }

            tagEl.addEventListener('click', () => {
                if (tagsSelecionadas.includes(siglaTxt)) {
                    tagsSelecionadas = tagsSelecionadas.filter(t => t !== siglaTxt);
                    tagEl.classList.remove('active');
                } else {
                    tagsSelecionadas.push(siglaTxt);
                    tagEl.classList.add('active');
                }
                vincularEquipamentos();
            });
        });

    } catch (error) {
        console.error(`Erro ao processar filtro sequencial nas tags de estação:`, error);
    }
}

async function vincularLifrota() {
    try {
        if (!containers.frota || !templates.frota) return;

        let queriesValidas = [Query.equal('linha', String(linhaAtiva))];

        if (baseSelecionada) {
            const resMEF = await databases.listDocuments(DB_ID, COL_MANUTENCAO_MEF, [
                Query.equal('linha', String(linhaAtiva)),
                Query.equal('base', baseSelecionada)
            ]);
            
            const siglasEquipesMEF = resMEF.documents.map(doc => doc.sigla).filter(Boolean);

            if (siglasEquipesMEF.length === 0) {
                containers.frota.querySelectorAll('.vtr-card').forEach(card => card.remove());
                return;
            }

            const resEstacoes = await databases.listDocuments(DB_ID, COL_ESTACAO, [
                Query.equal('linha', String(linhaAtiva)),
                Query.equal('MEF', siglasEquipesMEF) 
            ]);

            const estacoesPermitidas = resEstacoes.documents.map(doc => doc.sigla || doc.Sigla).filter(Boolean);

            if (estacoesPermitidas.length === 0) {
                containers.frota.querySelectorAll('.vtr-card').forEach(card => card.remove());
                return;
            }

            queriesValidas.push(Query.equal('posicionamento', estacoesPermitidas));
        }

        const response = await databases.listDocuments(DB_ID, COL_FROTA, queriesValidas);

        containers.frota.querySelectorAll('.vtr-card').forEach(card => card.remove());

        response.documents.forEach(doc => {
            let cardHtml = templates.frota
                .replace(/{status}/g, doc.status || "")
                .replace(/{fabricante}/g, doc.fabricante || "")
                .replace(/{placa}/g, doc.placa || "")
                .replace(/{sigla}/gi, doc.posicionamento || "")
                .replace(/{ncombust}/g, doc.ncombust || "")
                .replace(/{diariobordo}/g, doc.diariobordo || "")
                .replace(/{cartaoabast}/g, doc.cartaoabast || "");

            cardHtml = cardHtml.replace('class="vtr-card"', `class="vtr-card" data-id="${doc.$id}" style="cursor: pointer;"`);

            containers.frota.insertAdjacentHTML('beforeend', cardHtml);
        });

        containers.frota.querySelectorAll('.vtr-card').forEach(card => {
            card.addEventListener('click', () => {
                const idDoc = card.getAttribute('data-id');
                const modalOverlay = document.getElementById('vtr-modal-overlay');
                if (modalOverlay) {
                    modalOverlay.classList.add('aberto');
                    carregarListaGeralFrota(idDoc); 
                }
            });
        });

    } catch (error) {
        console.error(`Erro ao processar filtro sequencial de frota:`, error);
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
            // Mapeamento de segurança para ler a sigla tanto de estacaoId quanto do campo sigla
            const siglaTratada = doc.estacaoId || doc.sigla || "";

            let itemHtml = templates.pendencias
                .replace(/{status}/g, doc.status || "")
                .replace(/{tipo}/g, doc.tipo || "")
                .replace(/{sistema}/g, doc.sistema || "")
                .replace(/{ordem}/g, doc.ordem || "")
                .replace(/{relato}/g, doc.relato || "")
                .replace(/{acao}/g, doc.acao || "")
                .replace(/{responsavel}/g, doc.responsavel || "")
                .replace(/{sigla}/gi, siglaTratada)
                .replace(/{modificacao}/g, formatarDataHora(doc.modificado))
                .replace(/{data-criacao}/g, formatarDataHora(doc.criado))
                .replace(/{descritivo}/g, doc.descricao || doc.descritivo || ""); 

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = itemHtml.trim();
            const cardElement = tempDiv.firstElementChild;

            if (cardElement) {
                cardElement.style.cursor = "pointer";
                cardElement.addEventListener('click', () => {
                    abrirModalEdicaoPendencia(doc);
                });

                containers.pendencias.appendChild(cardElement);
            }
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

        const tagsVisiveisNoLayout = Array.from(document.querySelectorAll('.sigla-tag')).map(t => t.textContent.trim());

        response.documents.forEach(doc => {
            const statusAtual = doc.statusFuncionamento || "Normal";
            const siglaCard = (doc.sigla || "").trim();

            if (filtroStatusEquip !== "Todos" && statusAtual !== filtroStatusEquip) {
                return; 
            }

            if (tagsSelecionadas.length > 0 && !tagsSelecionadas.includes(siglaCard)) {
                return; 
            }

            if (baseSelecionada && !tagsVisiveisNoLayout.includes(siglaCard)) {
                return; 
            }

            let novoHtml = templates.equipamentos
                .replace(/{sigla}/gi, siglaCard)
                .replace(/{equipamento}/g, doc.detalhe || "") 
                .replace(/{Sistema}/g, doc.sistema || "")     
                .replace(/{Status}/g, statusAtual);

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = novoHtml;
            const novoCard = tempDiv.firstElementChild;

            if (statusAtual === "Inoperante") {
                novoCard.classList.add('red');
            } else {
                novoCard.classList.remove('red');
            }

            novoCard.setAttribute('data-id', doc.$id);
            novoCard.style.cursor = 'pointer';

            containers.equipamentos.appendChild(novoCard);
        });

        containers.equipamentos.querySelectorAll('.equip-card').forEach(card => {
            const idDoc = card.getAttribute('data-id');

            card.addEventListener('click', (e) => {
                e.stopPropagation(); 
                mostrarMenuStatusEquipamento(e, idDoc);
            });

            card.addEventListener('contextmenu', (e) => {
                e.preventDefault();  
                e.stopPropagation();
                mostrarMenuStatusEquipamento(e, idDoc);
            });
        });

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

        containers.bases.innerHTML = '<div class="opcao" data-value="">Todas as Bases</div>';
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
// 5. INSCRIÇÕES EM TEMPO REAL (REALTIME OTIMIZADO)
// ============================================================================
client.subscribe(`databases.${DB_ID}.collections.${COL_EQUIPAMENTOS}.documents`, () => vincularEquipamentos());
client.subscribe(`databases.${DB_ID}.collections.${COL_EPC}.documents`, () => processarMetricaBloco(COL_EPC, "EPC", "epc"));
client.subscribe(`databases.${DB_ID}.collections.${COL_MANUTENCAO_MEF}.documents`, () => vincularBasesDropdown());
client.subscribe(`databases.${DB_ID}.collections.${COL_ESTACAO}.documents`, () => vincularSiglasEstacao());
client.subscribe(`databases.${DB_ID}.collections.${COL_PENDENCIA_KPI}.documents`, () => vincularStatusPendencias());
client.subscribe(`databases.${DB_ID}.collections.${COL_FROTA}.documents`, () => {
    vincularLifrota();
    const overlay = document.getElementById('vtr-modal-overlay');
    if (overlay && overlay.classList.contains('aberto')) carregarListaGeralFrota();
});

// ============================================================================
// 6. DISPARO DE CARREGAMENTO ÚNICO INICIAL
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    inicializarTemplatesEmMemoria(); 
    configurarBotoesLinha();          
    recarregarDadosPainel();          
    configurarNavegacaoAbas(); 
    configurarModalVeiculo(); 
    configurarModalPendencia(); 
    configurarBotaoCopiarTexto(); 
    configurarBotaoCopiarTabela(); 
    configurarFiltrosEquipamentos(); 
});

// ============================================================================
// 7. LÓGICA DE INTERAÇÃO E CASCATA DO SELECT CUSTOMIZADO
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

  containerOpcoes.addEventListener("click", async (e) => {
    const opcao = e.target.closest(".opcao");
    if (!opcao) return;

    textoGatilho.textContent = opcao.textContent;
    select.classList.remove("aberto");

    const valorSelecionado = opcao.getAttribute("data-value");
    
    baseSelecionada = valorSelecionado || null; 
    tagsSelecionadas = []; 

    vincularLifrota();
    await vincularSiglasEstacao(); 
    vincularEquipamentos();        
  });

  document.addEventListener("click", (e) => {
    if (!select.contains(e.target)) {
        select.classList.remove("aberto");
    }
  });
});

// ============================================================================
// 8. CONTROLADOR DE NAVEGAÇÃO DE ABAS (VIEWS)
// ============================================================================
function configurarNavegacaoAbas() {
    const barraNav = document.querySelector('.external-nav');
    if (!barraNav) return;

    barraNav.addEventListener('click', (e) => {
        const circuloClicado = e.target.closest('.circulo-nav');
        if (!circuloClicado || circuloClicado.classList.contains('ativo')) return;

        barraNav.querySelectorAll('.circulo-nav').forEach(c => c.classList.remove('ativo'));
        circuloClicado.classList.add('ativo');

        const icone = circuloClicado.querySelector('i');
        if (!icone) return;

        document.querySelectorAll('.painel-view').forEach(view => view.classList.remove('active'));

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

// ============================================================================
// 9. GERENCIADOR DO MODAL DE FROTA (CADASTRO INTELIGENTE)
// ============================================================================
function configurarModalVeiculo() {
    const btnAbrir = document.querySelector('.vtr-add-card');
    const modalOverlay = document.getElementById('vtr-modal-overlay');
    const btnFecharX = document.getElementById('close-vtr-modal');
    const btnCancelar = document.getElementById('btn-cancelar-vtr');
    const formulario = document.getElementById('form-add-vtr');

    if (!btnAbrir || !modalOverlay) return;

    btnAbrir.addEventListener('click', () => {
        modalOverlay.classList.add('aberto');
        const inputLinhaForm = document.getElementById('vtr-linha-input');
        if (inputLinhaForm) inputLinhaForm.value = String(linhaAtiva);
        carregarListaGeralFrota(); 
    });

    const fecharModal = () => {
        modalOverlay.classList.remove('aberto');
        if (formulario) formulario.reset(); 
    };

    if (btnFecharX) btnFecharX.addEventListener('click', fecharModal);
    if (btnCancelar) btnCancelar.addEventListener('click', fecharModal);

    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) fecharModal();
    });

    if (formulario) {
        formulario.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const novaSigla = (document.getElementById('vtr-add-sigla-input') || document.getElementById('vtr-sigla-input')).value.trim();
            let linhaDestino = document.getElementById('vtr-linha-input').value;

            try {
                const checkEst = await databases.listDocuments(DB_ID, COL_ESTACAO, [
                    Query.equal('sigla', novaSigla)
                ]);
                if (checkEst.documents.length > 0) {
                    linhaDestino = checkEst.documents[0].linha;
                }
            } catch (err) { console.error(err); }

            const data = {
                status: document.getElementById('vtr-status-input').value,
                fabricante: document.getElementById('vtr-fabricante-input').value.trim(),
                placa: document.getElementById('vtr-placa-input').value.trim().toUpperCase(),
                posicionamento: novaSigla,
                linha: String(linhaDestino), 
                ncombust: "100%", 
                diariobordo: "Sim", 
                cartaoabast: "OK",
                observacao: "" 
            };

            try {
                await databases.createDocument(DB_ID, COL_FROTA, ID.unique(), data);
                fecharModal();
            } catch (error) {
                console.error("Erro ao cadastrar veículo:", error);
                alert("Erro ao salvar no banco.");
            }
        });
    }
}

// ============================================================================
// 10. CARREGADOR DA LISTA GERAL EXPANDIDA COM CAMPO DE OBSERVAÇÃO NATIVA
// ============================================================================
async function carregarListaGeralFrota(idParaEditar = null) {
    try {
        const response = await databases.listDocuments(DB_ID, COL_FROTA);
        const containerLista = document.getElementById('modal-vtr-list');
        if (!containerLista) return;

        containerLista.innerHTML = "";
        
        if (response.documents.length === 0) {
            containerLista.innerHTML = '<span style="color:#777; font-size:9pt; font-style:italic;">Nenhum veículo registrado na frota.</span>';
            return;
        }

        response.documents.forEach(doc => {
            const idDoc = doc.$id;
            const fabricante = doc.fabricante || "";
            const placa = doc.placa || "";
            const status = doc.status || "";
            const sigla = doc.posicionamento || "";
            const linha = doc.linha || "";
            const ncombust = doc.ncombust || "";
            const diariobordo = doc.diariobordo || "";
            const cartaoabast = doc.cartaoabast || "";
            const observacao = doc.observacao || "";

            const itemHtml = `
                <div class="modal-vtr-item" id="row-${idDoc}" style="background:#f8fafc; border:1px solid var(--border-light); border-radius:10px; padding:12px 15px;">
                    <div class="vtr-mode-view" id="view-layer-${idDoc}">
                        <div class="modal-vtr-info">
                            <strong>${fabricante}</strong> - ${placa}
                            <span style="font-size: 8.5pt; padding: 2px 6px; border-radius: 4px; margin-left: 8px; font-weight: bold; background: ${status === 'Normal' ? '#e6fbf4' : status === 'Avariado' ? '#fef2f2' : '#fffbeb'}; color: ${status === 'Normal' ? '#10b981' : status === 'Avariado' ? '#ef4444' : '#f59e0b'};">${status}</span><br>
                            <small>Linha: ${linha} ${sigla ? `| Sigla: ${sigla}` : ''}</small><br>
                            <small style="color:var(--text-light); font-weight:500;">Combustível: <b>${ncombust}</b> | Diário: <b>${diariobordo}</b> | Cartão: <b>${cartaoabast}</b></small>
                            
                            ${observacao ? `
                                <div style="margin-top: 6px; padding: 6px 10px; background: #fff5f5; border-left: 3px solid #ef4444; border-radius: 4px;">
                                    <small style="color: #b91c1c; font-weight: 600; display: block; font-size: 8pt;">
                                        <i class="fi fi-rr-comment-alt" style="margin-right: 4px; vertical-align: middle;"></i>OBSERVAÇÃO DO OPERADOR:
                                    </small>
                                    <span style="font-size: 8.5pt; color: #374151; font-style: italic; display: block; margin-top: 2px;">"${observacao}"</span>
                                </div>
                            ` : ''}
                        </div>
                        <div class="modal-vtr-actions">
                            <button class="modal-action-btn edit" data-id="${idDoc}" title="Editar Informações">
                                <i class="fi fi-rr-edit"></i>
                            </button>
                            <button class="modal-action-btn del" data-id="${idDoc}" title="Excluir Registro">
                                <i class="fi fi-rr-trash"></i>
                            </button>
                        </div>
                    </div>

                    <div class="vtr-mode-edit" id="edit-layer-${idDoc}" style="display: none;">
                        <div class="modal-vtr-inputs-grid">
                            <div class="inline-form-group">
                                <label>Fabricante</label>
                                <input type="text" class="inline-edit-input input-fab" value="${fabricante}" list="fabricantes-sugestoes">
                            </div>
                            <div class="inline-form-group">
                                <label>Placa</label>
                                <input type="text" class="inline-edit-input input-plac" value="${placa}">
                            </div>
                            <div class="inline-form-group">
                                <label>Status</label>
                                <select class="inline-edit-input input-stat">
                                    <option value="Normal" ${status === 'Normal' ? 'selected' : ''}>Normal</option>
                                    <option value="Em Manutenção" ${status === 'Em Manutenção' ? 'selected' : ''}>Em Manutenção</option>
                                    <option value="Avariado" ${status === 'Avariado' ? 'selected' : ''}>Avariado</option>
                                </select>
                            </div>
                            <div class="inline-form-group">
                                <label>Sigla</label>
                                <input type="text" class="inline-edit-input input-sigl" value="${sigla}">
                            </div>
                            <div class="inline-form-group">
                                <label>Combustível</label>
                                <input type="text" class="inline-edit-input input-comb" value="${ncombust}">
                            </div>
                            <div class="inline-form-group">
                                <label>Diário de Bordo</label>
                                <select class="inline-edit-input input-diar">
                                    <option value="Sim" ${diariobordo === 'Sim' || diariobordo === 'OK' ? 'selected' : ''}>Sim</option>
                                    <option value="Não" ${diariobordo === 'Não' ? 'selected' : ''}>Não</option>
                                </select>
                            </div>
                            <div class="inline-form-group">
                                <label>Cartão Abastec.</label>
                                <input type="text" class="inline-edit-input input-cart" value="${cartaoabast}">
                            </div>
                            <div class="inline-form-group">
                                <label>Linha Operação</label>
                                <select class="inline-edit-input input-lin">
                                    <option value="8" ${String(linha) === '8' ? 'selected' : ''}>Linha 8</option>
                                    <option value="9" ${String(linha) === '9' ? 'selected' : ''}>Linha 9</option>
                                </select>
                            </div>
                            <div class="inline-form-group" style="grid-column: span 2;">
                                <label>Observações / Relato de Alterações do Veículo</label>
                                <input type="text" class="inline-edit-input input-obs" value="${observacao}" placeholder="Ex: Problema no ar condicionado, pneu careca, etc...">
                            </div>
                        </div>
                        <div class="modal-vtr-actions">
                            <button class="modal-vtr-action-btn save" data-id="${idDoc}" title="Confirmar Alteração">
                                <i class="fi fi-rr-check"></i>
                            </button>
                            <button class="modal-vtr-action-btn cancel" data-id="${idDoc}" title="Cancelar">
                                <i class="fi fi-rr-cross"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            containerLista.insertAdjacentHTML('beforeend', itemHtml);
        });

        containerLista.querySelectorAll('.modal-vtr-item').forEach(card => {
            const id = card.id.replace('row-', '');
            const camadaVisao = card.querySelector(`#view-layer-${id}`);
            const camadaEdicao = card.querySelector(`#edit-layer-${id}`);

            if (idParaEditar && id === idParaEditar) {
                camadaVisao.style.display = 'none';
                camadaEdicao.style.display = 'flex';
                setTimeout(() => {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 150);
            }

            card.querySelector('.modal-action-btn.edit').addEventListener('click', () => {
                camadaVisao.style.display = 'none';
                camadaEdicao.style.display = 'flex';
            });

            card.querySelector('.modal-action-btn.cancel').addEventListener('click', () => {
                camadaEdicao.style.display = 'none';
                camadaVisao.style.display = 'flex';
            });

            card.querySelector('.modal-action-btn.del').addEventListener('click', () => {
                excluirVeiculoDoModal(id);
            });

            card.querySelector('.modal-action-btn.save').addEventListener('click', async () => {
                const novaSigla = camadaEdicao.querySelector('.input-sigl').value.trim();
                let SecretLinha = camadaEdicao.querySelector('.input-lin').value;

                try {
                    const estacaoMatch = await databases.listDocuments(DB_ID, COL_ESTACAO, [
                        Query.equal('sigla', novaSigla)
                    ]);
                    if (estacaoMatch.documents.length > 0) {
                        SecretLinha = estacaoMatch.documents[0].linha;
                    }
                } catch (err) {
                    console.error("Erro ao validar linha da estação informada:", err);
                }

                const updatedData = {
                    fabricante: camadaEdicao.querySelector('.input-fab').value.trim(),
                    placa: camadaEdicao.querySelector('.input-plac').value.trim().toUpperCase(),
                    status: camadaEdicao.querySelector('.input-stat').value,
                    posicionamento: novaSigla,
                    linha: String(SecretLinha), 
                    ncombust: camadaEdicao.querySelector('.input-comb').value.trim(),
                    diariobordo: camadaEdicao.querySelector('.input-diar').value,
                    cartaoabast: camadaEdicao.querySelector('.input-cart').value.trim(),
                    observacao: camadaEdicao.querySelector('.input-obs').value.trim()
                };

                try {
                    await databases.updateDocument(DB_ID, COL_FROTA, id, updatedData);
                } catch (error) {
                    console.error("Erro ao atualizar dados in-place:", error);
                    alert("Não foi possível salvar as alterações.");
                }
            });
        });

    } catch (error) {
        console.error("Erro ao carregar lista geral da frota:", error);
    }
}

async function excluirVeiculoDoModal(id) {
    if (!confirm("Deseja realmente excluir este veículo de forma definitiva?")) return;
    try {
        await databases.deleteDocument(DB_ID, COL_FROTA, id);
    } catch (error) {
        console.error("Erro ao excluir veículo:", error);
        alert("Não foi possível processar a exclusão.");
    }
}

// ============================================================================
// 11. MOTOR ASSÍNCRONO DE CÓPIA CORPORATIVA (FORMATO RELATÓRIO)
// ============================================================================
function configurarBotaoCopiarTexto() {
    const btnCopiar = document.getElementById('btn-copiar-dados-frota');
    if (!btnCopiar) return;

    btnCopiar.addEventListener('click', async () => {
        try {
            const response = await databases.listDocuments(DB_ID, COL_FROTA);
            if (response.documents.length === 0) {
                alert("Nenhum registro de veículo encontrado para exportação.");
                return;
            }

            let txt = `📋 RELATÓRIO OPERACIONAL - MONITORAMENTO DA FROTA VTR\n`;
            txt += `Data/Hora da Extração: ${new Date().toLocaleString('pt-BR')}\n`;
            txt += `====================================================\n\n`;

            response.documents.forEach((doc, i) => {
                txt += `${i + 1}. [${doc.posicionamento || "SEM SIGLA"}] ${doc.fabricante || "N/A"} — PLACA: ${doc.placa || "N/A"}\n`;
                txt += `   • Status: ${doc.status || "N/A"}\n`;
                txt += `   • Linha Operacional: Linha ${doc.linha || "N/A"}\n`;
                txt += `   • Nível de Combustível: ${doc.ncombust || "N/A"}\n`;
                txt += `   • Diário de Bordo OK: ${doc.diariobordo || "N/A"}\n`;
                txt += `   • Cartão Abastecimento: ${doc.cartaoabast || "N/A"}\n`;
                if (doc.observacao && doc.observacao.trim() !== "") {
                    txt += `   • Relato Técnico / Observação: "${doc.observacao}"\n`;
                }
                txt += `----------------------------------------------------\n`;
            });

            await navigator.clipboard.writeText(txt);

            const htmlOriginal = btnCopiar.innerHTML;
            btnCopiar.innerHTML = `<i class="fi fi-rr-check"></i> Texto Copiado!`;
            btnCopiar.style.background = "#10b981";
            btnCopiar.style.color = "#ffffff";
            btnCopiar.style.borderColor = "#10b981";

            setTimeout(() => {
                btnCopiar.innerHTML = htmlOriginal;
                btnCopiar.style.background = "";
                btnCopiar.style.color = "";
                btnCopiar.style.borderColor = "";
            }, 2000);

        } catch (error) {
            console.error("Falha ao exportar relatório:", error);
            alert("Erro ao copiar.");
        }
    });
}

// ============================================================================
// 12. EXPORTADOR DE TABELAS MATRICIAIS (COMPATÍVEL COM EXCEL/SISTEMAS)
// ============================================================================
function configurarBotaoCopiarTabela() {
    const btnCopiarTabela = document.getElementById('btn-copiar-tabela-frota');
    if (!btnCopiarTabela) return;

    btnCopiarTabela.addEventListener('click', async () => {
        try {
            const response = await databases.listDocuments(DB_ID, COL_FROTA);
            if (response.documents.length === 0) {
                alert("Nenhum registro de veículo encontrado para exportação estruturada.");
                return;
            }

            const cabecalho = ["Sigla_Estacao", "Fabricante", "Placa", "Status", "Linha", "Combustivel", "Diario_Bordo", "Cartao_Abastec", "Observacao"];
            let tabelaTexto = cabecalho.join("\t") + "\n";

            response.documents.forEach(doc => {
                const obsLimpa = (doc.observacao || "").replace(/\r?\n|\r/g, " ");

                const inlineValores = [
                    doc.posicionamento || "",
                    doc.fabricante || "",
                    doc.placa || "",
                    doc.status || "",
                    doc.linha || "",
                    doc.ncombust || "",
                    doc.diariobordo || "",
                    doc.cartaoabast || "",
                    obsLimpa
                ];

                tabelaTexto += inlineValores.join("\t") + "\n";
            });

            await navigator.clipboard.writeText(tabelaTexto);

            const htmlOriginal = btnCopiarTabela.innerHTML;
            btnCopiarTabela.innerHTML = `<i class="fi fi-rr-check"></i> Tabela Copiada!`;
            btnCopiarTabela.style.background = "#10b981";
            btnCopiarTabela.style.color = "#ffffff";
            btnCopiarTabela.style.borderColor = "#10b981";

            setTimeout(() => {
                btnCopiarTabela.innerHTML = htmlOriginal;
                btnCopiarTabela.style.background = "";
                btnCopiarTabela.style.color = "";
                btnCopiarTabela.style.borderColor = "";
            }, 2000);

        } catch (error) {
            console.error("Falha ao exportar tabela para o clipboard:", error);
            alert("Erro ao copiar tabela.");
        }
    });
}

// ============================================================================
// 13. GERENCIADOR DE MENU DE CONTEXTO E TROCA DE STATUS (EQUIPAMENTOS)
// ============================================================================
function mostrarMenuStatusEquipamento(e, idDoc) {
    let menuExistente = document.getElementById('custom-equip-menu');
    if (menuExistente) menuExistente.remove();

    const menu = document.createElement('div');
    menu.id = 'custom-equip-menu';
    menu.className = 'custom-context-menu';
    menu.innerHTML = `
        <div class="context-menu-item" data-status="Normal">
            <i class="fi fi-rr-check" style="color: #10b981;"></i> Normal
        </div>
        <div class="context-menu-item" data-status="Inoperante">
            <i class="fi fi-rr-cross" style="color: #ef4444;"></i> Inoperante
        </div>
    `;

    menu.style.top = `${e.pageY}px`;
    menu.style.left = `${e.pageX}px`;
    document.body.appendChild(menu);

    menu.querySelectorAll('.context-menu-item').forEach(item => {
        item.addEventListener('click', async (clickEvent) => {
            clickEvent.stopPropagation(); 
            const novoStatus = item.getAttribute('data-status');

            try {
                await databases.updateDocument(DB_ID, COL_EQUIPAMENTOS, idDoc, {
                    statusFuncionamento: novoStatus
                });
            } catch (error) {
                console.error("Erro ao atualizar status do equipamento:", error);
                alert("Não foi possível salvar o novo status.");
            }
            menu.remove(); 
        });
    });

    setTimeout(() => {
        const fecharMenuNeutro = () => {
            const menuParaDeletar = document.getElementById('custom-equip-menu');
            if (menuParaDeletar) menuParaDeletar.remove();
            document.removeEventListener('click', fecharMenuNeutro);
            document.removeEventListener('contextmenu', fecharMenuNeutro);
        };
        document.addEventListener('click', fecharMenuNeutro);
        document.addEventListener('contextmenu', fecharMenuNeutro);
    }, 20);
}

// ============================================================================
// 14. CONTROLADOR DOS BOTÕES DE FILTRO DE EQUIPAMENTOS (PILLS)
// ============================================================================
function configurarFiltrosEquipamentos() {
    const containerFiltros = document.querySelector('.equip-filters-row');
    if (!containerFiltros) return;

    containerFiltros.addEventListener('click', (e) => {
        const botaoClicado = e.target.closest('.btn-filter-equip');
        if (!botaoClicado || botaoClicado.classList.contains('active')) return;

        containerFiltros.querySelectorAll('.btn-filter-equip').forEach(btn => btn.classList.remove('active'));
        botaoClicado.classList.add('active');

        filtroStatusEquip = botaoClicado.getAttribute('data-status');
        vincularEquipamentos();
    });
}

// ============================================================================
// 15. ENGINE ATUALIZADO: ABAS DINÂMICAS + ATRIBUTO OBRIGATÓRIO REAL "estacaoId"
// ============================================================================
function abrirModalEdicaoPendencia(doc) {
    idPendenciaEmEdicao = doc.$id; 
    
    // Aloca os dados capturados do Appwrite na aba 1 (Editar) mapeando a chave estacaoId
    document.getElementById('pend-sigla-input').value = doc.estacaoId || doc.sigla || ""; 
    document.getElementById('pend-ordem-input').value = doc.ordem || "";
    document.getElementById('pend-status-input').value = doc.status || "Aberto";
    document.getElementById('pend-tipo-input').value = doc.tipo || "";
    document.getElementById('pend-sistema-input').value = doc.sistema || "";
    document.getElementById('pend-responsavel-input').value = doc.responsavel || "";
    document.getElementById('pend-relato-input').value = doc.relato || "";
    document.getElementById('pend-acao-input').value = doc.acao || "";
    document.getElementById('pend-desc-input').value = doc.descricao || doc.descritivo || "";

    // Ativa e força a exibição da aba de edição
    const tabEditar = document.getElementById('tab-btn-editar');
    if (tabEditar) {
        tabEditar.style.display = 'flex';
        tabEditar.click(); 
    }

    const overlay = document.getElementById('pend-modal-overlay');
    if (overlay) overlay.classList.add('aberto');
}

function configurarModalPendencia() {
    const overlay = document.getElementById('pend-modal-overlay');
    const btnFechar = document.getElementById('close-pend-modal');
    const btnAbrirAddGlobal = document.getElementById('btn-abrir-add-pend');
    
    const formEdit = document.getElementById('form-edit-pend');
    const formAdd = document.getElementById('form-add-pend');

    const tabEditar = document.getElementById('tab-btn-editar');
    const tabAdicionar = document.getElementById('tab-btn-adicionar');
    const paneEditar = document.getElementById('pane-edit-pend');
    const paneAdicionar = document.getElementById('pane-add-pend');

    if (!overlay) return;

    // GERENCIADOR DE ALTERNÂNCIA DE ABAS
    tabEditar.addEventListener('click', () => {
        if (!idPendenciaEmEdicao) return; 
        tabAdicionar.classList.remove('active');
        tabEditar.classList.add('active');
        paneAdicionar.classList.remove('active');
        paneEditar.classList.add('active');
    });

    tabAdicionar.addEventListener('click', () => {
        tabEditar.classList.remove('active');
        tabAdicionar.classList.add('active');
        paneEditar.classList.remove('active');
        paneAdicionar.classList.add('active');
    });

    const fecharModal = () => {
        overlay.classList.remove('aberto');
        idPendenciaEmEdicao = null;
        if (formEdit) formEdit.reset();
        if (formAdd) formAdd.reset();
    };

    if (btnFechar) btnFechar.addEventListener('click', fecharModal);
    
    document.querySelectorAll('.btn-fechar-modal-generic').forEach(btn => {
        btn.addEventListener('click', fecharModal);
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) fecharModal();
    });

    // GATILHO GLOBAL: Abertura direta do formulário de inserção limpo
    if (btnAbrirAddGlobal) {
        btnAbrirAddGlobal.addEventListener('click', () => {
            idPendenciaEmEdicao = null;
            if (formAdd) formAdd.reset();
            
            tabEditar.style.display = 'none'; 
            tabAdicionar.click();            
            overlay.classList.add('aberto');
        });
    }

    // FORMULÁRIO 1: SUBMIT DE ALTERAÇÃO (UPDATE)
    if (formEdit) {
        formEdit.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!idPendenciaEmEdicao) return;

            const siglaValor = document.getElementById('pend-sigla-input').value.trim().toUpperCase();

            const dataAtualizada = {
                sigla: siglaValor,
                estacaoId: siglaValor, // 🌟 Corrigido: Envia a chave exata 'estacaoId' com I maiúsculo para o Appwrite
                ordem: document.getElementById('pend-ordem-input').value.trim(),
                status: document.getElementById('pend-status-input').value,
                tipo: document.getElementById('pend-tipo-input').value.trim(),
                sistema: document.getElementById('pend-sistema-input').value.trim(),
                responsavel: document.getElementById('pend-responsavel-input').value.trim(),
                relato: document.getElementById('pend-relato-input').value.trim(),
                acao: document.getElementById('pend-acao-input').value.trim(),
                descricao: document.getElementById('pend-desc-input').value.trim(),
                modificado: new Date().toISOString()
            };

            try {
                await databases.updateDocument(DB_ID, COL_PENDENCIA_KPI, idPendenciaEmEdicao, dataAtualizada);
                fecharModal();
            } catch (error) {
                console.error("Erro Appwrite [Update]:", error);
                alert("Erro ao Atualizar Documento:\n" + error.message); 
            }
        });
    }

    // FORMULÁRIO 2: SUBMIT DE INSERÇÃO (CREATE)
    if (formAdd) {
        formAdd.addEventListener('submit', async (e) => {
            e.preventDefault();

            const siglaValorAdd = document.getElementById('add-pend-sigla-input').value.trim().toUpperCase();

            const novaPendencia = {
                sigla: siglaValorAdd,
                estacaoId: siglaValorAdd, // 🌟 Corrigido: Envia a chave exata 'estacaoId' com I maiúsculo para o Appwrite
                ordem: document.getElementById('add-pend-ordem-input').value.trim(),
                status: document.getElementById('add-pend-status-input').value,
                tipo: document.getElementById('add-pend-tipo-input').value.trim(),
                sistema: document.getElementById('add-pend-sistema-input').value.trim(),
                responsavel: document.getElementById('add-pend-responsavel-input').value.trim(),
                relato: document.getElementById('add-pend-relato-input').value.trim(),
                acao: document.getElementById('add-pend-acao-input').value.trim(),
                descricao: document.getElementById('add-pend-desc-input').value.trim(),
                linha: String(linhaAtiva), 
                criado: new Date().toISOString(),
                modificado: new Date().toISOString()
            };

            try {
                await databases.createDocument(DB_ID, COL_PENDENCIA_KPI, ID.unique(), novaPendencia);
                fecharModal();
            } catch (error) {
                console.error("Erro Appwrite [Create]:", error);
                alert("Erro ao Criar Nova OS:\n" + error.message); 
            }
        });
    }
}