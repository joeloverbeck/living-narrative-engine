/**
 * @file Integration tests for preventing event recursion during anatomy generation
 * @description Verifies that anatomy generation does not trigger infinite event recursion loops
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('Anatomy Event Recursion Prevention', () => {
  let testBed;
  let entityManager;
  let anatomyGenerationService;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    entityManager = testBed.getEntityManager();
    anatomyGenerationService = testBed.anatomyGenerationService;
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should not trigger event recursion warnings during anatomy generation', async () => {
    // Spy on console.warn to detect recursion warnings
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const actor = await testBed.createActor({
      recipeId: 'anatomy:human_male',
    });

    await anatomyGenerationService.generateAnatomy(actor.id);

    // Check for recursion depth warnings
    const recursionWarnings = warnSpy.mock.calls.filter((call) =>
      call[0]?.includes?.('recursion depth exceeded')
    );

    // After fix: should have NO recursion warnings
    expect(recursionWarnings.length).toBe(0);

    warnSpy.mockRestore();
  });

  it('should complete description generation without warnings', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const actor = await testBed.createActor({
      recipeId: 'anatomy:human_female',
    });

    await anatomyGenerationService.generateAnatomy(actor.id);

    // Verify no recursion warnings occurred during generation
    const recursionWarnings = warnSpy.mock.calls.filter((call) =>
      call[0]?.includes?.('recursion depth exceeded')
    );

    expect(recursionWarnings.length).toBe(0);

    warnSpy.mockRestore();
  });

  it('should complete anatomy generation with all descriptions without recursion', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const actor = await testBed.createActor({
      recipeId: 'anatomy:octopus_common',
    });

    // Generate anatomy (includes description generation)
    await anatomyGenerationService.generateAnatomy(actor.id);

    const actorInstance = entityManager.getEntityInstance(actor.id);
    const anatomyData = actorInstance.getComponentData('anatomy:body');

    // Verify anatomy was generated successfully
    expect(anatomyData).toBeDefined();
    expect(anatomyData.body.root).toBeDefined();
    expect(Object.keys(anatomyData.body.parts).length).toBeGreaterThan(0);

    // Verify no recursion warnings occurred
    const recursionWarnings = warnSpy.mock.calls.filter((call) =>
      call[0]?.includes?.('recursion depth exceeded')
    );

    expect(recursionWarnings.length).toBe(0);

    warnSpy.mockRestore();
  });

  it('should handle multiple anatomy generations without accumulating recursion', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Generate multiple anatomies
    for (let i = 0; i < 3; i++) {
      const actor = await testBed.createActor({
        recipeId: i % 2 === 0 ? 'anatomy:human_male' : 'anatomy:human_female',
      });

      await anatomyGenerationService.generateAnatomy(actor.id);
    }

    // Check for ANY recursion warnings across all generations
    const recursionWarnings = warnSpy.mock.calls.filter((call) =>
      call[0]?.includes?.('recursion depth exceeded')
    );

    expect(recursionWarnings.length).toBe(0);

    warnSpy.mockRestore();
  });
});
