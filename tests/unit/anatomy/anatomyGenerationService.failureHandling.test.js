import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyGenerationService } from '../../../src/anatomy/anatomyGenerationService.js';
import {
  createMockEntityManager,
  createSimpleMockDataRegistry,
  createMockLogger,
} from '../../common/mockFactories.js';

const orchestratorInstances = [];

jest.mock(
  '../../../src/anatomy/workflows/anatomyGenerationWorkflow.js',
  () => ({
    AnatomyGenerationWorkflow: jest.fn().mockImplementation(() => ({})),
  })
);
jest.mock(
  '../../../src/anatomy/workflows/descriptionGenerationWorkflow.js',
  () => ({
    DescriptionGenerationWorkflow: jest.fn().mockImplementation(() => ({})),
  })
);
jest.mock('../../../src/anatomy/workflows/graphBuildingWorkflow.js', () => ({
  GraphBuildingWorkflow: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../src/anatomy/orchestration/anatomyErrorHandler.js', () => ({
  AnatomyErrorHandler: jest
    .fn()
    .mockImplementation(() => ({ handle: jest.fn() })),
}));
jest.mock('../../../src/anatomy/orchestration/anatomyOrchestrator.js', () => ({
  AnatomyOrchestrator: jest.fn(function () {
    const instance = {
      checkGenerationNeeded: jest.fn(),
      orchestrateGeneration: jest.fn(),
    };
    orchestratorInstances.push(instance);
    return instance;
  }),
}));

const buildDeps = () => ({
  entityManager: createMockEntityManager(),
  dataRegistry: createSimpleMockDataRegistry(),
  logger: createMockLogger(),
  bodyBlueprintFactory: {},
  anatomyDescriptionService: {},
  bodyGraphService: {},
});

describe('AnatomyGenerationService failure handling coverage', () => {
  let deps;

  beforeEach(() => {
    orchestratorInstances.length = 0;
    deps = buildDeps();
  });

  it('returns false when orchestration reports failure without throwing', async () => {
    const service = new AnatomyGenerationService(deps);
    const orchestratorMock = orchestratorInstances.pop();

    orchestratorMock.checkGenerationNeeded.mockReturnValue({
      needsGeneration: true,
      reason: 'ready',
    });
    deps.entityManager.getEntityInstance.mockReturnValue({
      getComponentData: jest.fn().mockReturnValue({ recipeId: 'bp-failure' }),
    });
    orchestratorMock.orchestrateGeneration.mockResolvedValue({
      success: false,
      entityCount: 0,
    });

    const result = await service.generateAnatomyIfNeeded('entity-failure');

    expect(result).toBe(false);
    expect(orchestratorMock.orchestrateGeneration).toHaveBeenCalledWith(
      'entity-failure',
      'bp-failure'
    );
  });

  it('gracefully skips unknown prerequisite failure reasons', async () => {
    const service = new AnatomyGenerationService(deps);
    const orchestratorMock = orchestratorInstances.pop();

    orchestratorMock.checkGenerationNeeded.mockReturnValue({
      needsGeneration: false,
      reason: 'unexpected-condition',
    });

    const result = await service.generateAnatomyIfNeeded('entity-unknown');

    expect(result).toBe(false);
    expect(deps.logger.warn).not.toHaveBeenCalled();
    expect(deps.logger.debug).not.toHaveBeenCalled();
  });

  it('records an unknown error message when rejection lacks details', async () => {
    const localDeps = buildDeps();
    const service = new AnatomyGenerationService(localDeps);
    const error = new Error('');
    error.message = '';

    const generationSpy = jest
      .spyOn(service, 'generateAnatomyIfNeeded')
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(error);

    const result = await service.generateAnatomyForEntities([
      'skipped-entity',
      'failing-entity',
    ]);

    expect(result).toEqual({
      generated: [],
      skipped: ['skipped-entity'],
      failed: [{ entityId: 'failing-entity', error: 'Unknown error' }],
    });
    expect(localDeps.logger.error).toHaveBeenCalledWith(
      "AnatomyGenerationService: Failed to process entity 'failing-entity'",
      { error }
    );
    expect(generationSpy).toHaveBeenCalledTimes(2);
  });
});
