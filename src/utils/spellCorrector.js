const fs = require("fs");
const path = require("path");
const Typo = require("typo-js");

// Resolve automaticamente o caminho do pacote
const dictionaryBasePath = path.dirname(
    require.resolve("dictionary-pt-br")
);

const affPath = path.join(dictionaryBasePath, "index.aff");
const dicPath = path.join(dictionaryBasePath, "index.dic");

const affData = fs.readFileSync(affPath, "utf-8");
const dicData = fs.readFileSync(dicPath, "utf-8");

const dictionary = new Typo("pt_BR", affData, dicData);

/**
 * Corrige ortografia básica usando Typo.js
 */
function correctText(text) {
    const words = text.split(/\b/);

    const corrected = words.map(word => {
        if (/^[a-zA-ZÀ-ÿ]+$/.test(word) && !dictionary.check(word)) {
            const suggestions = dictionary.suggest(word);
            return suggestions.length > 0 ? suggestions[0] : word;
        }
        return word;
    });

    return corrected.join("");
}

module.exports = { correctText };
