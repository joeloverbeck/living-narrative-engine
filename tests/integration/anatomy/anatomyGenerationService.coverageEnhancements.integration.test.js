import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { AnatomyGenerationService } from '../../../src/anatomy/anatomyGenerationService.js';
import { AnatomyOrchestrator } from '../../../src/anatomy/orchestration/anatomyOrchestrator.js';
import { ANATOMY_BODY_COMPONENT_ID } from '../../../src/constants/componentIds.js';

const SIMPLE_COMPONENT_DEFINITIONS = {
  [ANATOMY_BODY_COMPONENT_ID]: {
    id: ANATOMY_BODY_COMPONENT_ID,
    data: { recipeId: null, body: null },
  },
  'anatomy:joint': {
    id: 'anatomy:joint',
    data: { parentId: null, socketId: null, jointType: null },
  },
  'anatomy:part': {
    id: 'anatomy:part',
    data: { subType: null },
  },
  'anatomy:sockets': {
    id: 'anatomy:sockets',
    data: { sockets: [] },
  },
  'core:name': {
    id: 'core:name',
    data: { text: '' },
  },
};

const loadMinimalAnatomyData = (testBed) => {
  testBed.loadComponents(SIMPLE_COMPONENT_DEFINITIONS);
  testBed.loadEntityDefinitions({
    'test:torso': {
      id: 'test:torso',
      components: {
        'anatomy:part': { subType: 'torso' },
        'anatomy:sockets': {
          sockets: [{ id: 'arm_socket', allowedTypes: ['arm'], maxCount: 2 }],
        },
      },
    },
    'test:arm': {
      id: 'test:arm',
      components: {
        'anatomy:part': { subType: 'arm' },
      },
    },
  });

  testBed.loadBlueprints({
    'test:simple_blueprint': {
      id: 'test:simple_blueprint',
      rootSlot: 'torso',
      slots: {
        torso: {
          type: 'torso',
          definitionId: 'test:torso',
          count: 1,
        },
        leftArm: {
          parent: 'torso',
          socket: 'arm_socket',
          type: 'arm',
          definitionId: 'test:arm',
          count: 1,
        },
      },
      clothingSlotMappings: {},
    },
  });

  testBed.loadRecipes({
    'test:valid_recipe': {
      id: 'test:valid_recipe',
      blueprintId: 'test:simple_blueprint',
      slots: {
        torso: {
          type: 'torso',
          definitionId: 'test:torso',
          count: 1,
        },
        leftArm: {
          type: 'arm',
          definitionId: 'test:arm',
          count: 1,
        },
      },
      bodyDescriptors: {},
    },
  });
};

describe('AnatomyGenerationService integration coverage enhancements', () => {
  /** @type {AnatomyIntegrationTestBed} */
  let testBed;
  /** @type {AnatomyGenerationService} */
  let service;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    service = new AnatomyGenerationService({
      entityManager: testBed.entityManager,
      dataRegistry: testBed.registry,
      logger: testBed.logger,
      bodyBlueprintFactory: testBed.bodyBlueprintFactory,
      anatomyDescriptionService: testBed.anatomyDescriptionService,
      bodyGraphService: testBed.bodyGraphService,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('validates required constructor dependencies', () => {
    expect(
      () =>
        new AnatomyGenerationService({
          dataRegistry: testBed.registry,
          logger: testBed.logger,
          bodyBlueprintFactory: testBed.bodyBlueprintFactory,
          anatomyDescriptionService: testBed.anatomyDescriptionService,
          bodyGraphService: testBed.bodyGraphService,
        })
    ).toThrow('entityManager is required');

    expect(
      () =>
        new AnatomyGenerationService({
          entityManager: testBed.entityManager,
          logger: testBed.logger,
          bodyBlueprintFactory: testBed.bodyBlueprintFactory,
          anatomyDescriptionService: testBed.anatomyDescriptionService,
          bodyGraphService: testBed.bodyGraphService,
        })
    ).toThrow('dataRegistry is required');

    expect(
      () =>
        new AnatomyGenerationService({
          entityManager: testBed.entityManager,
          dataRegistry: testBed.registry,
          bodyBlueprintFactory: testBed.bodyBlueprintFactory,
          anatomyDescriptionService: testBed.anatomyDescriptionService,
          bodyGraphService: testBed.bodyGraphService,
        })
    ).toThrow('logger is required');

    expect(
      () =>
        new AnatomyGenerationService({
          entityManager: testBed.entityManager,
          dataRegistry: testBed.registry,
          logger: testBed.logger,
          anatomyDescriptionService: testBed.anatomyDescriptionService,
          bodyGraphService: testBed.bodyGraphService,
        })
    ).toThrow('bodyBlueprintFactory is required');

    expect(
      () =>
        new AnatomyGenerationService({
          entityManager: testBed.entityManager,
          dataRegistry: testBed.registry,
          logger: testBed.logger,
          bodyBlueprintFactory: testBed.bodyBlueprintFactory,
          bodyGraphService: testBed.bodyGraphService,
        })
    ).toThrow('anatomyDescriptionService is required');

    expect(
      () =>
        new AnatomyGenerationService({
          entityManager: testBed.entityManager,
          dataRegistry: testBed.registry,
          logger: testBed.logger,
          bodyBlueprintFactory: testBed.bodyBlueprintFactory,
          anatomyDescriptionService: testBed.anatomyDescriptionService,
        })
    ).toThrow('bodyGraphService is required');
  });

  it('handles generation prerequisites before delegating to orchestrator', async () => {
    testBed.logger.warn.mockClear();

    await expect(
      service.generateAnatomyIfNeeded('missing-entity')
    ).resolves.toBe(false);
    expect(testBed.logger.warn).toHaveBeenCalledWith(
      "AnatomyGenerationService: Entity 'missing-entity' not found"
    );

    testBed.loadComponents(SIMPLE_COMPONENT_DEFINITIONS);
    testBed.loadEntityDefinitions({
      'test:body_no_recipe': {
        id: 'test:body_no_recipe',
        components: {
          [ANATOMY_BODY_COMPONENT_ID]: {},
        },
      },
      'test:body_generated': {
        id: 'test:body_generated',
        components: {
          [ANATOMY_BODY_COMPONENT_ID]: {
            recipeId: 'test:valid_recipe',
            body: { root: 'existing-root' },
          },
        },
      },
      'test:body_missing_component': {
        id: 'test:body_missing_component',
        components: {
          'core:name': { text: 'No anatomy component' },
        },
      },
    });

    const noRecipe = await testBed.entityManager.createEntityInstance(
      'test:body_no_recipe'
    );
    testBed.logger.warn.mockClear();

    await expect(service.generateAnatomyIfNeeded(noRecipe.id)).resolves.toBe(
      false
    );
    expect(testBed.logger.warn).toHaveBeenCalledWith(
      `AnatomyGenerationService: Entity '${noRecipe.id}' has anatomy:body component but no recipeId`
    );

    const missingComponent = await testBed.entityManager.createEntityInstance(
      'test:body_missing_component'
    );
    testBed.logger.warn.mockClear();

    await expect(
      service.generateAnatomyIfNeeded(missingComponent.id)
    ).resolves.toBe(false);
    expect(testBed.logger.warn).not.toHaveBeenCalled();

    const alreadyGenerated = await testBed.entityManager.createEntityInstance(
      'test:body_generated'
    );
    testBed.logger.warn.mockClear();
    testBed.logger.debug.mockClear();

    const checkSpy = jest.spyOn(
      AnatomyOrchestrator.prototype,
      'checkGenerationNeeded'
    );

    await expect(
      service.generateAnatomyIfNeeded(alreadyGenerated.id)
    ).resolves.toBe(false);
    expect(checkSpy).toHaveReturnedWith(
      expect.objectContaining({
        needsGeneration: false,
        reason: 'Anatomy already generated',
      })
    );
    expect(testBed.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('already has generated anatomy')
    );

    checkSpy.mockRestore();
  });

  it('generates anatomy when data is available and tracks orchestrator outcomes', async () => {
    testBed.loadComponents(SIMPLE_COMPONENT_DEFINITIONS);
    testBed.loadEntityDefinitions({
      'test:body_ready': {
        id: 'test:body_ready',
        components: {
          [ANATOMY_BODY_COMPONENT_ID]: {
            recipeId: 'test:valid_recipe',
          },
        },
      },
    });

    const ready =
      await testBed.entityManager.createEntityInstance('test:body_ready');

    const generationCheck = jest
      .spyOn(AnatomyOrchestrator.prototype, 'checkGenerationNeeded')
      .mockReturnValue({
        needsGeneration: true,
        reason: 'Ready for generation',
      });

    const orchestrateSuccess = jest
      .spyOn(AnatomyOrchestrator.prototype, 'orchestrateGeneration')
      .mockImplementation(async (entityId, recipeId) => {
        await testBed.entityManager.addComponent(
          entityId,
          ANATOMY_BODY_COMPONENT_ID,
          {
            recipeId,
            body: { root: `${entityId}-root`, parts: {} },
          }
        );
        return { success: true, entityCount: 2, rootId: `${entityId}-root` };
      });

    await expect(service.generateAnatomyIfNeeded(ready.id)).resolves.toBe(true);

    const bodyComponent = testBed.entityManager.getComponentData(
      ready.id,
      ANATOMY_BODY_COMPONENT_ID
    );
    expect(bodyComponent.body).toEqual(
      expect.objectContaining({ root: expect.stringContaining('-root') })
    );

    orchestrateSuccess.mockResolvedValueOnce({
      success: false,
      entityCount: 0,
      rootId: null,
    });

    await expect(service.generateAnatomyIfNeeded(ready.id)).resolves.toBe(
      false
    );

    orchestrateSuccess.mockRejectedValueOnce(
      new Error('Simulated orchestration error')
    );

    await expect(service.generateAnatomyIfNeeded(ready.id)).rejects.toThrow(
      'Simulated orchestration error'
    );
    expect(testBed.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to generate anatomy for entity'),
      expect.objectContaining({ error: expect.any(Error) })
    );

    orchestrateSuccess.mockRestore();
    generationCheck.mockRestore();
  });

  it('aggregates batch generation results across mixed entities', async () => {
    const generationSpy = jest
      .spyOn(service, 'generateAnatomyIfNeeded')
      .mockImplementation((entityId) => {
        if (entityId === 'entity-success') {
          return Promise.resolve(true);
        }
        if (entityId === 'entity-error') {
          return Promise.reject(new Error('batch failure'));
        }
        if (entityId === 'entity-unknown-error') {
          return Promise.reject({});
        }
        return Promise.resolve(false);
      });

    const result = await service.generateAnatomyForEntities([
      'entity-success',
      'entity-skip',
      'entity-error',
      'entity-missing',
      'entity-unknown-error',
    ]);

    expect(result.generated).toEqual(['entity-success']);
    expect(result.skipped).toEqual(['entity-skip', 'entity-missing']);
    expect(result.failed).toEqual([
      { entityId: 'entity-error', error: 'batch failure' },
      { entityId: 'entity-unknown-error', error: 'Unknown error' },
    ]);

    generationSpy.mockRestore();
  });
});
