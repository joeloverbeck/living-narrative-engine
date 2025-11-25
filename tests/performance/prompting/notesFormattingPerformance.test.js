/**
 * @file Notes Formatting Performance Tests
 * @description Performance benchmarks for notes processing and formatting
 *
 * Performance Test Methodology:
 * - Uses warm-up iterations to stabilize JIT compilation and memory allocation
 * - Takes multiple measurements and uses median to reduce timing variability
 * - Accounts for JavaScript engine optimizations and garbage collection effects
 * - Tests with realistic data sizes and complexity patterns
 * - Allows for reasonable performance variance (up to 4x ratio degradation)
 * - Handles very fast operations that may be below measurement threshold
 *
 * Note: Performance thresholds are designed to catch genuine algorithmic
 * regressions while tolerating normal execution environment variability.
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';
import { PromptDataFormatter } from '../../../src/prompting/promptDataFormatter.js';
import { SUBJECT_TYPES } from '../../../src/constants/subjectTypes.js';

describe('Notes Formatting Performance', () => {
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
      shouldUseGrouping: jest.fn(() => false), // Default to flat formatting
      groupActionsByNamespace: jest.fn(() => new Map()),
      getSortedNamespaces: jest.fn(() => []),
      formatNamespaceDisplayName: jest.fn((namespace) =>
        namespace.toUpperCase()
      ),
    },
    characterDataXmlBuilder: {
      buildCharacterDataXml: jest.fn(() => '<character/>'),
    },
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

  describe('Large Dataset Performance', () => {
    test('should maintain performance with large note sets', async () => {
      // Create a large set of notes
      const largeNotesArray = Array.from({ length: 100 }, (_, index) => ({
        text: `Note ${index + 1}`,
        subject: `Subject ${(index % 10) + 1}`,
        subjectType:
          Object.values(SUBJECT_TYPES)[
            index % Object.values(SUBJECT_TYPES).length
          ],
        context: `Context ${index + 1}`,
        tags: [`tag${index + 1}`, `category${(index % 5) + 1}`],
        timestamp: new Date(2024, 0, 1, index % 24).toISOString(),
      }));

      const gameStateDto = {
        actorState: {
          components: {
            'core:notes': {
              notes: largeNotesArray,
            },
          },
        },
        actorPromptData: { name: 'Test Character' },
        currentUserInput: '',
        perceptionLog: [],
        currentLocation: {
          name: 'Test Location',
          description: 'A test location',
          exits: [],
          characters: [],
        },
        availableActions: [],
      };

      // Measure processing time
      const startTime = Date.now();

      const promptData = await promptContentProvider.getPromptData(
        gameStateDto,
        mockLogger
      );

      const groupedContent = promptDataFormatter.formatNotes(
        promptData.notesArray,
        { groupBySubject: true }
      );

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should process 100 notes in reasonable time (< 100ms)
      expect(processingTime).toBeLessThan(100);
      expect(promptData.notesArray).toHaveLength(100);

      // Verify tags are excluded from all notes
      promptData.notesArray.forEach((note) => {
        expect(note).not.toHaveProperty('tags');
      });

      const primaryCategory =
        promptDataFormatter.getSubjectTypeDisplayInfo(
          Object.values(SUBJECT_TYPES)[0]
        ).displayCategory;

      expect(groupedContent).toContain(`## ${primaryCategory}`);
      expect(groupedContent).toContain('### Subject 1');

      // Verify all subjects are present
      for (let i = 1; i <= 10; i++) {
        expect(groupedContent).toContain(`### Subject ${i}`);
      }
    });

    test('should scale linearly with note count', async () => {
      const testSizes = [50, 100, 200, 400];
      const timings = [];

      // Warm-up iteration to stabilize performance measurements
      const warmupNotesArray = Array.from({ length: 10 }, (_, index) => ({
        text: `Warmup Note ${index + 1}`,
        subject: `Subject ${index + 1}`,
        subjectType: Object.values(SUBJECT_TYPES)[0],
        context: `Context ${index + 1}`,
        tags: [`tag${index + 1}`],
        timestamp: new Date(2024, 0, 1).toISOString(),
      }));

      const warmupGameState = {
        actorState: {
          components: {
            'core:notes': {
              notes: warmupNotesArray,
            },
          },
        },
        actorPromptData: { name: 'Test Character' },
        currentUserInput: '',
        perceptionLog: [],
        currentLocation: {
          name: 'Test Location',
          description: 'A test location',
          exits: [],
          characters: [],
        },
        availableActions: [],
      };

      // Execute warm-up to stabilize JIT compilation and memory allocation
      const warmupData = await promptContentProvider.getPromptData(
        warmupGameState,
        mockLogger
      );
      promptDataFormatter.formatNotes(warmupData.notesArray, {
        groupBySubject: true,
      });

      for (const size of testSizes) {
        const notesArray = Array.from({ length: size }, (_, index) => ({
          text: `Note ${index + 1}`,
          subject: `Subject ${(index % 20) + 1}`,
          subjectType:
            Object.values(SUBJECT_TYPES)[
              index % Object.values(SUBJECT_TYPES).length
            ],
          context: `Context ${index + 1}`,
          tags: [`tag${index + 1}`],
          timestamp: new Date(2024, 0, 1, index % 24).toISOString(),
        }));

        const gameStateDto = {
          actorState: {
            components: {
              'core:notes': {
                notes: notesArray,
              },
            },
          },
          actorPromptData: { name: 'Test Character' },
          currentUserInput: '',
          perceptionLog: [],
          currentLocation: {
            name: 'Test Location',
            description: 'A test location',
            exits: [],
            characters: [],
          },
          availableActions: [],
        };

        // Take multiple measurements to reduce timing variability
        const measurements = [];
        const measurementCount = 3;

        for (let i = 0; i < measurementCount; i++) {
          const startTime = performance.now();

          const promptData = await promptContentProvider.getPromptData(
            gameStateDto,
            mockLogger
          );

          promptDataFormatter.formatNotes(promptData.notesArray, {
            groupBySubject: true,
          });

          const endTime = performance.now();
          measurements.push(endTime - startTime);
        }

        // Use median measurement to reduce impact of outliers
        measurements.sort((a, b) => a - b);
        const medianTime = measurements[Math.floor(measurements.length / 2)];

        timings.push({
          size,
          time: medianTime,
        });
      }

      // Verify approximate linear scaling with more realistic bounds
      // The ratio of time/size should not increase dramatically
      const ratios = timings.map((t) => t.time / t.size);
      const firstRatio = ratios[0];

      // Add minimum time threshold to avoid measuring noise on very fast operations
      const MINIMUM_MEASURABLE_TIME = 0.1; // 0.1ms minimum
      const hasSignificantTime = timings.some(t => t.time > MINIMUM_MEASURABLE_TIME);

      if (hasSignificantTime) {
        ratios.forEach((ratio, index) => {
          if (index > 0) {
            // Allow up to 4x degradation in performance ratio to account for:
            // - JavaScript JIT compilation effects
            // - Garbage collection variability
            // - Test environment resource contention
            // - Normal performance fluctuations in complex operations
            expect(ratio).toBeLessThan(firstRatio * 4);
          }
        });
      } else {
        // If operations are too fast to measure reliably, just verify completion
        expect(timings.length).toBe(testSizes.length);
        timings.forEach(timing => {
          expect(timing.time).toBeGreaterThanOrEqual(0);
        });
      }
    });

    test('should handle deeply nested note structures efficiently', async () => {
      // Create notes with varying complexity
      const complexNotesArray = Array.from({ length: 50 }, (_, index) => ({
        text: `Complex note ${index + 1} with very long text content that simulates real-world usage scenarios where notes might contain detailed observations, character descriptions, plot points, and other narrative elements that would typically be found in a living narrative engine context.`,
        subject: `Complex Subject ${(index % 5) + 1}`,
        subjectType:
          Object.values(SUBJECT_TYPES)[
            index % Object.values(SUBJECT_TYPES).length
          ],
        context: `Detailed context ${index + 1} with additional information`,
        tags: Array.from({ length: 10 }, (_, tagIndex) => `tag${tagIndex}`),
        timestamp: new Date(2024, 0, 1, index % 24, index % 60).toISOString(),
        // Add nested metadata to simulate complex structures
        metadata: {
          importance: index % 5,
          category: `category${index % 3}`,
          relatedNotes: Array.from({ length: 3 }, (_, i) => `note${i}`),
        },
      }));

      const gameStateDto = {
        actorState: {
          components: {
            'core:notes': {
              notes: complexNotesArray,
            },
          },
        },
        actorPromptData: { name: 'Test Character' },
        currentUserInput: '',
        perceptionLog: [],
        currentLocation: {
          name: 'Test Location',
          description: 'A test location',
          exits: [],
          characters: [],
        },
        availableActions: [],
      };

      const startTime = performance.now();

      const promptData = await promptContentProvider.getPromptData(
        gameStateDto,
        mockLogger
      );

      const groupedContent = promptDataFormatter.formatNotes(
        promptData.notesArray,
        { groupBySubject: true }
      );

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Should handle complex notes efficiently (< 150ms for 50 complex notes)
      expect(processingTime).toBeLessThan(150);
      expect(promptData.notesArray).toHaveLength(50);
      expect(groupedContent).toBeTruthy();
    });

    test('should maintain performance with many unique subjects', async () => {
      // Create notes with all unique subjects (worst case for grouping)
      const uniqueSubjectNotes = Array.from({ length: 100 }, (_, index) => ({
        text: `Note for unique subject ${index + 1}`,
        subject: `Unique Subject ${index + 1}`, // All unique
        subjectType:
          Object.values(SUBJECT_TYPES)[
            index % Object.values(SUBJECT_TYPES).length
          ],
        context: `Context ${index + 1}`,
        timestamp: new Date(2024, 0, 1, index % 24).toISOString(),
      }));

      const gameStateDto = {
        actorState: {
          components: {
            'core:notes': {
              notes: uniqueSubjectNotes,
            },
          },
        },
        actorPromptData: { name: 'Test Character' },
        currentUserInput: '',
        perceptionLog: [],
        currentLocation: {
          name: 'Test Location',
          description: 'A test location',
          exits: [],
          characters: [],
        },
        availableActions: [],
      };

      const startTime = performance.now();

      const promptData = await promptContentProvider.getPromptData(
        gameStateDto,
        mockLogger
      );

      const groupedContent = promptDataFormatter.formatNotes(
        promptData.notesArray,
        { groupBySubject: true }
      );

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Should handle many unique subjects efficiently
      expect(processingTime).toBeLessThan(200);
      expect(promptData.notesArray).toHaveLength(100);

      // Verify all unique subjects are present
      for (let i = 1; i <= 100; i++) {
        expect(groupedContent).toContain(`### Unique Subject ${i}`);
      }
    });
  });
});
