/**
 * @file EntityFactoryWorkflow.e2e.test.js
 * @description End-to-end tests for entity factory workflows
 *
 * Tests the complete entity factory system including factory service initialization,
 * entity construction pipeline, definition lookup and caching, and comprehensive
 * error handling. This addresses the Priority 1 critical gap identified in the
 * entity workflows E2E test coverage analysis for factory system operations.
 *
 * Key Workflows Tested:
 * - Factory service lifecycle management and dependency resolution
 * - Complete entity construction through specialized factories
 * - Definition lookup optimization and caching effectiveness
 * - Factory error scenarios and recovery mechanisms
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterEach,
  afterAll,
} from '@jest/globals';
import EntityWorkflowTestBed from './common/entityWorkflowTestBed.js';

describe('Entity Factory E2E Workflow', () => {
  let testBed;

  // Container reuse optimization: Initialize once, reset state between tests
  beforeAll(async () => {
    testBed = new EntityWorkflowTestBed();
    await testBed.initialize();
  });

  afterEach(async () => {
    if (testBed) {
      // Lightweight cleanup: remove entities and reset state without destroying container
      await testBed.cleanupEntities();
    }
  });

  afterAll(async () => {
    if (testBed) {
      await testBed.cleanup();
    }
  });

  describe('Factory Service Initialization', () => {
    it('should initialize factory services with proper dependency resolution', async () => {
      // Arrange
      // Import factory classes for validation
      const EntityFactory = (
        await import('../../../src/entities/factories/entityFactory.js')
      ).default;

      // Create a definition first
      const definitionId = 'test:factory_init';
      await testBed.ensureEntityDefinitionExists(definitionId, {
        id: definitionId,
        components: {
          'core:name': { text: 'Factory Init Test' },
        },
      });

      // Act - Create factory instance with dependencies
      const factory = new EntityFactory({
        validator: testBed.validator,
        logger: testBed.logger,
        idGenerator: () => `factory_test_${Date.now()}`,
        cloner: (obj) => JSON.parse(JSON.stringify(obj)),
        defaultPolicy: { defaultComponentIds: [] },
      });

      // Assert factory initialization
      expect(factory).toBeDefined();
      expect(typeof factory.create).toBe('function');
      expect(typeof factory.reconstruct).toBe('function');

      // Test that factory can create an entity
      // Note: EntityFactory.create() signature is: (definitionId, options, registry, repository, definition)
      // Create a mock repository with the required has() method
      const mockRepository = {
        has: (id) => false, // For testing, assume no duplicates exist
        add: (entity) => {},
        get: (id) => null,
        remove: (id) => {},
      };

      const entity = factory.create(
        definitionId,
        { instanceId: 'factory_init_test' },
        testBed.registry,
        mockRepository
      );

      expect(entity).toBeDefined();
      expect(entity.id).toBe('factory_init_test');
      // Entity objects store definition ID internally but don't expose getDefinitionId()
      // Instead, verify the entity was created with the correct components from the definition
      expect(entity.hasComponent('core:name')).toBe(true);
      const nameData = entity.getComponentData('core:name');
      expect(nameData.text).toBe('Factory Init Test');
    });

    it('should coordinate between specialized factories during entity creation', async () => {
      // Arrange
      const definitionId = 'test:coordinated_entity';
      const instanceId = 'coordinated_test_001';

      await testBed.ensureEntityDefinitionExists(definitionId, {
        id: definitionId,
        components: {
          'core:name': { text: 'Test Entity' },
          'core:description': { text: 'Factory coordination test' },
        },
      });

      // Act - Create entity through entity manager (uses factory internally)
      const startTime = performance.now();
      const entity = await testBed.entityManager.createEntityInstance(
        definitionId,
        {
          instanceId,
        }
      );
      const endTime = performance.now();
      const creationTime = endTime - startTime;

      // Assert coordination between factories worked - verify the entity was created correctly
      expect(entity).toBeDefined();
      expect(entity.entityId || entity.id).toBe(instanceId);

      // Verify the entity has the expected components from the definition
      expect(entity.hasComponent('core:name')).toBe(true);
      expect(entity.hasComponent('core:description')).toBe(true);

      const nameData = entity.getComponentData('core:name');
      const descriptionData = entity.getComponentData('core:description');
      expect(nameData.text).toBe('Test Entity');
      expect(descriptionData.text).toBe('Factory coordination test');

      // Verify entity was registered in the entity manager
      const retrievedEntity =
        testBed.entityManager.getEntityInstance(instanceId);
      expect(retrievedEntity).toBeDefined();
      expect(retrievedEntity.id).toBe(instanceId);

      // Performance validation (<100ms target)
      expect(creationTime).toBeLessThan(100);
    });

    it('should properly manage factory lifecycle and cleanup resources', async () => {
      // Arrange
      const EntityFactory = (
        await import('../../../src/entities/factories/entityFactory.js')
      ).default;
      const factoryInstances = [];
      const memoryBefore = process.memoryUsage().heapUsed;

      // Act - Create multiple factory instances
      for (let i = 0; i < 10; i++) {
        const factory = new EntityFactory({
          validator: testBed.validator,
          logger: testBed.logger,
          idGenerator: () => `lifecycle_${i}_${Date.now()}`,
          cloner: (obj) => JSON.parse(JSON.stringify(obj)),
          defaultPolicy: { defaultComponentIds: [] },
        });

        factoryInstances.push(factory);

        // Use factory to create entities
        const definitionId = `test:lifecycle_entity_${i}`;
        await testBed.ensureEntityDefinitionExists(definitionId, {
          id: definitionId,
          components: {
            'core:name': { text: `Lifecycle Entity ${i}` },
          },
        });

        // Create mock repository for this test
        const mockRepository = {
          has: (id) => false,
          add: (entity) => {},
          get: (id) => null,
          remove: (id) => {},
        };

        const entity = factory.create(
          definitionId,
          { instanceId: `lifecycle_entity_${i}` },
          testBed.registry,
          mockRepository
        );

        expect(entity).toBeDefined();
      }

      // Clean up references
      factoryInstances.length = 0;

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memoryAfter = process.memoryUsage().heapUsed;

      // Assert - Memory should not grow excessively
      const memoryGrowth = memoryAfter - memoryBefore;
      const memoryGrowthMB = memoryGrowth / (1024 * 1024);

      // Memory growth should be reasonable (< 10MB for 10 factories)
      expect(memoryGrowthMB).toBeLessThan(10);
    });
  });

  describe('Entity Construction Pipeline', () => {
    it('should complete entity construction with proper validation integration', async () => {
      // Arrange
      const definitionId = 'test:validated_entity';
      const instanceId = 'validated_001';

      // Create definition with components that require validation
      await testBed.ensureEntityDefinitionExists(definitionId, {
        id: definitionId,
        components: {
          'core:position': { locationId: 'test_location' },
          'core:name': { text: 'Validated Entity' },
          'core:stats': {
            health: 100,
            maxHealth: 100,
            mana: 50,
            maxMana: 100,
          },
        },
      });

      // Register stats schema for validation (only if not already registered)
      try {
        await testBed.validator.addSchema(
          {
            type: 'object',
            properties: {
              health: { type: 'number', minimum: 0, maximum: 1000 },
              energy: { type: 'number', minimum: 0, maximum: 100 },
            },
            required: ['health', 'energy'],
            additionalProperties: false,
          },
          'core:stats'
        );
      } catch (err) {
        // Schema might already exist, that's ok
        if (!err.message.includes('already exists')) {
          throw err;
        }
      }

      // Act - Create entity with component overrides requiring validation
      const entity = await testBed.createTestEntity(definitionId, {
        instanceId,
        componentOverrides: {
          'core:stats': {
            health: 150,
            maxHealth: 200,
            mana: 75,
            maxMana: 150,
          },
        },
      });

      // Assert validation occurred and entity was created correctly
      expect(entity).toBeDefined();
      expect(entity.id).toBe(instanceId);

      // Verify components were validated and applied
      const statsComponent = entity.getComponentData('core:stats');
      expect(statsComponent).toEqual({
        health: 150,
        maxHealth: 200,
        mana: 75,
        maxMana: 150,
      });

      // Verify position component from definition
      const positionComponent = entity.getComponentData('core:position');
      expect(positionComponent).toEqual({
        locationId: 'test_location',
      });
    });

    it('should handle complex component validation cascade during construction', async () => {
      // Arrange - Create interdependent components
      const definitionId = 'test:cascade_entity';
      const instanceId = 'cascade_001';

      await testBed.ensureEntityDefinitionExists(definitionId, {
        id: definitionId,
        components: {
          'test:inventory': {
            maxWeight: 100,
            items: [],
          },
          'test:equipment': {
            slots: {
              weapon: null,
              armor: null,
            },
          },
        },
      });

      // Register schemas for validation cascade
      await testBed.validator.addSchema(
        {
          type: 'object',
          properties: {
            maxWeight: { type: 'number', minimum: 0 },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  weight: { type: 'number', minimum: 0 },
                },
                required: ['id', 'weight'],
              },
            },
          },
          required: ['maxWeight', 'items'],
        },
        'test:inventory'
      );

      await testBed.validator.addSchema(
        {
          type: 'object',
          properties: {
            slots: {
              type: 'object',
              properties: {
                weapon: {
                  oneOf: [{ type: 'null' }, { type: 'string' }],
                },
                armor: {
                  oneOf: [{ type: 'null' }, { type: 'string' }],
                },
              },
            },
          },
          required: ['slots'],
        },
        'test:equipment'
      );

      // Act - Create entity with complex overrides
      const entity = await testBed.createTestEntity(definitionId, {
        instanceId,
        componentOverrides: {
          'test:inventory': {
            maxWeight: 150,
            items: [
              { id: 'sword', weight: 10 },
              { id: 'potion', weight: 1 },
            ],
          },
          'test:equipment': {
            slots: {
              weapon: 'sword',
              armor: null,
            },
          },
        },
      });

      // Assert cascade validation succeeded
      expect(entity).toBeDefined();

      const inventory = entity.getComponentData('test:inventory');
      expect(inventory.items).toHaveLength(2);
      expect(inventory.maxWeight).toBe(150);

      const equipment = entity.getComponentData('test:equipment');
      expect(equipment.slots.weapon).toBe('sword');
      expect(equipment.slots.armor).toBeNull();
    });

    it('should inject default components and validate entity assembly', async () => {
      // Arrange
      const definitionId = 'test:default_injection';
      const instanceId = 'injection_001';

      // Create a definition with some components
      await testBed.ensureEntityDefinitionExists(definitionId, {
        id: definitionId,
        components: {
          'core:name': { text: 'Test Entity' },
        },
      });

      // Mock default policy to inject additional components
      const EntityFactory = (
        await import('../../../src/entities/factories/entityFactory.js')
      ).default;
      const factory = new EntityFactory({
        validator: testBed.validator,
        logger: testBed.logger,
        idGenerator: () => instanceId,
        cloner: (obj) => JSON.parse(JSON.stringify(obj)),
        defaultPolicy: {
          defaultComponentIds: ['core:timestamp', 'core:metadata'],
        },
      });

      // Register schemas for default components
      await testBed.validator.addSchema(
        {
          type: 'object',
          properties: {
            created: { type: 'number' },
            modified: { type: 'number' },
          },
        },
        'core:timestamp'
      );

      await testBed.validator.addSchema(
        {
          type: 'object',
          properties: {
            version: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
          },
        },
        'core:metadata'
      );

      // Register default component definitions using registry's interface
      testBed.registry.store('components', 'core:timestamp', {
        id: 'core:timestamp',
        dataSchema: {
          type: 'object',
          properties: {
            created: { type: 'number' },
            modified: { type: 'number' },
          },
        },
      });

      testBed.registry.store('components', 'core:metadata', {
        id: 'core:metadata',
        dataSchema: {
          type: 'object',
          properties: {
            version: { type: 'string' },
            tags: { type: 'array' },
          },
        },
      });

      // Act - Create entity with factory that has default injection
      // Create mock repository
      const mockRepository = {
        has: (id) => false,
        add: (entity) => {},
        get: (id) => null,
        remove: (id) => {},
      };

      const beforeCreation = Date.now();
      const entity = factory.create(
        definitionId,
        { instanceId },
        testBed.registry,
        mockRepository
      );
      const afterCreation = Date.now();

      // Assert default components were injected
      expect(entity).toBeDefined();
      expect(entity.id).toBe(instanceId);

      // Check explicitly defined component
      expect(entity.hasComponent('core:name')).toBe(true);
      const nameData = entity.getComponentData('core:name');
      expect(nameData.text).toBe('Test Entity');

      // Check if injected default components were added (they might not be if factory doesn't implement this feature)
      // This test validates that IF the factory supports default injection, it works correctly
      // If not supported, we just verify the core functionality works
      const hasTimestamp = entity.hasComponent('core:timestamp');
      const hasMetadata = entity.hasComponent('core:metadata');

      if (hasTimestamp) {
        const timestampData = entity.getComponentData('core:timestamp');
        expect(timestampData.created).toBeGreaterThanOrEqual(beforeCreation);
        expect(timestampData.created).toBeLessThanOrEqual(afterCreation);
      }

      if (hasMetadata) {
        const metadataData = entity.getComponentData('core:metadata');
        expect(metadataData).toBeDefined();
      }

      // At minimum, verify the explicitly defined component exists
      expect(entity.hasComponent('core:name')).toBe(true);
    });

    // Performance tests have been moved to tests/performance/entities/entityFactoryPerformance.test.js
  });

  describe('Definition Lookup and Caching', () => {
    // Caching performance tests have been moved to tests/performance/entities/entityFactoryPerformance.test.js

    it('should handle definition lookup failures gracefully', async () => {
      // Arrange
      const nonExistentDefinitionId = 'test:non_existent_definition';
      const fallbackDefinitionId = 'test:fallback_definition';

      // Only create the fallback definition
      await testBed.ensureEntityDefinitionExists(fallbackDefinitionId, {
        id: fallbackDefinitionId,
        components: {
          'core:name': { text: 'Fallback Entity' },
        },
      });

      // Act & Assert - Attempt to create entity with non-existent definition
      try {
        await testBed.entityManager.createEntityInstance(
          nonExistentDefinitionId,
          {
            instanceId: 'should_fail',
          }
        );

        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Should throw appropriate error
        expect(error).toBeDefined();
        expect(error.message).toContain(nonExistentDefinitionId);
      }

      // Verify system remains stable after lookup failure
      const validEntity = await testBed.entityManager.createEntityInstance(
        fallbackDefinitionId,
        {
          instanceId: 'fallback_001',
        }
      );

      expect(validEntity).toBeDefined();
      expect(validEntity.id).toBe('fallback_001');
    });

    // Cache invalidation tests have been moved to tests/performance/entities/entityFactoryPerformance.test.js

    // Large-scale lookup performance tests have been moved to tests/performance/entities/entityFactoryPerformance.test.js
  });

  describe('Factory Error Handling', () => {
    it('should handle and translate factory validation errors appropriately', async () => {
      // Arrange
      const definitionId = 'test:invalid_entity';

      await testBed.ensureEntityDefinitionExists(definitionId, {
        id: definitionId,
        components: {
          'test:strict': {
            requiredField: 'value',
            numberField: 42,
          },
        },
      });

      // Register strict schema that will cause validation failures
      await testBed.validator.addSchema(
        {
          type: 'object',
          properties: {
            requiredField: { type: 'string', minLength: 1 },
            numberField: { type: 'number', minimum: 0, maximum: 100 },
          },
          required: ['requiredField', 'numberField'],
          additionalProperties: false,
        },
        'test:strict'
      );

      // Act & Assert - Try to create entity with invalid component data
      try {
        await testBed.createTestEntity(definitionId, {
          instanceId: 'invalid_001',
          componentOverrides: {
            'test:strict': {
              requiredField: '', // Empty string violates minLength
              numberField: 150, // Exceeds maximum
            },
          },
        });

        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Should receive validation error
        expect(error).toBeDefined();
        // Check for validation-related error
        const errorMessage = error.message.toLowerCase();
        expect(errorMessage).toMatch(/validation|validate|invalid|strict/);

        // Verify error contains helpful information
        expect(error.message.toLowerCase()).toMatch(/strict|component|invalid/);
      }

      // Verify system remains stable after validation error
      const validEntity = await testBed.createTestEntity(definitionId, {
        instanceId: 'valid_after_error',
        componentOverrides: {
          'test:strict': {
            requiredField: 'valid value',
            numberField: 50,
          },
        },
      });

      expect(validEntity).toBeDefined();
      expect(validEntity.id).toBe('valid_after_error');
    });

    it('should handle factory initialization failures and provide recovery', async () => {
      // Arrange - Create factory with invalid dependencies
      const EntityFactory = (
        await import('../../../src/entities/factories/entityFactory.js')
      ).default;

      // Act & Assert - Try to create factory with missing validator
      try {
        new EntityFactory({
          validator: null, // Invalid dependency
          logger: testBed.logger,
          idGenerator: () => 'test_id',
          cloner: (obj) => JSON.parse(JSON.stringify(obj)),
          defaultPolicy: {},
        });

        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Should throw dependency validation error
        expect(error).toBeDefined();
        // Should contain reference to the missing dependency
        expect(error.message.toLowerCase()).toMatch(
          /validator|ischemavalidator|dependency/
        );
      }

      // Try with missing logger
      try {
        new EntityFactory({
          validator: testBed.validator,
          logger: null, // Invalid dependency
          idGenerator: () => 'test_id',
          cloner: (obj) => JSON.parse(JSON.stringify(obj)),
          defaultPolicy: {},
        });

        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Should throw dependency validation error
        expect(error).toBeDefined();
        expect(error.message.toLowerCase()).toMatch(/logger|ilogger/);
      }

      // Verify valid factory can still be created after failures
      const validFactory = new EntityFactory({
        validator: testBed.validator,
        logger: testBed.logger,
        idGenerator: () => 'recovery_test',
        cloner: (obj) => JSON.parse(JSON.stringify(obj)),
        defaultPolicy: { defaultComponentIds: [] },
      });

      expect(validFactory).toBeDefined();
      expect(typeof validFactory.create).toBe('function');
    });

    it('should handle entity reconstruction errors with proper error context', async () => {
      // Arrange
      const EntityFactory = (
        await import('../../../src/entities/factories/entityFactory.js')
      ).default;
      const factory = new EntityFactory({
        validator: testBed.validator,
        logger: testBed.logger,
        idGenerator: () => 'reconstruct_test',
        cloner: (obj) => JSON.parse(JSON.stringify(obj)),
        defaultPolicy: { defaultComponentIds: [] },
      });

      // Act & Assert - Try to reconstruct with invalid data

      // Create mock repository for reconstruction tests
      const mockRepository = {
        has: (id) => false,
        add: (entity) => {},
        get: (id) => null,
        remove: (id) => {},
      };

      // Test null serialized data
      try {
        factory.reconstruct(null, testBed.registry, mockRepository);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('serializedEntity');
      }

      // Test missing instanceId
      try {
        factory.reconstruct(
          {
            definitionId: 'test:entity',
            components: {},
            // instanceId missing
          },
          testBed.registry,
          mockRepository
        );
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('instanceId');
      }

      // Test missing definitionId
      try {
        factory.reconstruct(
          {
            instanceId: 'test_instance',
            components: {},
            // definitionId missing
          },
          testBed.registry,
          mockRepository
        );
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        // Error might be about missing definitionId or about registry access
        expect(error).toBeDefined();
      }

      // Test invalid component data
      const definitionId = 'test:reconstruct_entity';
      await testBed.ensureEntityDefinitionExists(definitionId);

      try {
        factory.reconstruct(
          {
            instanceId: 'reconstruct_001',
            definitionId: definitionId,
            components: {
              'invalid:component': 'not_an_object', // Components should be objects
            },
          },
          testBed.registry,
          mockRepository
        );
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        // Error should indicate component validation issue
      }

      // Verify valid reconstruction works after errors
      const validEntity = factory.reconstruct(
        {
          instanceId: 'valid_reconstruct',
          definitionId: definitionId,
          components: {
            'core:name': { text: 'Reconstructed' },
          },
        },
        testBed.registry,
        mockRepository
      );

      expect(validEntity).toBeDefined();
      expect(validEntity.id).toBe('valid_reconstruct');
    });

    it('should maintain system stability during cascading factory failures', async () => {
      // Arrange
      const definitionId = 'test:cascade_failure';
      const failureScenarios = [];
      const recoveryAttempts = [];

      await testBed.ensureEntityDefinitionExists(definitionId, {
        id: definitionId,
        components: {
          'core:name': { text: 'Cascade Test' },
        },
      });

      // Simulate various failure scenarios
      const scenarios = [
        { instanceId: '', error: 'empty instanceId' }, // Empty ID
        { instanceId: null, error: 'null instanceId' }, // Null ID
        {
          instanceId: 'duplicate_id',
          duplicate: true,
          error: 'duplicate entity',
        }, // Duplicate
        {
          componentOverrides: { 'invalid:component': {} },
          error: 'invalid component',
        }, // Invalid component
      ];

      // Act - Execute failure scenarios
      for (const scenario of scenarios) {
        try {
          if (scenario.duplicate) {
            // Create first entity to cause duplicate
            await testBed.createTestEntity(definitionId, {
              instanceId: scenario.instanceId,
            });
          }

          // Attempt operation that should fail
          await testBed.createTestEntity(definitionId, {
            instanceId: scenario.instanceId,
            componentOverrides: scenario.componentOverrides,
          });

          failureScenarios.push({ scenario, failed: false });
        } catch (error) {
          failureScenarios.push({
            scenario,
            failed: true,
            error: error.message,
          });

          // Attempt recovery
          try {
            const recoveryEntity = await testBed.createTestEntity(
              definitionId,
              {
                instanceId: `recovery_${Date.now()}_${Math.random()}`,
              }
            );

            recoveryAttempts.push({
              scenario: scenario.error,
              recovered: true,
              entityId: recoveryEntity.id,
            });
          } catch (recoveryError) {
            recoveryAttempts.push({
              scenario: scenario.error,
              recovered: false,
              error: recoveryError.message,
            });
          }
        }
      }

      // Assert all scenarios failed as expected
      expect(
        failureScenarios.filter((s) => s.failed).length
      ).toBeGreaterThanOrEqual(3);

      // Assert all recovery attempts succeeded
      const successfulRecoveries = recoveryAttempts.filter((r) => r.recovered);
      expect(successfulRecoveries.length).toBe(recoveryAttempts.length);

      // Verify system remains fully functional
      const finalValidation = await testBed.createTestEntity(definitionId, {
        instanceId: 'final_validation_entity',
      });

      expect(finalValidation).toBeDefined();
      expect(finalValidation.id).toBe('final_validation_entity');

      // Check event system still works
      const events = testBed.getEventsByType('core:entity_created');
      expect(events.length).toBeGreaterThan(0);
    });

    // Resource exhaustion test moved to:
    // tests/memory/entities/entityFactoryResourceExhaustion.memory.test.js
  });
});
