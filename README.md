# Sistema de Consulta SIAFIC

Sistema Node.js para consultas em linguagem natural ao banco de dados SIAFIC.

## Requisitos

- Node.js (versão LTS recomendada)
- PostgreSQL acessível pela aplicação
- PM2 instalado globalmente no servidor de produção

## Configuração do ambiente

Crie `.env.production` a partir do modelo fornecido:

```bash
cp .env.example .env.production
```

| Variável | Descrição |
| --- | --- |
| `PORT` | Porta HTTP do serviço. |
| `DATABASE_URL` | String de conexão do PostgreSQL. |
| `API_USERNAME` | Usuário da API. |
| `API_PASSWORD` | Senha da API. |
| `TRIGGER_USERNAME` | Usuário empregado pelos gatilhos administrativos. |
| `TRIGGER_PASSWORD` | Senha empregada pelos gatilhos administrativos. |
| `DB_SSL` | Use `true` quando a conexão com o banco exigir SSL. |

Nunca envie `.env.production` ao repositório.

## Execução local

```bash
npm install
npm start
```

Para desenvolvimento com reinício automático:

```bash
npm run dev
```

## Endpoints principais

| Método | Rota | Finalidade |
| --- | --- | --- |
| `GET` | `/health` | Verifica a disponibilidade da API e do banco. |
| `POST` | `/consultar` | Executa uma consulta em linguagem natural. |
| `POST` | `/admin/*` | Executa rotinas administrativas de carga e manutenção. |

Proteja as rotas administrativas no proxy reverso ou no próprio aplicativo antes de expô-las à internet.

## Produção com PM2

Instale as dependências da aplicação:

```bash
npm ci --omit=dev
```

Inicie o serviço com o perfil de produção:

```bash
pm2 start ecosystem.config.js --env production
```

O processo registrado chama-se `portal-web`. A configuração inicia três instâncias em cluster, reinicia processos que falhem e limita cada processo a 500 MB de memória.

Após confirmar que o serviço iniciou corretamente, registre o estado atual do PM2:

```bash
pm2 save
```

Para recarregar após alterações de código ou de ambiente:

```bash
pm2 reload ecosystem.config.js --env production --update-env
```

## Logs e operação

Os logs são mantidos pelo PM2 em `~/.pm2/logs` no usuário que executa o serviço. Habilite a rotação uma vez por servidor:

```bash
pm2 install pm2-logrotate
```

Comandos úteis:

```bash
pm2 status
pm2 logs portal-web
pm2 monit
```

## Proxy reverso

Em produção, exponha o serviço por Nginx ou Caddy com HTTPS. Configure o monitoramento do proxy para consultar `GET /health`.
