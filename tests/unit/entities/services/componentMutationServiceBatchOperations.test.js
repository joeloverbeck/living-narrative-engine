/**
 * @file Unit tests for ComponentMutationService batch operations
 * @description Tests that verify correct parameter order and validation
 * in batchAddComponentsOptimized method. These tests expose a critical bug
 * where parameters are passed in the wrong order to #validateComponentData.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { ComponentMutationService } from '../../../../src/entities/services/componentMutationService.js';
import { EntityRepositoryAdapter } from '../../../../src/entities/services/entityRepositoryAdapter.js';
import Entity from '../../../../src/entities/entity.js';
import EntityDefinition from '../../../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../../../src/entities/entityInstanceData.js';
import { COMPONENTS_BATCH_ADDED_ID } from '../../../../src/constants/eventIds.js';

/**
 * Creates a mock schema validator that tracks validation calls
 *
 * @returns {object} Mock validator with tracking
 */
function createMockValidator() {
  const validationCalls = [];

  return {
    validate: jest.fn((schemaId, data) => {
      validationCalls.push({ schemaId, data });

      // Pass validation for known component schemas
      if (schemaId === 'core:position' || schemaId === 'inventory:inventory') {
        return { isValid: true };
      }

      // Fail for entity instance IDs (these should never be used as schema IDs)
      if (schemaId.includes('actor') || schemaId.includes('test:')) {
        return {
          isValid: false,
          errors: [
            {
              keyword: 'schemaNotFound',
              params: { schemaId },
              message: `Schema with id '${schemaId}' not found, is invalid, or validator could not be retrieved.`,
            },
          ],
        };
      }

      return { isValid: true };
    }),
    validationCalls,
  };
}

/**
 * Creates a mock logger that tracks error calls
 *
 * @returns {object} Mock logger
 */
function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

/**
 * Creates a mock event dispatcher
 *
 * @returns {object} Mock dispatcher
 */
function createMockDispatcher() {
  return {
    dispatch: jest.fn(),
  };
}

/**
 * Creates a mock component cloner
 *
 * @returns {Function} Mock cloner function
 */
function createMockCloner() {
  return jest.fn((data) => ({ ...data }));
}

describe('ComponentMutationService - Batch Operations', () => {
  let service;
  let mockValidator;
  let mockLogger;
  let mockDispatcher;
  let mockCloner;
  let entityRepository;

  beforeEach(() => {
    mockValidator = createMockValidator();
    mockLogger = createMockLogger();
    mockDispatcher = createMockDispatcher();
    mockCloner = createMockCloner();

    // Create entity repository with a test entity
    const entityDefinition = new EntityDefinition(
      'test:actor',
      {
        components: {},
      },
      mockLogger
    );

    const entityInstanceData = new EntityInstanceData(
      'test:actor1',
      entityDefinition,
      {},
      mockLogger
    );

    const entity = new Entity(entityInstanceData);

    entityRepository = new EntityRepositoryAdapter({
      logger: mockLogger,
    });
    entityRepository.add(entity);

    service = new ComponentMutationService({
      entityRepository,
      validator: mockValidator,
      logger: mockLogger,
      eventDispatcher: mockDispatcher,
      cloner: mockCloner,
    });
  });

  describe('Parameter Order Validation', () => {
    it('should validate componentTypeId as schema ID (not instanceId)', async () => {
      // Arrange: Create batch spec with valid component
      const batchSpec = [
        {
          instanceId: 'test:actor1',
          componentTypeId: 'core:position',
          componentData: { locationId: 'room-1' },
        },
      ];

      // Act: Execute batch add
      await service.batchAddComponentsOptimized(batchSpec, false);

      // Assert: Validator should be called with componentTypeId as schema ID
      // NOT instanceId! This test will FAIL if parameters are in wrong order.
      expect(mockValidator.validate).toHaveBeenCalled();

      const validationCall = mockValidator.validationCalls[0];
      expect(validationCall.schemaId).toBe('core:position'); // ✅ Correct
      expect(validationCall.schemaId).not.toBe('test:actor1'); // ❌ Wrong!

      // Verify the data passed is componentData, not something else
      expect(validationCall.data).toEqual({ locationId: 'room-1' });
    });

    it('should reject when instanceId is mistakenly used as componentTypeId', async () => {
      // Arrange: This simulates the bug where parameters are out of order
      const batchSpec = [
        {
          instanceId: 'test:actor1',
          componentTypeId: 'core:position',
          componentData: { locationId: 'room-1' },
        },
      ];

      // Act & Assert: If bug exists, validator will be called with instanceId as schemaId
      // and will fail validation because entity IDs are not valid component schemas

      const result = await service.batchAddComponentsOptimized(
        batchSpec,
        false
      );

      // With correct implementation: should succeed
      expect(result.errors).toHaveLength(0);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].success).toBe(true);

      // Verify schema validation was attempted with correct component type
      const firstCall = mockValidator.validationCalls[0];
      expect(firstCall.schemaId).toBe('core:position');
    });

    it('should handle validation errors with correct component type in error message', async () => {
      // Arrange: Force validation failure for a known component type
      mockValidator.validate.mockImplementation((schemaId) => {
        if (schemaId === 'inventory:inventory') {
          return {
            isValid: false,
            errors: [
              {
                keyword: 'required',
                message: 'Missing required property: items',
              },
            ],
          };
        }
        return { isValid: true };
      });

      const batchSpec = [
        {
          instanceId: 'test:actor1',
          componentTypeId: 'inventory:inventory',
          componentData: {}, // Invalid - missing required fields
        },
      ];

      // Act
      const result = await service.batchAddComponentsOptimized(
        batchSpec,
        false
      );

      // Assert: Error should reference componentTypeId, not instanceId
      expect(result.errors).toHaveLength(1);
      expect(mockValidator.validate).toHaveBeenCalledWith(
        'inventory:inventory',
        {}
      );

      // Error message should include correct component type AND entity ID for context
      const errorMessage = result.errors[0].error.message;
      expect(errorMessage).toContain('inventory:inventory');
      expect(errorMessage).toContain('test:actor1'); // Entity ID included for debugging context
    });
  });

  describe('Batch Operation Success Scenarios', () => {
    it('should successfully add multiple components with correct validation', async () => {
      // Arrange: Create multiple entities
      const entityDefinition2 = new EntityDefinition(
        'test:actor',
        {
          components: {},
        },
        mockLogger
      );

      const entityInstanceData2 = new EntityInstanceData(
        'test:actor2',
        entityDefinition2,
        {},
        mockLogger
      );

      const entity2 = new Entity(entityInstanceData2);
      entityRepository.add(entity2);

      const batchSpec = [
        {
          instanceId: 'test:actor1',
          componentTypeId: 'core:position',
          componentData: { locationId: 'room-1' },
        },
        {
          instanceId: 'test:actor2',
          componentTypeId: 'core:position',
          componentData: { locationId: 'room-2' },
        },
      ];

      // Act
      const result = await service.batchAddComponentsOptimized(
        batchSpec,
        false
      );

      // Assert: Both operations should succeed
      expect(result.errors).toHaveLength(0);
      expect(result.results).toHaveLength(2);
      expect(result.updateCount).toBe(2);

      // Verify each validation call used correct component type
      expect(mockValidator.validationCalls).toHaveLength(2);
      expect(mockValidator.validationCalls[0].schemaId).toBe('core:position');
      expect(mockValidator.validationCalls[1].schemaId).toBe('core:position');
    });

    it('should preserve entity integrity after batch operations', async () => {
      // Arrange
      const batchSpec = [
        {
          instanceId: 'test:actor1',
          componentTypeId: 'core:position',
          componentData: { locationId: 'room-1' },
        },
      ];

      // Act
      await service.batchAddComponentsOptimized(batchSpec, false);

      // Assert: Entity should have the component with correct data
      const entity = entityRepository.get('test:actor1');
      expect(entity.hasComponent('core:position')).toBe(true);

      const positionData = entity.getComponentData('core:position');
      expect(positionData.locationId).toBe('room-1');
    });
  });

  describe('Error Recovery and Reporting', () => {
    it('should provide detailed error context for validation failures', async () => {
      // Arrange: Force validation to fail
      mockValidator.validate.mockReturnValue({
        isValid: false,
        errors: [
          {
            keyword: 'type',
            message: 'must be string',
            params: { type: 'string' },
          },
        ],
      });

      const batchSpec = [
        {
          instanceId: 'test:actor1',
          componentTypeId: 'core:position',
          componentData: { locationId: 123 }, // Wrong type
        },
      ];

      // Act
      const result = await service.batchAddComponentsOptimized(
        batchSpec,
        false
      );

      // Assert: Error details should be captured
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].spec).toEqual(batchSpec[0]);
      expect(result.errors[0].error).toBeDefined();

      // Logger should have recorded the error with correct component type
      expect(mockLogger.error).toHaveBeenCalled();
      const errorCall = mockLogger.error.mock.calls[0][0];
      expect(errorCall).toContain('core:position');
      expect(errorCall).toContain('test:actor1');
    });

    it('should continue batch processing after individual failures', async () => {
      // Arrange: Create entity2 for second spec
      const entityDefinition2 = new EntityDefinition(
        'test:actor',
        {
          components: {},
        },
        mockLogger
      );

      const entityInstanceData2 = new EntityInstanceData(
        'test:actor2',
        entityDefinition2,
        {},
        mockLogger
      );

      const entity2 = new Entity(entityInstanceData2);
      entityRepository.add(entity2);

      // First spec will fail validation, second will succeed
      mockValidator.validate.mockImplementation((schemaId, data) => {
        if (data.locationId === 'invalid') {
          return {
            isValid: false,
            errors: [{ message: 'Invalid location' }],
          };
        }
        return { isValid: true };
      });

      const batchSpec = [
        {
          instanceId: 'test:actor1',
          componentTypeId: 'core:position',
          componentData: { locationId: 'invalid' }, // Will fail
        },
        {
          instanceId: 'test:actor2',
          componentTypeId: 'core:position',
          componentData: { locationId: 'room-2' }, // Will succeed
        },
      ];

      // Act
      const result = await service.batchAddComponentsOptimized(
        batchSpec,
        false
      );

      // Assert: One error, one success
      // Note: results array only contains successful operations, not failed ones
      expect(result.errors).toHaveLength(1);
      expect(result.results).toHaveLength(1); // Only successful operation
      expect(result.updateCount).toBe(1);

      // Second entity should have the component
      const entity2Instance = entityRepository.get('test:actor2');
      expect(entity2Instance.hasComponent('core:position')).toBe(true);
    });
  });

  describe('Batch event emission', () => {
    it('should record an error when a component spec is missing required identifiers', async () => {
      const batchSpec = [
        {
          componentTypeId: 'core:position',
          componentData: { locationId: 'room-1' },
        },
      ];

      const result = await service.batchAddComponentsOptimized(batchSpec);

      expect(result.results).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBeInstanceOf(Error);
      expect(result.errors[0].error.message).toContain(
        'Invalid component spec: missing instanceId or componentTypeId'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid component spec')
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Batch add components completed with 1 errors out of 1 total'
      );
    });

    it('should emit a batch event when emitBatchEvent is true and updates exist', async () => {
      const batchSpec = [
        {
          instanceId: 'test:actor1',
          componentTypeId: 'core:position',
          componentData: { locationId: 'room-1' },
        },
      ];

      const result = await service.batchAddComponentsOptimized(batchSpec);

      expect(result.errors).toHaveLength(0);
      expect(result.updateCount).toBe(1);
      expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        COMPONENTS_BATCH_ADDED_ID,
        expect.objectContaining({
          updateCount: 1,
          updates: [
            expect.objectContaining({
              instanceId: 'test:actor1',
              componentTypeId: 'core:position',
              componentData: { locationId: 'room-1' },
              oldComponentData: undefined,
              isNewComponent: true,
            }),
          ],
        })
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Emitted batch event for ${result.updateCount} component updates`
      );
    });
  });
});
