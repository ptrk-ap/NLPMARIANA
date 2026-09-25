/**
 * iniciarAuxiliares.js
 *
 * Cria e popula as tabelas auxiliares:
 * - contratos
 * - emendas
 * - credor
 *
 * As fontes são as tabelas de execução de 2025 e 2026.
 */

require("dotenv").config();

const { populateContratos } = require("./populateContratos");
const { populateEmendas } = require("./populateEmendas");
const { populateCredores } = require("./populateCredores");

async function iniciarAuxiliares() {
    console.log("==============================================");
    console.log("     INICIALIZAÇÃO DAS TABELAS AUXILIARES");
    console.log("==============================================\n");

    try {
        console.log("Iniciando população das tabelas auxiliares...\n");

        const resultados = await Promise.allSettled([
            populateContratos(),
            populateEmendas(),
            populateCredores(),
        ]);

        const nomes = [
            "contratos",
            "emendas",
            "credor",
        ];

        let houveErro = false;

        resultados.forEach((resultado, index) => {
            const nome = nomes[index];

            if (resultado.status === "fulfilled") {
                console.log(
                    `\n✅ Tabela '${nome}' processada com sucesso.`
                );
            } else {
                houveErro = true;

                console.error(
                    `\n❌ Erro ao processar a tabela '${nome}':`
                );
                console.error(resultado.reason);
            }
        });

        console.log("\n==============================================");

        if (houveErro) {
            console.error(
                "❌ A inicialização das tabelas auxiliares terminou com erros."
            );
            process.exitCode = 2;
        } else {
            console.log(
                "✅ Todas as tabelas auxiliares foram processadas com sucesso."
            );
            process.exitCode = 0;
        }

        console.log("==============================================\n");

    } catch (error) {
        console.error("\n❌ ERRO INESPERADO:");
        console.error(error);

        process.exitCode = 1;
    }
}

iniciarAuxiliares();