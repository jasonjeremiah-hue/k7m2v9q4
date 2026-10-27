FROM node:22-alpine AS frontend
WORKDIR /build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate && pnpm install --frozen-lockfile
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN pnpm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN useradd --create-home --uid 10001 aeris
COPY --from=frontend /build/dist ./dist
COPY backend ./backend
COPY data ./data
USER aeris
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/api/health',timeout=3)" || exit 1
CMD ["python", "-m", "backend.server", "--host", "0.0.0.0", "--port", "8080"]
