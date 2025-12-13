/**
 * @file Unit tests for AnatomyGenerationService additional coverage.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AnatomyGenerationService } from '../../../src/anatomy/anatomyGenerationService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
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

describe('AnatomyGenerationService – additional', () => {
  describe('constructor validation', () => {
    it('throws when any dependency is missing', () => {
      const deps = buildDeps();
      for (const key of Object.keys(deps)) {
        const bad = { ...deps };
        bad[key] = undefined;
        expect(() => new AnatomyGenerationService(bad)).toThrow(
          InvalidArgumentError
        );
      }
    });
  });

  describe('generateAnatomyIfNeeded branching', () => {
    let service;
    let deps;
    let orchestratorMock;

    beforeEach(() => {
      orchestratorInstances.length = 0;
      deps = buildDeps();
      service = new AnatomyGenerationService(deps);
      orchestratorMock = orchestratorInstances.pop();
    });

    it('logs warning when entity not found', async () => {
      orchestratorMock.checkGenerationNeeded.mockReturnValue({
        needsGeneration: false,
        reason: 'Entity not found',
      });
      const result = await service.generateAnatomyIfNeeded('e1');
      expect(result).toBe(false);
      expect(deps.logger.warn).toHaveBeenCalledWith(
        "AnatomyGenerationService: Entity 'e1' not found"
      );
    });

    it('logs warning when recipe missing', async () => {
      orchestratorMock.checkGenerationNeeded.mockReturnValue({
        needsGeneration: false,
        reason: 'anatomy:body component has no recipeId',
      });
      const result = await service.generateAnatomyIfNeeded('e2');
      expect(result).toBe(false);
      expect(deps.logger.warn).toHaveBeenCalledWith(
        "AnatomyGenerationService: Entity 'e2' has anatomy:body component but no recipeId"
      );
    });

    it('logs debug when anatomy already generated', async () => {
      orchestratorMock.checkGenerationNeeded.mockReturnValue({
        needsGeneration: false,
        reason: 'Anatomy already generated',
      });
      const result = await service.generateAnatomyIfNeeded('e3');
      expect(result).toBe(false);
      expect(deps.logger.debug).toHaveBeenCalledWith(
        "AnatomyGenerationService: Entity 'e3' already has generated anatomy"
      );
    });

    it('returns true when orchestration succeeds', async () => {
      orchestratorMock.checkGenerationNeeded.mockReturnValue({
        needsGeneration: true,
        reason: 'Ready for generation',
      });
      const entity = {
        getComponentData: jest.fn().mockReturnValue({ recipeId: 'r1' }),
      };
      deps.entityManager.getEntityInstance.mockReturnValue(entity);
      orchestratorMock.orchestrateGeneration.mockResolvedValue({
        success: true,
        entityCount: 2,
      });
      const result = await service.generateAnatomyIfNeeded('e4');
      expect(result).toBe(true);
      expect(orchestratorMock.orchestrateGeneration).toHaveBeenCalledWith(
        'e4',
        'r1'
      );
      expect(deps.logger.debug).toHaveBeenCalledWith(
        "AnatomyGenerationService: Successfully generated anatomy for entity 'e4' with 2 parts"
      );
    });

    it('returns false when orchestration reports failure', async () => {
      orchestratorMock.checkGenerationNeeded.mockReturnValue({
        needsGeneration: true,
        reason: 'Ready for generation',
      });
      deps.entityManager.getEntityInstance.mockReturnValue({
        getComponentData: jest.fn().mockReturnValue({ recipeId: 'r2' }),
      });
      orchestratorMock.orchestrateGeneration.mockResolvedValue({
        success: false,
      });
      const result = await service.generateAnatomyIfNeeded('e5');
      expect(result).toBe(false);
    });

    it('logs and rethrows errors', async () => {
      orchestratorMock.checkGenerationNeeded.mockReturnValue({
        needsGeneration: true,
        reason: 'Ready for generation',
      });
      deps.entityManager.getEntityInstance.mockReturnValue({
        getComponentData: jest.fn().mockReturnValue({ recipeId: 'r3' }),
      });
      const error = new Error('boom');
      orchestratorMock.orchestrateGeneration.mockRejectedValue(error);
      await expect(service.generateAnatomyIfNeeded('e6')).rejects.toThrow(
        'boom'
      );
      expect(deps.logger.error).toHaveBeenCalledWith(
        "AnatomyGenerationService: Failed to generate anatomy for entity 'e6'",
        { error }
      );
    });
  });

  describe('generateAnatomyForEntities', () => {
    it('aggregates results across entities', async () => {
      orchestratorInstances.length = 0;
      const service = new AnatomyGenerationService(buildDeps());
      const spy = jest
        .spyOn(service, 'generateAnatomyIfNeeded')
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockRejectedValueOnce(new Error('fail'));

      const result = await service.generateAnatomyForEntities(['a', 'b', 'c']);

      expect(result).toEqual({
        generated: ['a'],
        skipped: ['b'],
        failed: [{ entityId: 'c', error: 'fail' }],
      });
      expect(spy).toHaveBeenCalledTimes(3);
    });
  });
});
