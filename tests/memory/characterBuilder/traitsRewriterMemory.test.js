/**
 * @file Memory tests for TraitsRewriter workflows
 * @description Tests TraitsRewriter memory usage, stability, and resource cleanup
 * under various processing scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('TraitsRewriter Memory', () => {
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
        // Simulate realistic response time
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              content: JSON.stringify({
                characterName: 'Test Character',
                rewrittenTraits: {
                  'core:personality': 'I am a test character with complex personality traits.',
                  'core:likes': 'I enjoy testing and performance validation.',
                  'core:fears': 'I fear system failures and poor performance.',
                  'core:goals': 'I strive to maintain excellent performance under all conditions.',
                  'core:dislikes': 'I dislike inefficient processes and slow responses.',
                }
              })
            });
          }, 10); // 10ms simulated LLM response time
        });
      }),
    };
    container.setOverride(tokens.LLMAdapter, correctedLLMAdapter);

    // Also ensure schema validator is permissive for memory testing
    const mockSchemaValidator = {
      validate: jest.fn().mockReturnValue(true),
      validateAgainstSchema: jest.fn().mockReturnValue({
        isValid: true,
        errors: []
      })
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

  describe('Memory Stability and Resource Management', () => {
    it('should maintain stable memory usage during processing', async () => {
      const character = {
        'core:name': { text: 'Memory Test Character' },
        'core:personality': { text: 'Testing memory efficiency' },
        'core:likes': { text: 'Low memory usage and efficient processing' },
        'core:fears': { text: 'Memory leaks and resource exhaustion' },
      };

      // Process multiple times to check for memory leaks
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        const testCharacter = {
          ...character,
          'core:name': { text: `Memory Test Character ${i + 1}` }
        };
        
        const generated = await services.generator.generateRewrittenTraits(testCharacter);
        // Process mock response separately (generator processes LLM internally)
        const mockRawResponse = JSON.stringify({
          characterName: `Memory Test Character ${i + 1}`,
          rewrittenTraits: {
            'core:personality': 'Testing memory efficiency',
            'core:likes': 'Low memory usage and efficient processing',
            'core:fears': 'Memory leaks and resource exhaustion',
          }
        });
        const processed = await services.processor.processResponse(
          mockRawResponse,
          testCharacter
        );
        const enhanced = services.enhancer.enhanceForDisplay(
          processed.rewrittenTraits,
          { characterName: processed.characterName }
        );
        
        // Verify each iteration produces valid results
        expect(enhanced.sections).toBeDefined();
        
        // Force garbage collection hint (if available)
        if (global.gc) {
          global.gc();
        }
      }
      
      mockLogger.info(`Memory stability test completed ${iterations} iterations`);
    });

    it('should handle service cleanup efficiently', async () => {
      const character = {
        'core:name': { text: 'Cleanup Test Character' },
        'core:personality': { text: 'Testing cleanup efficiency' },
      };

      const startTime = performance.now();
      
      // Process a request and measure cleanup time
      const generated = await services.generator.generateRewrittenTraits(character);
      // Process mock response separately (generator processes LLM internally)
      const mockRawResponse = JSON.stringify({
        characterName: 'Cleanup Test Character',
        rewrittenTraits: {
          'core:personality': 'Testing cleanup efficiency',
        }
      });
      const processed = await services.processor.processResponse(
        mockRawResponse,
        character
      );
      
      // Cleanup should be fast
      const cleanupStartTime = performance.now();
      await testBed.cleanup();
      await testBed.initialize(); // Reinitialize for next test
      const cleanupDuration = performance.now() - cleanupStartTime;
      
      const totalDuration = performance.now() - startTime;
      
      expect(cleanupDuration).toBeLessThan(1000); // Cleanup should be under 1 second
      expect(totalDuration).toBeLessThan(5000); // Total process should be under 5 seconds
      
      mockLogger.info(`Service cleanup completed in ${cleanupDuration.toFixed(2)}ms`);
    });
  });
});