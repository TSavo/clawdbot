FROM node:22-bookworm

# Install Bun (required for build scripts)
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

RUN corepack enable

WORKDIR /app

# Install minimal system dependencies (ffmpeg and python3 will be installed by plugin system)
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      curl \
      git \
      ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

# Create voice model cache directory (plugin will populate on first run)
RUN mkdir -p /app/.cache/whisper /app/models/tts-kokoro && \
    chmod 777 /app/.cache/whisper /app/models/tts-kokoro

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY ui/package.json ./ui/package.json
COPY patches ./patches
COPY scripts ./scripts

RUN pnpm install

COPY . .

# Include speech-plugins extension in the build if it exists
# This enables TTS and STT plugins (Whisper, Kokoro, etc.)
RUN if [ -d "extensions/speech-plugins" ]; then \
      echo "Found speech-plugins extension, including in build..."; \
    fi

RUN pnpm build
RUN pnpm ui:install
RUN pnpm ui:build

# Voice provider configuration is set via environment variables in docker-compose
# Whisper (STT) and Kokoro (TTS) enabled in system mode by default

# Create application user (non-root) for security
RUN useradd -m -u 1000 node || true
USER node

ENV NODE_ENV=production

# Health check for the gateway daemon
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:18789/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))" || exit 1

CMD ["node", "dist/index.js"]
