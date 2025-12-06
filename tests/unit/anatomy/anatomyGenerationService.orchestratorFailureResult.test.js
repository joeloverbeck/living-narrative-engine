/**
 * @file Additional coverage tests for AnatomyGenerationService to exercise orchestrator
 *       failure result handling.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyGenerationService } from '../../../src/anatomy/anatomyGenerationService.js';
import { ANATOMY_BODY_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { AnatomyOrchestrator } from '../../../src/anatomy/orchestration/anatomyOrchestrator.js';

const orchestratorInstances = [];
const createOrchestratorInstance = () => ({
  checkGenerationNeeded: jest.fn(),
  orchestrateGeneration: jest.fn(),
});

jest.mock('../../../src/anatomy/orchestration/anatomyOrchestrator.js', () => {
  const AnatomyOrchestrator = jest.fn().mockImplementation(() => {
    const instance = createOrchestratorInstance();
    orchestratorInstances.push(instance);
    return instance;
  });
  AnatomyOrchestrator.__getInstances = () => orchestratorInstances;
  AnatomyOrchestrator.__reset = () => {
    orchestratorInstances.length = 0;
  };
  return { AnatomyOrchestrator };
});

jest.mock(
  '../../../src/anatomy/workflows/anatomyGenerationWorkflow.js',
  () => ({
    AnatomyGenerationWorkflow: jest.fn(),
  })
);

jest.mock(
  '../../../src/anatomy/workflows/descriptionGenerationWorkflow.js',
  () => ({
    DescriptionGenerationWorkflow: jest.fn(),
  })
);

jest.mock('../../../src/anatomy/workflows/graphBuildingWorkflow.js', () => ({
  GraphBuildingWorkflow: jest.fn(),
}));

jest.mock('../../../src/anatomy/orchestration/anatomyErrorHandler.js', () => ({
  AnatomyErrorHandler: jest.fn(),
}));

const getLatestOrchestratorInstance = () => {
  const instances = AnatomyOrchestrator.__getInstances();
  return instances[instances.length - 1];
};

describe('AnatomyGenerationService orchestrator fallback coverage', () => {
  let mockEntityManager;
  let mockLogger;
  let service;
  let entityRecord;

  beforeEach(() => {
    AnatomyOrchestrator.__reset();
    jest.clearAllMocks();

    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    entityRecord = {
      getComponentData: jest
        .fn()
        .mockReturnValue({ recipeId: 'orchestration-recipe' }),
    };
    mockEntityManager.getEntityInstance.mockReturnValue(entityRecord);

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    service = new AnatomyGenerationService({
      entityManager: mockEntityManager,
      dataRegistry: {},
      logger: mockLogger,
      bodyBlueprintFactory: {},
      anatomyDescriptionService: {},
      bodyGraphService: {},
    });
  });

  it('returns false when the orchestrator signals an unsuccessful generation result', async () => {
    const orchestrator = getLatestOrchestratorInstance();
    orchestrator.checkGenerationNeeded.mockReturnValue({
      needsGeneration: true,
    });
    orchestrator.orchestrateGeneration.mockResolvedValue({
      success: false,
      entityCount: 0,
      rootId: 'unused-root',
    });

    const result = await service.generateAnatomyIfNeeded('entity-under-test');

    expect(result).toBe(false);
    expect(orchestrator.checkGenerationNeeded).toHaveBeenCalledWith(
      'entity-under-test'
    );
    expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
      'entity-under-test'
    );
    expect(entityRecord.getComponentData).toHaveBeenCalledWith(
      ANATOMY_BODY_COMPONENT_ID
    );
    expect(orchestrator.orchestrateGeneration).toHaveBeenCalledWith(
      'entity-under-test',
      'orchestration-recipe'
    );
    expect(
      mockLogger.info.mock.calls.some(([message]) =>
        message?.includes('Successfully generated anatomy')
      )
    ).toBe(false);
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
