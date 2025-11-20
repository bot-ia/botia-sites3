# Etapa 1: Construcción
FROM node:20-alpine as build

WORKDIR /app

# Copiamos archivos de dependencias
COPY package*.json ./
RUN npm install

# Copiamos el código y construimos
COPY . .
RUN npm run build

# Etapa 2: Servidor Nginx
FROM nginx:alpine

# Copiamos configuración de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiamos TODO el resultado del build a una carpeta temporal para inspeccionarla
COPY --from=build /app/dist /tmp/dist

# --- MAGIA AUTOMÁTICA ---
# Este comando busca el archivo 'index.html' donde quiera que esté
# y mueve todo el contenido de esa carpeta a la carpeta pública de Nginx.
# También imprime qué carpeta encontró para que lo veas en los logs si es necesario.
RUN echo "Buscando el build de Angular..." && \
    encontrado=$(find /tmp/dist -name index.html | head -n 1) && \
    if [ -z "$encontrado" ]; then \
        echo "ERROR CRÍTICO: No se encontró index.html en /tmp/dist. Listando contenido:"; \
        ls -R /tmp/dist; \
        exit 1; \
    fi && \
    carpeta_origen=$(dirname "$encontrado") && \
    echo "Build encontrado en: $carpeta_origen" && \
    cp -r "$carpeta_origen"/* /usr/share/nginx/html/ && \
    rm -rf /tmp/dist

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]