const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

// caminho fixo do CSV
const CSV_PATH = path.resolve(__dirname, "../data/entidades/listaTitulo.csv");

// leitura do CSV → retorna array de frases
function carregarFrases() {
    return new Promise((resolve, reject) => {
        const frases = [];

        fs.createReadStream(CSV_PATH)
            .pipe(csv())
            .on("data", (row) => {
                // pega o único valor da linha (1 coluna)
                const valor = Object.values(row)[0];
                if (valor) frases.push(valor);
            })
            .on("end", () => resolve(frases))
            .on("error", reject);
    });
}

module.exports = carregarFrases;
