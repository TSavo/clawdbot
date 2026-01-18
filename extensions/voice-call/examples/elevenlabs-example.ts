/**
 * ElevenLabs TTS Provider - Integration Examples
 *
 * This file demonstrates various ways to use the ElevenLabs TTS provider
 * in your Clawdbot voice applications.
 */

import {
  ElevenLabsTTSProvider,
  ElevenLabsBatchSynthesizer,
  getCommonVoices,
  findVoiceByName,
  getVoicesByGender,
  estimateCharacterCount,
  chunkTextBySentences,
  ElevenLabsTTSService,
} from "../src/plugins/tts-elevenlabs/index.js";

/**
 * Example 1: Basic Synthesis
 *
 * Simple text-to-speech synthesis with default settings.
 */
async function example1_basicSynthesis() {
  console.log("=== Example 1: Basic Synthesis ===\n");

  const provider = new ElevenLabsTTSProvider({
    apiKey: process.env.ELEVENLABS_API_KEY!,
  });

  try {
    const audio = await provider.synthesize("Hello, world! This is ElevenLabs text-to-speech.");
    console.log(`✓ Synthesized audio: ${audio.length} bytes`);
  } catch (error) {
    console.error("✗ Synthesis failed:", error);
  }
}

/**
 * Example 2: Voice Selection
 *
 * Synthesize using different voices and genders.
 */
async function example2_voiceSelection() {
  console.log("\n=== Example 2: Voice Selection ===\n");

  const provider = new ElevenLabsTTSProvider({
    apiKey: process.env.ELEVENLABS_API_KEY!,
    voiceId: "bella",
  });

  // List common voices
  console.log("Available voices:");
  getCommonVoices().forEach((voice) => {
    console.log(`  - ${voice.name} (${voice.id}): ${voice.description}`);
  });

  // Get female voices
  console.log("\nFemale voices:");
  getVoicesByGender("female").forEach((voice) => {
    console.log(`  - ${voice.name}`);
  });

  // Find voice by name
  const rachel = findVoiceByName("rachel");
  if (rachel) {
    console.log(`\nFound voice: ${rachel.name} (${rachel.id})`);

    try {
      const audio = await provider.synthesize("Hello from Rachel!", {
        voice: rachel.id,
      });
      console.log(`✓ Synthesized with ${rachel.name}: ${audio.length} bytes`);
    } catch (error) {
      console.error("✗ Synthesis failed:", error);
    }
  }
}

/**
 * Example 3: Batch Synthesis
 *
 * Synthesize multiple texts efficiently using batch processing.
 */
async function example3_batchSynthesis() {
  console.log("\n=== Example 3: Batch Synthesis ===\n");

  const provider = new ElevenLabsTTSProvider({
    apiKey: process.env.ELEVENLABS_API_KEY!,
  });

  const synthesizer = new ElevenLabsBatchSynthesizer(provider);

  const texts = [
    "Good morning!",
    "Welcome to our application.",
    "Let's get started with voice synthesis.",
  ];

  console.log(`Synthesizing ${texts.length} texts...`);

  try {
    const audioBuffers = await synthesizer.synthesizeBatch(texts, undefined, (index, total) => {
      console.log(`  Progress: ${index + 1}/${total}`);
    });

    console.log(`✓ Synthesized ${audioBuffers.length} audio files`);
    audioBuffers.forEach((audio, i) => {
      console.log(`  Text ${i + 1}: ${audio.length} bytes`);
    });
  } catch (error) {
    console.error("✗ Batch synthesis failed:", error);
  }
}

/**
 * Example 4: Concatenation with Silence
 *
 * Synthesize multiple phrases and concatenate them with silence between.
 */
async function example4_concatenation() {
  console.log("\n=== Example 4: Concatenation with Silence ===\n");

  const provider = new ElevenLabsTTSProvider({
    apiKey: process.env.ELEVENLABS_API_KEY!,
  });

  const synthesizer = new ElevenLabsBatchSynthesizer(provider);

  const phrases = [
    "Welcome.",
    "This is a concatenated message.",
    "All phrases are joined with silence between them.",
  ];

  console.log(`Concatenating ${phrases.length} phrases with 500ms silence...`);

  try {
    const concatenated = await synthesizer.synthesizeAndConcatenate(
      phrases,
      { voice: "bella" },
      500, // 500ms silence between phrases
    );

    console.log(`✓ Concatenated audio: ${concatenated.length} bytes`);
  } catch (error) {
    console.error("✗ Concatenation failed:", error);
  }
}

/**
 * Example 5: Large Text Chunking
 *
 * Process large texts by chunking into sentences.
 */
async function example5_textChunking() {
  console.log("\n=== Example 5: Text Chunking ===\n");

  const provider = new ElevenLabsTTSProvider({
    apiKey: process.env.ELEVENLABS_API_KEY!,
  });

  const largeText = `
    The quick brown fox jumps over the lazy dog. This is a common pangram used in typography.
    It contains every letter of the English alphabet at least once. Such pangrams are useful for
    testing fonts and typefaces. They help display the full range of characters available in a font.
    Another popular pangram is "Pack my box with five dozen liquor jugs." Let's try to synthesize
    this entire text by chunking it into manageable pieces.
  `;

  const chunks = chunkTextBySentences(largeText.trim(), 200);

  console.log(`Original text length: ${largeText.length} characters`);
  console.log(`Chunked into ${chunks.length} sentences:\n`);

  chunks.forEach((chunk, i) => {
    console.log(`  Chunk ${i + 1}: "${chunk}"`);
  });

  // Synthesize chunks
  console.log("\nSynthesizing chunks...");

  try {
    const synthesizer = new ElevenLabsBatchSynthesizer(provider);
    const audioBuffers = await synthesizer.synthesizeBatch(chunks);

    const totalSize = audioBuffers.reduce((sum, buf) => sum + buf.length, 0);
    console.log(`✓ Synthesized ${audioBuffers.length} chunks`);
    console.log(`  Total audio size: ${totalSize} bytes`);
  } catch (error) {
    console.error("✗ Chunked synthesis failed:", error);
  }
}

/**
 * Example 6: Cost Tracking
 *
 * Monitor character usage and API quota.
 */
async function example6_costTracking() {
  console.log("\n=== Example 6: Cost Tracking ===\n");

  const provider = new ElevenLabsTTSProvider({
    apiKey: process.env.ELEVENLABS_API_KEY!,
  });

  const textToSynthesize = "The quick brown fox jumps over the lazy dog.";

  try {
    // Estimate character count
    const estimatedChars = estimateCharacterCount(textToSynthesize);
    console.log(`Text: "${textToSynthesize}"`);
    console.log(`Estimated characters: ${estimatedChars}`);

    // Get user info
    const userInfo = await provider.getUserInfo();
    console.log(`\nUser subscription info:`);
    console.log(`  Character balance: ${userInfo.subscription.character_count}`);
    if (userInfo.subscription_tier) {
      console.log(`  Subscription tier: ${userInfo.subscription_tier}`);
    }

    // Calculate remaining after synthesis
    const remainingAfter = userInfo.subscription.character_count - estimatedChars;
    console.log(`  Remaining after this synthesis: ${remainingAfter}`);
  } catch (error) {
    console.error("✗ Cost tracking failed:", error);
  }
}

/**
 * Example 7: Plugin Service
 *
 * Use the ElevenLabs service wrapper for lifecycle management.
 */
async function example7_pluginService() {
  console.log("\n=== Example 7: Plugin Service ===\n");

  const service = new ElevenLabsTTSService();

  try {
    // Initialize the service
    console.log("Initializing service...");
    const initialized = await service.initialize({
      apiKey: process.env.ELEVENLABS_API_KEY!,
    });

    if (!initialized) {
      console.error("✗ Service initialization failed");
      return;
    }

    console.log("✓ Service initialized");

    // Check if ready
    console.log(`Service ready: ${service.isReady()}`);

    // Get status
    const status = service.getStatus();
    console.log(`Status: ${JSON.stringify(status, null, 2)}`);

    // Perform health check
    console.log("\nPerforming health check...");
    const healthy = await service.healthCheck();
    console.log(`Health check: ${healthy ? "✓ Healthy" : "✗ Unhealthy"}`);

    // Use the provider
    const provider = service.getProvider();
    if (provider) {
      const audio = await provider.synthesize("Service is working!");
      console.log(`✓ Synthesized: ${audio.length} bytes`);
    }

    // Shutdown
    console.log("\nShutting down service...");
    await service.shutdown();
    console.log("✓ Service shutdown complete");
  } catch (error) {
    console.error("✗ Service error:", error);
  }
}

/**
 * Example 8: Error Handling
 *
 * Demonstrate proper error handling for common scenarios.
 */
async function example8_errorHandling() {
  console.log("\n=== Example 8: Error Handling ===\n");

  // Invalid configuration
  console.log("Testing error handling...\n");

  try {
    console.log("1. Invalid API key:");
    new ElevenLabsTTSProvider({ apiKey: "" });
  } catch (error) {
    console.log(`   ✓ Caught: ${(error as Error).message}`);
  }

  try {
    console.log("\n2. Invalid stability parameter:");
    new ElevenLabsTTSProvider({
      apiKey: "test-key",
      stability: 1.5,
    });
  } catch (error) {
    console.log(`   ✓ Caught: ${(error as Error).message}`);
  }

  try {
    console.log("\n3. Empty text synthesis:");
    const provider = new ElevenLabsTTSProvider({
      apiKey: "test-key",
    });
    await provider.synthesize("");
  } catch (error) {
    console.log(`   ✓ Caught: ${(error as Error).message}`);
  }

  console.log("\nError handling complete.");
}

/**
 * Main runner - execute examples
 */
async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     ElevenLabs TTS Provider - Integration Examples         ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  if (!process.env.ELEVENLABS_API_KEY) {
    console.error("Error: ELEVENLABS_API_KEY environment variable not set");
    console.error("Set it with: export ELEVENLABS_API_KEY=your_api_key");
    process.exit(1);
  }

  // Run examples
  await example1_basicSynthesis();
  await example2_voiceSelection();
  await example3_batchSynthesis();
  await example4_concatenation();
  await example5_textChunking();
  await example6_costTracking();
  await example7_pluginService();
  await example8_errorHandling();

  console.log(
    "\n╔════════════════════════════════════════════════════════════╗",
  );
  console.log("║                  Examples Complete!                        ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  example1_basicSynthesis,
  example2_voiceSelection,
  example3_batchSynthesis,
  example4_concatenation,
  example5_textChunking,
  example6_costTracking,
  example7_pluginService,
  example8_errorHandling,
};
