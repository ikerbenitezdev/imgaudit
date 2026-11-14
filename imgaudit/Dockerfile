FROM node:22-slim
WORKDIR /app

# tini evita procesos zombi de Chromium; Chromium con sus dependencias del sistema
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN apt-get update && apt-get install -y --no-install-recommends tini ca-certificates fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund \
    && npx playwright install --with-deps chromium \
    && chmod -R a+rX /ms-playwright \
    && rm -rf /var/lib/apt/lists/* /root/.npm

COPY . .

# El analizador abre webs de terceros: se ejecuta sin privilegios de root
USER node
ENV NODE_ENV=production NODE_OPTIONS=--max-old-space-size=384
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["tini", "--"]
CMD ["node", "server.js"]
