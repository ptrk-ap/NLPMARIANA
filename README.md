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
| `GET` | `/health` | Verifica a disponibilidade da API e a conectividade com o banco. |
| `POST` | `/consultar` | Processa e executa uma consulta orçamentária em linguagem natural. |
| `POST` | `/admin/*` | Executa rotinas administrativas de carga e manutenção de dados. |

### Exemplo de consulta (`POST /consultar`)

Envie um JSON contendo o campo `frase` (limite de 200 caracteres):

```json
{
  "frase": "empenhado na Secretaria de cultura em 2026"
}
```

A consulta deve conter pelo menos uma métrica de valor orçamentário (empenhado, liquidado, pago ou dotação) e opcionalmente dimensões/filtros como ano, órgão, etc.

## Motor de NLP e Filtros de Entidades

O sistema converte consultas em linguagem natural em queries SQL otimizadas sobre as tabelas do SIAFIC.

### Dimensões e Entidades Suportadas

- **Valores/Métricas:** Dotação inicial, dotação atualizada, despesas empenhadas, liquidadas e pagas.
- **Unidade Gestora (UG):** Reconhecimento por código (ex: `380101`), mnemônico/sigla (ex: `SECULT`, `SEED`, `SEFAZ`) ou descrição textual (ex: *"Secretaria de Cultura"*, *"Polícia Militar"*).
  - Inclui tratamento de *stopwords* institucionais (`estado`, `estadual`, `amapa`).
  - Utiliza threshold dinâmico com regras de sensibilidade para termos técnicos.
- **Unidade Orçamentária (UO):** Suporte a códigos e descrições das UOs.
- **Exercício e Período:** Suporte a anos (ex: `2024`, `2025`, `2026`), intervalos cronológicos e datas específicas.
- **Classificações Orçamentárias:** Função, Programa, Ação, Fonte de Recursos, Grupo de Despesa, Elemento e Natureza da Despesa.
- **Instrumentos e Parceiros:** Contratos, Convênios (despesa e receita), Emendas parlamentares e Credores (com suporte a CPF/CNPJ e busca fonética/textual).
- **Regras de Exclusão:** Suporte a termos negativos (ex: *"sem convênios"*, *"exceto saúde"*).

Proteja as rotas administrativas no proxy reverso ou no próprio aplicativo antes de expô-las à internet.

## Proxy reverso

Em produção, exponha o serviço por Nginx ou Caddy com HTTPS. Configure o monitoramento do proxy para consultar `GET /health`.
