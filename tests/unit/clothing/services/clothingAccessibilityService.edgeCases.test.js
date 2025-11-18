import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { ClothingAccessibilityService } from '../../../../src/clothing/services/clothingAccessibilityService.js';
import { PRIORITY_CONFIG } from '../../../../src/scopeDsl/prioritySystem/priorityConstants.js';

/**
 *
 */
function createMocks() {
  return {
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    },
    entityManager: {
      getComponentData: jest.fn(),
      hasComponent: jest.fn()
    },
    entitiesGateway: {
      getComponentData: jest.fn()
    }
  };
}

describe('ClothingAccessibilityService edge cases', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('disables priority caching when configuration flag is off', () => {
    const { logger, entityManager } = createMocks();

    const service = new ClothingAccessibilityService({
      logger,
      entityManager,
      priorityConfig: { ...PRIORITY_CONFIG, enableCaching: false }
    });

    entityManager.getComponentData.mockReturnValue({ equipped: {} });
    expect(service.getAccessibleItems('entity')).toEqual([]);
    expect(logger.info).toHaveBeenCalledWith('ClothingAccessibilityService: Initialized');
  });

  it('logs a warning when coverage analyzer initialization fails', () => {
    const mocks = createMocks();

    const service = new ClothingAccessibilityService({
      logger: mocks.logger,
      entityManager: mocks.entityManager,
      entitiesGateway: mocks.entitiesGateway,
      coverageAnalyzerFactory: () => {
        throw new Error('failed to build analyzer');
      }
    });

    expect(service).toBeInstanceOf(ClothingAccessibilityService);
    expect(mocks.logger.warn).toHaveBeenCalledWith('Failed to initialize coverage analyzer', {
      error: 'failed to build analyzer'
    });

    const accessibility = service.isItemAccessible('entity', 'item');
    expect(accessibility).toEqual({
      accessible: true,
      reason: 'No coverage analyzer available',
      blockingItems: []
    });
  });

  it('returns original items when coverage analysis fails during blocking', () => {
    const mocks = createMocks();

    mocks.entityManager.getComponentData.mockReturnValue({
      equipped: {
        torso_upper: {
          outer: 'clothing:jacket'
        }
      }
    });

    const service = new ClothingAccessibilityService({
      logger: mocks.logger,
      entityManager: mocks.entityManager,
      entitiesGateway: mocks.entitiesGateway,
      coverageAnalyzerFactory: () => ({
        analyzeCoverageBlocking: () => {
          throw new Error('analysis failure');
        }
      })
    });

    const items = service.getAccessibleItems('entity', { mode: 'topmost' });
    expect(items).toEqual(['clothing:jacket']);
    expect(mocks.logger.warn).toHaveBeenCalledWith('Coverage analysis failed, returning all items', {
      entityId: 'entity',
      error: 'analysis failure'
    });
  });

  it('assumes accessibility and logs when analyzer throws in isItemAccessible', () => {
    const mocks = createMocks();

    mocks.entityManager.getComponentData.mockReturnValue({ equipped: {} });

    const service = new ClothingAccessibilityService({
      logger: mocks.logger,
      entityManager: mocks.entityManager,
      entitiesGateway: mocks.entitiesGateway,
      coverageAnalyzerFactory: () => ({
        analyzeCoverageBlocking: () => {
          throw new Error('check failure');
        }
      })
    });

    const result = service.isItemAccessible('entity', 'item');
    expect(result).toEqual({
      accessible: true,
      reason: 'Coverage check failed, assuming accessible',
      blockingItems: []
    });
    expect(mocks.logger.warn).toHaveBeenCalledWith('Failed to check accessibility', {
      entityId: 'entity',
      itemId: 'item',
      error: 'check failure'
    });
  });

  it('evicts oldest priority cache entries when exceeding the configured limit', () => {
    const mocks = createMocks();

    mocks.entityManager.getComponentData.mockReturnValue({
      equipped: {
        torso_upper: {
          outer: 'clothing:coat',
          base: 'clothing:shirt'
        }
      }
    });

    const service = new ClothingAccessibilityService({
      logger: mocks.logger,
      entityManager: mocks.entityManager,
      priorityConfig: { ...PRIORITY_CONFIG, enableCaching: true, maxCacheSize: 1 }
    });

    const items = service.getAccessibleItems('entity', { mode: 'all' });
    expect(items).toEqual(['clothing:coat', 'clothing:shirt']);
  });
});
