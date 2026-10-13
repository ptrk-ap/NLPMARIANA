# Stage 1: Dependências e Build (se houver)
FROM node:20-alpine AS builder

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de dependência
COPY package*.json ./

# Instala as dependências (incluindo devDependencies, caso necessário para build)
RUN npm ci

# Copia o restante do código da aplicação
COPY . .

# Se houver script de build (ex: TypeScript ou transpilação), descomente a linha abaixo
# RUN npm run build

# Stage 2: Imagem de Produção
FROM node:20-alpine

WORKDIR /app

# Copia apenas os arquivos necessários para instalar as dependências de produção
COPY package*.json ./

# Instala apenas as dependências de produção para reduzir o tamanho da imagem
RUN npm ci --only=production

# Copia o código da aplicação do estágio anterior (ajuste as pastas conforme necessário)
COPY --from=builder /app/src ./src
COPY --from=builder /app/*.js ./
# Se houver outras pastas necessárias, adicione-as aqui

# Define o ambiente como produção
ENV NODE_ENV=production

# Expõe a porta que a aplicação irá rodar
EXPOSE 3000

# Comando para iniciar a aplicação (ajuste o arquivo de entrada conforme o seu projeto)
CMD ["node", "src/server.js"]
