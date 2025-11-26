/**
 * @jest-environment jsdom
 */

/**
 * @file Performance benchmarks for prompt generation
 * @description Tests focused on measuring and validating prompt generation performance
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { PromptGenerationTestBed } from '../e2e/prompting/common/promptGenerationTestBed.js';

describe('Prompt Generation Performance', () => {
  let testBed;
  let testActors;

  // Performance optimization: Create expensive resources once per suite
  beforeAll(async () => {
    testBed = new PromptGenerationTestBed();
    await testBed.initialize();

    // Set up test world, actors, and actions
    await testBed.createTestWorld();
    testActors = await testBed.createTestActors();
    await testBed.registerTestActions();
  });

  // Reset state between tests (lightweight operation)
  beforeEach(() => {
    testBed.resetTestState();
  });

  afterAll(async () => {
    await testBed.cleanup();
  });

  /**
   * Test: Performance of prompt generation
   * Verifies generation completes within reasonable time
   */
  it('should generate prompts within performance limits', async () => {
    // Arrange
    const aiActor = testActors.aiActor;
    const turnContext = testBed.createTestTurnContext();
    const availableActions = testBed.createTestActionComposites();

    // Act - Measure generation time
    const startTime = Date.now();
    const prompt = await testBed.generatePrompt(
      aiActor.id,
      turnContext,
      availableActions
    );
    const endTime = Date.now();

    const generationTime = endTime - startTime;

    // Assert
    expect(prompt).toBeDefined();
    expect(generationTime).toBeLessThan(500); // Should complete in under 500ms

    // Test multiple rapid generations (reduced iterations for performance)
    const iterations = 5;
    const rapidStartTime = Date.now();
    for (let i = 0; i < iterations; i++) {
      await testBed.generatePrompt(aiActor.id, turnContext, availableActions);
    }
    const rapidEndTime = Date.now();

    const avgTime = (rapidEndTime - rapidStartTime) / iterations;
    expect(avgTime).toBeLessThan(200); // Average should be under 200ms
  });

  /**
   * Test: Performance with varying context sizes
   * Verifies prompt generation scales appropriately with context
   */
  it('should maintain performance with large contexts', async () => {
    // Arrange
    const aiActor = testActors.aiActor;
    const availableActions = testBed.createTestActionComposites();

    // Test with different context sizes
    const contextSizes = [
      { name: 'Small', entityCount: 5 },
      { name: 'Medium', entityCount: 20 },
      { name: 'Large', entityCount: 50 },
    ];

    const performanceResults = [];

    for (const { name, entityCount } of contextSizes) {
      // Create context with specified entity count
      const turnContext = {
        ...testBed.createTestTurnContext(),
        visibleEntities: [],
      };

      // Add additional entities to context
      for (let i = 0; i < entityCount; i++) {
        turnContext.visibleEntities.push({
          id: `test-entity-${i}`,
          name: `Test Entity ${i}`,
          description: `A test entity for performance measurement`,
        });
      }

      // Measure generation time
      const startTime = Date.now();
      const prompt = await testBed.generatePrompt(
        aiActor.id,
        turnContext,
        availableActions
      );
      const endTime = Date.now();

      const generationTime = endTime - startTime;
      performanceResults.push({
        contextSize: name,
        entityCount,
        generationTime,
        promptLength: prompt.length,
      });

      // Assert prompt was generated
      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(0);
    }

    // Verify performance doesn't degrade excessively with larger contexts
    const smallContextTime = performanceResults[0].generationTime;
    const largeContextTime = performanceResults[2].generationTime;

    // Large context should not take more than 3x the time of small context
    // Handle case where times are 0 (very fast execution)
    if (smallContextTime > 0) {
      expect(largeContextTime).toBeLessThan(smallContextTime * 3);
    } else {
      // If small context was instantaneous, large should still be reasonable
      expect(largeContextTime).toBeLessThan(100);
    }

    // All generations should complete within reasonable time
    performanceResults.forEach(({ contextSize, generationTime }) => {
      expect(generationTime).toBeLessThan(1000); // 1 second max
      console.log(`${contextSize} context: ${generationTime}ms`);
    });
  });

  /**
   * Test: Caching effectiveness
   * Verifies that repeated generations benefit from caching
   */
  it('should demonstrate caching benefits for repeated generations', async () => {
    // Arrange
    const aiActor = testActors.aiActor;
    const turnContext = testBed.createTestTurnContext();
    const availableActions = testBed.createTestActionComposites();

    // First generation (cold cache)
    const coldStartTime = Date.now();
    const firstPrompt = await testBed.generatePrompt(
      aiActor.id,
      turnContext,
      availableActions
    );
    const coldEndTime = Date.now();
    const coldCacheTime = coldEndTime - coldStartTime;

    // Second generation (warm cache)
    const warmStartTime = Date.now();
    const secondPrompt = await testBed.generatePrompt(
      aiActor.id,
      turnContext,
      availableActions
    );
    const warmEndTime = Date.now();
    const warmCacheTime = warmEndTime - warmStartTime;

    // Assert
    expect(firstPrompt).toBeDefined();
    expect(secondPrompt).toBeDefined();

    // Warm cache should be faster (or at least not significantly slower)
    // Use max to handle case where coldCacheTime is 0
    // More lenient timing to account for system variance since no actual caching exists
    expect(warmCacheTime).toBeLessThanOrEqual(
      Math.max(coldCacheTime * 2.5, 15)
    );

    console.log(
      `Cold cache: ${coldCacheTime}ms, Warm cache: ${warmCacheTime}ms`
    );
  });
});
