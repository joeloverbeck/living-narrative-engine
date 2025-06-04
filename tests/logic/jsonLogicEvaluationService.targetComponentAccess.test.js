// src/tests/logic/jsonLogicEvaluationService.targetComponentAccess.test.js

/**
 * @jest-environment node
 * @file This file contains unit tests for the JsonLogicEvaluationService.
 * It focuses specifically on testing access to TARGET component data using the
 * 'var' operator (e.g., 'target.components.componentId.property').
 * It uses mocked dependencies (ILogger, EntityManager) for isolation.
 * Corresponds to Ticket: [PARENT_ID].7
 */

import { describe, expect, test, jest, beforeEach, it } from '@jest/globals';

// --- Class Under Test ---
import JsonLogicEvaluationService from '../../src/logic/jsonLogicEvaluationService.js'; // Adjust path as needed

// --- Dependencies for Mocking & Context ---
import { createJsonLogicContext } from '../../src/logic/contextAssembler.js'; // Adjust path as needed
import Entity from '../../src/entities/entity.js'; // Adjust path as needed

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */ // Adjust path as needed
/** @typedef {import('../../src/entities/entityManager.js').default} EntityManager */ // Adjust path as needed
/** @typedef {import('../../src/logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */ // Adjust path as needed
/** @typedef {import('../../src/logic/defs.js').GameEvent} GameEvent */ // Adjust path as needed

// --- Mock Dependencies ---

// Mock ILogger
/** @type {jest.Mocked<ILogger>} */
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Mock EntityManager
/** @type {jest.Mocked<EntityManager>} */
const mockEntityManager = {
  getEntityInstance: jest.fn(),
  getComponentData: jest.fn(),
  hasComponent: jest.fn(), // Mocked for completeness, though 'var' uses getComponentData
  // Add other EntityManager methods if needed by contextAssembler or future tests
  createEntityInstance: jest.fn(),
  addComponent: jest.fn(),
  removeComponent: jest.fn(),
  removeEntityInstance: jest.fn(),
  getEntitiesInLocation: jest.fn(),
  buildInitialSpatialIndex: jest.fn(),
  clearAll: jest.fn(),
  activeEntities: new Map(),
};

// Helper to create a simple mock entity instance for testing
const createMockEntity = (id) => new Entity(id, 'dummy');

// Define a base event structure for context creation
/** @type {GameEvent} */
const baseEvent = { type: 'TEST_EVENT', payload: {} };

// --- Test Suite ---

describe('JsonLogicEvaluationService - Target Component Access Tests ([PARENT_ID].7)', () => {
  /** @type {JsonLogicEvaluationService} */
  let service;

  // Define common IDs for tests - Specific to Target context
  const targetId = 'enemy_goblin';
  const actorId = 'player1'; // A dummy actor ID for context creation if needed
  const componentId = 'armor'; // Example component for target
  const propertyId = 'rating'; // Example property
  const nestedPropertyPath = 'material.hardness'; // Example nested property
  const statsComponentId = 'attributes'; // Another component for target
  const namespacedComponentId = 'game:state'; // Example namespaced component
  const missingComponentId = 'missingComp';
  const missingPropertyId = 'missingProp';
  const mockTarget = createMockEntity(targetId);
  const mockActor = createMockEntity(actorId); // Actor entity might be needed by context creator

  // --- Test Setup & Teardown ---
  beforeEach(() => {
    jest.clearAllMocks();
    service = new JsonLogicEvaluationService({ logger: mockLogger });

    // Reset mock implementations for EntityManager
    mockEntityManager.getEntityInstance.mockReset();
    mockEntityManager.getComponentData.mockReset();
    mockEntityManager.hasComponent.mockReset();

    // Set default mock implementations: By default, find nothing
    // We might need to find the actor sometimes, even if tests focus on target
    mockEntityManager.getEntityInstance.mockImplementation((id) => {
      if (id === actorId) return mockActor;
      if (id === targetId) return undefined; // Default target to not found unless overridden
      return undefined;
    });
    mockEntityManager.getComponentData.mockImplementation(
      (entityId, compId) => undefined
    );
  });

  // --- [PARENT_ID].7: Target Component Access Tests ---
  describe('Target Component Access (target.components.*)', () => {
    describe('Component Existence Checks', () => {
      const componentExistsRule = {
        '!!': { var: `target.components.${componentId}` },
      };
      const componentIsNullRule = {
        '==': [{ var: `target.components.${componentId}` }, null],
      };
      const componentIsNotNullRule = {
        '!=': [{ var: `target.components.${componentId}` }, null],
      };

      test('{"!!": "target.components.armor"} should return true when component exists', () => {
        const componentData = { [propertyId]: 10, type: 'leather' };
        mockEntityManager.getEntityInstance.mockReturnValue(mockTarget); // Ensure target is found
        mockEntityManager.getComponentData.mockImplementation((id, compId) =>
          id === targetId && compId === componentId ? componentData : undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(componentExistsRule, context);

        expect(result).toBe(true);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          targetId
        );
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          targetId,
          componentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('{"!!": "target.components.armor"} should return false when component is missing', () => {
        mockEntityManager.getEntityInstance.mockReturnValue(mockTarget); // Target exists
        // getComponentData returns undefined by default or explicit mock

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(componentExistsRule, context);

        expect(result).toBe(false);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          targetId
        );
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          targetId,
          componentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('{"==": ["target.components.armor", null]} should return true when component is missing', () => {
        mockEntityManager.getEntityInstance.mockReturnValue(mockTarget); // Target exists
        // getComponentData returns undefined by default

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(componentIsNullRule, context);

        expect(result).toBe(true);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          targetId
        );
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          targetId,
          componentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('{"!=": ["target.components.armor", null]} should return true when component exists', () => {
        const componentData = { [propertyId]: 5 };
        mockEntityManager.getEntityInstance.mockReturnValue(mockTarget); // Target exists
        mockEntityManager.getComponentData.mockImplementation((id, compId) =>
          id === targetId && compId === componentId ? componentData : undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(componentIsNotNullRule, context);

        expect(result).toBe(true);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          targetId
        );
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          targetId,
          componentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    }); // End describe Component Existence Checks

    describe('Property Access (Component Exists)', () => {
      const propertyValueRule = (value) => ({
        '==': [
          { var: `target.components.${componentId}.${propertyId}` },
          value,
        ],
      });
      const missingPropertyIsNullRule = {
        '==': [
          { var: `target.components.${componentId}.${missingPropertyId}` },
          null,
        ],
      };
      const nestedPropertyValueRule = (value) => ({
        '==': [
          {
            var: `target.components.${statsComponentId}.${nestedPropertyPath}`,
          },
          value,
        ],
      });
      const nestedMissingPropertyIsNullRule = {
        '==': [
          {
            var: `target.components.${statsComponentId}.material.missingNested`,
          },
          null,
        ],
      };
      const nestedMissingMiddlePropertyIsNullRule = {
        '==': [
          {
            var: `target.components.${statsComponentId}.missingMiddle.hardness`,
          },
          null,
        ],
      };

      test('{"==": ["target.components.armor.rating", 10]} should return true when component/property exist and value matches', () => {
        const componentData = { [propertyId]: 10, type: 'leather' };
        mockEntityManager.getEntityInstance.mockReturnValue(mockTarget);
        mockEntityManager.getComponentData.mockImplementation((id, compId) =>
          id === targetId && compId === componentId ? componentData : undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(propertyValueRule(10), context);

        expect(result).toBe(true);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          targetId,
          componentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('{"==": ["target.components.armor.rating", 10]} should return false when component/property exist but value differs', () => {
        const componentData = { [propertyId]: 5, type: 'leather' }; // Value is 5, rule checks for 10
        mockEntityManager.getEntityInstance.mockReturnValue(mockTarget);
        mockEntityManager.getComponentData.mockImplementation((id, compId) =>
          id === targetId && compId === componentId ? componentData : undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(propertyValueRule(10), context);

        expect(result).toBe(false);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          targetId,
          componentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('{"==": ["target.components.armor.missingProp", null]} should return true when component exists but property is missing', () => {
        const componentData = { [propertyId]: 10 }; // Component data exists, but missing 'missingProp'
        mockEntityManager.getEntityInstance.mockReturnValue(mockTarget);
        mockEntityManager.getComponentData.mockImplementation((id, compId) =>
          id === targetId && compId === componentId ? componentData : undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(missingPropertyIsNullRule, context);

        expect(result).toBe(true);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          targetId,
          componentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('{"==": ["target.components.attributes.material.hardness", 7]} should return true for nested property access', () => {
        const statsData = { material: { hardness: 7, type: 'iron' } };
        mockEntityManager.getEntityInstance.mockReturnValue(mockTarget);
        mockEntityManager.getComponentData.mockImplementation((id, compId) =>
          id === targetId && compId === statsComponentId ? statsData : undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(nestedPropertyValueRule(7), context);

        expect(result).toBe(true);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          targetId,
          statsComponentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('{"==": ["target.components.attributes.material.hardness", 7]} should return false for nested property access with different value', () => {
        const statsData = { material: { hardness: 9, type: 'steel' } }; // Value is 9
        mockEntityManager.getEntityInstance.mockReturnValue(mockTarget);
        mockEntityManager.getComponentData.mockImplementation((id, compId) =>
          id === targetId && compId === statsComponentId ? statsData : undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(nestedPropertyValueRule(7), context); // Rule checks for 7

        expect(result).toBe(false);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          targetId,
          statsComponentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('{"==": ["target.components.attributes.material.missingNested", null]} should return true for missing nested property', () => {
        const statsData = { material: { hardness: 7 } }; // 'missingNested' is not present under material
        mockEntityManager.getEntityInstance.mockReturnValue(mockTarget);
        mockEntityManager.getComponentData.mockImplementation((id, compId) =>
          id === targetId && compId === statsComponentId ? statsData : undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(
          nestedMissingPropertyIsNullRule,
          context
        );

        expect(result).toBe(true);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          targetId,
          statsComponentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('{"==": ["target.components.attributes.missingMiddle.hardness", null]} should return true for missing intermediate nested property', () => {
        const statsData = { material: { hardness: 7 } }; // 'missingMiddle' object doesn't exist
        mockEntityManager.getEntityInstance.mockReturnValue(mockTarget);
        mockEntityManager.getComponentData.mockImplementation((id, compId) =>
          id === targetId && compId === statsComponentId ? statsData : undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(
          nestedMissingMiddlePropertyIsNullRule,
          context
        );

        expect(result).toBe(true);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          targetId,
          statsComponentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    }); // End describe Property Access (Component Exists)

    describe('Property Access (Component Missing)', () => {
      const missingComponentPropertyIsNullRule = {
        '==': [
          { var: `target.components.${missingComponentId}.someProp` },
          null,
        ],
      };

      test('{"==": ["target.components.missingComp.someProp", null]} should return true when component is missing', () => {
        mockEntityManager.getEntityInstance.mockReturnValue(mockTarget); // Target exists
        // Ensure getComponentData returns undefined for missingComponentId (default mock behavior)
        mockEntityManager.getComponentData.mockImplementation(
          (id, compId) =>
            id === targetId && compId === missingComponentId
              ? undefined
              : undefined // Explicit undefined for this component
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(
          missingComponentPropertyIsNullRule,
          context
        );

        expect(result).toBe(true);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          targetId
        );
        // Check getComponentData was called with the missing ID for the target
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          targetId,
          missingComponentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    }); // End describe Property Access (Component Missing)

    describe('Namespaced Component Access', () => {
      const namespacedPropValueRule = (value) => ({
        '==': [
          { var: `target.components.${namespacedComponentId}.status` },
          value,
        ],
      });
      const namespacedMissingPropIsNullRule = {
        '==': [
          { var: `target.components.${namespacedComponentId}.missingStatus` },
          null,
        ],
      };
      const namespacedCompMissingIsNullRule = {
        '==': [{ var: `target.components.${namespacedComponentId}` }, null],
      };

      test('{"==": ["target.components.game:state.status", "active"]} should return true when namespaced component and property exist', () => {
        const nsComponentData = { status: 'active', health_percentage: 80 };
        mockEntityManager.getEntityInstance.mockReturnValue(mockTarget);
        mockEntityManager.getComponentData.mockImplementation((id, compId) =>
          id === targetId && compId === namespacedComponentId
            ? nsComponentData
            : undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(
          namespacedPropValueRule('active'),
          context
        );

        expect(result).toBe(true);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          targetId,
          namespacedComponentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('{"==": ["target.components.game:state.status", "active"]} should return false when namespaced component exists but property value differs', () => {
        const nsComponentData = { status: 'inactive', health_percentage: 80 }; // Status is inactive
        mockEntityManager.getEntityInstance.mockReturnValue(mockTarget);
        mockEntityManager.getComponentData.mockImplementation((id, compId) =>
          id === targetId && compId === namespacedComponentId
            ? nsComponentData
            : undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(
          namespacedPropValueRule('active'),
          context
        ); // Rule checks for active

        expect(result).toBe(false);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          targetId,
          namespacedComponentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('{"==": ["target.components.game:state.missingStatus", null]} should return true when namespaced component exists but property is missing', () => {
        const nsComponentData = { health_percentage: 80 }; // 'status' property is missing
        mockEntityManager.getEntityInstance.mockReturnValue(mockTarget);
        mockEntityManager.getComponentData.mockImplementation((id, compId) =>
          id === targetId && compId === namespacedComponentId
            ? nsComponentData
            : undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(
          namespacedMissingPropIsNullRule,
          context
        );

        expect(result).toBe(true);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          targetId,
          namespacedComponentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('{"==": ["target.components.game:state", null]} should return true when namespaced component itself is missing', () => {
        mockEntityManager.getEntityInstance.mockReturnValue(mockTarget); // Target exists
        // Ensure getComponentData returns undefined for the namespaced ID
        mockEntityManager.getComponentData.mockImplementation((id, compId) =>
          id === targetId && compId === namespacedComponentId
            ? undefined
            : undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          targetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(
          namespacedCompMissingIsNullRule,
          context
        );

        expect(result).toBe(true);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          targetId,
          namespacedComponentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    }); // End describe Namespaced Component Access

    describe('Target Missing', () => {
      const anyComponentPathRule = {
        '==': [{ var: `target.components.${componentId}.${propertyId}` }, null],
      };
      const anyComponentExistenceRule = {
        '!!': { var: `target.components.${componentId}` },
      };

      test('accessing any component path should resolve to null when target in context is null', () => {
        // Target ID passed to context creator is null
        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(anyComponentPathRule, context);

        expect(result).toBe(true); // Because target.components... resolves to null, null == null
        // Entity manager should not be called for target if targetId is null
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith(
          null
        ); // Shouldn't be called with null
        expect(mockEntityManager.getComponentData).not.toHaveBeenCalled(); // No component data lookup if target context is null
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('accessing any component path should resolve to null when target entity is not found', () => {
        const missingTargetId = 'ghost_target';
        // Ensure getEntityInstance returns undefined for the specific missingTargetId
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === actorId) return mockActor;
          if (id === missingTargetId) return undefined;
          return undefined;
        });

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          missingTargetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(anyComponentPathRule, context);

        expect(result).toBe(true); // Because context assembler sets target to null if not found, path resolves to null
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          missingTargetId
        );
        // getComponentData should not be called if the entity wasn't found
        expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('checking component existence ("!!") should resolve to false when target is null', () => {
        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(anyComponentExistenceRule, context);

        expect(result).toBe(false); // Because target.components... resolves to null, !!null is false
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith(
          null
        );
        expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('checking component existence ("!!") should resolve to false when target entity is not found', () => {
        const missingTargetId = 'ghost_target';
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === actorId) return mockActor;
          if (id === missingTargetId) return undefined;
          return undefined;
        });

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          missingTargetId,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(anyComponentExistenceRule, context);

        expect(result).toBe(false); // Because target becomes null in context, path resolves to null, !!null is false
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          missingTargetId
        );
        expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    }); // End describe Target Missing
  }); // End describe Target Component Access
}); // End describe JsonLogicEvaluationService
