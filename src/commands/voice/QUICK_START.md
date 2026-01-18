# Voice CLI Quick Start

## Installation & Setup

```bash
# Configure voice providers (one-time setup)
clawdbot configure voice

# Verify providers are set up
clawdbot voice provider --status
```

## Common Tasks

### Convert Audio to Text

```bash
# Transcribe a recording
clawdbot voice transcribe --file meeting.wav

# Get JSON output for processing
clawdbot voice transcribe --file meeting.wav --format json

# Specify language
clawdbot voice transcribe --file spanish_audio.wav --language es

# Show all details
clawdbot voice transcribe --file audio.wav --verbose
```

### Generate Speech from Text

```bash
# Create audio from text
clawdbot voice synthesize --text "Hello world" --output greeting.wav

# Use a specific voice
clawdbot voice synthesize --text "Hello" --voice af --output hello.wav

# Adjust speed
clawdbot voice synthesize --text "Please speak slowly" --speed 0.8

# Process stdin
echo "Welcome to the system" | clawdbot voice synthesize --output welcome.wav
```

### Manage Configuration

```bash
# List all providers
clawdbot voice config --list

# Set default transcription provider
clawdbot voice config --set-default-stt whisper

# Set default synthesis provider
clawdbot voice config --set-default-tts kokoro

# Show system setup
clawdbot voice config --show-deployment
```

### Check Provider Status

```bash
# List available providers
clawdbot voice provider --list

# Check current status
clawdbot voice provider --status

# Test a provider
clawdbot voice provider --test --provider whisper
```

### Create Voice Channels

```bash
# Create a new channel
clawdbot voice channel --create my-meeting

# Add people to channel
clawdbot voice channel --add my-meeting --participant alice
clawdbot voice channel --add my-meeting --participant bob

# Check who's in channel
clawdbot voice channel --status my-meeting

# Remove participant
clawdbot voice channel --remove my-meeting --participant alice

# Clean up
clawdbot voice channel --delete my-meeting
```

## Useful Patterns

### Batch Processing

```bash
# Transcribe all WAV files
for file in *.wav; do
  echo "Processing: $file"
  clawdbot voice transcribe --file "$file" --format json | \
    jq '.text' >> transcripts.txt
done
```

### Scripting

```bash
#!/bin/bash

# Transcribe → Process → Synthesize

TEXT=$(clawdbot voice transcribe --file input.wav --format json | jq -r .text)
RESPONSE="You said: $TEXT"

clawdbot voice synthesize --text "$RESPONSE" --output response.wav
```

### Monitoring

```bash
# Watch provider health
while true; do
  clear
  clawdbot voice provider --status
  sleep 5
done
```

## Troubleshooting

### "No voice providers configured"
```bash
clawdbot configure voice
```

### Provider is unhealthy
```bash
# Check what's wrong
clawdbot voice provider --test --provider whisper

# Check system requirements
clawdbot voice provider --list
```

### Audio file not found
```bash
# Make sure path is correct
ls -la audio.wav

# Use absolute path if needed
clawdbot voice transcribe --file /full/path/to/audio.wav
```

### Text too long
```bash
# Max 5000 characters; split if needed
head -c 5000 myfile.txt | clawdbot voice synthesize
```

## Tips & Tricks

- Use `--verbose` for debugging and detailed output
- Set `--format json` for machine-readable output
- Use `--speed 1.5` to make synthesis faster or `0.8` for slower
- Providers are tried in priority order; set defaults with `config --set-default-*`
- Channel operations are in-memory (lost on restart)

## Getting Help

```bash
# Show all voice commands
clawdbot voice --help

# Help for specific command
clawdbot voice transcribe --help
clawdbot voice synthesize --help
clawdbot voice config --help
clawdbot voice provider --help
clawdbot voice channel --help
```

## File Locations

- **Config**: `~/.clawdbot/config.yaml`
- **Output audio**: Current directory by default
- **Logs**: Run with `--verbose` for details

## Performance Expectations

| Operation | Typical Time |
|-----------|------------|
| Transcribe (10s audio) | 1-5 seconds |
| Synthesize (10 words) | 0.5-2 seconds |
| Provider health check | ~100ms |
| Channel creation | <10ms |

## See Also

- Full documentation: `src/commands/voice/README.md`
- Configuration guide: `clawdbot configure voice --help`
- Provider details: `clawdbot voice provider --list`
