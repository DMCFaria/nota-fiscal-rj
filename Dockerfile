# Estágio 1: Build
FROM node:18-alpine AS build-stage

WORKDIR /app

# Copia arquivos de dependências
COPY package*.json ./
RUN npm install

# Copia o restante do código e gera o build
COPY . .
RUN npm run build

# Estágio 2: Produção (Servindo com Nginx)
FROM nginx:stable-alpine

COPY --from=build-stage /app/dist /usr/share/nginx/html

# ATENÇÃO: Descomente e garanta que o arquivo nginx.conf existe na raiz
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]