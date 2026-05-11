# --- ETAPA 1: Construcción del Frontend ---
FROM node:20-alpine AS build-stage

# Establecer directorio de trabajo para el frontend
WORKDIR /app/frontend

# Copiar archivos de dependencias e instalar
COPY frontend/package*.json ./
RUN npm install

# Copiar el resto del código del frontend y compilar
COPY frontend/ ./
RUN npm run build

# --- ETAPA 2: Configuración del Servidor Backend ---
FROM node:20-alpine

# Establecer directorio de trabajo para el servidor
WORKDIR /app

# Copiar dependencias del backend e instalar (solo producción)
COPY backend/package*.json ./
RUN npm install --production

# Copiar el código del servidor
COPY backend/server.js ./

# Copiar los archivos compilados del frontend (dist) a la carpeta public del backend
# Vite genera por defecto una carpeta llamada 'dist'
COPY --from=build-stage /app/frontend/dist ./public

# Exponer el puerto que configuramos en server.js
EXPOSE 8080

# Comando para arrancar la aplicación
CMD ["node", "server.js"]