import { describe, it, expect, beforeEach } from '@jest/globals';

import { AnatomyGenerationService } from '../../../src/anatomy/anatomyGenerationService.js';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { ANATOMY_BODY_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('AnatomyGenerationService real module integration', () => {
  /** @type {AnatomyIntegrationTestBed} */
  let testBed;
  /** @type {AnatomyGenerationService} */
  let service;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.loadAnatomyModData();
    service = new AnatomyGenerationService({
      entityManager: testBed.entityManager,
      dataRegistry: testBed.registry,
      logger: testBed.logger,
      bodyBlueprintFactory: testBed.bodyBlueprintFactory,
      anatomyDescriptionService: testBed.anatomyDescriptionService,
      bodyGraphService: testBed.bodyGraphService,
    });
  });

  it('generates anatomy and aggregates batch results with real orchestrator collaborators', async () => {
    testBed.logger.warn.mockClear();
    const missingResult =
      await service.generateAnatomyIfNeeded('missing-entity');
    expect(missingResult).toBe(false);
    expect(testBed.logger.warn).toHaveBeenCalledWith(
      "AnatomyGenerationService: Entity 'missing-entity' not found"
    );

    const actorNoRecipe =
      await testBed.entityManager.createEntityInstance('core:actor');
    await testBed.entityManager.addComponent(
      actorNoRecipe.id,
      ANATOMY_BODY_COMPONENT_ID,
      {}
    );

    testBed.logger.warn.mockClear();
    const noRecipeResult = await service.generateAnatomyIfNeeded(
      actorNoRecipe.id
    );
    expect(noRecipeResult).toBe(false);
    expect(testBed.logger.warn).toHaveBeenCalledWith(
      `AnatomyGenerationService: Entity '${actorNoRecipe.id}' has anatomy:body component but no recipeId`
    );

    const generatedActor = await testBed.createActor({
      recipeId: 'anatomy:human_male_balanced',
    });

    const generated = await service.generateAnatomyIfNeeded(generatedActor.id);
    expect(generated).toBe(true);
    const generatedBody = testBed.entityManager.getComponentData(
      generatedActor.id,
      ANATOMY_BODY_COMPONENT_ID
    );
    expect(generatedBody.body).toBeDefined();
    expect(generatedBody.body.root).toEqual(expect.any(String));

    testBed.logger.debug.mockClear();
    const secondCall = await service.generateAnatomyIfNeeded(generatedActor.id);
    expect(secondCall).toBe(false);
    expect(testBed.logger.debug).toHaveBeenCalledWith(
      `AnatomyGenerationService: Entity '${generatedActor.id}' already has generated anatomy`
    );

    const batchSuccessActor = await testBed.createActor({
      recipeId: 'anatomy:human_female_balanced',
    });

    const failingActor =
      await testBed.entityManager.createEntityInstance('core:actor');
    await testBed.entityManager.addComponent(
      failingActor.id,
      ANATOMY_BODY_COMPONENT_ID,
      {
        recipeId: 'invalid:recipe',
      }
    );

    testBed.logger.error.mockClear();
    const batchResult = await service.generateAnatomyForEntities([
      batchSuccessActor.id,
      failingActor.id,
      'missing-batch-entity',
      actorNoRecipe.id,
    ]);

    expect(batchResult.generated).toEqual([batchSuccessActor.id]);
    expect(batchResult.skipped).toEqual(
      expect.arrayContaining(['missing-batch-entity', actorNoRecipe.id])
    );
    expect(batchResult.failed).toEqual([
      {
        entityId: failingActor.id,
        error: expect.stringContaining("Recipe 'invalid:recipe' not found"),
      },
    ]);

    const failureLog = testBed.logger.error.mock.calls.find(([message]) =>
      message.includes(
        `Failed to generate anatomy for entity '${failingActor.id}'`
      )
    );
    expect(failureLog).toBeDefined();
    expect(failureLog[1]).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("Recipe 'invalid:recipe' not found"),
      })
    );

    const aggregateFailureLog = testBed.logger.error.mock.calls.find(
      ([message]) =>
        message.includes(`Failed to process entity '${failingActor.id}'`)
    );
    expect(aggregateFailureLog).toBeDefined();
  });
});
