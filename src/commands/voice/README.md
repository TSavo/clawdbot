# Voice CLI Commands

Voice provider operations for speech-to-text (STT) and text-to-speech (TTS) via the command line.

## Overview

The voice CLI provides five main command groups:

- **transcribe**: Convert audio files to text
- **synthesize**: Convert text to audio (speech synthesis)
- **config**: Manage provider configuration
- **provider**: List and test available providers
- **channel**: Manage voice channels (Discord-style audio rooms)

## Installation

Ensure voice providers are configured:

```bash
clawdbot configure voice
```

## Usage

### Transcribe Audio

Convert audio files to text using configured STT providers.

```bash
# Basic transcription
clawdbot voice transcribe --file audio.wav

# Specify provider
clawdbot voice transcribe --file audio.wav --provider whisper

# Specify language
clawdbot voice transcribe --file audio.wav --language en

# JSON output
clawdbot voice transcribe --file audio.wav --format json

# Verbose output (includes confidence, language, etc.)
clawdbot voice transcribe --file audio.wav --verbose
```

**Supported audio formats**: WAV, MP3, FLAC, OGG, M4A, AAC, WMA

**Output**: Text of transcribed content

### Synthesize Speech

Convert text to audio using configured TTS providers.

```bash
# Basic synthesis
clawdbot voice synthesize --text "Hello world"

# Specify provider
clawdbot voice synthesize --text "Hello world" --provider kokoro

# Specify voice
clawdbot voice synthesize --text "Hello world" --voice en_us

# Save to file
clawdbot voice synthesize --text "Hello world" --output speech.wav

# Adjust speech speed
clawdbot voice synthesize --text "Hello world" --speed 1.5

# Read from stdin
echo "Hello world" | clawdbot voice synthesize

# Specify language
clawdbot voice synthesize --text "Hola mundo" --language es
```

**Input**: Text (via `--text` or stdin)

**Output**: WAV audio file

### Configuration

Manage voice provider settings and defaults.

```bash
# List all configured providers
clawdbot voice config --list

# Set default STT provider
clawdbot voice config --set-default-stt whisper

# Set default TTS provider
clawdbot voice config --set-default-tts kokoro

# Show deployment configuration
clawdbot voice config --show-deployment

# Edit provider settings
clawdbot voice config --edit myProvider
```

**Default action** (no args): Shows configuration summary

### Provider Management

List and test voice providers.

```bash
# List available providers
clawdbot voice provider --list

# Show provider status
clawdbot voice provider --status

# Test a specific provider
clawdbot voice provider --test --provider whisper

# Verbose output
clawdbot voice provider --status --verbose
```

**Provider Types**:

**Local STT**:
- Whisper: OpenAI Whisper (CPU-based)
- Faster-Whisper: Optimized Whisper fork

**Cloud STT**:
- OpenAI Whisper API
- Google Cloud Speech-to-Text
- Azure Speech Services

**Local TTS**:
- Kokoro: Fast, high-quality local TTS
- Piper: Offline TTS with multiple voices

**Cloud TTS**:
- ElevenLabs
- Google Cloud Text-to-Speech
- Azure Speech Services
- OpenAI TTS

### Voice Channels

Create and manage voice channels for multi-party audio communication.

```bash
# Create a voice channel
clawdbot voice channel --create myroom

# Create with max participants
clawdbot voice channel --create myroom --max-participants 8

# List all channels
clawdbot voice channel --list

# Add participant to channel
clawdbot voice channel --add myroom --participant user123

# Remove participant
clawdbot voice channel --remove myroom --participant user123

# Show channel status
clawdbot voice channel --status myroom

# Delete channel
clawdbot voice channel --delete myroom
```

**Channel Features**:
- Multi-party audio mixing
- Participant management
- Real-time transcription per participant
- Audio level mixing and muting
- Channel statistics and active speaker detection

## Configuration

Voice providers are configured in `~/.clawdbot/config.yaml`:

```yaml
voice:
  providers:
    enabled: true
    providers:
      - id: whisper-local
        enabled: true
        priority: 1
        stt:
          type: whisper
          modelSize: base
      - id: kokoro-local
        enabled: true
        priority: 1
        tts:
          type: local
          model: kokoro
          voice: af
```

## Examples

### Transcribe and Display

```bash
clawdbot voice transcribe --file meeting.wav --verbose
```

Output:
```
Transcription:
──────────────────────────────────────────────────
Welcome to the meeting. Let's discuss the Q4 roadmap.
──────────────────────────────────────────────────

Metadata:
  Confidence: 94.2%
  Language: en
  Duration: 5.2s
  Provider: whisper-local
  Processing: 2.1s
```

### Batch Transcription

```bash
for file in *.wav; do
  clawdbot voice transcribe --file "$file" --format json >> results.jsonl
done
```

### Create Multi-Party Channel

```bash
# Create channel
clawdbot voice channel --create standup

# Add participants
clawdbot voice channel --add standup --participant alice
clawdbot voice channel --add standup --participant bob
clawdbot voice channel --add standup --participant charlie

# Monitor
clawdbot voice channel --status standup
```

### Synthesize with Specific Voice

```bash
clawdbot voice synthesize \
  --text "Welcome to our AI assistant" \
  --provider kokoro \
  --voice af \
  --output welcome.wav
```

## Error Handling

**No providers configured**:
```
Voice providers not configured. Run "clawdbot configure voice" first.
```

**Provider not found**:
```
Provider not found: whisper
```

**Audio file not found**:
```
Audio file not found or unsupported format: audio.wav
```

**Text exceeds limit**:
```
Text exceeds maximum length of 5000 characters
```

## Performance

- **Transcription latency**: 0.5-5s depending on provider and audio length
- **Synthesis latency**: 0.1-2s depending on provider and text length
- **Channel capacity**: Up to 16 participants per channel by default
- **Concurrent sessions**: Provider-dependent

## Advanced

### Use in Scripts

```bash
#!/bin/bash

# Transcribe audio and extract key phrases
TRANSCRIPTION=$(clawdbot voice transcribe --file audio.wav --format json | jq -r .text)

# Synthesize response
clawdbot voice synthesize --text "Processing: $TRANSCRIPTION" --output response.wav

# Play response
ffplay response.wav
```

### Provider Testing

```bash
# Test all providers
clawdbot voice provider --list | grep "✓" | while read provider; do
  echo "Testing $provider..."
  clawdbot voice provider --test --provider "$provider"
done
```

## Troubleshooting

### Provider Health Check

```bash
clawdbot voice provider --status
```

### Configuration Verification

```bash
clawdbot voice config --show-deployment
```

### Test Provider Capabilities

```bash
clawdbot voice provider --test --provider whisper
```

## File Structure

```
src/commands/voice/
├── helpers.ts           # Shared utilities
├── transcribe.ts        # Transcribe command
├── synthesize.ts        # Synthesize command
├── config.ts            # Config management command
├── provider.ts          # Provider management command
├── channel.ts           # Voice channel command
└── index.ts             # Export index
```

## See Also

- Configuration: `clawdbot configure voice`
- Main program: See `/src/cli/program/register.voice.ts`
- Voice orchestration: `src/media/voice-providers/`
- Voice channels: `src/media/voice-channels/`
