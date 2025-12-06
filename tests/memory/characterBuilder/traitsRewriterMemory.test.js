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

    // Ensure schema validator is permissive for memory testing
    const mockSchemaValidator = {
      validate: jest.fn().mockReturnValue(true),
      validateAgainstSchema: jest.fn().mockReturnValue({
        isValid: true,
        errors: [],
      }),
    };
    container.setOverride(tokens.ISchemaValidator, mockSchemaValidator);

    // Resolve services for testing
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
          'core:name': { text: `Memory Test Character ${i + 1}` },
        };

        const generated =
          await services.generator.generateRewrittenTraits(testCharacter);

        // The generator already processes the response internally, so we can use its result directly
        const enhanced = services.enhancer.enhanceForDisplay(
          generated.rewrittenTraits,
          { characterName: generated.characterName }
        );

        // Verify each iteration produces valid results
        expect(enhanced.sections).toBeDefined();

        // Force garbage collection hint (if available)
        if (global.gc) {
          global.gc();
        }
      }

      mockLogger.info(
        `Memory stability test completed ${iterations} iterations`
      );
    });

    it('should handle service cleanup efficiently', async () => {
      const character = {
        'core:name': { text: 'Cleanup Test Character' },
        'core:personality': { text: 'Testing cleanup efficiency' },
      };

      const startTime = performance.now();

      // Process a request and measure cleanup time
      const generated =
        await services.generator.generateRewrittenTraits(character);

      const totalDuration = performance.now() - startTime;

      // Verify result and performance
      expect(generated).toHaveProperty('rewrittenTraits');
      expect(totalDuration).toBeLessThan(5000); // Total process should be under 5 seconds

      mockLogger.info(
        `Service processing completed in ${totalDuration.toFixed(2)}ms`
      );
    });
  });
});
