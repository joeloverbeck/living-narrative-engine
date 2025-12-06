import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { createEventBus } from '../../common/mockFactories/eventBus.js';
import BodyGraphService from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

const HUMAN_BALANCED_RECIPE = 'anatomy:human_female_balanced';

describe('BodyGraphService anatomy metadata integration', () => {
  let testBed;
  let eventBus;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.setup();
    eventBus = createEventBus({ captureEvents: true });
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  it('provides anatomy metadata that other services can consume', async () => {
    const actor = await testBed.createActor({
      recipeId: HUMAN_BALANCED_RECIPE,
    });
    await testBed.anatomyGenerationService.generateAnatomyIfNeeded(actor.id);

    const bodyGraphService = new BodyGraphService({
      entityManager: testBed.entityManager,
      logger: testBed.logger,
      eventDispatcher: eventBus,
    });

    await bodyGraphService.buildAdjacencyCache(actor.id);

    const metadata = await bodyGraphService.getAnatomyData(actor.id);
    expect(metadata).toEqual({
      recipeId: HUMAN_BALANCED_RECIPE,
      rootEntityId: actor.id,
    });

    const blueprint =
      await testBed.anatomyBlueprintRepository.getBlueprintByRecipeId(
        metadata.recipeId
      );
    expect(blueprint).not.toBeNull();

    const bodyComponent = testBed.entityManager.getComponentData(
      actor.id,
      'anatomy:body'
    );
    const bodyGraph = await bodyGraphService.getBodyGraph(
      metadata.rootEntityId
    );
    const partIds = bodyGraph.getAllPartIds();

    expect(partIds.length).toBeGreaterThan(0);
    expect(partIds).toContain(bodyComponent.body.root);

    const repeatedMetadata = await bodyGraphService.getAnatomyData(actor.id);
    expect(repeatedMetadata).toEqual(metadata);
  });

  it('throws InvalidArgumentError when required dependencies are missing', () => {
    expect(
      () =>
        new BodyGraphService({
          logger: testBed.logger,
          eventDispatcher: eventBus,
        })
    ).toThrow(InvalidArgumentError);

    expect(
      () =>
        new BodyGraphService({
          entityManager: testBed.entityManager,
          logger: testBed.logger,
        })
    ).toThrow(InvalidArgumentError);
  });
});
