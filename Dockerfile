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

# Copia os arquivos do build para a pasta do Nginx
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Copia uma configuração customizada do Nginx (opcional, mas recomendada)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]