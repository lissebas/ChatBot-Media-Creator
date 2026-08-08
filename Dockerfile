# ChatBot Creator — imagen de desarrollo. Todo (Node, npm, dependencias) vive dentro
# del contenedor; nada se instala en la máquina del usuario.
FROM node:20-alpine

WORKDIR /app

# Instala dependencias primero (capa cacheable). Si no hay package-lock aún,
# `npm install` lo genera dentro del contenedor.
COPY package.json ./
RUN npm install

# El código se monta por volumen en docker-compose (hot-reload). En build de
# producción se copiaría aquí.
EXPOSE 5173

CMD ["npm", "run", "dev"]
