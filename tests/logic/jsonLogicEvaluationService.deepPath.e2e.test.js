// src/tests/logic/jsonLogicEvaluationService.deepPath.e2e.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import JsonLogicEvaluationService from '../../src/logic/jsonLogicEvaluationService.js'; // Adjust path if needed
import { createJsonLogicContext } from '../../src/logic/contextAssembler.js'; // Adjust path if needed
import Entity from '../../src/entities/entity.js'; // Adjust path if needed
import EntityDefinition from '../../src/entities/EntityDefinition.js'; // Added
import EntityInstanceData from '../../src/entities/EntityInstanceData.js'; // Added
// No longer need direct import of jsonLogic here if only using service.evaluate

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */ // Adjusted path assuming relative location
/** @typedef {import('../../src/logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */ // Adjusted path
/** @typedef {import('../../src/logic/defs.js').GameEvent} GameEvent */ // Adjusted path
/** @typedef {import('../../src/entities/entityManager.js').default} EntityManager */ // Adjusted path

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
  hasComponent: jest.fn(),
  // Add dummy implementations for other potential methods if needed
  createEntityInstance: jest.fn(),
  addComponent: jest.fn(),
  removeComponent: jest.fn(),
  removeEntityInstance: jest.fn(),
  getEntitiesInLocation: jest.fn(),
  buildInitialSpatialIndex: jest.fn(),
  clearAll: jest.fn(),
  activeEntities: new Map(),
  // Add mocks for new EntityManager properties/methods if necessary for these tests
  _definitionCache: new Map(), // Mock internal for safety, though likely not directly used by these tests
  getPrimaryInstanceByDefinitionId: jest.fn(),
};

// Helper to create mock entity instance for tests
// Updated createMockEntity
const createMockEntity = (instanceId, definitionId = 'test:dummydef', initialComponents = {}) => {
  // A generic definition used for mock entities in this test file
  // Ensure the definitionId has a colon, or EntityDefinition.modId might be undefined.
  const defIdToUse = definitionId.includes(':') ? definitionId : `test:${definitionId}`;
  const genericDefinition = new EntityDefinition(defIdToUse, { components: {} }); // Base components can be passed if needed
  const instanceData = new EntityInstanceData(instanceId, genericDefinition, initialComponents);
  const entity = new Entity(instanceData);
  return entity;
};

// --- Test Suite for Isolated Deep Path Evaluation ---

describe('JsonLogicEvaluationService - Isolated Deep Path E2E Test', () => {
  let service;

  // General setup before each test in this file
  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test

    // Instantiate the service with the mock logger
    service = new JsonLogicEvaluationService({ logger: mockLogger });
    mockLogger.info.mockClear(); // Clear constructor log call

    // Reset EntityManager mocks to a clean default state
    mockEntityManager.getEntityInstance.mockReset();
    mockEntityManager.getComponentData.mockReset();
    mockEntityManager.hasComponent.mockReset();

    // Default mock implementations
    mockEntityManager.getEntityInstance.mockImplementation(
      (entityId) => undefined
    );
    mockEntityManager.getComponentData.mockImplementation(
      (entityId, componentTypeId) => undefined
    );
    mockEntityManager.hasComponent.mockImplementation(
      (entityId, componentTypeId) => false
    );
  });

  // --- Test Case: Deep Data Access (Component Array) ---
  describe('Deep Data Access Rule (Corrected Path): { "==": [ {"var":"target.components.Inventory.items.0.id"}, "item:key" ] }', () => {
    // Constants needed for the test
    // ***** THE CORRECTED RULE *****
    const rule = {
      '==': [{ var: 'target.components.Inventory.items.0.id' }, 'item:key'],
    };
    const targetId = 'chest:1';
    const mockTarget = createMockEntity(targetId);
    const inventoryComponentId = 'Inventory';
    /** @type {GameEvent} */
    const event = { type: 'INTERACT', payload: {} };

    // Setup specific to this test context (finding the target entity, checking component existence)
    beforeEach(() => {
      // Target entity exists
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === targetId) return mockTarget;
        return undefined;
      });
      // Assume Inventory component exists (needed for some Proxy traps if using the non-simplified version)
      mockEntityManager.hasComponent.mockImplementation((id, compId) => {
        return id === targetId && compId === inventoryComponentId;
      });
    });

    // The test case - should now pass
    test('should return true when the deep path matches', () => {
      // Data the component should contain
      const inventoryData = {
        items: [
          { id: 'item:key', name: 'Old Key', quantity: 1 },
          { id: 'item:coin', name: 'Gold Coin', quantity: 10 },
        ],
      };
      // Configure EM to return the specific component data for this test
      // This will be used by the Proxy's 'get' trap inside createComponentAccessor
      mockEntityManager.getComponentData.mockImplementation((id, compId) => {
        if (id === targetId && compId === inventoryComponentId) {
          // Return a plain object copy just to be safe
          return JSON.parse(JSON.stringify(inventoryData));
        }
        return undefined;
      });

      // --- Context Creation ---
      // Create the context using the original assembler (assuming hack removed & Proxy restored)
      const context = createJsonLogicContext(
        event,
        null,
        targetId,
        mockEntityManager,
        mockLogger
      );

      // --- Evaluate the CORRECTED rule ---
      const result = service.evaluate(rule, context);

      // --- Assertion ---
      expect(result).toBe(true); // This should now pass

      // --- Verification ---
      // Verify mocks were called as expected by the context creation and evaluation
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        targetId
      );
      // getComponentData should be called by the Proxy when 'Inventory' is accessed by json-logic-js
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        targetId,
        inventoryComponentId
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });
});
