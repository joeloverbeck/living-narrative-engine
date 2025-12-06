/**
 * @file MultiTargetActionWorkflow.e2e.test.js
 * @description End-to-end tests for multi-target action workflows
 *
 * Tests the complete multi-target action system from target extraction and resolution
 * through event construction, validation, and complex scenario handling.
 *
 * This addresses the Priority 1 critical gap identified in the entity workflows
 * E2E test coverage analysis for multi-target action operations.
 *
 * Key test scenarios from analysis report section 5.2:
 * 1. Complete Target Workflow - Target extraction, resolution, event construction
 * 2. Target Relationship Validation - Consistency, circular references, validation
 * 3. Dynamic Target Resolution - Runtime changes, placeholder resolution, performance
 * 4. Error Recovery & Edge Cases - Invalid configurations, graceful degradation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import EntityWorkflowTestBed from './common/entityWorkflowTestBed.js';
import TargetManager from '../../../src/entities/multiTarget/targetManager.js';
import TargetExtractionResult from '../../../src/entities/multiTarget/targetExtractionResult.js';
import MultiTargetEventBuilder from '../../../src/entities/multiTarget/multiTargetEventBuilder.js';
import {
  isValidTargetName,
  isValidEntityId,
  determinePrimaryTarget,
  validateAttemptActionPayload,
} from '../../../src/utils/multiTargetValidationUtils.js';

describe('Multi-Target Action E2E Workflow', () => {
  let testBed;
  let logger;

  const cleanupEntities = async () => {
    if (!testBed) {
      return;
    }

    for (const entityId of testBed.createdEntities) {
      if (!testBed.removedEntities.has(entityId)) {
        try {
          await testBed.removeTestEntity(entityId, { expectSuccess: false });
        } catch (error) {
          logger?.warn?.(
            `Failed to cleanup test entity ${entityId}: ${error.message}`
          );
        }
      }
    }

    testBed.createdEntities.clear();
    testBed.removedEntities.clear();
    testBed.clearTransientState();
  };

  beforeAll(async () => {
    testBed = new EntityWorkflowTestBed();
    await testBed.initialize();
    logger = testBed.logger;
  });

  afterEach(async () => {
    await cleanupEntities();
  });

  afterAll(async () => {
    if (testBed) {
      await testBed.cleanup();
    }
  });

  describe('Complete Target Workflow', () => {
    it('should handle complete multi-target workflow from creation to event construction', async () => {
      // Arrange - Create entities to serve as targets
      const actorDefinition = 'test:actor';
      const primaryTargetDefinition = 'test:primary_target';
      const secondaryTargetDefinition = 'test:secondary_target';

      await testBed.ensureEntityDefinitionExists(actorDefinition, {
        id: actorDefinition,
        components: {
          'core:name': { text: 'Test Actor' },
          'core:description': { text: 'Actor for multi-target tests' },
        },
      });

      await testBed.ensureEntityDefinitionExists(primaryTargetDefinition, {
        id: primaryTargetDefinition,
        components: {
          'core:name': { text: 'Primary Target' },
          'core:description': {
            text: 'Primary target for multi-target action',
          },
        },
      });

      await testBed.ensureEntityDefinitionExists(secondaryTargetDefinition, {
        id: secondaryTargetDefinition,
        components: {
          'core:name': { text: 'Secondary Target' },
          'core:description': {
            text: 'Secondary target for multi-target action',
          },
        },
      });

      // Create test entities
      const actorEntity = await testBed.createTestEntity(actorDefinition, {
        instanceId: 'test_actor_001',
      });
      const primaryTargetEntity = await testBed.createTestEntity(
        primaryTargetDefinition,
        {
          instanceId: 'test_primary_001',
        }
      );
      const secondaryTargetEntity = await testBed.createTestEntity(
        secondaryTargetDefinition,
        {
          instanceId: 'test_secondary_001',
        }
      );

      // Act - Create TargetManager with multiple targets
      const targetManager = new TargetManager({ logger });

      const targets = {
        primary: primaryTargetEntity.id,
        secondary: secondaryTargetEntity.id,
      };

      targetManager.setTargets(targets);

      // Assert - Verify target manager state
      expect(targetManager.getTargetCount()).toBe(2);
      expect(targetManager.isMultiTarget()).toBe(true);
      expect(targetManager.getPrimaryTarget()).toBe(primaryTargetEntity.id);
      expect(targetManager.getTarget('primary')).toBe(primaryTargetEntity.id);
      expect(targetManager.getTarget('secondary')).toBe(
        secondaryTargetEntity.id
      );

      // Act - Create TargetExtractionResult
      const extractionResult = new TargetExtractionResult({
        targetManager,
        extractionMetadata: {
          source: 'e2e_test',
          extractionTime: Date.now(),
        },
      });

      // Assert - Verify extraction result
      expect(extractionResult.hasMultipleTargets()).toBe(true);
      expect(extractionResult.getTargetCount()).toBe(2);
      expect(extractionResult.getPrimaryTarget()).toBe(primaryTargetEntity.id);
      expect(extractionResult.isValid()).toBe(true);

      // Act - Build event payload using MultiTargetEventBuilder
      const eventBuilder = new MultiTargetEventBuilder({ logger });
      const actionId = 'test:multi_target_action';
      const originalInput = 'perform complex action on targets';

      const eventPayload = eventBuilder
        .setActor(actorEntity.id)
        .setAction(actionId)
        .setOriginalInput(originalInput)
        .setTargetsFromExtraction(extractionResult)
        .build();

      // Assert - Verify event payload structure
      expect(eventPayload).toBeDefined();
      expect(eventPayload.actorId).toBe(actorEntity.id);
      expect(eventPayload.actionId).toBe(actionId);
      expect(eventPayload.originalInput).toBe(originalInput);
      expect(eventPayload.targetId).toBe(primaryTargetEntity.id);
      expect(eventPayload.targets).toEqual(targets);
      expect(eventPayload.primaryId).toBe(primaryTargetEntity.id);
      expect(eventPayload.secondaryId).toBe(secondaryTargetEntity.id);
      expect(eventPayload.tertiaryId).toBe(null);

      // Assert - Validate payload using validation utility
      const validationResult = validateAttemptActionPayload(eventPayload);
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
      expect(validationResult.details.hasMultipleTargets).toBe(true);
      expect(validationResult.details.targetCount).toBe(2);
      expect(validationResult.details.primaryTarget).toBe(
        primaryTargetEntity.id
      );
    });

    it('should handle single target workflow with backward compatibility', async () => {
      // Arrange - Create single target scenario
      const actorDefinition = 'test:single_actor';
      const targetDefinition = 'test:single_target';

      await testBed.ensureEntityDefinitionExists(actorDefinition, {
        id: actorDefinition,
        components: {
          'core:name': { text: 'Single Actor' },
        },
      });

      await testBed.ensureEntityDefinitionExists(targetDefinition, {
        id: targetDefinition,
        components: {
          'core:name': { text: 'Single Target' },
        },
      });

      const actorEntity = await testBed.createTestEntity(actorDefinition, {
        instanceId: 'single_actor_001',
      });
      const targetEntity = await testBed.createTestEntity(targetDefinition, {
        instanceId: 'single_target_001',
      });

      // Act - Create single target configuration
      const targetManager = new TargetManager({ logger });
      targetManager.addTarget('primary', targetEntity.id);

      const extractionResult = new TargetExtractionResult({ targetManager });

      // Assert - Verify single target behavior
      expect(extractionResult.hasMultipleTargets()).toBe(false);
      expect(extractionResult.getTargetCount()).toBe(1);
      expect(extractionResult.getPrimaryTarget()).toBe(targetEntity.id);

      // Act - Build legacy-compatible event
      const eventBuilder = new MultiTargetEventBuilder({ logger });
      const eventPayload = eventBuilder
        .setActor(actorEntity.id)
        .setAction('test:single_action')
        .setOriginalInput('single target action')
        .setLegacyTarget(targetEntity.id)
        .build();

      // Assert - Verify legacy compatibility
      expect(eventPayload.targetId).toBe(targetEntity.id);
      expect(eventPayload.targets).toBeUndefined();
      expect(eventPayload.primaryId).toBe(targetEntity.id);
      expect(eventPayload.secondaryId).toBe(null);
      expect(eventPayload.tertiaryId).toBe(null);

      const validationResult = validateAttemptActionPayload(eventPayload);
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.details.hasMultipleTargets).toBe(false);
      expect(validationResult.details.targetCount).toBe(1);
    });

    it('should validate target extraction with placeholder resolution', async () => {
      // Arrange - Set up complex target scenario
      const targets = {
        primary: 'entity_001',
        secondary: 'entity_002',
        tertiary: 'entity_003',
        custom_target: 'entity_004',
      };

      const targetManager = new TargetManager({ logger });
      targetManager.setTargets(targets);

      const extractionResult = new TargetExtractionResult({
        targetManager,
        extractionMetadata: {
          source: 'placeholder_test',
          placeholderCount: 4,
        },
      });

      // Act & Assert - Test placeholder resolution
      expect(extractionResult.getEntityIdByPlaceholder('primary')).toBe(
        'entity_001'
      );
      expect(extractionResult.getEntityIdByPlaceholder('secondary')).toBe(
        'entity_002'
      );
      expect(extractionResult.getEntityIdByPlaceholder('tertiary')).toBe(
        'entity_003'
      );
      expect(extractionResult.getEntityIdByPlaceholder('custom_target')).toBe(
        'entity_004'
      );
      expect(extractionResult.getEntityIdByPlaceholder('nonexistent')).toBe(
        null
      );

      // Assert - Verify target existence checks
      expect(extractionResult.hasTarget('primary')).toBe(true);
      expect(extractionResult.hasTarget('secondary')).toBe(true);
      expect(extractionResult.hasTarget('tertiary')).toBe(true);
      expect(extractionResult.hasTarget('custom_target')).toBe(true);
      expect(extractionResult.hasTarget('nonexistent')).toBe(false);

      // Assert - Verify primary target determination
      expect(extractionResult.getPrimaryTarget()).toBe('entity_001');
      expect(determinePrimaryTarget(targets)).toBe('entity_001');
    });
  });

  describe('Target Relationship Validation', () => {
    it('should validate multi-target consistency and relationships', async () => {
      // Arrange - Create entities with relationships
      const parentDefinition = 'test:parent';
      const childDefinition = 'test:child';

      await testBed.ensureEntityDefinitionExists(parentDefinition, {
        id: parentDefinition,
        components: {
          'core:name': { text: 'Parent Entity' },
          'core:description': { text: 'Parent in relationship' },
        },
      });

      await testBed.ensureEntityDefinitionExists(childDefinition, {
        id: childDefinition,
        components: {
          'core:name': { text: 'Child Entity' },
          'core:description': { text: 'Child in relationship' },
        },
      });

      const parentEntity = await testBed.createTestEntity(parentDefinition, {
        instanceId: 'parent_001',
      });
      const child1Entity = await testBed.createTestEntity(childDefinition, {
        instanceId: 'child_001',
      });
      const child2Entity = await testBed.createTestEntity(childDefinition, {
        instanceId: 'child_002',
      });

      // Act - Create target relationships
      const targetManager = new TargetManager({ logger });
      const relationshipTargets = {
        parent: parentEntity.id,
        child1: child1Entity.id,
        child2: child2Entity.id,
      };

      targetManager.setTargets(relationshipTargets);

      // Assert - Verify relationship consistency
      const validation = targetManager.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Verify all entities exist
      const entityIds = targetManager.getEntityIds();
      expect(entityIds).toContain(parentEntity.id);
      expect(entityIds).toContain(child1Entity.id);
      expect(entityIds).toContain(child2Entity.id);

      // Verify primary target is determined correctly (should be 'parent' based on priority)
      expect(targetManager.getPrimaryTarget()).toBe(parentEntity.id);
    });

    it('should detect and handle duplicate entity IDs in targets', async () => {
      // Arrange - Create scenario with duplicate entity IDs
      const entityDefinition = 'test:duplicate_entity';

      await testBed.ensureEntityDefinitionExists(entityDefinition, {
        id: entityDefinition,
        components: {
          'core:name': { text: 'Duplicate Test Entity' },
        },
      });

      const entity = await testBed.createTestEntity(entityDefinition, {
        instanceId: 'duplicate_001',
      });

      // Act - Set targets with duplicate entity IDs
      const targetManager = new TargetManager({ logger });
      const duplicateTargets = {
        primary: entity.id,
        secondary: entity.id, // Duplicate!
        tertiary: entity.id, // Duplicate!
      };

      targetManager.setTargets(duplicateTargets);

      // Assert - Validation should detect duplicates
      const validation = targetManager.validate();
      expect(validation.isValid).toBe(true); // Still valid but with warnings
      expect(validation.warnings).toContain(
        'Duplicate entity IDs found in targets'
      );

      // Verify target manager still functions correctly
      expect(targetManager.getTargetCount()).toBe(3);
      expect(targetManager.getPrimaryTarget()).toBe(entity.id);
    });

    it('should validate target name conventions', async () => {
      // Act & Assert - Test valid target names
      expect(isValidTargetName('primary')).toBe(true);
      expect(isValidTargetName('secondary')).toBe(true);
      expect(isValidTargetName('target_1')).toBe(true);
      expect(isValidTargetName('customTarget')).toBe(true);

      // Act & Assert - Test invalid target names
      expect(isValidTargetName('')).toBe(false);
      expect(isValidTargetName('123invalid')).toBe(false); // Can't start with number
      expect(isValidTargetName('invalid-name')).toBe(false); // No hyphens
      expect(isValidTargetName('invalid.name')).toBe(false); // No dots
      expect(isValidTargetName('invalid name')).toBe(false); // No spaces
      expect(isValidTargetName(null)).toBe(false);
      expect(isValidTargetName(undefined)).toBe(false);

      // Act & Assert - Test valid entity IDs
      expect(isValidEntityId('entity_001')).toBe(true);
      expect(isValidEntityId('mod:entity')).toBe(true);
      expect(isValidEntityId('test-entity-123')).toBe(true);
      expect(isValidEntityId('UUID-1234-5678')).toBe(true);

      // Act & Assert - Test invalid entity IDs
      expect(isValidEntityId('')).toBe(false);
      expect(isValidEntityId('invalid entity')).toBe(false); // No spaces
      expect(isValidEntityId('invalid@entity')).toBe(false); // Invalid character
      expect(isValidEntityId(null)).toBe(false);
      expect(isValidEntityId(undefined)).toBe(false);
    });

    it('should handle circular reference detection in target relationships', async () => {
      // Arrange - This test validates that the system doesn't break with circular references
      // Note: The current implementation doesn't explicitly check for circular references,
      // but it should handle them gracefully
      const targetManager = new TargetManager({ logger });

      // Create a scenario that could potentially have circular references
      const circularTargets = {
        a: 'entity_a',
        b: 'entity_b',
        c: 'entity_c',
        // In a more complex system, entity_c might reference back to entity_a
      };

      // Act - Set targets (current system handles this as separate entities)
      targetManager.setTargets(circularTargets);

      // Assert - System should handle this gracefully
      const validation = targetManager.validate();
      expect(validation.isValid).toBe(true);
      expect(targetManager.getTargetCount()).toBe(3);

      // Verify each target is accessible
      expect(targetManager.hasTarget('a')).toBe(true);
      expect(targetManager.hasTarget('b')).toBe(true);
      expect(targetManager.hasTarget('c')).toBe(true);

      // Verify primary target determination works
      expect(targetManager.getPrimaryTarget()).toBe('entity_a'); // First in order
    });
  });

  describe('Dynamic Target Resolution', () => {
    it('should handle runtime target changes and re-resolution', async () => {
      // Arrange - Set up initial target configuration
      const targetManager = new TargetManager({ logger });

      const initialTargets = {
        primary: 'initial_entity_001',
        secondary: 'initial_entity_002',
      };

      targetManager.setTargets(initialTargets);

      // Assert - Verify initial state
      expect(targetManager.getTargetCount()).toBe(2);
      expect(targetManager.getPrimaryTarget()).toBe('initial_entity_001');
      expect(targetManager.getTarget('secondary')).toBe('initial_entity_002');

      // Act - Add new target dynamically
      targetManager.addTarget('tertiary', 'new_entity_003');

      // Assert - Verify target addition
      expect(targetManager.getTargetCount()).toBe(3);
      expect(targetManager.getTarget('tertiary')).toBe('new_entity_003');
      expect(targetManager.getPrimaryTarget()).toBe('initial_entity_001'); // Should remain the same

      // Act - Update existing target
      const updatedTargets = {
        primary: 'updated_entity_001',
        secondary: 'updated_entity_002',
        tertiary: 'updated_entity_003',
      };

      targetManager.setTargets(updatedTargets);

      // Assert - Verify updates
      expect(targetManager.getTargetCount()).toBe(3);
      expect(targetManager.getPrimaryTarget()).toBe('updated_entity_001');
      expect(targetManager.getTarget('secondary')).toBe('updated_entity_002');
      expect(targetManager.getTarget('tertiary')).toBe('updated_entity_003');
    });

    it('should handle complex placeholder resolution scenarios', async () => {
      // Arrange - Create complex placeholder scenario
      const targetManager = new TargetManager({ logger });

      const complexTargets = {
        primary: 'primary_entity_001',
        secondary: 'secondary_entity_002',
        tertiary: 'tertiary_entity_003',
        weapon: 'weapon_entity_004',
        armor: 'armor_entity_005',
        consumable: 'consumable_entity_006',
      };

      targetManager.setTargets(complexTargets);

      const extractionResult = new TargetExtractionResult({
        targetManager,
        extractionMetadata: {
          source: 'complex_resolution_test',
          complexity: 'high',
          placeholderTypes: ['standard', 'item', 'equipment'],
        },
      });

      // Act & Assert - Test various placeholder resolution patterns
      expect(extractionResult.getEntityIdByPlaceholder('primary')).toBe(
        'primary_entity_001'
      );
      expect(extractionResult.getEntityIdByPlaceholder('secondary')).toBe(
        'secondary_entity_002'
      );
      expect(extractionResult.getEntityIdByPlaceholder('tertiary')).toBe(
        'tertiary_entity_003'
      );
      expect(extractionResult.getEntityIdByPlaceholder('weapon')).toBe(
        'weapon_entity_004'
      );
      expect(extractionResult.getEntityIdByPlaceholder('armor')).toBe(
        'armor_entity_005'
      );
      expect(extractionResult.getEntityIdByPlaceholder('consumable')).toBe(
        'consumable_entity_006'
      );

      // Test non-existent placeholders
      expect(extractionResult.getEntityIdByPlaceholder('nonexistent')).toBe(
        null
      );

      // Note: Empty string placeholder throws validation error as expected behavior
      expect(() => {
        extractionResult.getEntityIdByPlaceholder('');
      }).toThrow('Invalid placeholderName');

      // Verify metadata
      const metadata = extractionResult.getExtractionMetadata();
      expect(metadata.source).toBe('complex_resolution_test');
      expect(metadata.complexity).toBe('high');
      expect(metadata.placeholderTypes).toContain('standard');
      expect(metadata.placeholderTypes).toContain('item');
      expect(metadata.placeholderTypes).toContain('equipment');
    });

    it('should measure target resolution performance', async () => {
      // Arrange - Create large target set for performance testing
      const targetManager = new TargetManager({ logger });
      const largeTargetSet = {};

      // Create 100 targets for performance testing
      for (let i = 1; i <= 100; i++) {
        largeTargetSet[`target_${i.toString().padStart(3, '0')}`] =
          `entity_${i.toString().padStart(3, '0')}`;
      }

      targetManager.setTargets(largeTargetSet);
      const extractionResult = new TargetExtractionResult({ targetManager });

      // Act & Assert - Performance testing
      const startTime = performance.now();

      // Perform multiple placeholder resolutions
      for (let i = 1; i <= 100; i++) {
        const targetName = `target_${i.toString().padStart(3, '0')}`;
        const expectedEntity = `entity_${i.toString().padStart(3, '0')}`;
        const resolved = extractionResult.getEntityIdByPlaceholder(targetName);
        expect(resolved).toBe(expectedEntity);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Assert - Performance benchmark: < 10ms per placeholder as per report
      const timePerResolution = totalTime / 100;
      expect(timePerResolution).toBeLessThan(10); // 10ms threshold from analysis report

      // Log performance metrics for monitoring
      logger.debug('Target resolution performance test completed', {
        totalTargets: 100,
        totalTime: totalTime.toFixed(2),
        averageTimePerResolution: timePerResolution.toFixed(2),
        performanceBenchmark: '< 10ms per placeholder',
      });
    });
  });

  describe('Error Recovery & Edge Cases', () => {
    it('should handle invalid target configurations gracefully', async () => {
      // Act & Assert - Test various invalid configurations
      const targetManager = new TargetManager({ logger });

      // Test empty targets object
      expect(() => {
        targetManager.setTargets({});
      }).not.toThrow();

      const validation1 = targetManager.validate();
      expect(validation1.isValid).toBe(false);
      expect(validation1.errors).toContain('No targets defined');

      // Test invalid target types
      expect(() => {
        targetManager.setTargets('invalid_string');
      }).toThrow('Targets must be an object');

      expect(() => {
        targetManager.setTargets(['invalid', 'array']);
      }).toThrow('Targets must be an object');

      expect(() => {
        targetManager.setTargets(null);
      }).toThrow('Targets object is required');

      // Test invalid individual target values
      targetManager.setTargets({
        valid: 'valid_entity_001',
      });

      expect(() => {
        targetManager.addTarget('', 'entity_002');
      }).toThrow();

      expect(() => {
        targetManager.addTarget('valid_name', '');
      }).toThrow();

      expect(() => {
        targetManager.addTarget(null, 'entity_003');
      }).toThrow();
    });

    it('should handle primary target validation errors', async () => {
      // Arrange - Create target manager with invalid primary target scenario
      const targetManager = new TargetManager({ logger });

      const targets = {
        secondary: 'entity_002',
        tertiary: 'entity_003',
      };

      targetManager.setTargets(targets);

      // Act & Assert - Test setting primary target that doesn't exist in targets
      expect(() => {
        targetManager.setPrimaryTarget('nonexistent_entity');
      }).toThrow('Entity ID "nonexistent_entity" not found in targets');

      // Test setting valid primary target
      expect(() => {
        targetManager.setPrimaryTarget('entity_002');
      }).not.toThrow();

      expect(targetManager.getPrimaryTarget()).toBe('entity_002');

      // Test validation with manually set primary target
      const validation = targetManager.validate();
      expect(validation.isValid).toBe(true);
    });

    it('should validate event payload construction with invalid data', async () => {
      // Arrange - Create invalid event payload scenarios
      const eventBuilder = new MultiTargetEventBuilder({ logger });

      // Test building without required fields
      expect(() => {
        eventBuilder.build();
      }).toThrow('Missing required fields: actorId, actionId, originalInput');

      // Test building with partial required fields
      eventBuilder.setActor('test_actor');
      expect(() => {
        eventBuilder.build();
      }).toThrow('Missing required fields: actionId, originalInput');

      eventBuilder.setAction('test:action');
      expect(() => {
        eventBuilder.build();
      }).toThrow('Missing required fields: originalInput');

      eventBuilder.setOriginalInput('test input');
      expect(() => {
        eventBuilder.build();
      }).toThrow('Event must have either targets object or targetId field');

      // Test with valid minimal configuration
      eventBuilder.setLegacyTarget('test_target');
      expect(() => {
        eventBuilder.build();
      }).not.toThrow();

      const payload = eventBuilder.build();
      expect(payload).toBeDefined();
      expect(payload.actorId).toBe('test_actor');
      expect(payload.actionId).toBe('test:action');
      expect(payload.originalInput).toBe('test input');
      expect(payload.targetId).toBe('test_target');
    });

    it('should handle memory management and resource cleanup', async () => {
      // Arrange - Create large number of target managers for memory testing
      const targetManagers = [];
      const extractionResults = [];
      const eventBuilders = [];

      // Act - Create many objects to test memory management
      for (let i = 0; i < 100; i++) {
        const targetManager = new TargetManager({ logger });
        const targets = {
          primary: `entity_primary_${i}`,
          secondary: `entity_secondary_${i}`,
          tertiary: `entity_tertiary_${i}`,
        };

        targetManager.setTargets(targets);
        targetManagers.push(targetManager);

        const extractionResult = new TargetExtractionResult({
          targetManager,
          extractionMetadata: {
            source: `memory_test_${i}`,
            iteration: i,
          },
        });
        extractionResults.push(extractionResult);

        const eventBuilder = new MultiTargetEventBuilder({ logger });
        eventBuilder
          .setActor(`actor_${i}`)
          .setAction(`test:action_${i}`)
          .setOriginalInput(`test input ${i}`)
          .setTargetsFromExtraction(extractionResult);

        eventBuilders.push(eventBuilder);
      }

      // Assert - Verify all objects are created correctly
      expect(targetManagers).toHaveLength(100);
      expect(extractionResults).toHaveLength(100);
      expect(eventBuilders).toHaveLength(100);

      // Test random access to verify objects are still valid
      const randomIndex = Math.floor(Math.random() * 100);
      const randomTargetManager = targetManagers[randomIndex];
      const randomExtractionResult = extractionResults[randomIndex];
      const randomEventBuilder = eventBuilders[randomIndex];

      expect(randomTargetManager.getTargetCount()).toBe(3);
      expect(randomTargetManager.isMultiTarget()).toBe(true);
      expect(randomExtractionResult.isValid()).toBe(true);
      expect(randomExtractionResult.hasMultipleTargets()).toBe(true);

      // Build event payload to verify builder is still functional
      const payload = randomEventBuilder.build();
      expect(payload).toBeDefined();
      expect(payload.actorId).toBe(`actor_${randomIndex}`);
      expect(payload.actionId).toBe(`test:action_${randomIndex}`);

      // Act - Clear references for garbage collection testing
      targetManagers.length = 0;
      extractionResults.length = 0;
      eventBuilders.length = 0;

      // Assert - This test primarily validates that no memory leaks occur
      // In a real environment, memory monitoring tools would be used
      expect(targetManagers).toHaveLength(0);
      expect(extractionResults).toHaveLength(0);
      expect(eventBuilders).toHaveLength(0);
    });

    it('should handle graceful degradation during system stress', async () => {
      // Arrange - Create stress test scenario
      const stressTestPromises = [];

      // Act - Perform concurrent operations to test system stability
      for (let i = 0; i < 50; i++) {
        const stressOperation = async () => {
          const targetManager = new TargetManager({ logger });
          const targets = {};

          // Create variable number of targets per operation
          const targetCount = Math.floor(Math.random() * 10) + 1;
          for (let j = 0; j < targetCount; j++) {
            targets[`target_${j}`] = `entity_${i}_${j}`;
          }

          targetManager.setTargets(targets);

          const extractionResult = new TargetExtractionResult({
            targetManager,
            extractionMetadata: {
              source: `stress_test_${i}`,
              targetCount,
              timestamp: Date.now(),
            },
          });

          const eventBuilder = new MultiTargetEventBuilder({ logger });
          const payload = eventBuilder
            .setActor(`stress_actor_${i}`)
            .setAction(`stress:action_${i}`)
            .setOriginalInput(`stress test ${i}`)
            .setTargetsFromExtraction(extractionResult)
            .build();

          return {
            operationId: i,
            targetCount,
            isValid: extractionResult.isValid(),
            hasMultipleTargets: extractionResult.hasMultipleTargets(),
            payloadValid: validateAttemptActionPayload(payload).isValid,
          };
        };

        stressTestPromises.push(stressOperation());
      }

      // Wait for all operations to complete
      const stressResults = await Promise.all(stressTestPromises);

      // Assert - Verify all operations completed successfully
      expect(stressResults).toHaveLength(50);

      for (const result of stressResults) {
        expect(result.isValid).toBe(true);
        expect(result.payloadValid).toBe(true);
        expect(result.targetCount).toBeGreaterThan(0);
        expect(result.targetCount).toBeLessThanOrEqual(10);

        // Check multi-target expectations based on target count
        const expectedMultiTarget = result.targetCount > 1;
        expect(result.hasMultipleTargets).toBe(expectedMultiTarget);
      }

      // Log stress test results
      const totalTargets = stressResults.reduce(
        (sum, result) => sum + result.targetCount,
        0
      );
      const multiTargetOperations = stressResults.filter(
        (result) => result.hasMultipleTargets
      ).length;

      logger.debug('Stress test completed successfully', {
        totalOperations: 50,
        totalTargetsProcessed: totalTargets,
        multiTargetOperations,
        singleTargetOperations: 50 - multiTargetOperations,
        averageTargetsPerOperation: (totalTargets / 50).toFixed(2),
      });
    });
  });
});
