# Voice Dashboard Component Implementation Guide

## Overview

This guide provides detailed implementation patterns and examples for building the voice dashboard components. It covers component structure, hooks usage, styling, and integration with the Zustand store.

## Component Development Standards

### File Structure for Each Component

```
ComponentName/
├── ComponentName.tsx          # Main component
├── ComponentName.module.css   # Scoped styles
├── ComponentName.test.ts      # Unit tests
├── hooks.ts                   # Component-specific hooks (if needed)
├── types.ts                   # Component-specific types (if needed)
└── index.ts                   # Barrel export
```

### TypeScript Best Practices

```typescript
// Always use strict typing
import type { FC } from "react";
import type { ComponentProps } from "./types";

// Use FC for type safety
export const MyComponent: FC<ComponentProps> = ({
  prop1,
  prop2,
  onAction,
}) => {
  // Implementation
};

// Export with displayName for debugging
MyComponent.displayName = "MyComponent";
```

## Core Component Implementations

### 1. Provider Status Card

**File:** `ProviderCard.tsx`

```typescript
import React, { useState, useCallback } from "react";
import type { ProviderCardProps } from "../../controllers/voice-dashboard.types";
import { useVoiceProviderStore } from "../../controllers/voice-dashboard.store";
import styles from "./ProviderCard.module.css";

export const ProviderCard: React.FC<ProviderCardProps> = ({
  provider,
  status,
  isActive,
  isExpanded,
  onExpand,
  onTest,
  onSwitch,
  onConfigure,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const getStatusColor = useCallback(() => {
    if (!status) return "gray";
    return status.health === "healthy" ? "green" : status.health === "degraded" ? "yellow" : "red";
  }, [status?.health]);

  const statusColor = getStatusColor();

  return (
    <div className={`${styles.card} ${styles[`status-${statusColor}`]}`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={`${styles.statusIndicator} ${styles[statusColor]}`} title={status?.health || "Unknown"} />
        <div className={styles.title}>
          <h3>{provider.name}</h3>
          <span className={styles.type}>{provider.type.toUpperCase()}</span>
          <span className={styles.mode}>{provider.mode}</span>
        </div>
        {isActive && <span className={styles.badge}>Active</span>}
      </div>

      {/* Metrics Display */}
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.label}>Latency:</span>
          <span className={styles.value}>{status?.latency ?? "N/A"}ms</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.label}>Error Rate:</span>
          <span className={styles.value}>{status?.errorRate?.toFixed(1) ?? "N/A"}%</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.label}>Last Check:</span>
          <span className={styles.value}>{formatTime(status?.lastChecked)}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className={styles.actions}>
        <button onClick={onTest} className={styles.btn} aria-label="Quick test">
          Test
        </button>
        <button onClick={onSwitch} className={styles.btn} aria-label="Switch provider">
          {isActive ? "Active" : "Switch"}
        </button>
        <button onClick={onConfigure} className={styles.btn} aria-label="Configure provider">
          Config
        </button>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className={styles.expanded} role="region" aria-label={`${provider.name} details`}>
          <ResourceUsageMonitor providerId={provider.id} />
          <HealthTimeline providerId={provider.id} />
        </div>
      )}
    </div>
  );
};

ProviderCard.displayName = "ProviderCard";

// Helper function
function formatTime(timestamp?: number): string {
  if (!timestamp) return "N/A";
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}
```

**Styles:** `ProviderCard.module.css`

```css
.card {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 16px;
  background: var(--color-surface);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 150ms ease;
  overflow: hidden;
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.card.status-green {
  border-left: 4px solid #22c55e;
}

.card.status-yellow {
  border-left: 4px solid #eab308;
}

.card.status-red {
  border-left: 4px solid #ef4444;
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.statusIndicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.statusIndicator.green {
  background-color: #22c55e;
  animation: pulse-green 2s infinite;
}

.statusIndicator.yellow {
  background-color: #eab308;
}

.statusIndicator.red {
  background-color: #ef4444;
}

.title {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.title h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.type,
.mode {
  font-size: 11px;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge {
  padding: 4px 8px;
  background: #3b82f6;
  color: white;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.metrics {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.label {
  font-size: 11px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.value {
  font-size: 13px;
  font-weight: 600;
  font-family: monospace;
  color: var(--color-text-primary);
}

.actions {
  display: flex;
  gap: 8px;
}

.btn {
  flex: 1;
  padding: 6px 8px;
  background: var(--color-button-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
}

.btn:hover {
  background: var(--color-button-bg-hover);
  border-color: var(--color-button-border-hover);
}

.btn:active {
  transform: scale(0.98);
}

.expanded {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@keyframes pulse-green {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* Responsive */
@media (max-width: 768px) {
  .metrics {
    grid-template-columns: 1fr 1fr;
  }

  .actions {
    flex-direction: column;
  }
}
```

### 2. Provider Selector with Dropdown

**File:** `ProviderSelector.tsx`

```typescript
import React, { useRef, useEffect, useState } from "react";
import type { ProviderSelectorProps } from "../../controllers/voice-dashboard.types";
import { useVoiceProviderStore } from "../../controllers/voice-dashboard.store";
import styles from "./ProviderSelector.module.css";

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  type,
  providers,
  activeProviderId,
  onSelect,
  metrics,
  status,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const activeProvider = providers.find((p) => p.id === activeProviderId);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (providerId: string) => {
    onSelect(providerId);
    setIsOpen(false);
  };

  return (
    <div className={styles.container} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Select ${type.toUpperCase()} provider`}
      >
        <div className={styles.triggerContent}>
          <div className={styles.providerInfo}>
            <span className={styles.name}>{activeProvider?.name || "Select provider"}</span>
            <span className={styles.mode}>{activeProvider?.mode}</span>
          </div>
          <div className={styles.metrics}>
            {metrics && (
              <>
                <span className={styles.latency}>{metrics.latency}ms</span>
                <span className={styles.successRate}>{metrics.successRate.toFixed(1)}%</span>
              </>
            )}
          </div>
        </div>
        <span className={`${styles.arrow} ${isOpen ? styles.open : ""}`}>▼</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={styles.dropdown} role="listbox">
          {providers.map((provider) => (
            <button
              key={provider.id}
              className={`${styles.option} ${provider.id === activeProviderId ? styles.active : ""}`}
              onClick={() => handleSelect(provider.id)}
              role="option"
              aria-selected={provider.id === activeProviderId}
            >
              <div className={styles.optionContent}>
                <div className={styles.optionName}>{provider.name}</div>
                <div className={styles.optionDetails}>
                  <span className={styles.mode}>{provider.mode}</span>
                  <span className={styles.type}>{provider.type}</span>
                </div>
              </div>

              {/* Status Badge */}
              {provider.id === activeProviderId && (
                <span className={styles.selectedBadge}>✓ Active</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

ProviderSelector.displayName = "ProviderSelector";
```

### 3. Audio Upload Component

**File:** `AudioUploader.tsx`

```typescript
import React, { useRef, useCallback } from "react";
import type { AudioUploaderProps } from "../../controllers/voice-dashboard.types";
import styles from "./AudioUploader.module.css";

export const AudioUploader: React.FC<AudioUploaderProps> = ({
  onFileSelected,
  acceptedFormats,
  maxSizeMb,
  isLoading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [dragActive, setDragActive] = React.useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      // Validate
      if (!acceptedFormats.includes(file.type)) {
        alert(`Invalid format. Supported: ${acceptedFormats.join(", ")}`);
        return;
      }

      if (file.size > maxSizeMb * 1024 * 1024) {
        alert(`File too large. Max size: ${maxSizeMb}MB`);
        return;
      }

      // Process
      const buffer = await file.arrayBuffer();

      // Get duration
      let duration: number | undefined;
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(buffer);
        duration = audioBuffer.duration;
      } catch (e) {
        console.warn("Could not decode audio duration:", e);
      }

      onFileSelected({
        buffer,
        filename: file.name,
        size: file.size,
        duration,
        format: file.type,
      });
    },
    [onFileSelected, acceptedFormats, maxSizeMb]
  );

  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.currentTarget.files;
      if (files?.length) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  return (
    <div className={styles.container}>
      <div
        ref={dropZoneRef}
        className={`${styles.dropZone} ${dragActive ? styles.dragActive : ""} ${isLoading ? styles.loading : ""}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        role="region"
        aria-label="Audio file upload area"
      >
        <div className={styles.content}>
          <svg
            className={styles.icon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>

          <h3>Drag audio file here</h3>
          <p>or</p>

          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFormats.join(",")}
            onChange={handleFileInput}
            disabled={isLoading}
            className={styles.input}
            aria-label="Choose audio file"
          />

          <button
            type="button"
            className={styles.button}
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            {isLoading ? "Uploading..." : "Choose File"}
          </button>

          <p className={styles.hint}>
            Max size: {maxSizeMb}MB | Formats: {acceptedFormats.join(", ")}
          </p>
        </div>
      </div>
    </div>
  );
};

AudioUploader.displayName = "AudioUploader";
```

### 4. Audio Player with Waveform

**File:** `AudioPlayer.tsx`

```typescript
import React, { useRef, useEffect, useState, useCallback } from "react";
import type { AudioPlayerProps } from "../../controllers/voice-dashboard.types";
import { AudioWaveform } from "./AudioWaveform";
import styles from "./AudioPlayer.module.css";

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  waveform,
  onPlay,
  onPause,
  onSeek,
  autoPlay = false,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  // Update current time
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    if (autoPlay) {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [autoPlay]);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      onPause?.();
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
      onPlay?.();
    }
  }, [isPlaying, onPlay, onPause]);

  const handleSeek = useCallback(
    (time: number) => {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = time;
        setCurrentTime(time);
        onSeek?.(time);
      }
    },
    [onSeek]
  );

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.currentTarget.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  }, []);

  return (
    <div className={styles.container}>
      <audio ref={audioRef} src={audioUrl} crossOrigin="anonymous" />

      {/* Controls */}
      <div className={styles.controls}>
        <button
          onClick={handlePlayPause}
          className={styles.playButton}
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>

        <div className={styles.timeDisplay}>
          <span>{formatTime(currentTime)}</span>
          <span>/</span>
          <span>{formatTime(duration)}</span>
        </div>

        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={(e) => handleSeek(parseFloat(e.currentTarget.value))}
          className={styles.progressBar}
          aria-label="Audio progress"
        />

        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={handleVolumeChange}
          className={styles.volumeControl}
          aria-label="Volume control"
        />
      </div>

      {/* Waveform */}
      {waveform && (
        <AudioWaveform
          data={waveform}
          currentTime={currentTime}
          duration={duration}
          onSeek={handleSeek}
        />
      )}
    </div>
  );
};

AudioPlayer.displayName = "AudioPlayer";

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
```

## Hooks Implementation

### useHealthMonitor Hook

**File:** `hooks/useHealthMonitor.ts`

```typescript
import { useEffect } from "react";
import { useVoiceProviderStore } from "../controllers/voice-dashboard.store";

export const useHealthMonitor = (enabled = true) => {
  const { wsConnected, connectWebSocket, disconnectWebSocket } = useVoiceProviderStore();

  useEffect(() => {
    if (enabled) {
      connectWebSocket();
    } else {
      disconnectWebSocket();
    }

    return () => {
      if (enabled) {
        disconnectWebSocket();
      }
    };
  }, [enabled, connectWebSocket, disconnectWebSocket]);

  return { wsConnected };
};
```

### useAudioPlayback Hook

**File:** `hooks/useAudioPlayback.ts`

```typescript
import { useState, useCallback, useRef } from "react";
import type { AudioPlaybackState, WaveformData } from "../controllers/voice-dashboard.types";

export const useAudioPlayback = (audioUrl: string) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playbackState, setPlaybackState] = useState<AudioPlaybackState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    speed: 1,
  });
  const [waveform, setWaveform] = useState<WaveformData | null>(null);

  // Generate waveform
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    const analyzeWaveform = async () => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const rawData = audioBuffer.getChannelData(0);
        const samples = 512;
        const blockSize = Math.floor(rawData.length / samples);
        const filteredData: number[] = [];

        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(rawData[i * blockSize + j]);
          }
          filteredData.push(sum / blockSize);
        }

        const maxValue = Math.max(...filteredData);
        const normalizedData = filteredData.map((v) => v / maxValue);

        setWaveform({
          peaks: normalizedData,
          samples: rawData.length,
          duration: audioBuffer.duration,
          sampleRate: audioBuffer.sampleRate,
        });
      } catch (error) {
        console.error("Error analyzing waveform:", error);
      }
    };

    analyzeWaveform();
  }, [audioUrl]);

  const play = useCallback(() => {
    audioRef.current?.play();
    setPlaybackState((prev) => ({ ...prev, isPlaying: true }));
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setPlaybackState((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setPlaybackState((prev) => ({ ...prev, currentTime: time }));
    }
  }, []);

  const setVolumeLevel = useCallback((volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      setPlaybackState((prev) => ({ ...prev, volume }));
    }
  }, []);

  const setSpeed = useCallback((speed: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
      setPlaybackState((prev) => ({ ...prev, speed }));
    }
  }, []);

  return {
    audioRef,
    playbackState,
    waveform,
    controls: { play, pause, seek, setVolumeLevel, setSpeed },
  };
};
```

## Testing Patterns

### Component Unit Test Example

**File:** `ProviderCard.test.ts`

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { ProviderCard } from "./ProviderCard";
import type { ProviderCardProps } from "../../controllers/voice-dashboard.types";

describe("ProviderCard", () => {
  const mockProps: ProviderCardProps = {
    provider: {
      id: "faster-whisper",
      name: "Faster-Whisper",
      type: "stt",
      mode: "gpu",
      description: "GPU-accelerated whisper",
      capabilities: [],
      active: true,
    },
    status: {
      id: "faster-whisper",
      health: "healthy",
      available: true,
      healthy: true,
      lastChecked: Date.now(),
      latency: 800,
      errorRate: 0.1,
      successRate: 99.9,
      requestsProcessed: 1000,
      requestsFailed: 1,
      warnings: [],
    },
    isActive: true,
    isExpanded: false,
    onExpand: jest.fn(),
    onTest: jest.fn(),
    onSwitch: jest.fn(),
    onConfigure: jest.fn(),
  };

  it("renders provider information", () => {
    render(<ProviderCard {...mockProps} />);

    expect(screen.getByText("Faster-Whisper")).toBeInTheDocument();
    expect(screen.getByText("STT")).toBeInTheDocument();
    expect(screen.getByText("gpu")).toBeInTheDocument();
  });

  it("displays metrics correctly", () => {
    render(<ProviderCard {...mockProps} />);

    expect(screen.getByText("800ms")).toBeInTheDocument();
    expect(screen.getByText("0.1%")).toBeInTheDocument();
  });

  it("calls onTest when test button clicked", () => {
    render(<ProviderCard {...mockProps} />);
    fireEvent.click(screen.getByLabelText("Quick test"));
    expect(mockProps.onTest).toHaveBeenCalled();
  });

  it("shows active badge when isActive is true", () => {
    render(<ProviderCard {...mockProps} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("expands details when expanded", () => {
    const { rerender } = render(<ProviderCard {...mockProps} />);

    // Initially not expanded
    expect(screen.queryByRole("region")).not.toBeInTheDocument();

    // Expand
    rerender(<ProviderCard {...mockProps} isExpanded={true} />);
    expect(screen.getByRole("region")).toBeInTheDocument();
  });
});
```

## Performance Optimization Tips

1. **Memoization:**
   ```typescript
   const MemoizedCard = React.memo(ProviderCard, (prev, next) => {
     return (
       prev.provider.id === next.provider.id &&
       prev.status?.health === next.status?.health &&
       prev.isActive === next.isActive
     );
   });
   ```

2. **useCallback for event handlers:**
   ```typescript
   const handleClick = useCallback(() => {
     // Implementation
   }, [dependency]);
   ```

3. **Lazy load metrics:**
   ```typescript
   const MetricsChart = React.lazy(() => import("./MetricsChart"));
   ```

## Accessibility Checklist

- [ ] All buttons have aria-labels
- [ ] Form inputs have associated labels
- [ ] Color not sole indicator of status
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] ARIA roles used correctly
- [ ] Live regions for updates
- [ ] Alt text on images/icons
- [ ] Sufficient color contrast (4.5:1)
- [ ] Touch targets >= 44x44px mobile

## Common Patterns

### Loading State
```typescript
{isLoading && <LoadingSpinner />}
{error && <ErrorAlert message={error} onDismiss={clearError} />}
{!isLoading && data && <Content data={data} />}
```

### Error Boundary
```typescript
class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? <ErrorFallback /> : this.props.children;
  }
}
```

### Real-time Updates
```typescript
useEffect(() => {
  const unsubscribe = store.subscribe(
    (state) => state.providerStatus,
    (status) => {
      // Handle status update
    }
  );

  return () => unsubscribe();
}, []);
```

## Next Steps

1. Implement all component files in `/ui/src/components/voice-dashboard/`
2. Create comprehensive unit tests (>80% coverage)
3. Run visual regression tests against design system
4. Test WebSocket integration thoroughly
5. Performance audit with Lighthouse
6. Accessibility audit with axe-core
7. E2E testing with actual providers
