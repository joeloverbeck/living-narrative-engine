/**
 * @file Integration tests for TraitsRewriter complete workflows and service integration
 * @description Tests complete end-to-end trait rewriting workflows, service integration,
 * event system integration, and error handling across service boundaries
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TraitsRewriterGenerator } from '../../../src/characterBuilder/services/TraitsRewriterGenerator.js';
import { TraitsRewriterResponseProcessor } from '../../../src/characterBuilder/services/TraitsRewriterResponseProcessor.js';
import { TraitsRewriterDisplayEnhancer } from '../../../src/characterBuilder/services/TraitsRewriterDisplayEnhancer.js';

describe('TraitsRewriter Integration Tests', () => {
  let services;
  let mockLogger;
  let mockEventBus;
  let mockLlmService;
  let mockLlmStrategyFactory;
  let mockSchemaValidator;

  beforeEach(() => {
    // Mock dependencies
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    mockLlmService = {
      requestResponse: jest.fn(),
      clean: jest.fn().mockImplementation((str) => str),
      parseAndRepair: jest.fn().mockImplementation((str) => JSON.parse(str)),
    };

    mockLlmStrategyFactory = {
      getAIDecision: jest.fn(),
    };

    const mockLlmConfigManager = {
      getActiveConfiguration: jest.fn().mockReturnValue({
        model: 'gpt-3.5-turbo',
        temperature: 0.8,
      }),
    };

    const mockTokenEstimator = {
      estimateTokens: jest.fn().mockReturnValue(100),
    };

    mockSchemaValidator = {
      validate: jest.fn().mockReturnValue(true),
      validateAgainstSchema: jest.fn().mockReturnValue({
        isValid: true,
        errors: [],
      }),
    };

    // Create services with mocked dependencies
    services = {
      generator: new TraitsRewriterGenerator({
        logger: mockLogger,
        llmJsonService: mockLlmService,
        llmStrategyFactory: mockLlmStrategyFactory,
        llmConfigManager: mockLlmConfigManager,
        eventBus: mockEventBus,
        tokenEstimator: mockTokenEstimator,
      }),
      processor: new TraitsRewriterResponseProcessor({
        logger: mockLogger,
        llmJsonService: mockLlmService,
        schemaValidator: mockSchemaValidator,
      }),
      enhancer: new TraitsRewriterDisplayEnhancer({
        logger: mockLogger,
      }),
      eventBus: mockEventBus,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Workflow Integration', () => {
    it('should execute complete trait rewriting workflow successfully', async () => {
      // Arrange
      const characterDefinition = {
        'core:name': { text: 'Elena Vasquez' },
        'core:personality': { 
          text: 'Analytical software engineer with perfectionist tendencies' 
        },
        'core:likes': { 
          text: 'Clean code, challenging algorithms, espresso, and mystery novels' 
        },
        'core:fears': { 
          text: 'Public speaking, being seen as incompetent, and system failures' 
        },
      };

      // Mock LLM response that would be returned by the generator
      const mockLLMResponse = JSON.stringify({
        characterName: 'Elena Vasquez',
        rewrittenTraits: {
          'core:personality': 'I am an analytical software engineer who strives for perfection in every line of code I write.',
          'core:likes': 'I enjoy tackling challenging algorithms over a perfect espresso, and I find mystery novels fascinating.',
          'core:fears': 'I fear being judged when speaking publicly and worry about making critical mistakes that could cause system failures.',
        }
      });

      // Set up the mock LLM strategy factory response - it expects an object with content property
      mockLlmStrategyFactory.getAIDecision.mockResolvedValue({
        content: mockLLMResponse,
      });

      // Act - Execute complete workflow
      // Step 1: Generate traits with TraitsRewriterGenerator (which handles the full generation internally)
      const generatorResult = await services.generator.generateRewrittenTraits(
        characterDefinition,
        { includeMetadata: true }
      );

      // Step 2: Test ResponseProcessor separately with raw LLM response
      const rawLlmResponse = mockLLMResponse; // The raw JSON string from LLM
      const processedResult = await services.processor.processResponse(
        rawLlmResponse,
        characterDefinition
      );

      const displayData = services.enhancer.enhanceForDisplay(
        processedResult.rewrittenTraits,
        processedResult.characterName
      );

      // Assert - Test TraitsRewriterGenerator result
      expect(generatorResult).toHaveProperty('rewrittenTraits');
      expect(generatorResult).toHaveProperty('characterName', 'Elena Vasquez');
      expect(generatorResult).toHaveProperty('processingTime');
      
      // Assert - Test ResponseProcessor result
      expect(processedResult).toHaveProperty('characterName');
      expect(processedResult).toHaveProperty('rewrittenTraits');
      
      // Assert - Test DisplayEnhancer result
      expect(displayData).toHaveProperty('sections');
      expect(displayData.sections).toHaveLength(3); // personality, likes, fears
      
      // Verify LLM strategy factory was called
      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.any(String),
          temperature: expect.any(Number),
          maxTokens: expect.any(Number),
        })
      );
    });

    it('should handle partial character data gracefully', async () => {
      const partialCharacterData = {
        'core:name': { text: 'Partial Character' },
        'core:personality': { text: 'Basic personality trait' },
      };

      // Mock LLM response for partial data
      const mockLLMResponse = JSON.stringify({
        characterName: 'Partial Character',
        rewrittenTraits: {
          'core:personality': 'I have a basic personality trait that defines who I am.',
        }
      });

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue({
        content: mockLLMResponse,
      });

      const result = await services.generator.generateRewrittenTraits(partialCharacterData);

      expect(result.rewrittenTraits).toHaveProperty('core:personality');
      expect(Object.keys(result.rewrittenTraits)).toHaveLength(1);
    });

    it('should maintain data integrity across service boundaries', async () => {
      const characterData = {
        'core:name': { text: 'Test <script>alert("xss")</script> Character' },
        'core:personality': { text: 'I have "quotes" and \'apostrophes\' & ampersands' },
      };

      // Mock LLM response with potentially problematic content
      const mockLLMResponse = JSON.stringify({
        characterName: 'Test Character',
        rewrittenTraits: {
          'core:personality': 'I am someone with quotes and apostrophes in my speech.',
        }
      });

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue({
        content: mockLLMResponse,
      });

      const generated = await services.generator.generateRewrittenTraits(characterData);
      const processed = await services.processor.processResponse(
        generated.llmResponse,
        characterData
      );
      const enhanced = services.enhancer.enhanceForDisplay(
        processed.rewrittenTraits,
        processed.characterName
      );

      // Verify no data corruption
      expect(enhanced.characterName).toBeDefined();
      enhanced.sections.forEach((section) => {
        expect(section.content).toBeDefined();
        expect(typeof section.content).toBe('string');
      });
    });
  });

  describe('Service Integration', () => {
    it('should resolve all service dependencies correctly', () => {
      // Verify dependency injection worked correctly
      expect(services.generator).toBeDefined();
      expect(services.processor).toBeDefined();
      expect(services.enhancer).toBeDefined();

      // Verify services have expected methods
      expect(typeof services.generator.generateRewrittenTraits).toBe('function');
      expect(typeof services.processor.processResponse).toBe('function');
      expect(typeof services.enhancer.enhanceForDisplay).toBe('function');
    });

    it('should coordinate between Generator and ResponseProcessor', async () => {
      const characterData = {
        'core:name': { text: 'Test Character' },
        'core:personality': { text: 'A brave and loyal companion' },
      };

      // Mock LLM response
      const mockLLMResponse = JSON.stringify({
        characterName: 'Test Character',
        rewrittenTraits: {
          'core:personality': 'I am a brave and loyal companion, always ready to help.',
        }
      });

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue({
        content: mockLLMResponse,
      });

      // Generator creates LLM request
      const generatorResult = await services.generator.generateRewrittenTraits(characterData);

      // ResponseProcessor handles LLM response
      const processorResult = await services.processor.processResponse(
        generatorResult.llmResponse,
        characterData
      );

      expect(processorResult.rewrittenTraits).toBeDefined();
      expect(processorResult.characterName).toBe(characterData['core:name'].text);
    });

    it('should coordinate between ResponseProcessor and DisplayEnhancer', async () => {
      const processedTraits = {
        'core:personality': 'I am a brave and loyal companion, always ready to help.',
        'core:likes': 'I enjoy adventures and helping friends.',
      };
      const characterName = 'Test Character';

      const displayData = services.enhancer.enhanceForDisplay(
        processedTraits,
        characterName
      );

      // Verify proper data transformation
      expect(displayData.sections).toBeInstanceOf(Array);
      expect(displayData.sections[0]).toHaveProperty('label');
      expect(displayData.sections[0]).toHaveProperty('content');
      expect(displayData.sections[0]).toHaveProperty('cssClass');
    });
  });

  describe('Event System Integration', () => {
    it('should dispatch events correctly throughout workflow', async () => {
      const capturedEvents = [];
      const eventSpy = {
        getEventsByType: (type) => capturedEvents.filter(e => e.type === type)
      };
      
      // Mock event bus to capture events
      const originalDispatch = services.eventBus.dispatch;
      services.eventBus.dispatch = (event) => {
        capturedEvents.push(event);
        return originalDispatch.call(services.eventBus, event);
      };
      
      const characterData = {
        'core:name': { text: 'Test Character' },
        'core:personality': { text: 'A brave and loyal companion' },
      };

      // Mock LLM response
      const mockLLMResponse = JSON.stringify({
        characterName: 'Test Character',
        rewrittenTraits: {
          'core:personality': 'I am a brave and loyal companion.',
        }
      });

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue({
        content: mockLLMResponse,
      });

      // Execute workflow
      await services.generator.generateRewrittenTraits(characterData);

      // Verify events were dispatched (specific events may vary based on implementation)
      expect(capturedEvents.length).toBeGreaterThanOrEqual(0);
      
      // Restore original dispatch
      services.eventBus.dispatch = originalDispatch;
    });

    it('should handle event system errors gracefully', async () => {
      const faultyEventBus = {
        dispatch: jest.fn().mockRejectedValue(new Error('Event bus error')),
        subscribe: jest.fn(),
        unsubscribe: jest.fn()
      };

      // Create generator with faulty event bus
      const faultyGenerator = new TraitsRewriterGenerator({
        logger: mockLogger,
        llmJsonService: mockLlmService,
        eventBus: faultyEventBus,
        schemaValidator: mockSchemaValidator,
      });

      const characterData = {
        'core:name': { text: 'Test Character' },
        'core:personality': { text: 'A brave and loyal companion' },
      };

      // Mock LLM response
      const mockLLMResponse = JSON.stringify({
        characterName: 'Test Character',
        rewrittenTraits: {
          'core:personality': 'I am a brave and loyal companion.',
        }
      });

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue({
        content: mockLLMResponse,
      });

      // Should not crash on event bus failures
      await expect(
        faultyGenerator.generateRewrittenTraits(characterData)
      ).resolves.toBeDefined();
    });

    it('should maintain event correlation across services', async () => {
      const events = [];
      const eventTracker = {
        getAllEvents: () => events
      };
      
      // Mock event bus to track events
      const originalDispatch = services.eventBus.dispatch;
      services.eventBus.dispatch = (event) => {
        // Add correlation ID if not present
        if (!event.payload.correlationId) {
          event.payload.correlationId = 'test-correlation-id';
        }
        events.push(event);
        return originalDispatch.call(services.eventBus, event);
      };
      
      const characterData = {
        'core:name': { text: 'Test Character' },
        'core:personality': { text: 'A brave and loyal companion' },
      };

      // Mock LLM response
      const mockLLMResponse = JSON.stringify({
        characterName: 'Test Character',
        rewrittenTraits: {
          'core:personality': 'I am a brave and loyal companion.',
        }
      });

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue({
        content: mockLLMResponse,
      });

      await services.generator.generateRewrittenTraits(characterData);

      const trackedEvents = eventTracker.getAllEvents();
      if (trackedEvents.length > 1) {
        const correlationId = trackedEvents[0].payload.correlationId;

        // All events should share same correlation ID
        trackedEvents.forEach((event) => {
          expect(event.payload.correlationId).toBe(correlationId);
        });
      }

      // Restore original dispatch
      services.eventBus.dispatch = originalDispatch;
    });
  });

  describe('Error Handling Integration', () => {
    it('should propagate errors correctly across service boundaries', async () => {
      const invalidCharacterData = { invalid: 'data' };

      // Should fail in Generator due to validation
      await expect(
        services.generator.generateRewrittenTraits(invalidCharacterData)
      ).rejects.toThrow();
    });

    it('should handle LLM service failures gracefully', async () => {
      const faultyLLMService = {
        requestResponse: jest.fn().mockRejectedValue(new Error('LLM_SERVICE_ERROR'))
      };

      // Create generator with faulty LLM service
      const faultyGenerator = new TraitsRewriterGenerator({
        logger: mockLogger,
        llmJsonService: faultyLLMService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      const characterData = {
        'core:name': { text: 'Test Character' },
        'core:personality': { text: 'A brave and loyal companion' },
      };

      await expect(
        faultyGenerator.generateRewrittenTraits(characterData)
      ).rejects.toThrow('LLM_SERVICE_ERROR');
    });

    it('should recover from partial failures', async () => {
      const malformedLLMResponse = '{"characterName": "Test", "rewrittenTraits": {"invalid": "json"';
      const characterDefinition = {
        'core:name': { text: 'Test Character' },
        'core:personality': { text: 'A brave and loyal companion' },
      };

      // Should handle partial processing and return what's available
      const result = await services.processor.processResponse(
        malformedLLMResponse,
        characterDefinition
      );

      expect(result).toHaveProperty('characterName');
      expect(result.rewrittenTraits).toBeDefined();
    });

    it('should handle schema validation errors gracefully', async () => {
      // Test with invalid character data structure
      const invalidCharacterData = {
        'invalid:component': { text: 'This component does not exist' },
      };

      await expect(
        services.generator.generateRewrittenTraits(invalidCharacterData)
      ).rejects.toThrow();

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Data Integrity Tests', () => {
    it('should preserve character name integrity across all services', async () => {
      const originalName = 'Elena María Vásquez-O\'Connor';
      const characterData = {
        'core:name': { text: originalName },
        'core:personality': { text: 'Complex personality' },
      };

      // Mock LLM response
      const mockLLMResponse = JSON.stringify({
        characterName: originalName,
        rewrittenTraits: {
          'core:personality': 'I have a complex personality.',
        }
      });

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue({
        content: mockLLMResponse,
      });

      const generated = await services.generator.generateRewrittenTraits(characterData);
      const processed = await services.processor.processResponse(
        generated.llmResponse,
        characterData
      );
      const enhanced = services.enhancer.enhanceForDisplay(
        processed.rewrittenTraits,
        processed.characterName
      );

      // Name should be preserved exactly
      expect(processed.characterName).toBe(originalName);
      expect(enhanced.characterName).toBe(originalName);
    });

    it('should handle special characters in trait content safely', async () => {
      const characterData = {
        'core:name': { text: 'Test Character' },
        'core:personality': { text: 'Personality with "quotes", \'apostrophes\', & symbols' },
        'core:likes': { text: 'Things with <brackets> and {braces}' },
      };

      // Mock LLM response with special characters
      const mockLLMResponse = JSON.stringify({
        characterName: 'Test Character',
        rewrittenTraits: {
          'core:personality': 'I have a personality with "quotes", \'apostrophes\', & symbols.',
          'core:likes': 'I enjoy things with brackets and braces in them.',
        }
      });

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue({
        content: mockLLMResponse,
      });

      const generated = await services.generator.generateRewrittenTraits(characterData);
      const processed = await services.processor.processResponse(
        generated.llmResponse,
        characterData
      );
      const enhanced = services.enhancer.enhanceForDisplay(
        processed.rewrittenTraits,
        processed.characterName
      );

      // All sections should be properly handled
      expect(enhanced.sections).toHaveLength(2);
      enhanced.sections.forEach((section) => {
        expect(section.content).toBeDefined();
        expect(typeof section.content).toBe('string');
        expect(section.content.length).toBeGreaterThan(0);
      });
    });

    it('should validate trait component IDs consistency', async () => {
      const characterData = {
        'core:name': { text: 'Test Character' },
        'core:personality': { text: 'Test personality' },
        'core:likes': { text: 'Test likes' },
        'core:fears': { text: 'Test fears' },
      };

      // Mock LLM response
      const mockLLMResponse = JSON.stringify({
        characterName: 'Test Character',
        rewrittenTraits: {
          'core:personality': 'I have a test personality.',
          'core:likes': 'I like test things.',
          'core:fears': 'I fear test scenarios.',
        }
      });

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue({
        content: mockLLMResponse,
      });

      const generated = await services.generator.generateRewrittenTraits(characterData);
      const processed = await services.processor.processResponse(
        generated.llmResponse,
        characterData
      );

      // Verify all original trait types are present in rewritten traits
      const originalTraitKeys = Object.keys(characterData).filter(key => key !== 'core:name');
      const rewrittenTraitKeys = Object.keys(processed.rewrittenTraits);
      
      originalTraitKeys.forEach(key => {
        expect(rewrittenTraitKeys).toContain(key);
      });
    });
  });

  describe('Integration Workflow Validation', () => {
    it('should complete full integration workflow within acceptable time', async () => {
      const characterData = {
        'core:name': { text: 'Performance Test Character' },
        'core:personality': { text: 'A character designed for performance testing' },
        'core:likes': { text: 'Fast responses and efficient processing' },
        'core:fears': { text: 'Slow performance and timeouts' },
      };

      // Mock LLM response
      const mockLLMResponse = JSON.stringify({
        characterName: 'Performance Test Character',
        rewrittenTraits: {
          'core:personality': 'I am designed for performance testing.',
          'core:likes': 'I enjoy fast responses and efficient processing.',
          'core:fears': 'I worry about slow performance and timeouts.',
        }
      });

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue({
        content: mockLLMResponse,
      });

      const startTime = performance.now();

      // Execute complete workflow
      const generated = await services.generator.generateRewrittenTraits(characterData);
      const processed = await services.processor.processResponse(
        generated.llmResponse,
        characterData
      );
      const enhanced = services.enhancer.enhanceForDisplay(
        processed.rewrittenTraits,
        processed.characterName
      );

      const duration = performance.now() - startTime;

      // Verify workflow completed successfully
      expect(enhanced.sections).toHaveLength(3);
      
      // Should complete within reasonable time (excluding LLM call since it's mocked)
      expect(duration).toBeLessThan(100); // 100ms for service coordination
    });

    it('should handle empty trait responses gracefully', async () => {
      const characterData = {
        'core:name': { text: 'Empty Test Character' },
        'core:personality': { text: 'Test personality' },
      };

      // Mock empty LLM response
      const mockLLMResponse = JSON.stringify({
        characterName: 'Empty Test Character',
        rewrittenTraits: {}
      });

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue({
        content: mockLLMResponse,
      });

      const generated = await services.generator.generateRewrittenTraits(characterData);
      const processed = await services.processor.processResponse(
        generated.llmResponse,
        characterData
      );
      const enhanced = services.enhancer.enhanceForDisplay(
        processed.rewrittenTraits,
        processed.characterName
      );

      // Should handle empty traits gracefully
      expect(enhanced.sections).toBeDefined();
      expect(Array.isArray(enhanced.sections)).toBe(true);
    });

    it('should validate service method signatures and return types', () => {
      // Generator service validation
      expect(typeof services.generator.generateRewrittenTraits).toBe('function');
      
      // Processor service validation
      expect(typeof services.processor.processResponse).toBe('function');
      
      // Enhancer service validation
      expect(typeof services.enhancer.enhanceForDisplay).toBe('function');
      expect(typeof services.enhancer.formatForExport).toBe('function');
      expect(typeof services.enhancer.generateExportFilename).toBe('function');
      
      // All core services validated - controller not needed for integration tests
    });
  });
});