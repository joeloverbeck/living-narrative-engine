import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TargetDisplayNameResolver } from '../../../../../../src/actions/pipeline/services/implementations/TargetDisplayNameResolver.js';
import {
  ServiceError,
  ServiceErrorCodes,
} from '../../../../../../src/actions/pipeline/services/base/ServiceError.js';
import { createMockLogger } from '../../../../../common/mockFactories/loggerMocks.js';

describe('TargetDisplayNameResolver', () => {
  let mockLogger;
  let mockEntityManager;
  let mockEntity;
  let targetDisplayNameResolver;

  beforeEach(() => {
    mockLogger = createMockLogger();

    mockEntity = {
      id: 'entity-123',
      getComponentData: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    targetDisplayNameResolver = new TargetDisplayNameResolver({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with valid dependencies', () => {
      expect(targetDisplayNameResolver).toBeInstanceOf(
        TargetDisplayNameResolver
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TargetDisplayNameResolver: initialized',
        expect.objectContaining({
          service: 'TargetDisplayNameResolver',
          operation: 'initialized',
        })
      );
    });

    it('should throw error if entityManager is missing', () => {
      expect(() => {
        new TargetDisplayNameResolver({
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw error if logger is missing', () => {
      expect(() => {
        new TargetDisplayNameResolver({
          entityManager: mockEntityManager,
        });
      }).toThrow();
    });

    it('should validate entityManager has required methods', () => {
      const invalidEntityManager = {};
      expect(() => {
        new TargetDisplayNameResolver({
          entityManager: invalidEntityManager,
          logger: mockLogger,
        });
      }).toThrow();
    });
  });

  describe('getEntityDisplayName', () => {
    describe('exact logic from MultiTargetResolutionStage lines 713-730', () => {
      it('should return entityId when entity is not found', () => {
        const entityId = 'missing-entity';
        mockEntityManager.getEntityInstance.mockReturnValue(null);

        const result = targetDisplayNameResolver.getEntityDisplayName(entityId);

        expect(result).toBe(entityId);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          entityId
        );
      });

      it('should return name from core:name component text field', () => {
        const entityId = 'entity-123';
        const expectedName = 'Test Character';

        mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
        mockEntity.getComponentData.mockImplementation((componentId) => {
          if (componentId === 'core:name') {
            return { text: expectedName };
          }
          return null;
        });

        const result = targetDisplayNameResolver.getEntityDisplayName(entityId);

        expect(result).toBe(expectedName);
        expect(mockEntity.getComponentData).toHaveBeenCalledWith('core:name');
      });

      it('should fallback to core:description name field when core:name.text is not available', () => {
        const entityId = 'entity-123';
        const expectedName = 'Described Entity';

        mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
        mockEntity.getComponentData.mockImplementation((componentId) => {
          if (componentId === 'core:name') {
            return null;
          }
          if (componentId === 'core:description') {
            return { name: expectedName };
          }
          return null;
        });

        const result = targetDisplayNameResolver.getEntityDisplayName(entityId);

        expect(result).toBe(expectedName);
        expect(mockEntity.getComponentData).toHaveBeenCalledWith('core:name');
        expect(mockEntity.getComponentData).toHaveBeenCalledWith(
          'core:description'
        );
      });

      it('should fallback to core:actor name field when previous options are not available', () => {
        const entityId = 'entity-123';
        const expectedName = 'Actor Name';

        mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
        mockEntity.getComponentData.mockImplementation((componentId) => {
          if (componentId === 'core:actor') {
            return { name: expectedName };
          }
          return null;
        });

        const result = targetDisplayNameResolver.getEntityDisplayName(entityId);

        expect(result).toBe(expectedName);
        expect(mockEntity.getComponentData).toHaveBeenCalledWith('core:name');
        expect(mockEntity.getComponentData).toHaveBeenCalledWith(
          'core:description'
        );
        expect(mockEntity.getComponentData).toHaveBeenCalledWith('core:actor');
      });

      it('should fallback to core:item name field when all previous options are not available', () => {
        const entityId = 'entity-123';
        const expectedName = 'Item Name';

        mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
        mockEntity.getComponentData.mockImplementation((componentId) => {
          if (componentId === 'core:item') {
            return { name: expectedName };
          }
          return null;
        });

        const result = targetDisplayNameResolver.getEntityDisplayName(entityId);

        expect(result).toBe(expectedName);
        expect(mockEntity.getComponentData).toHaveBeenCalledWith('core:name');
        expect(mockEntity.getComponentData).toHaveBeenCalledWith(
          'core:description'
        );
        expect(mockEntity.getComponentData).toHaveBeenCalledWith('core:actor');
        expect(mockEntity.getComponentData).toHaveBeenCalledWith('core:item');
      });

      it('should return entityId when no name found in any component', () => {
        const entityId = 'entity-123';

        mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
        mockEntity.getComponentData.mockReturnValue(null);

        const result = targetDisplayNameResolver.getEntityDisplayName(entityId);

        expect(result).toBe(entityId);
        expect(mockEntity.getComponentData).toHaveBeenCalledWith('core:name');
        expect(mockEntity.getComponentData).toHaveBeenCalledWith(
          'core:description'
        );
        expect(mockEntity.getComponentData).toHaveBeenCalledWith('core:actor');
        expect(mockEntity.getComponentData).toHaveBeenCalledWith('core:item');
      });

      it('should return entityId when exception occurs (exact error handling)', () => {
        const entityId = 'entity-123';

        mockEntityManager.getEntityInstance.mockImplementation(() => {
          throw new Error('Entity fetch failed');
        });

        const result = targetDisplayNameResolver.getEntityDisplayName(entityId);

        expect(result).toBe(entityId);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Failed to get entity display name',
          expect.objectContaining({
            entityId,
            error: 'Entity fetch failed',
          })
        );
      });

      it('should prefer first available name in exact component priority order', () => {
        const entityId = 'entity-123';
        const nameName = 'Name Component';
        const descName = 'Description Component';
        const actorName = 'Actor Component';
        const itemName = 'Item Component';

        mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
        mockEntity.getComponentData.mockImplementation((componentId) => {
          if (componentId === 'core:name') {
            return { text: nameName };
          }
          if (componentId === 'core:description') {
            return { name: descName };
          }
          if (componentId === 'core:actor') {
            return { name: actorName };
          }
          if (componentId === 'core:item') {
            return { name: itemName };
          }
          return null;
        });

        const result = targetDisplayNameResolver.getEntityDisplayName(entityId);

        // Should return the first available (core:name.text)
        expect(result).toBe(nameName);
        // Should not check further components due to short-circuit evaluation
        expect(mockEntity.getComponentData).toHaveBeenCalledWith('core:name');
      });
    });

    describe('input validation', () => {
      it('should return fallback name for null entityId', () => {
        const result = targetDisplayNameResolver.getEntityDisplayName(null);

        expect(result).toBe('Unknown Entity');
        expect(mockLogger.debug).toHaveBeenLastCalledWith(
          'TargetDisplayNameResolver: getEntityDisplayName',
          expect.objectContaining({
            entityId: null,
            result: 'invalid_id',
          })
        );
      });

      it('should return fallback name for undefined entityId', () => {
        const result =
          targetDisplayNameResolver.getEntityDisplayName(undefined);

        expect(result).toBe('Unknown Entity');
      });

      it('should return fallback name for empty string entityId', () => {
        const result = targetDisplayNameResolver.getEntityDisplayName('');

        expect(result).toBe('Unknown Entity');
      });

      it('should return fallback name for non-string entityId', () => {
        const result = targetDisplayNameResolver.getEntityDisplayName(123);

        expect(result).toBe('Unknown Entity');
      });
    });

    describe('logging behavior', () => {
      it('should log successful operations', () => {
        const entityId = 'entity-123';
        const expectedName = 'Test Name';

        mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
        mockEntity.getComponentData.mockImplementation((componentId) => {
          if (componentId === 'core:name') {
            return { text: expectedName };
          }
          return null;
        });

        targetDisplayNameResolver.getEntityDisplayName(entityId);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'TargetDisplayNameResolver: getEntityDisplayName',
          expect.objectContaining({
            entityId,
            result: 'success',
            displayName: expectedName,
          })
        );
      });

      it('should log when entity not found', () => {
        const entityId = 'missing-entity';
        mockEntityManager.getEntityInstance.mockReturnValue(null);

        targetDisplayNameResolver.getEntityDisplayName(entityId);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'TargetDisplayNameResolver: getEntityDisplayName',
          expect.objectContaining({
            entityId,
            result: 'entity_not_found',
          })
        );
      });
    });
  });

  describe('getEntityDisplayNames (batch processing)', () => {
    it('should process multiple entity IDs', () => {
      const entityIds = ['entity-1', 'entity-2', 'entity-3'];

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'entity-1') {
          return {
            id,
            getComponentData: jest
              .fn()
              .mockImplementation((comp) =>
                comp === 'core:name' ? { text: 'Entity One' } : null
              ),
          };
        }
        if (id === 'entity-2') {
          return null; // Missing entity
        }
        if (id === 'entity-3') {
          return {
            id,
            getComponentData: jest
              .fn()
              .mockImplementation((comp) =>
                comp === 'core:actor' ? { name: 'Entity Three' } : null
              ),
          };
        }
        return null;
      });

      const result = targetDisplayNameResolver.getEntityDisplayNames(entityIds);

      expect(result).toEqual({
        'entity-1': 'Entity One',
        'entity-2': 'entity-2', // Fallback to ID
        'entity-3': 'Entity Three',
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TargetDisplayNameResolver: getEntityDisplayNames',
        expect.objectContaining({
          count: 3,
        })
      );
    });

    it('should throw error for non-array input', () => {
      expect(() => {
        targetDisplayNameResolver.getEntityDisplayNames('not-an-array');
      }).toThrow(ServiceError);
    });

    it('should throw error for missing entityIds parameter', () => {
      expect(() => {
        targetDisplayNameResolver.getEntityDisplayNames();
      }).toThrow(ServiceError);
    });

    it('should handle empty array', () => {
      const result = targetDisplayNameResolver.getEntityDisplayNames([]);

      expect(result).toEqual({});
    });
  });

  describe('setFallbackName', () => {
    it('should update fallback name', () => {
      const newFallbackName = 'Custom Fallback';

      targetDisplayNameResolver.setFallbackName(newFallbackName);

      // Test that the new fallback is used
      const result = targetDisplayNameResolver.getEntityDisplayName(null);
      expect(result).toBe(newFallbackName);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TargetDisplayNameResolver: setFallbackName',
        expect.objectContaining({
          fallbackName: newFallbackName,
        })
      );
    });

    it('should throw error for non-string fallback name', () => {
      expect(() => {
        targetDisplayNameResolver.setFallbackName(123);
      }).toThrow(ServiceError);

      expect(() => {
        targetDisplayNameResolver.setFallbackName(null);
      }).toThrow(ServiceError);
    });
  });

  describe('interface method compliance', () => {
    describe('getDisplayName', () => {
      it('should handle entity object with ID', () => {
        const entity = { id: 'entity-123' };
        const expectedName = 'Test Name';

        mockEntityManager.getEntityInstance.mockReturnValue({
          ...mockEntity,
          getComponentData: jest
            .fn()
            .mockImplementation((comp) =>
              comp === 'core:name' ? { text: expectedName } : null
            ),
        });

        const result = targetDisplayNameResolver.getDisplayName(entity);

        expect(result).toBe(expectedName);
      });

      it('should return fallback for entity without ID', () => {
        const entity = {};

        const result = targetDisplayNameResolver.getDisplayName(entity);

        expect(result).toBe('Unknown Entity');
      });

      it('should use options.defaultName when provided', () => {
        const entity = null;
        const options = { defaultName: 'Custom Default' };

        const result = targetDisplayNameResolver.getDisplayName(
          entity,
          options
        );

        expect(result).toBe('Custom Default');
      });
    });

    describe('getDisplayNameDetails', () => {
      it('should provide detailed information for valid entity', () => {
        const entity = {
          id: 'entity-123',
          getComponentData: jest
            .fn()
            .mockImplementation((comp) =>
              comp === 'core:name' ? { text: 'Test Name' } : null
            ),
        };

        mockEntityManager.getEntityInstance.mockReturnValue(entity);

        const result = targetDisplayNameResolver.getDisplayNameDetails(entity);

        expect(result).toEqual({
          displayName: 'Test Name',
          source: 'name',
          isDefault: false,
        });
      });

      it('should indicate default name usage', () => {
        const entity = null;

        const result = targetDisplayNameResolver.getDisplayNameDetails(entity);

        expect(result).toEqual({
          displayName: 'Unknown Entity',
          source: 'default',
          isDefault: true,
        });
      });

      it('should correctly identify source components', () => {
        const entity = {
          id: 'entity-123',
          getComponentData: jest
            .fn()
            .mockImplementation((comp) =>
              comp === 'core:actor' ? { name: 'Actor Name' } : null
            ),
        };

        mockEntityManager.getEntityInstance.mockReturnValue(entity);

        const result = targetDisplayNameResolver.getDisplayNameDetails(entity);

        expect(result.source).toBe('actor');
        expect(result.isDefault).toBe(false);
      });

      it('should flag ID fallback when no display components resolve', () => {
        const entity = {
          id: 'entity-123',
          getComponentData: jest.fn().mockReturnValue(null),
        };

        mockEntityManager.getEntityInstance.mockReturnValue(entity);

        const result = targetDisplayNameResolver.getDisplayNameDetails(entity);

        expect(result).toEqual({
          displayName: 'entity-123',
          source: 'id',
          isDefault: true,
        });
      });

      it('should mark description component as the source when matched', () => {
        const entity = {
          id: 'entity-123',
          getComponentData: jest
            .fn()
            .mockImplementation((comp) =>
              comp === 'core:description' ? { name: 'Descriptive Name' } : null
            ),
        };

        mockEntityManager.getEntityInstance.mockReturnValue(entity);

        const result = targetDisplayNameResolver.getDisplayNameDetails(entity);

        expect(result).toEqual({
          displayName: 'Descriptive Name',
          source: 'description',
          isDefault: false,
        });
      });

      it('should mark item component as the source when matched', () => {
        const entity = {
          id: 'entity-123',
          getComponentData: jest
            .fn()
            .mockImplementation((comp) =>
              comp === 'core:item' ? { name: 'Item Display' } : null
            ),
        };

        mockEntityManager.getEntityInstance.mockReturnValue(entity);

        const result = targetDisplayNameResolver.getDisplayNameDetails(entity);

        expect(result).toEqual({
          displayName: 'Item Display',
          source: 'item',
          isDefault: false,
        });
      });
    });

    describe('getDisplayNames', () => {
      it('should process entity objects array', () => {
        const entities = [{ id: 'entity-1' }, { id: 'entity-2' }];

        mockEntityManager.getEntityInstance.mockImplementation((id) => ({
          id,
          getComponentData: jest
            .fn()
            .mockImplementation((comp) =>
              comp === 'core:name' ? { text: `Name for ${id}` } : null
            ),
        }));

        const result = targetDisplayNameResolver.getDisplayNames(entities);

        expect(result).toBeInstanceOf(Map);
        expect(result.get('entity-1')).toBe('Name for entity-1');
        expect(result.get('entity-2')).toBe('Name for entity-2');
      });

      it('should throw error for non-array input', () => {
        expect(() => {
          targetDisplayNameResolver.getDisplayNames('not-array');
        }).toThrow(ServiceError);
      });

      it('should skip entities without IDs in the batch', () => {
        const entities = [{ id: 'entity-1' }, { name: 'no-id' }];

        mockEntityManager.getEntityInstance.mockImplementation((id) => ({
          id,
          getComponentData: jest
            .fn()
            .mockImplementation((comp) =>
              comp === 'core:name' ? { text: `Name for ${id}` } : null
            ),
        }));

        const result = targetDisplayNameResolver.getDisplayNames(entities);

        expect(result.size).toBe(1);
        expect(result.get('entity-1')).toBe('Name for entity-1');
      });
    });

    describe('formatWithContext', () => {
      beforeEach(() => {
        const contextMockEntity = {
          id: 'entity-123',
          getComponentData: jest.fn().mockImplementation((comp) => {
            if (comp === 'core:name') return { text: 'Test Entity' };
            if (comp === 'core:location') return { name: 'Test Location' };
            if (comp === 'core:health') return { current: 75, max: 100 };
            return null;
          }),
        };
        mockEntityManager.getEntityInstance.mockReturnValue(contextMockEntity);
      });

      it('should format with location context', () => {
        const entity = { id: 'entity-123' };
        const context = { includeLocation: true };

        const result = targetDisplayNameResolver.formatWithContext(
          entity,
          context
        );

        expect(result).toBe('Test Entity (at Test Location)');
      });

      it('should format with health context', () => {
        const entity = { id: 'entity-123' };
        const context = { includeState: true };

        const result = targetDisplayNameResolver.formatWithContext(
          entity,
          context
        );

        expect(result).toBe('Test Entity (75% health)');
      });

      it('should format with both contexts', () => {
        const entity = { id: 'entity-123' };
        const context = { includeLocation: true, includeState: true };

        const result = targetDisplayNameResolver.formatWithContext(
          entity,
          context
        );

        expect(result).toBe('Test Entity (at Test Location) (75% health)');
      });

      it('should handle missing entity', () => {
        const result = targetDisplayNameResolver.formatWithContext(null);

        expect(result).toBe('Unknown Entity');
      });

      it('should return base name when actual entity cannot be fetched', () => {
        const entity = { id: 'entity-999' };
        const baseEntity = {
          id: 'entity-999',
          getComponentData: jest.fn().mockReturnValue(null),
        };

        mockEntityManager.getEntityInstance.mockReset();
        mockEntityManager.getEntityInstance
          .mockReturnValueOnce(baseEntity)
          .mockReturnValueOnce(null);

        const result = targetDisplayNameResolver.formatWithContext(entity, {
          includeLocation: true,
          includeState: true,
        });

        expect(result).toBe('entity-999');
      });

      it('should avoid adding state context when at full health', () => {
        const entity = { id: 'entity-123' };

        const healthyEntity = {
          id: 'entity-123',
          getComponentData: jest.fn().mockImplementation((comp) => {
            if (comp === 'core:name') return { text: 'Healthy Entity' };
            if (comp === 'core:health') return { current: 100, max: 100 };
            return null;
          }),
        };

        mockEntityManager.getEntityInstance.mockReturnValue(healthyEntity);

        const result = targetDisplayNameResolver.formatWithContext(entity, {
          includeState: true,
        });

        expect(result).toBe('Healthy Entity');
      });
    });

    describe('hasValidDisplayName', () => {
      it('should return true for entity with valid display name', () => {
        const entity = { id: 'entity-123' };

        mockEntityManager.getEntityInstance.mockReturnValue({
          ...mockEntity,
          getComponentData: jest
            .fn()
            .mockImplementation((comp) =>
              comp === 'core:name' ? { text: 'Valid Name' } : null
            ),
        });

        const result = targetDisplayNameResolver.hasValidDisplayName(entity);

        expect(result).toBe(true);
      });

      it('should return false for entity that falls back to ID', () => {
        const entity = { id: 'entity-123' };

        mockEntityManager.getEntityInstance.mockReturnValue({
          ...mockEntity,
          getComponentData: jest.fn().mockReturnValue(null),
        });

        const result = targetDisplayNameResolver.hasValidDisplayName(entity);

        expect(result).toBe(false);
      });

      it('should return false for null entity', () => {
        const result = targetDisplayNameResolver.hasValidDisplayName(null);

        expect(result).toBe(false);
      });

      it('should respect custom fallback names when determining validity', () => {
        const entity = { id: 'entity-123' };

        targetDisplayNameResolver.setFallbackName('Mystery Being');

        mockEntityManager.getEntityInstance.mockReturnValue({
          ...mockEntity,
          getComponentData: jest.fn().mockReturnValue(null),
        });

        const result = targetDisplayNameResolver.hasValidDisplayName(entity);

        expect(result).toBe(false);
      });
    });

    describe('getEntityDisplayNames', () => {
      it('should use fallback name for invalid identifiers', () => {
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'valid-entity') {
            return {
              id,
              getComponentData: jest.fn().mockImplementation((comp) =>
                comp === 'core:name' ? { text: 'Valid Name' } : null
              ),
            };
          }

          return null;
        });

        const result = targetDisplayNameResolver.getEntityDisplayNames([
          'valid-entity',
          null,
          42,
        ]);

        expect(result['valid-entity']).toBe('Valid Name');
        expect(result.null).toBe('Unknown Entity');
        expect(result[42]).toBe('Unknown Entity');
      });
    });
  });
});
