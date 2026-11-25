# ═══════════════════════════════════════════════════════════════
# 1. Web arayüzünü derle (React + Vite)
# ═══════════════════════════════════════════════════════════════
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY index.html vite.config.js tsconfig.json ./
COPY public ./public
COPY src ./src

# Göreli adres: API ve WebSocket aynı kökenden (Nginx ters proxy) sunulur, CORS gerekmez
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ═══════════════════════════════════════════════════════════════
# 2. Nginx ile sun
# ═══════════════════════════════════════════════════════════════
FROM nginx:1.27-alpine
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist /usr/share/nginx/html
# Arka uç adresi ortam değişkeninden: docker compose'da http://backend:8080, Render vb. platformda servis adresi
COPY nginx.conf /etc/nginx/templates/default.conf.template
ENV BACKEND_HOSTPORT=backend:8080

EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget -qO- http://localhost/ > /dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
