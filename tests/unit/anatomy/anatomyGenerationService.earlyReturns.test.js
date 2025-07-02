import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AnatomyGenerationService } from '../../../src/anatomy/anatomyGenerationService.js';

describe('AnatomyGenerationService early return cases', () => {
  let service;
  let em;
  let registry;
  let logger;
  let factory;
  let descService;
  let graphService;

  beforeEach(() => {
    em = {
      getEntityInstance: jest.fn(),
      addComponent: jest.fn(),
    };
    registry = { get: jest.fn() };
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    factory = { createAnatomyGraph: jest.fn() };
    descService = { generateAllDescriptions: jest.fn() };
    graphService = { buildAdjacencyCache: jest.fn() };
    service = new AnatomyGenerationService({
      entityManager: em,
      dataRegistry: registry,
      logger,
      bodyBlueprintFactory: factory,
      anatomyDescriptionService: descService,
      bodyGraphService: graphService,
    });
  });

  it('returns false if entity is not found', async () => {
    em.getEntityInstance.mockReturnValue(null);
    const result = await service.generateAnatomyIfNeeded('x');
    expect(result).toBe(false);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('returns false if entity lacks body component', async () => {
    em.getEntityInstance.mockReturnValue({
      hasComponent: jest.fn().mockReturnValue(false),
    });
    const result = await service.generateAnatomyIfNeeded('x');
    expect(result).toBe(false);
  });

  it('warns if recipeId missing', async () => {
    const entity = {
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockReturnValue({}),
    };
    em.getEntityInstance.mockReturnValue(entity);
    const result = await service.generateAnatomyIfNeeded('x');
    expect(result).toBe(false);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('does nothing when anatomy already generated', async () => {
    const entity = {
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockReturnValue({ recipeId: 'r', body: {} }),
    };
    em.getEntityInstance.mockReturnValue(entity);
    const result = await service.generateAnatomyIfNeeded('x');
    expect(result).toBe(false);
    expect(logger.debug).toHaveBeenCalled();
  });
});
