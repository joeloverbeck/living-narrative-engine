import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { GraphBuildingWorkflow } from '../../../../src/anatomy/workflows/graphBuildingWorkflow.js';
import { GraphBuildingError } from '../../../../src/anatomy/orchestration/anatomyErrorHandler.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('GraphBuildingWorkflow', () => {
  let workflow;
  let mockEntityManager;
  let mockLogger;
  let mockBodyGraphService;

  beforeEach(() => {
    // Create mocks
    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    mockLogger = createMockLogger();

    mockBodyGraphService = {
      buildAdjacencyCache: jest.fn(),
      clearCache: jest.fn(),
      hasCache: jest.fn(),
    };
  });

  describe('constructor', () => {
    it('should initialize successfully with all dependencies', () => {
      expect(() => {
        workflow = new GraphBuildingWorkflow({
          entityManager: mockEntityManager,
          logger: mockLogger,
          bodyGraphService: mockBodyGraphService,
        });
      }).not.toThrow();
    });

    it('should throw when missing entityManager', () => {
      expect(() => {
        new GraphBuildingWorkflow({
          logger: mockLogger,
          bodyGraphService: mockBodyGraphService,
        });
      }).toThrow(Error);
    });

    it('should throw when missing logger', () => {
      expect(() => {
        new GraphBuildingWorkflow({
          entityManager: mockEntityManager,
          bodyGraphService: mockBodyGraphService,
        });
      }).toThrow(Error);
    });

    it('should throw when missing bodyGraphService', () => {
      expect(() => {
        new GraphBuildingWorkflow({
          entityManager: mockEntityManager,
          logger: mockLogger,
        });
      }).toThrow(Error);
    });

    it('should throw when entityManager lacks required methods', () => {
      const invalidEntityManager = {};
      expect(() => {
        new GraphBuildingWorkflow({
          entityManager: invalidEntityManager,
          logger: mockLogger,
          bodyGraphService: mockBodyGraphService,
        });
      }).toThrow(Error);
    });

    it('should throw when bodyGraphService lacks required methods', () => {
      const invalidBodyGraphService = {};
      expect(() => {
        new GraphBuildingWorkflow({
          entityManager: mockEntityManager,
          logger: mockLogger,
          bodyGraphService: invalidBodyGraphService,
        });
      }).toThrow(Error);
    });
  });

  describe('buildCache', () => {
    beforeEach(() => {
      workflow = new GraphBuildingWorkflow({
        entityManager: mockEntityManager,
        logger: mockLogger,
        bodyGraphService: mockBodyGraphService,
      });
    });

    it('should build cache successfully', async () => {
      const rootId = 'root-123';
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      await workflow.buildCache(rootId);

      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(rootId);
      expect(mockEntity.hasComponent).toHaveBeenCalledWith('anatomy:part');
      expect(mockBodyGraphService.buildAdjacencyCache).toHaveBeenCalledWith(
        rootId
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Building adjacency cache for root entity '${rootId}'`
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Successfully built adjacency cache for root entity '${rootId}'`
        )
      );
    });

    it('should throw InvalidArgumentError when rootId is not provided', async () => {
      await expect(workflow.buildCache()).rejects.toThrow(
        new InvalidArgumentError('rootId is required')
      );
      await expect(workflow.buildCache(null)).rejects.toThrow(
        new InvalidArgumentError('rootId is required')
      );
      await expect(workflow.buildCache('')).rejects.toThrow(
        new InvalidArgumentError('rootId is required')
      );
    });

    it('should throw InvalidArgumentError when root entity does not exist', async () => {
      const rootId = 'non-existent';
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      await expect(workflow.buildCache(rootId)).rejects.toThrow(
        new InvalidArgumentError(
          `Root entity '${rootId}' not found in entity manager`
        )
      );
    });

    it('should log warning when root entity lacks anatomy:part component', async () => {
      const rootId = 'root-without-anatomy';
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(false),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      await workflow.buildCache(rootId);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `Root entity '${rootId}' does not have anatomy:part component`
        )
      );
      expect(mockBodyGraphService.buildAdjacencyCache).toHaveBeenCalledWith(
        rootId
      );
    });

    it('should throw GraphBuildingError when bodyGraphService fails', async () => {
      const rootId = 'root-123';
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const originalError = new Error('Build failed');
      mockBodyGraphService.buildAdjacencyCache.mockImplementation(() => {
        throw originalError;
      });

      await expect(workflow.buildCache(rootId)).rejects.toThrow(
        GraphBuildingError
      );
      await expect(workflow.buildCache(rootId)).rejects.toThrow(
        `Failed to build adjacency cache for root entity '${rootId}': Build failed`
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Failed to build adjacency cache for root entity '${rootId}'`
        ),
        expect.objectContaining({
          error: 'Build failed',
          stack: expect.any(String),
        })
      );
    });

    it('should rethrow InvalidArgumentError without wrapping', async () => {
      const rootId = 'root-123';
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const invalidArgError = new InvalidArgumentError('Invalid configuration');
      mockBodyGraphService.buildAdjacencyCache.mockImplementation(() => {
        throw invalidArgError;
      });

      await expect(workflow.buildCache(rootId)).rejects.toThrow(
        invalidArgError
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('rebuildCache', () => {
    beforeEach(() => {
      workflow = new GraphBuildingWorkflow({
        entityManager: mockEntityManager,
        logger: mockLogger,
        bodyGraphService: mockBodyGraphService,
      });
    });

    it('should clear cache and rebuild when clearCache method exists', async () => {
      const rootId = 'root-123';
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      await workflow.rebuildCache(rootId);

      expect(mockBodyGraphService.clearCache).toHaveBeenCalledWith(rootId);
      expect(mockBodyGraphService.buildAdjacencyCache).toHaveBeenCalledWith(
        rootId
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Rebuilding adjacency cache for root entity '${rootId}'`
        )
      );
    });

    it('should rebuild without clearing when clearCache method does not exist', async () => {
      const rootId = 'root-123';
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      // Remove clearCache method
      delete mockBodyGraphService.clearCache;

      await workflow.rebuildCache(rootId);

      expect(mockBodyGraphService.buildAdjacencyCache).toHaveBeenCalledWith(
        rootId
      );
    });

    it('should propagate errors from buildCache', async () => {
      const rootId = 'invalid-root';
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      await expect(workflow.rebuildCache(rootId)).rejects.toThrow(
        new InvalidArgumentError(
          `Root entity '${rootId}' not found in entity manager`
        )
      );
    });
  });

  describe('hasCacheForRoot', () => {
    beforeEach(() => {
      workflow = new GraphBuildingWorkflow({
        entityManager: mockEntityManager,
        logger: mockLogger,
        bodyGraphService: mockBodyGraphService,
      });
    });

    it('should return true when cache exists', () => {
      const rootId = 'root-123';
      mockBodyGraphService.hasCache.mockReturnValue(true);

      expect(workflow.hasCacheForRoot(rootId)).toBe(true);
      expect(mockBodyGraphService.hasCache).toHaveBeenCalledWith(rootId);
    });

    it('should return false when cache does not exist', () => {
      const rootId = 'root-123';
      mockBodyGraphService.hasCache.mockReturnValue(false);

      expect(workflow.hasCacheForRoot(rootId)).toBe(false);
      expect(mockBodyGraphService.hasCache).toHaveBeenCalledWith(rootId);
    });

    it('should return false when rootId is null', () => {
      expect(workflow.hasCacheForRoot(null)).toBe(false);
      expect(mockBodyGraphService.hasCache).not.toHaveBeenCalled();
    });

    it('should return false when rootId is undefined', () => {
      expect(workflow.hasCacheForRoot(undefined)).toBe(false);
      expect(mockBodyGraphService.hasCache).not.toHaveBeenCalled();
    });

    it('should return false when rootId is empty string', () => {
      expect(workflow.hasCacheForRoot('')).toBe(false);
      expect(mockBodyGraphService.hasCache).not.toHaveBeenCalled();
    });

    it('should return false when bodyGraphService lacks hasCache method', () => {
      delete mockBodyGraphService.hasCache;
      const rootId = 'root-123';

      expect(workflow.hasCacheForRoot(rootId)).toBe(false);
    });
  });

  describe('validateCache', () => {
    beforeEach(() => {
      workflow = new GraphBuildingWorkflow({
        entityManager: mockEntityManager,
        logger: mockLogger,
        bodyGraphService: mockBodyGraphService,
      });
    });

    it('should return valid result when root entity exists', async () => {
      const rootId = 'root-123';
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const result = await workflow.validateCache(rootId);

      expect(result).toEqual({
        valid: true,
        issues: [],
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Cache for root entity '${rootId}' is valid`)
      );
    });

    it('should return invalid result when root entity does not exist', async () => {
      const rootId = 'non-existent';
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      const result = await workflow.validateCache(rootId);

      expect(result).toEqual({
        valid: false,
        issues: [`Root entity '${rootId}' not found`],
      });
    });

    it('should handle errors during validation', async () => {
      const rootId = 'root-123';
      const error = new Error('Validation error');
      mockEntityManager.getEntityInstance.mockImplementation(() => {
        throw error;
      });

      const result = await workflow.validateCache(rootId);

      expect(result).toEqual({
        valid: false,
        issues: [`Validation error: ${error.message}`],
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Error during cache validation for root entity '${rootId}'`
        ),
        expect.objectContaining({ error: error.message })
      );
    });

    it('should include service-provided issues and warn when invalid', async () => {
      const rootId = 'root-456';
      const mockEntity = { hasComponent: jest.fn().mockReturnValue(true) };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyGraphService.validateCache = jest.fn().mockResolvedValue({
        valid: false,
        issues: ['Dangling connection detected'],
      });

      const result = await workflow.validateCache(rootId);

      expect(mockBodyGraphService.validateCache).toHaveBeenCalledWith(rootId);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `Cache validation failed for root entity '${rootId}'`
        ),
        { issues: ['Dangling connection detected'] }
      );
      expect(result).toEqual({
        valid: false,
        issues: ['Dangling connection detected'],
      });
    });

    it('should support service returning issue array without validity flag', async () => {
      const rootId = 'root-789';
      const mockEntity = { hasComponent: jest.fn().mockReturnValue(true) };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyGraphService.validateCache = jest
        .fn()
        .mockResolvedValue(['Missing child link']);

      const result = await workflow.validateCache(rootId);

      expect(result).toEqual({
        valid: false,
        issues: ['Missing child link'],
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `Cache validation failed for root entity '${rootId}'`
        ),
        { issues: ['Missing child link'] }
      );
    });

    it('should support service returning string issue', async () => {
      const rootId = 'root-321';
      const mockEntity = { hasComponent: jest.fn().mockReturnValue(true) };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyGraphService.validateCache = jest
        .fn()
        .mockResolvedValue('Cache mismatch detected');

      const result = await workflow.validateCache(rootId);

      expect(result).toEqual({
        valid: false,
        issues: ['Cache mismatch detected'],
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `Cache validation failed for root entity '${rootId}'`
        ),
        { issues: ['Cache mismatch detected'] }
      );
    });

    it('should add default message when service reports invalid without issues', async () => {
      const rootId = 'root-654';
      const mockEntity = { hasComponent: jest.fn().mockReturnValue(true) };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyGraphService.validateCache = jest.fn().mockResolvedValue({
        valid: false,
      });

      const result = await workflow.validateCache(rootId);

      expect(result).toEqual({
        valid: false,
        issues: [
          `BodyGraphService reported invalid cache state for root entity '${rootId}'`,
        ],
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `Cache validation failed for root entity '${rootId}'`
        ),
        {
          issues: [
            `BodyGraphService reported invalid cache state for root entity '${rootId}'`,
          ],
        }
      );
    });
  });
});
