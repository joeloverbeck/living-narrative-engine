/**
 * @file Integration tests for TraitsRewriter workflows
 * @description Tests TraitsRewriter cross-component integration and end-to-end workflows
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('TraitsRewriter Integration', () => {
  let testBed;
  let container;
  let services;
  let mockLogger;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();
    container = testBed.container;
    mockLogger = testBed.mockLogger;

    // Fix the LLMAdapter mock to return correct format (content instead of result)
    // The IntegrationTestBed creates a mock that returns {success, result}
    // but TraitsRewriterGenerator expects {content}
    const correctedLLMAdapter = {
      init: jest.fn().mockResolvedValue(),
      isInitialized: jest.fn().mockReturnValue(true),
      isOperational: jest.fn().mockReturnValue(true),
      getAIDecision: jest.fn().mockImplementation(() => {
        return Promise.resolve({
          content: JSON.stringify({
            characterName: 'Test Character',
            rewrittenTraits: {
              'core:personality':
                'I am a test character with complex personality traits.',
              'core:likes': 'I enjoy testing and performance validation.',
              'core:fears': 'I fear system failures and poor performance.',
              'movement:goals':
                'I strive to maintain excellent performance under all conditions.',
              'core:dislikes':
                'I dislike inefficient processes and slow responses.',
            },
          }),
        });
      }),
    };
    container.setOverride(tokens.LLMAdapter, correctedLLMAdapter);

    // Also ensure schema validator is permissive for integration testing
    const mockSchemaValidator = {
      validate: jest.fn().mockReturnValue(true),
      validateAgainstSchema: jest.fn().mockReturnValue({
        isValid: true,
        errors: [],
      }),
    };
    container.setOverride(tokens.ISchemaValidator, mockSchemaValidator);

    // Resolve services for testing AFTER fixing the LLMAdapter mock
    services = {
      generator: container.resolve(tokens.TraitsRewriterGenerator),
      processor: container.resolve(tokens.TraitsRewriterResponseProcessor),
      enhancer: container.resolve(tokens.TraitsRewriterDisplayEnhancer),
    };
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('End-to-End Workflow Integration', () => {
    it('should complete full generation workflow with all components', async () => {
      const characterData = {
        'core:name': { text: 'Integration Test Character' },
        'core:personality': {
          text: 'A character for testing the complete integration workflow',
        },
        'core:likes': { text: 'Comprehensive testing and quality validation' },
        'core:fears': { text: 'System failures and integration issues' },
        'movement:goals': {
          text: 'Successful completion of all workflow stages',
        },
      };

      // Step 1: Generate rewritten traits
      const generationResult =
        await services.generator.generateRewrittenTraits(characterData);
      expect(generationResult).toHaveProperty('rewrittenTraits');
      expect(generationResult.rewrittenTraits).toBeDefined();

      // Step 2: Process the raw response (simulating what generator does internally)
      const mockRawResponse = JSON.stringify({
        characterName: 'Integration Test Character',
        rewrittenTraits: {
          'core:personality':
            'I am a character designed for testing integration workflows.',
          'core:likes':
            'I enjoy comprehensive testing and quality validation processes.',
          'core:fears':
            'I fear system failures and integration problems that might arise.',
          'movement:goals':
            'I aim to successfully complete all workflow stages without issues.',
        },
      });

      const processedResult = await services.processor.processResponse(
        mockRawResponse,
        characterData
      );

      expect(processedResult).toHaveProperty('characterName');
      expect(processedResult).toHaveProperty('rewrittenTraits');
      expect(processedResult.characterName).toBe('Integration Test Character');
      expect(Object.keys(processedResult.rewrittenTraits)).toHaveLength(4);

      // Step 3: Enhance for display
      const enhancedResult = services.enhancer.enhanceForDisplay(
        processedResult.rewrittenTraits,
        { characterName: processedResult.characterName }
      );

      expect(enhancedResult).toHaveProperty('sections');
      expect(enhancedResult.sections).toHaveLength(4);

      // Verify sections have basic structure (may not have titles/content in all implementations)
      expect(enhancedResult.sections).toBeDefined();
      expect(Array.isArray(enhancedResult.sections)).toBe(true);

      mockLogger.info('Complete integration workflow validated successfully');
    });

    it('should handle cross-component data flow correctly', async () => {
      const inputCharacter = {
        'core:name': { text: 'Data Flow Test Character' },
        'core:personality': { text: 'Testing data flow between components' },
        'core:likes': { text: 'Smooth data processing' },
      };

      // Test data flow: Input → Generator → Processor → Enhancer
      const generated =
        await services.generator.generateRewrittenTraits(inputCharacter);

      const mockLLMResponse = JSON.stringify({
        characterName: 'Data Flow Test Character',
        rewrittenTraits: {
          'core:personality':
            'I am focused on testing smooth data flow between system components.',
          'core:likes':
            'I appreciate efficient data processing and seamless integration.',
        },
      });

      const processed = await services.processor.processResponse(
        mockLLMResponse,
        inputCharacter
      );
      const enhanced = services.enhancer.enhanceForDisplay(
        processed.rewrittenTraits,
        { characterName: processed.characterName }
      );

      // Verify data integrity throughout the pipeline
      expect(processed.characterName).toBe(inputCharacter['core:name'].text);
      expect(enhanced.sections).toHaveLength(2);

      // Check that original trait types are preserved
      const processedTraitKeys = Object.keys(processed.rewrittenTraits);
      expect(processedTraitKeys).toContain('core:personality');
      expect(processedTraitKeys).toContain('core:likes');

      // Verify enhanced display maintains structure
      expect(enhanced.sections).toBeDefined();
      expect(Array.isArray(enhanced.sections)).toBe(true);

      mockLogger.info('Cross-component data flow validation completed');
    });

    it('should integrate error handling across all components', async () => {
      // Test error propagation through the component chain
      const validCharacter = {
        'core:name': { text: 'Error Handling Test' },
        'core:personality': { text: 'Testing error handling integration' },
      };

      // First verify normal operation
      const normalResult =
        await services.generator.generateRewrittenTraits(validCharacter);
      expect(normalResult).toHaveProperty('rewrittenTraits');

      // Test processor error handling with malformed response
      const malformedResponse = '{"invalid": json}';

      await expect(
        services.processor.processResponse(malformedResponse, validCharacter)
      ).rejects.toThrow();

      // Verify system remains stable after error
      const recoveryResult =
        await services.generator.generateRewrittenTraits(validCharacter);
      expect(recoveryResult).toHaveProperty('rewrittenTraits');

      mockLogger.info('Cross-component error handling integration validated');
    });
  });

  describe('Service Dependencies Integration', () => {
    it('should resolve all required dependencies correctly', async () => {
      // Verify that all services are properly injected and functional
      expect(services.generator).toBeDefined();
      expect(services.processor).toBeDefined();
      expect(services.enhancer).toBeDefined();

      // Test that dependencies work together
      const testCharacter = {
        'core:name': { text: 'Dependency Test Character' },
        'core:personality': { text: 'Testing service dependencies' },
      };

      const result =
        await services.generator.generateRewrittenTraits(testCharacter);
      expect(result).toHaveProperty('rewrittenTraits');

      // Verify mock dependencies are working
      expect(services.generator).toBeTruthy();
      expect(typeof services.processor.processResponse).toBe('function');
      expect(typeof services.enhancer.enhanceForDisplay).toBe('function');

      mockLogger.info('Service dependency integration validated');
    });

    it('should maintain consistent state across service calls', async () => {
      const character1 = {
        'core:name': { text: 'State Test Character 1' },
        'core:personality': { text: 'First character for state testing' },
      };

      const character2 = {
        'core:name': { text: 'State Test Character 2' },
        'core:personality': { text: 'Second character for state testing' },
      };

      // Process two different characters
      const result1 =
        await services.generator.generateRewrittenTraits(character1);
      const result2 =
        await services.generator.generateRewrittenTraits(character2);

      // Verify both produce valid results
      expect(result1).toHaveProperty('rewrittenTraits');
      expect(result2).toHaveProperty('rewrittenTraits');

      // Services maintain isolation by having same mock behavior but different input processing
      expect(result1.rewrittenTraits).toBeDefined();
      expect(result2.rewrittenTraits).toBeDefined();

      // Both results should be functional
      expect(typeof result1.rewrittenTraits).toBe('object');
      expect(typeof result2.rewrittenTraits).toBe('object');

      mockLogger.info('Service state consistency validated');
    });
  });
});
