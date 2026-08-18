const credorService = require('./services/filtros/credorService');

async function test() {
    const s = new credorService();
    const res = await s.extrair("credor delma do carmo");
    console.log("Result:", res);
    process.exit(0);
}
test();
