const fs = require('fs');
const path = require('path');

const targetServices = [
    'categoriadespesaService.js',
    'conveniodespesaService.js',
    'convenioreceitaService.js',
    'eixoService.js',
    'elementoService.js',
    'fonteService.js',
    'funcaoService.js',
    'grupodespesaService.js',
    'naturezaService.js',
    'odsService.js',
    'poderService.js',
    'programaService.js',
    'ugService.js',
    'uoService.js'
];

const dir = path.join(__dirname, 'src', 'services', 'filtros');

for (const file of targetServices) {
    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) continue;

    let content = fs.readFileSync(filePath, 'utf8');
    console.log(`Processando ${file}...`);

    // Extract basic info
    const csvMatch = content.match(/const caminhoCsv = path\.join\([^,]+, [^,]+, [^,]+, [^,]+, [^,]+, "([^"]+)"\);/);
    if (!csvMatch) {
        console.log(`Skipping ${file} - no caminhoCsv`);
        continue;
    }
    const csvFileName = csvMatch[1];

    // Identify class name
    const classMatch = content.match(/class\s+([A-Za-z0-9_]+)\s*\{/);
    if (!classMatch) continue;
    const className = classMatch[1];

    // Find the constructor content
    const constructorMatch = content.match(/constructor\(\)\s*\{([\s\S]*?)\}\s*\/\*\*/);
    if (!constructorMatch) {
        console.log(`Skipping ${file} - no constructor match`);
        continue;
    }
    let constructorBody = constructorMatch[1];

    // Find item array name (e.g. this.fontes)
    const itemArrayMatch = constructorBody.match(/this\.([a-zA-Z0-9_]+)\s*=\s*this\.carregarCsv\(caminhoCsv\);/);
    if (!itemArrayMatch) {
        console.log(`Skipping ${file} - no carregarCsv`);
        continue;
    }
    const itemArrayName = itemArrayMatch[1]; // e.g. "fontes"
    
    // Find singular name in the loop (e.g. "fonte" from "for (const fonte of this.fontes)")
    const loopMatch = constructorBody.match(new RegExp(`for\\s*\\(\\s*const\\s+([a-zA-Z0-9_]+)\\s+of\\s+this\\.${itemArrayName}\\s*\\)`));
    const singularName = loopMatch ? loopMatch[1] : 'item';

    // Find tokensPorX name
    const tokensPorXMatch = constructorBody.match(/this\.([a-zA-Z0-9_]+)\s*=\s*new Map\(\);/g);
    // Usually it's this.indiceDescricao and this.tokensPor...
    let tokensMapName = 'tokensPorItem';
    if (tokensPorXMatch) {
        for (const match of tokensPorXMatch) {
            if (match.includes('tokensPor')) {
                tokensMapName = match.match(/this\.([a-zA-Z0-9_]+)/)[1];
            }
        }
    }

    // Extract the token filter logic
    const filterMatch = constructorBody.match(/\.filter\((.*?)\);/);
    const tokenFilter = filterMatch ? filterMatch[1] : 'p => p.length > 3';

    // --- Build new constructor and _carregarParaAno ---
    const newConstructor = `
    constructor() {
        const anos = ["2024", "2025", "2026"];
        this.dadosPorAno = {};
        const pastaBase = path.join(__dirname, "..", "..", "data", "entidades");

        for (const ano of anos) {
            const caminho = path.join(pastaBase, ano, "${csvFileName}");
            if (!fs.existsSync(caminho)) {
                const caminhoPadrao = path.join(pastaBase, "${csvFileName}");
                if (fs.existsSync(caminhoPadrao)) {
                    this._carregarParaAno(ano, caminhoPadrao);
                }
                continue;
            }
            this._carregarParaAno(ano, caminho);
        }
    }

    _carregarParaAno(ano, caminho) {
        const ${itemArrayName} = this.carregarCsv(caminho);
        const mapaPorCodigo = new Map(${itemArrayName}.map(x => [x.codigo, x]));
        const indiceDescricao = new Map();
        const ${tokensMapName} = new Map();

        for (const ${singularName} of ${itemArrayName}) {
            const tokens = normalize(${singularName}.descricao)
                .split(/\\s+/)
                .filter(${tokenFilter});

            ${tokensMapName}.set(${singularName}.codigo, tokens);

            for (const token of tokens) {
                if (!indiceDescricao.has(token)) {
                    indiceDescricao.set(token, []);
                }
                indiceDescricao.get(token).push(${singularName});
            }
        }

        this.dadosPorAno[ano] = { ${itemArrayName}, mapaPorCodigo, indiceDescricao, ${tokensMapName} };
    }
`;

    // Replace constructor
    content = content.replace(/constructor\(\)\s*\{[\s\S]*?\}\s*(?=\/\*\*)/, newConstructor + '\n    ');

    // --- Now replace extrair() method ---
    // Look for the extrair method signature
    content = content.replace(/extrair\(\s*frase\s*\)\s*\{/, 'extrair(frase, anosSolicitados = []) {');

    // Replace "this.mapaPorCodigo" with "dadosAno.mapaPorCodigo"
    content = content.replace(/this\.mapaPorCodigo/g, 'dadosAno.mapaPorCodigo');
    
    // Replace "this.indiceDescricao" with "dadosAno.indiceDescricao"
    content = content.replace(/this\.indiceDescricao/g, 'dadosAno.indiceDescricao');
    
    // Replace "this.tokensPor..." with "dadosAno.tokensPor..."
    content = content.replace(new RegExp(`this\\.${tokensMapName}`, 'g'), `dadosAno.${tokensMapName}`);

    // Insert the year loop wrapping the search logic.
    // The search logic usually starts after setting up `resultados` and `encontrados` and normalizes text.
    // Let's find a good insertion point. Usually it's right before `const codigos = frase.match(...)` or `const percentualMinimo = ...`
    
    // First, let's inject the year setup at the beginning of extrair
    const yearSetup = `
        if (!anosSolicitados || anosSolicitados.length === 0) {
            anosSolicitados = [new Date().getFullYear().toString()];
        } else {
            anosSolicitados = anosSolicitados.map(a => a.toString());
        }

        const resultadosFinais = [];
        const encontradosGlobais = new Set();
        
        for (const ano of anosSolicitados) {
            const dadosAno = this.dadosPorAno[ano];
            if (!dadosAno) continue;
            
            // Variáveis locais para o algoritmo original
            const encontrados = encontradosGlobais;
            const resultados = resultadosFinais;
`;
    // We will replace the original initialization of resultados/encontrados
    content = content.replace(/const resultados = \[\];\s*const encontrados = new Set\(\);/, yearSetup);

    // We need to close the `for (const ano of anosSolicitados)` loop right before the final `return resultados;`
    content = content.replace(/return resultados;\s*\}/, '}\n        return resultadosFinais;\n    }');

    // Special cases where the method had early returns (like `if (temPrograma) return resultados;`)
    // We change them to `continue` since they are now inside a year loop.
    content = content.replace(/return resultados;/g, 'continue;');
    // Restore the final return
    content = content.replace(/continue;\s*\}\s*return resultadosFinais;/, 'return resultadosFinais;\n    }');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Atualizado ${file}`);
}
