// src/tests/logic/jsonLogicEvaluationService.actorComponentAccess.test.js

/**
 * @jest-environment node
 * @file This file contains unit tests for the JsonLogicEvaluationService.
 * It focuses specifically on testing access to actor component data using the
 * 'var' operator (e.g., 'actor.components.componentId.property').
 * It uses mocked dependencies (ILogger, EntityManager) for isolation.
 */

import {
  describe,
  expect,
  test,
  jest,
  beforeEach,
  afterEach,
  it,
} from '@jest/globals';

// --- Class Under Test ---
import JsonLogicEvaluationService from '../../src/logic/jsonLogicEvaluationService.js'; // Adjust path as needed

// --- Dependencies for Mocking & Context ---
import { createJsonLogicContext } from '../../src/logic/contextAssembler.js'; // Adjust path as needed
import Entity from '../../src/entities/entity.js'; // Adjust path as needed
import EntityDefinition from '../../src/entities/entityDefinition.js'; // Added
import EntityInstanceData from '../../src/entities/entityInstanceData.js'; // Added

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
  hasComponent: jest.fn(), // Not directly used by component access via 'var', but good practice to mock
  createEntityInstance: jest.fn(),
  addComponent: jest.fn(),
  removeComponent: jest.fn(),
  removeEntityInstance: jest.fn(),
  getEntitiesInLocation: jest.fn(),
  buildInitialSpatialIndex: jest.fn(),
  clearAll: jest.fn(),
  activeEntities: new Map(),
  // Added for completeness with new EntityManager structure
  _definitionCache: new Map(),
};

const DUMMY_DEFINITION_ID_FOR_MOCKS = 'def:mock-actor-access';

// Helper to create a simple mock entity instance for testing
// Updated createMockEntity
const createMockEntity = (
  instanceId,
  definitionId = DUMMY_DEFINITION_ID_FOR_MOCKS,
  initialComponents = {}
) => {
  const defIdToUse = definitionId.includes(':')
    ? definitionId
    : `test:${definitionId}`;
  const genericDefinition = new EntityDefinition(defIdToUse, {
    components: {},
  });
  const instanceData = new EntityInstanceData(
    instanceId,
    genericDefinition,
    initialComponents
  );
  const entity = new Entity(instanceData);
  return entity;
};

// Define a base event structure for context creation
/** @type {GameEvent} */
const baseEvent = { type: 'TEST_EVENT', payload: {} };

// --- Test Suite ---

describe('JsonLogicEvaluationService - Actor Component Access Tests ([PARENT_ID].6)', () => {
  /** @type {JsonLogicEvaluationService} */
  let service;

  // Define common IDs for tests
  const actorId = 'player1';
  const componentId = 'health';
  const propertyId = 'current';
  const nestedPropertyPath = 'attributes.strength';
  const statsComponentId = 'stats';
  const namespacedComponentId = 'ns:stats';
  const missingComponentId = 'missingComp';
  const missingPropertyId = 'missingProp';
  const mockActor = createMockEntity(actorId);

  // --- Test Setup & Teardown ---
  beforeEach(() => {
    jest.clearAllMocks();
    service = new JsonLogicEvaluationService({ logger: mockLogger });

    // Reset mock implementations for EntityManager
    mockEntityManager.getEntityInstance.mockReset();
    mockEntityManager.getComponentData.mockReset();
    mockEntityManager.hasComponent.mockReset(); // Reset even if not directly used

    // Set default mock implementations: By default, find nothing
    mockEntityManager.getEntityInstance.mockImplementation((id) => undefined);
    mockEntityManager.getComponentData.mockImplementation(
      (entityId, compId) => undefined
    );
  });

  // --- [PARENT_ID].6: Actor Component Access Tests ---
  describe('Actor Component Access (actor.components.*)', () => {
    describe('Component Existence Checks', () => {
      const componentExistsRule = {
        '!!': { var: `actor.components.${componentId}` },
      };
      const componentIsNullRule = {
        '==': [{ var: `actor.components.${componentId}` }, null],
      };
      const componentIsNotNullRule = {
        '!=': [{ var: `actor.components.${componentId}` }, null],
      };

      test('{"!!": "actor.components.health"} should return true when component exists', () => {
        const componentData = { [propertyId]: 100, max: 100 };
        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);
        mockEntityManager.getComponentData.mockImplementation((id, compId) =>
          id === actorId && compId === componentId ? componentData : undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(componentExistsRule, context);

        expect(result).toBe(true);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          actorId
        );
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          actorId,
          componentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('{"!!": "actor.components.health"} should return false when component is missing', () => {
        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);
        // getComponentData returns undefined by default or explicit mock

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(componentExistsRule, context);

        expect(result).toBe(false);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          actorId
        );
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          actorId,
          componentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('{"==": ["actor.components.health", null]} should return true when component is missing', () => {
        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);
        // getComponentData returns undefined by default

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(componentIsNullRule, context);

        expect(result).toBe(true);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          actorId
        );
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          actorId,
          componentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('{"!=": ["actor.components.health", null]} should return true when component exists', () => {
        const componentData = { [propertyId]: 50 };
        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);
        mockEntityManager.getComponentData.mockImplementation((id, compId) =>
          id === actorId && compId === componentId ? componentData : undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(componentIsNotNullRule, context);

        expect(result).toBe(true);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          actorId
        );
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          actorId,
          componentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    }); // End describe Component Existence Checks

    describe('Property Access (Component Exists)', () => {
      const propertyValueRule = (value) => ({
        '==': [{ var: `actor.components.${componentId}.${propertyId}` }, value],
      });
      const missingPropertyIsNullRule = {
        '==': [
          { var: `actor.components.${componentId}.${missingPropertyId}` },
          null,
        ],
      };
      const nestedPropertyValueRule = (value) => ({
        '==': [
          { var: `actor.components.${statsComponentId}.${nestedPropertyPath}` },
          value,
        ],
      });
      const nestedMissingPropertyIsNullRule = {
        '==': [
          {
            var: `actor.components.${statsComponentId}.attributes.missingNested`,
          },
          null,
        ],
      };
      const nestedMissingMiddlePropertyIsNullRule = {
        '==': [
          {
            var: `actor.components.${statsComponentId}.missingMiddle.strength`,
          },
          null,
        ],
      };

      test('{"==": ["actor.components.health.current", 50]} should return true when component/property exist and value matches', () => {
        const componentData = { [propertyId]: 50, max: 100 };
        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);
        mockEntityManager.getComponentData.mockImplementation((id, compId) =>
          id === actorId && compId === componentId ? componentData : undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(propertyValueRule(50), context);

        expect(result).toBe(true);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          actorId,
          componentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('{"==": ["actor.components.health.current", 50]} should return false when component/property exist but value differs', () => {
        const componentData = { [propertyId]: 100, max: 100 }; // Value is 100, rule checks for 50
        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);
        mockEntityManager.getComponentData.mockImplementation((id, compId) =>
          id === actorId && compId === componentId ? componentData : undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(propertyValueRule(50), context);

        expect(result).toBe(false);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          actorId,
          componentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('{"==": ["actor.components.health.missingProp", null]} should return true when component exists but property is missing', () => {
        const componentData = { [propertyId]: 50 }; // Component data exists, but missing 'missingProp'
        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);
        mockEntityManager.getComponentData.mockImplementation((id, compId) =>
          id === actorId && compId === componentId ? componentData : undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(missingPropertyIsNullRule, context);

        expect(result).toBe(true);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          actorId,
          componentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('{"==": ["actor.components.stats.attributes.strength", 10]} should return true for nested property access', () => {
        const statsData = { attributes: { strength: 10, dexterity: 8 } };
        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);
        mockEntityManager.getComponentData.mockImplementation((id, compId) =>
          id === actorId && compId === statsComponentId ? statsData : undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(nestedPropertyValueRule(10), context);

        expect(result).toBe(true);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          actorId,
          statsComponentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('{"==": ["actor.components.stats.attributes.strength", 10]} should return false for nested property access with different value', () => {
        const statsData = { attributes: { strength: 15, dexterity: 8 } }; // Value is 15
        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);
        mockEntityManager.getComponentData.mockImplementation((id, compId) =>
          id === actorId && compId === statsComponentId ? statsData : undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(nestedPropertyValueRule(10), context); // Rule checks for 10

        expect(result).toBe(false);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          actorId,
          statsComponentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('{"==": ["actor.components.stats.attributes.missingNested", null]} should return true for missing nested property', () => {
        const statsData = { attributes: { strength: 10 } }; // 'missingNested' is not present under attributes
        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);
        mockEntityManager.getComponentData.mockImplementation((id, compId) =>
          id === actorId && compId === statsComponentId ? statsData : undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(
          nestedMissingPropertyIsNullRule,
          context
        );

        expect(result).toBe(true);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          actorId,
          statsComponentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('{"==": ["actor.components.stats.missingMiddle.strength", null]} should return true for missing intermediate nested property', () => {
        const statsData = { attributes: { strength: 10 } }; // 'missingMiddle' object doesn't exist
        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);
        mockEntityManager.getComponentData.mockImplementation((id, compId) =>
          id === actorId && compId === statsComponentId ? statsData : undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(
          nestedMissingMiddlePropertyIsNullRule,
          context
        );

        expect(result).toBe(true);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          actorId,
          statsComponentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    }); // End describe Property Access (Component Exists)

    describe('Property Access (Component Missing)', () => {
      const missingComponentPropertyIsNullRule = {
        '==': [
          { var: `actor.components.${missingComponentId}.someProp` },
          null,
        ],
      };

      test('{"==": ["actor.components.missingComp.someProp", null]} should return true when component is missing', () => {
        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);
        // Ensure getComponentData returns undefined for missingComponentId (default mock behavior)
        mockEntityManager.getComponentData.mockImplementation(
          (id, compId) =>
            id === actorId && compId === missingComponentId
              ? undefined
              : undefined // Explicit undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(
          missingComponentPropertyIsNullRule,
          context
        );

        expect(result).toBe(true);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          actorId
        );
        // Check getComponentData was called with the missing ID
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          actorId,
          missingComponentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    }); // End describe Property Access (Component Missing)

    describe('Namespaced Component Access', () => {
      const namespacedPropValueRule = (value) => ({
        '==': [
          { var: `actor.components.${namespacedComponentId}.level` },
          value,
        ],
      });
      const namespacedMissingPropIsNullRule = {
        '==': [
          { var: `actor.components.${namespacedComponentId}.missingLevel` },
          null,
        ],
      };
      const namespacedCompMissingIsNullRule = {
        '==': [{ var: `actor.components.${namespacedComponentId}` }, null],
      };

      test('{"==": ["actor.components.ns:stats.level", 5]} should return true when namespaced component and property exist', () => {
        const nsComponentData = { level: 5, exp: 100 };
        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);
        mockEntityManager.getComponentData.mockImplementation((id, compId) =>
          id === actorId && compId === namespacedComponentId
            ? nsComponentData
            : undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(namespacedPropValueRule(5), context);

        expect(result).toBe(true);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          actorId,
          namespacedComponentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('{"==": ["actor.components.ns:stats.level", 5]} should return false when namespaced component exists but property value differs', () => {
        const nsComponentData = { level: 10, exp: 100 }; // Level is 10
        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);
        mockEntityManager.getComponentData.mockImplementation((id, compId) =>
          id === actorId && compId === namespacedComponentId
            ? nsComponentData
            : undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(namespacedPropValueRule(5), context); // Rule checks for 5

        expect(result).toBe(false);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          actorId,
          namespacedComponentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('{"==": ["actor.components.ns:stats.missingLevel", null]} should return true when namespaced component exists but property is missing', () => {
        const nsComponentData = { exp: 100 }; // 'level' property is missing
        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);
        mockEntityManager.getComponentData.mockImplementation((id, compId) =>
          id === actorId && compId === namespacedComponentId
            ? nsComponentData
            : undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(
          namespacedMissingPropIsNullRule,
          context
        );

        expect(result).toBe(true);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          actorId,
          namespacedComponentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('{"==": ["actor.components.ns:stats", null]} should return true when namespaced component itself is missing', () => {
        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);
        // Ensure getComponentData returns undefined for the namespaced ID
        mockEntityManager.getComponentData.mockImplementation((id, compId) =>
          id === actorId && compId === namespacedComponentId
            ? undefined
            : undefined
        );

        const context = createJsonLogicContext(
          baseEvent,
          actorId,
          null,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(
          namespacedCompMissingIsNullRule,
          context
        );

        expect(result).toBe(true);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          actorId,
          namespacedComponentId
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    }); // End describe Namespaced Component Access

    describe('Actor Missing', () => {
      const anyComponentPathRule = {
        '==': [{ var: `actor.components.${componentId}.${propertyId}` }, null],
      };
      const anyComponentExistenceRule = {
        '!!': { var: `actor.components.${componentId}` },
      };

      test('accessing any component path should resolve to null when actor in context is null', () => {
        // Actor ID passed to context creator is null
        const context = createJsonLogicContext(
          baseEvent,
          null,
          null,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(anyComponentPathRule, context);

        expect(result).toBe(true); // Because actor.components... resolves to null, null == null
        // Entity manager should not be called if actorId is null
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('accessing any component path should resolve to null when actor entity is not found', () => {
        const missingActorId = 'ghost';
        mockEntityManager.getEntityInstance.mockImplementation(
          (id) => (id === missingActorId ? undefined : mockActor) // Ensure it only fails for 'ghost'
        );

        const context = createJsonLogicContext(
          baseEvent,
          missingActorId,
          null,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(anyComponentPathRule, context);

        expect(result).toBe(true); // Because context assembler sets actor to null, path resolves to null
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          missingActorId
        );
        // getComponentData should not be called if the entity wasn't found
        expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('checking component existence ("!!") should resolve to false when actor is null', () => {
        const context = createJsonLogicContext(
          baseEvent,
          null,
          null,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(anyComponentExistenceRule, context);

        expect(result).toBe(false); // Because actor.components... resolves to null, !!null is false
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('checking component existence ("!!") should resolve to false when actor entity is not found', () => {
        const missingActorId = 'ghost';
        mockEntityManager.getEntityInstance.mockImplementation((id) =>
          id === missingActorId ? undefined : mockActor
        );

        const context = createJsonLogicContext(
          baseEvent,
          missingActorId,
          null,
          mockEntityManager,
          mockLogger
        );
        const result = service.evaluate(anyComponentExistenceRule, context);

        expect(result).toBe(false); // Because context assembler sets actor to null, path resolves to null, !!null is false
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          missingActorId
        );
        expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    }); // End describe Actor Missing
  }); // End describe Actor Component Access
}); // End describe JsonLogicEvaluationService
