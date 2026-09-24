const readline = require('readline');
const http = require('http');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const PORT = process.env.PORT || 3000;
const URL = `http://localhost:${PORT}/consultar`;

function perguntar() {
    rl.question('\nVocê: ', (frase) => {
        if (frase.toLowerCase() === 'sair' || frase.toLowerCase() === 'exit') {
            console.log('Encerrando chat...');
            rl.close();
            return;
        }

        if (!frase.trim()) {
            perguntar();
            return;
        }

        const data = JSON.stringify({ frase: frase });

        const options = {
            hostname: 'localhost',
            port: PORT,
            path: '/consultar',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = http.request(options, (res) => {
            let body = '';

            res.on('data', (chunk) => {
                body += chunk;
            });

            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (parsed.whatsapp) {
                        console.log(`\nBot:\n${parsed.whatsapp}`);
                    } else if (parsed.erro) {
                        console.log(`\nErro: ${parsed.erro}`);
                        if (parsed.mensagem) console.log(`Mensagem: ${parsed.mensagem}`);
                    } else if (parsed.mensagem) {
                        console.log(`\nBot: ${parsed.mensagem}`);
                    } else {
                        console.log(`\nBot Resposta Bruta: ${body}`);
                    }
                } catch (e) {
                    console.log(`\nBot (Não-JSON): ${body}`);
                }
                perguntar();
            });
        });

        req.on('error', (e) => {
            console.error(`\nErro ao conectar com a API: ${e.message}`);
            console.log('Certifique-se de que o servidor está rodando (ex: npm start ou npm run dev).');
            perguntar();
        });

        req.write(data);
        req.end();
    });
}

console.log('=== Chat Console - NLPMARIANA ===');
console.log('Digite "sair" ou "exit" para encerrar.');
console.log('=================================');
perguntar();
