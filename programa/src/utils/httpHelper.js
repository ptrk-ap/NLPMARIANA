const https = require("https");

/**
 * Utilitário para realizar requisições HTTPS com tratamento de erro e timeout.
 */
function request(options, body = null, timeout = 600000) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode,
          body: buffer,
          headers: res.headers
        });
      });
    });

    req.on("error", (err) => {
      reject(new Error(`Erro na rede/HTTPS: ${err.message}`));
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Requisição excedeu o tempo limite de ${timeout}ms`));
    });

    // Configurar timeout
    req.setTimeout(timeout);

    if (body) {
      if (typeof body === "string" || Buffer.isBuffer(body)) {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }

    req.end();
  });
}

/**
 * Realiza uma requisição JSON e já trata o parse da resposta.
 */
async function jsonRequest(options, body = null, timeout = 600000) {
  try {
    const response = await request(options, body, timeout);

    // Se não houver corpo (204 No Content), retorna nulo
    if (response.statusCode === 204) return { statusCode: 204, data: null };

    let data;
    try {
      data = JSON.parse(response.body.toString());
    } catch (e) {
      // Se não for JSON, retorna o corpo como string
      data = response.body.toString();
    }

    return {
      statusCode: response.statusCode,
      data,
      headers: response.headers
    };
  } catch (error) {
    throw error;
  }
}

module.exports = {
  request,
  jsonRequest
};
