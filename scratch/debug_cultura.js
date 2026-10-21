/**
 * Debug detalhado: por que "Secretaria de Cultura" não é encontrada
 */
const UgService = require("../src/services/filtros/ugService");

const ugService = new UgService();
const dados2026 = ugService.dadosPorAno["2026"];

// A descrição completa é "SECRETARIA DE ESTADO DA CULTURA"
// Os tokens (len > 3) seriam: "secretaria", "estado", "cultura" 
// Mas "estado" e "estadual" são STOPWORDS!
// Então os tokens indexados da UG seriam apenas: "secretaria", "cultura"

// Frase do usuário: "empenhado na Secretaria de Cultura em 2026"
// Normalizado: "empenhado na secretaria de cultura em 2026"
// Sem stopwords (estado, estadual): permanece igual (pois "estado" não aparece na frase)
// Tokens com len > 3: "empenhado", "secretaria", "cultura", "2026"

// Tokens da UG "SECRETARIA DE ESTADO DA CULTURA" (len > 3):
const tokensUg = dados2026.tokensPorUnidade.get("380101");
console.log("Tokens indexados da SECULT:", tokensUg);

// Tokens da frase
const frase = "empenhado na secretaria de cultura em 2026";
const normalize = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/g, "").trim();
const STOPWORDS = new Set(["estado", "estadual"]);
const removeStopwords = (t) => t.split(/\s+/).filter(p => !STOPWORDS.has(p)).join(" ");

const textoNorm = removeStopwords(normalize(frase));
const tokensFrase = new Set(textoNorm.split(/\s+/).filter(p => p.length > 3));
console.log("Tokens da frase (len > 3):", [...tokensFrase]);

// Verificar interseção
const hits = tokensUg.filter(t => tokensFrase.has(t));
console.log("Hits (tokens em comum):", hits);
console.log("Total tokens UG:", tokensUg.length, "| Hits:", hits.length);
console.log("Percentual:", (hits.length / tokensUg.length).toFixed(2));
console.log("Percentual mínimo padrão: 0.90");
console.log("Match?", (hits.length / tokensUg.length) >= 0.9 ? "SIM" : "NÃO");

// Agora verificar com sensibilidade reduzida
console.log("\nCom sensibilidade 0.6 (se 'unidade_gestora' estivesse no texto):");
console.log("Match?", (hits.length / tokensUg.length) >= 0.6 ? "SIM" : "NÃO");
