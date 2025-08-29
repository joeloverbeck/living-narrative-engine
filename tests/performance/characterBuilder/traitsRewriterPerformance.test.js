/**
 * @file Performance tests for TraitsRewriter workflows
 * @description Tests TraitsRewriter performance under realistic load conditions,
 * complex character data, and concurrent processing scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('TraitsRewriter Performance', () => {
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

    // Also ensure schema validator is permissive for performance testing
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

  describe('Complex Data Performance', () => {
    it('should maintain acceptable performance with complex character data', async () => {
      const complexCharacterData = {
        'core:name': { text: 'Elena Vasquez' },
        'core:personality': { 
          text: 'Analytical software engineer with perfectionist tendencies and deep expertise in multiple programming languages, databases, and system architecture. Known for meticulous attention to detail and innovative problem-solving approaches.' 
        },
        'core:likes': { 
          text: 'Clean code, challenging algorithms, espresso, mystery novels, jazz music, late-night coding sessions, pair programming, code reviews, open source contributions, and mentoring junior developers' 
        },
        'core:dislikes': { 
          text: 'Technical debt, meetings without agenda, inefficient processes, poorly documented code, spaghetti code, unrealistic deadlines, and interruptions during deep work' 
        },
        'core:fears': { 
          text: 'Public speaking, being seen as incompetent, system failures, impostor syndrome, critical bugs in production, and letting the team down during important releases' 
        },
        'core:goals': { 
          text: 'Lead a development team, contribute to open source projects, mentor junior developers, architect scalable systems, write technical books, and speak at conferences' 
        },
      };

      const startTime = performance.now();
      
      // Execute complete workflow with complex data
      const result = await services.generator.generateRewrittenTraits(complexCharacterData);
      // Process mock response separately (generator processes LLM internally)
      const mockRawResponse = JSON.stringify({
        characterName: 'Test Character',
        rewrittenTraits: {
          'core:personality': 'I am a test character with complex personality traits.',
          'core:likes': 'I enjoy testing and performance validation.',
          'core:fears': 'I fear system failures and poor performance.',
          'core:goals': 'I strive to maintain excellent performance under all conditions.',
          'core:dislikes': 'I dislike inefficient processes and slow responses.',
        }
      });
      const processed = await services.processor.processResponse(
        mockRawResponse,
        complexCharacterData
      );
      const enhanced = services.enhancer.enhanceForDisplay(
        processed.rewrittenTraits,
        { characterName: processed.characterName }
      );
      
      const duration = performance.now() - startTime;

      // Assertions
      expect(result).toHaveProperty('rewrittenTraits');
      expect(processed).toHaveProperty('characterName');
      expect(enhanced.sections).toHaveLength(5); // personality, likes, dislikes, fears, goals

      // Performance assertion - should complete within 5 seconds (including simulated LLM time)
      expect(duration).toBeLessThan(5000);
      
      // Log performance for monitoring
      mockLogger.info(`Complex character processing completed in ${duration.toFixed(2)}ms`);
    });

    it('should handle multiple trait types efficiently', async () => {
      const multiTraitCharacter = {
        'core:name': { text: 'Multi-Trait Character' },
        'core:personality': { text: 'Complex personality trait' },
        'core:likes': { text: 'Multiple likes and preferences' },
        'core:dislikes': { text: 'Several dislikes and aversions' },
        'core:fears': { text: 'Various fears and anxieties' },
        'core:goals': { text: 'Ambitious goals and aspirations' },
        'core:values': { text: 'Strong moral values and principles' },
        'core:quirks': { text: 'Unique quirks and mannerisms' },
        'core:background': { text: 'Rich background and history' },
      };

      const startTime = performance.now();
      
      const result = await services.generator.generateRewrittenTraits(multiTraitCharacter);
      // Process mock response separately (generator processes LLM internally)
      const mockRawResponse = JSON.stringify({
        characterName: 'Multi-Trait Character',
        rewrittenTraits: {
          'core:personality': 'Complex personality trait',
          'core:likes': 'Multiple likes and preferences',
          'core:dislikes': 'Several dislikes and aversions',
          'core:fears': 'Various fears and anxieties',
          'core:goals': 'Ambitious goals and aspirations',
          'core:values': 'Strong moral values and principles',
          'core:quirks': 'Unique quirks and mannerisms',
          'core:background': 'Rich background and history',
        }
      });
      const processed = await services.processor.processResponse(
        mockRawResponse,
        multiTraitCharacter
      );
      const enhanced = services.enhancer.enhanceForDisplay(
        processed.rewrittenTraits,
        { characterName: processed.characterName }
      );
      
      const duration = performance.now() - startTime;

      // Should handle multiple trait types without significant performance degradation
      expect(enhanced.sections.length).toBeGreaterThanOrEqual(5);
      expect(duration).toBeLessThan(6000); // Slightly higher threshold for more data

      // Verify all trait types were processed
      expect(Object.keys(processed.rewrittenTraits).length).toBeGreaterThanOrEqual(5);
    });

    it('should process large trait content efficiently', async () => {
      const largeContent = 'A '.repeat(500) + 'very detailed character description that contains extensive information about their background, motivations, relationships, and complex psychological profile.';
      
      const largeContentCharacter = {
        'core:name': { text: 'Large Content Character' },
        'core:personality': { text: largeContent },
        'core:likes': { text: largeContent },
        'core:fears': { text: largeContent },
      };

      const startTime = performance.now();
      
      const result = await services.generator.generateRewrittenTraits(largeContentCharacter);
      // Process mock response separately (generator processes LLM internally)
      const mockRawResponse = JSON.stringify({
        characterName: 'Large Content Character',
        rewrittenTraits: {
          'core:personality': 'Large personality content processed efficiently',
          'core:likes': 'Large likes content processed efficiently',
          'core:fears': 'Large fears content processed efficiently',
        }
      });
      const processed = await services.processor.processResponse(
        mockRawResponse,
        largeContentCharacter
      );
      
      const duration = performance.now() - startTime;

      // Should handle large content without excessive processing time
      expect(duration).toBeLessThan(3000);
      expect(processed.rewrittenTraits).toBeDefined();
      expect(Object.keys(processed.rewrittenTraits).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Concurrent Processing Performance', () => {
    it('should handle concurrent requests efficiently', async () => {
      const characterData = {
        'core:name': { text: 'Concurrent Test Character' },
        'core:personality': { text: 'A test character for concurrent processing' },
        'core:likes': { text: 'Parallel processing and efficiency' },
      };

      // Create 5 concurrent requests
      const promises = Array(5)
        .fill(null)
        .map((_, index) => {
          const testData = {
            ...characterData,
            'core:name': { text: `Concurrent Character ${index + 1}` }
          };
          return services.generator.generateRewrittenTraits(testData);
        });

      const startTime = performance.now();
      const results = await Promise.all(promises);
      const duration = performance.now() - startTime;

      // All should succeed
      results.forEach((result, index) => {
        expect(result).toHaveProperty('rewrittenTraits');
        mockLogger.info(`Concurrent request ${index + 1} completed successfully`);
      });

      // Should not take more than 10 seconds for 5 concurrent requests
      expect(duration).toBeLessThan(10000);
      
      // Log concurrent processing performance
      mockLogger.info(`5 concurrent requests completed in ${duration.toFixed(2)}ms`);
    });

    it('should maintain response quality under concurrent load', async () => {
      const baseCharacter = {
        'core:name': { text: 'Base Character' },
        'core:personality': { text: 'Baseline personality for load testing' },
      };

      // Create 3 different character variants for concurrent processing
      const characterVariants = [
        { ...baseCharacter, 'core:name': { text: 'Character A' }, 'core:likes': { text: 'Variant A likes' } },
        { ...baseCharacter, 'core:name': { text: 'Character B' }, 'core:fears': { text: 'Variant B fears' } },
        { ...baseCharacter, 'core:name': { text: 'Character C' }, 'core:goals': { text: 'Variant C goals' } },
      ];

      const promises = characterVariants.map(async (character) => {
        const generated = await services.generator.generateRewrittenTraits(character);
        // Process mock response separately (generator processes LLM internally)
        const mockRawResponse = JSON.stringify({
          characterName: character['core:name'].text,
          rewrittenTraits: {
            'core:personality': 'Baseline personality for load testing',
            'core:likes': character['core:likes'] ? character['core:likes'].text : 'Default likes',
            'core:fears': character['core:fears'] ? character['core:fears'].text : 'Default fears',
            'core:goals': character['core:goals'] ? character['core:goals'].text : 'Default goals',
          }
        });
        const processed = await services.processor.processResponse(
          mockRawResponse,
          character
        );
        const enhanced = services.enhancer.enhanceForDisplay(
          processed.rewrittenTraits,
          { characterName: processed.characterName }
        );
        return { processed, enhanced };
      });

      const results = await Promise.all(promises);

      // Verify all results maintain quality
      results.forEach((result, index) => {
        expect(result.processed.rewrittenTraits).toBeDefined();
        expect(result.enhanced.sections).toBeDefined();
        expect(result.processed.characterName).toContain('Character');
        
        mockLogger.info(`Concurrent result ${index + 1} quality validated`);
      });
    });

    it('should handle rapid sequential requests without degradation', async () => {
      const character = {
        'core:name': { text: 'Sequential Test Character' },
        'core:personality': { text: 'Testing sequential processing' },
      };

      const timings = [];
      
      // Execute 3 rapid sequential requests
      for (let i = 0; i < 3; i++) {
        const startTime = performance.now();
        
        const testCharacter = {
          ...character,
          'core:name': { text: `Sequential Character ${i + 1}` }
        };
        
        await services.generator.generateRewrittenTraits(testCharacter);
        
        const duration = performance.now() - startTime;
        timings.push(duration);
        
        mockLogger.info(`Sequential request ${i + 1} completed in ${duration.toFixed(2)}ms`);
      }

      // Performance should not significantly degrade with each request
      const averageTime = timings.reduce((sum, time) => sum + time, 0) / timings.length;
      const maxTime = Math.max(...timings);
      
      // Max time should not exceed average by more than 200%
      expect(maxTime).toBeLessThan(averageTime * 3);
      
      // All requests should complete within reasonable time
      timings.forEach((timing) => {
        expect(timing).toBeLessThan(3000);
      });
    });
  });

  describe('Error Recovery Performance', () => {
    it('should recover from errors quickly without affecting subsequent requests', async () => {
      // First, cause an error
      const invalidCharacter = { invalid: 'data' };
      
      try {
        await services.generator.generateRewrittenTraits(invalidCharacter);
      } catch (error) {
        // Expected error
      }
      
      // Now test recovery with valid data
      const validCharacter = {
        'core:name': { text: 'Recovery Test Character' },
        'core:personality': { text: 'Testing error recovery' },
      };
      
      const startTime = performance.now();
      const result = await services.generator.generateRewrittenTraits(validCharacter);
      const duration = performance.now() - startTime;
      
      // Should recover and process normally
      expect(result).toHaveProperty('rewrittenTraits');
      expect(duration).toBeLessThan(2000); // Should not be significantly slower after error
      
      mockLogger.info(`Error recovery completed in ${duration.toFixed(2)}ms`);
    });

    it('should handle validation errors efficiently', async () => {
      const timings = [];
      
      // Test multiple validation error scenarios
      const invalidScenarios = [
        { 'invalid:component': { text: 'Invalid component' } },
        { 'core:name': { invalidStructure: true } },
        { 'core:personality': 'Invalid structure - should be object' },
      ];
      
      for (const scenario of invalidScenarios) {
        const startTime = performance.now();
        
        try {
          await services.generator.generateRewrittenTraits(scenario);
        } catch (error) {
          // Expected validation error
        }
        
        const duration = performance.now() - startTime;
        timings.push(duration);
      }
      
      // Validation errors should be caught quickly
      const averageErrorTime = timings.reduce((sum, time) => sum + time, 0) / timings.length;
      expect(averageErrorTime).toBeLessThan(100); // Fast validation failure
      
      mockLogger.info(`Average validation error handling: ${averageErrorTime.toFixed(2)}ms`);
    });
  });

  describe('Performance Thresholds Validation', () => {
    it('should meet response time requirements for standard workflow', async () => {
      const standardCharacter = {
        'core:name': { text: 'Standard Performance Character' },
        'core:personality': { text: 'Standard personality for performance baseline' },
        'core:likes': { text: 'Standard likes for testing' },
        'core:fears': { text: 'Standard fears for validation' },
      };

      const startTime = performance.now();
      
      const generated = await services.generator.generateRewrittenTraits(standardCharacter);
      // Process mock response separately (generator processes LLM internally)
      const mockRawResponse = JSON.stringify({
        characterName: 'Standard Performance Character',
        rewrittenTraits: {
          'core:personality': 'Standard personality for performance baseline',
          'core:likes': 'Standard likes for testing',
          'core:fears': 'Standard fears for validation',
        }
      });
      const processed = await services.processor.processResponse(
        mockRawResponse,
        standardCharacter
      );
      const enhanced = services.enhancer.enhanceForDisplay(
        processed.rewrittenTraits,
        { characterName: processed.characterName }
      );
      
      const duration = performance.now() - startTime;

      // Performance requirements (excluding LLM call time since mocked)
      expect(enhanced.sections).toHaveLength(3);
      expect(duration).toBeLessThan(2000); // 2 second threshold for complete workflow
      
      // Log baseline performance
      mockLogger.info(`Standard workflow baseline: ${duration.toFixed(2)}ms`);
    });

    it('should maintain performance consistency across multiple runs', async () => {
      const character = {
        'core:name': { text: 'Consistency Test Character' },
        'core:personality': { text: 'Testing performance consistency' },
      };

      const timings = [];
      const runs = 5;
      
      for (let i = 0; i < runs; i++) {
        const testCharacter = {
          ...character,
          'core:name': { text: `Consistency Character ${i + 1}` }
        };
        
        const startTime = performance.now();
        await services.generator.generateRewrittenTraits(testCharacter);
        const duration = performance.now() - startTime;
        
        timings.push(duration);
      }
      
      const averageTime = timings.reduce((sum, time) => sum + time, 0) / timings.length;
      const maxDeviation = Math.max(...timings.map(time => Math.abs(time - averageTime)));
      
      // Performance should be consistent (deviation less than 50% of average)
      expect(maxDeviation).toBeLessThan(averageTime * 0.5);
      
      mockLogger.info(`Performance consistency: avg=${averageTime.toFixed(2)}ms, max_dev=${maxDeviation.toFixed(2)}ms`);
    });
  });
});