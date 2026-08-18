# Imagem de desenvolvimento. O código fica montado por volume (ver compose.yaml),
# de modo que editar no host recarrega no container sem rebuild.
FROM node:22-alpine

WORKDIR /app

# Copiamos apenas os manifestos primeiro para aproveitar o cache de camadas:
# enquanto package.json não mudar, o npm ci não roda de novo.
COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 5173

# --host expõe o servidor fora do container.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
