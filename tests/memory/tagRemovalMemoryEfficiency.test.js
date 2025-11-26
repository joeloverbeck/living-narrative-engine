/**
 * @file Memory efficiency tests for tag removal implementation
 * @description Tests measuring memory usage improvements from tag removal
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { AIPromptContentProvider } from '../../src/prompting/AIPromptContentProvider.js';
import { PromptDataFormatter } from '../../src/prompting/promptDataFormatter.js';
import { SUBJECT_TYPES } from '../../src/constants/subjectTypes.js';

// Import memory test utilities for robust memory testing
const { memoryTestUtils } = global;

describe('Tag Removal Memory Efficiency Tests', () => {
  let promptContentProvider;
  let promptDataFormatter;
  let mockLogger;

  // Test setup helpers
  const createMockLogger = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });

  const createMockServices = () => ({
    promptStaticContentService: {
      getCoreTaskDescriptionText: () => 'core-task',
      getCharacterPortrayalGuidelines: () => 'portrayal',
      getNc21ContentPolicyText: () => 'content-policy',
      getFinalLlmInstructionText: () => 'final-instructions',
    },
    perceptionLogFormatter: {
      format: (logArray) =>
        logArray.map((entry) => ({ content: entry.descriptionText || '' })),
    },
    gameStateValidationService: {
      validate: () => ({ isValid: true, errorContent: null }),
    },
    actionCategorizationService: {
      extractNamespace: jest.fn(
        (actionId) => actionId.split(':')[0] || 'unknown'
      ),
      shouldUseGrouping: jest.fn(() => false),
      groupActionsByNamespace: jest.fn(() => new Map()),
      getSortedNamespaces: jest.fn(() => []),
      formatNamespaceDisplayName: jest.fn((namespace) =>
        namespace.toUpperCase()
      ),
    },
    characterDataXmlBuilder: {
      buildCharacterDataXml: jest.fn(() => '<character><name>Test Character</name></character>'),
    },
    modActionMetadataProvider: {
      getMetadataForMod: jest.fn(() => null),
    },
  });

  const createTestNotesWithoutTags = (count = 10) => {
    return Array.from({ length: count }, (_, i) => ({
      text: `Test note ${i + 1} with detailed content for memory measurement`,
      subject: `Subject ${i + 1}`,
      subjectType:
        Object.values(SUBJECT_TYPES)[i % Object.values(SUBJECT_TYPES).length],
      context: `Context ${i + 1} with additional descriptive information`,
      timestamp: new Date(2024, 0, 1, i).toISOString(),
    }));
  };

  const createGameStateWithNotes = (notes) => ({
    actorState: {
      components: {
        'core:notes': {
          notes: notes,
        },
      },
    },
    actorPromptData: { name: 'Test Character' },
    currentUserInput: 'Test input for memory measurement',
    perceptionLog: [],
    currentLocation: {
      name: 'Test Location',
      description: 'A test location for memory measurement',
      exits: [],
      characters: [],
    },
    availableActions: [],
  });

  beforeEach(() => {
    mockLogger = createMockLogger();
    const mockServices = createMockServices();

    promptContentProvider = new AIPromptContentProvider({
      logger: mockLogger,
      ...mockServices,
    });

    promptDataFormatter = new PromptDataFormatter({ logger: mockLogger });
  });

  describe('Memory Usage Optimization', () => {
    test('should demonstrate memory efficiency without tag storage', async () => {
      const initialMemory = process.memoryUsage();
      const largeNotesSet = createTestNotesWithoutTags(200);
      const gameState = createGameStateWithNotes(largeNotesSet);

      // Process notes
      const promptData = await promptContentProvider.getPromptData(
        gameState,
        mockLogger
      );
      const formattedData = promptDataFormatter.formatPromptData(promptData);

      const finalMemory = process.memoryUsage();
      const heapUsedDelta = finalMemory.heapUsed - initialMemory.heapUsed;

      // Validate memory usage is reasonable
      expect(heapUsedDelta).toBeLessThan(10 * 1024 * 1024); // Less than 10MB for 200 notes
      expect(promptData.notesArray).toHaveLength(200);

      console.log(
        `Memory Usage (200 notes): ${(heapUsedDelta / 1024 / 1024).toFixed(2)}MB`
      );
    });

    test('should maintain low memory footprint with structured notes processing', async () => {
      const initialMemory = process.memoryUsage();

      // Create structured notes with various subject types
      const structuredNotes = Array.from({ length: 150 }, (_, i) => ({
        text: `Structured note ${i + 1} with comprehensive content for memory testing`,
        subject: `Structured Subject ${i + 1}`,
        subjectType:
          Object.values(SUBJECT_TYPES)[i % Object.values(SUBJECT_TYPES).length],
        context: `Detailed context ${i + 1} with extensive information for memory validation`,
        timestamp: new Date(2024, 0, 1, i % 24, i % 60).toISOString(),
      }));

      const gameState = createGameStateWithNotes(structuredNotes);

      // Process with grouping (more complex processing)
      const promptData = await promptContentProvider.getPromptData(
        gameState,
        mockLogger
      );
      const groupedContent = promptDataFormatter.formatNotes(
        promptData.notesArray,
        { groupBySubject: true }
      );

      const finalMemory = process.memoryUsage();
      const heapUsedDelta = finalMemory.heapUsed - initialMemory.heapUsed;

      // Validate memory efficiency with structured processing
      expect(heapUsedDelta).toBeLessThan(8 * 1024 * 1024); // Less than 8MB for 150 structured notes
      expect(promptData.notesArray).toHaveLength(150);
      expect(groupedContent.length).toBeGreaterThan(0);

      console.log(
        `Structured Notes Memory Usage (150 notes): ${(heapUsedDelta / 1024 / 1024).toFixed(2)}MB`
      );
    });

    test('should handle memory pressure during extended processing', async () => {
      const runs = 5;
      const notesPerRun = 100;
      let maxMemoryDelta = 0;

      for (let run = 0; run < runs; run++) {
        const initialMemory = process.memoryUsage();

        const notes = createTestNotesWithoutTags(notesPerRun);
        const gameState = createGameStateWithNotes(notes);

        // Process multiple times to simulate extended operation
        for (let i = 0; i < 3; i++) {
          const promptData = await promptContentProvider.getPromptData(
            gameState,
            mockLogger
          );
          const formattedData =
            promptDataFormatter.formatPromptData(promptData);

          // Verify processing success
          expect(promptData.notesArray).toHaveLength(notesPerRun);
          expect(formattedData.notesContent.length).toBeGreaterThan(0);
        }

        const finalMemory = process.memoryUsage();
        const heapUsedDelta = finalMemory.heapUsed - initialMemory.heapUsed;
        maxMemoryDelta = Math.max(maxMemoryDelta, heapUsedDelta);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      // Validate memory doesn't grow excessively across multiple runs
      expect(maxMemoryDelta).toBeLessThan(15 * 1024 * 1024); // Less than 15MB max delta

      console.log(
        `Extended Processing Memory Peak: ${(maxMemoryDelta / 1024 / 1024).toFixed(2)}MB`
      );
    });

    test('should efficiently handle large note datasets without memory leaks', async () => {
      const initialMemory = process.memoryUsage();

      // Process several batches of notes
      const batches = 4;
      const notesPerBatch = 75;

      for (let batch = 0; batch < batches; batch++) {
        const notes = createTestNotesWithoutTags(notesPerBatch);
        const gameState = createGameStateWithNotes(notes);

        const promptData = await promptContentProvider.getPromptData(
          gameState,
          mockLogger
        );
        const formattedData = promptDataFormatter.formatPromptData(promptData);

        // Verify each batch processes correctly
        expect(promptData.notesArray).toHaveLength(notesPerBatch);
        expect(formattedData.notesContent.length).toBeGreaterThan(0);
      }

      const finalMemory = process.memoryUsage();
      const heapUsedDelta = finalMemory.heapUsed - initialMemory.heapUsed;

      // Validate no significant memory accumulation across batches
      expect(heapUsedDelta).toBeLessThan(12 * 1024 * 1024); // Less than 12MB for all batches

      console.log(
        `Batch Processing Memory Usage (${batches * notesPerBatch} total notes): ${(heapUsedDelta / 1024 / 1024).toFixed(2)}MB`
      );
    });
  });

  describe('Memory Baseline Establishment', () => {
    test('should establish memory baseline for future regression testing', async () => {
      const baselineNoteCount = 100;
      const notes = createTestNotesWithoutTags(baselineNoteCount);
      const gameState = createGameStateWithNotes(notes);

      // Establish memory baselines
      const measurements = {
        peakHeapUsed: 0,
        heapUsedDelta: 0,
        rss: 0,
        external: 0,
      };

      // Force garbage collection and stabilization before initial measurement
      if (memoryTestUtils) {
        await memoryTestUtils.forceGCAndWait();
      }

      const initialMemory = process.memoryUsage();

      // Process notes and measure memory
      const promptData = await promptContentProvider.getPromptData(
        gameState,
        mockLogger
      );
      const formattedData = promptDataFormatter.formatPromptData(promptData);

      // Force garbage collection and stabilization before final measurement
      if (memoryTestUtils) {
        await memoryTestUtils.forceGCAndWait();
      }

      const peakMemory = process.memoryUsage();
      measurements.peakHeapUsed = peakMemory.heapUsed;
      measurements.heapUsedDelta = peakMemory.heapUsed - initialMemory.heapUsed;
      measurements.rss = peakMemory.rss;
      measurements.external = peakMemory.external;

      // Establish memory baselines (thresholds for regression prevention)
      const memoryBaselines = {
        maxHeapUsedDelta: 8 * 1024 * 1024, // 8MB max heap increase
        maxRss: 1024 * 1024 * 1024, // 1GB max RSS (adjusted for full test suite environment)
        maxExternal: 50 * 1024 * 1024, // 50MB max external memory
      };

      // Validate against baselines
      expect(measurements.heapUsedDelta).toBeLessThan(
        memoryBaselines.maxHeapUsedDelta
      );

      // RSS check with retry mechanism for robustness against system variability
      if (memoryTestUtils) {
        await memoryTestUtils.assertMemoryWithRetry(
          async () => measurements.rss,
          memoryBaselines.maxRss / (1024 * 1024), // Convert to MB for utility function
          6 // Retry attempts
        );
      } else {
        // Fallback for environments without memory test utilities
        expect(measurements.rss).toBeLessThan(memoryBaselines.maxRss);
      }

      expect(measurements.external).toBeLessThan(memoryBaselines.maxExternal);

      // Verify processing success
      expect(promptData.notesArray).toHaveLength(baselineNoteCount);
      expect(formattedData.notesContent.length).toBeGreaterThan(0);

      // Log memory baseline metrics for future reference
      console.log(`Memory Baselines (${baselineNoteCount} notes):`);
      console.log(
        `  - Heap Delta: ${(measurements.heapUsedDelta / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(
        `  - Peak Heap: ${(measurements.peakHeapUsed / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(`  - RSS: ${(measurements.rss / 1024 / 1024).toFixed(2)}MB`);
      console.log(
        `  - External: ${(measurements.external / 1024 / 1024).toFixed(2)}MB`
      );
    });
  });
});
