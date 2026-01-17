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
COPY extensions ./extensions

RUN pnpm install

COPY . .

# Include speech-plugins extension in the build if it exists
# This enables TTS and STT plugins (Whisper, Kokoro, etc.)
RUN if [ -d "extensions/speech-plugins" ]; then \
      echo "Found speech-plugins extension, including in build..."; \
    fi

RUN pnpm build

# Build workspace packages (extensions)
RUN if [ -d "extensions/speech-plugins" ]; then \
      echo "Building speech-plugins extension..."; \
      cd extensions/speech-plugins && pnpm build && cd ../../; \
    fi

RUN pnpm ui:install
RUN pnpm ui:build

# Voice provider configuration is set via environment variables in docker-compose
# Whisper (STT) and Kokoro (TTS) enabled in system mode by default

ENV NODE_ENV=production

# Health check for the gateway daemon
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -sf http://localhost:18789/ || exit 1

# Create application user (non-root) for security
RUN useradd -m -u 1000 node || true && \
    apt-get update && apt-get install -y sudo && apt-get clean && rm -rf /var/lib/apt/lists/* && \
    echo 'node ALL=(ALL) NOPASSWD: /usr/bin/apt-get' >> /etc/sudoers.d/node && \
    chmod 440 /etc/sudoers.d/node

USER node

CMD ["node", "dist/index.js", "gateway-daemon", "--bind", "lan", "--port", "18789"]
