# ═══════════════════════════════════════════════════════════════
# STAGE 1: Build React/Vite Application
# ═══════════════════════════════════════════════════════════════
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ═══════════════════════════════════════════════════════════════
# STAGE 2: Serve with Production Nginx Alpine
# ═══════════════════════════════════════════════════════════════
FROM nginx:alpine
WORKDIR /usr/share/nginx/html

# Clean default nginx files
RUN rm -rf ./*

# Copy built artifacts from stage 1
COPY --from=build /app/dist .

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
