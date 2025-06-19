/**
 * @file Tests matters regarding to invalid data when adding a component to an entity.
 * @see tests/entities/entityManager.addComponent.invalidData.test.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import EntityManager from '../../src/entities/entityManager.js';
import EntityDefinition from '../../src/entities/entityDefinition.js';

const createMockDataRegistry = () => ({
  getEntityDefinition: jest.fn(),
});

const createMockSchemaValidator = () => ({
  validate: jest.fn(() => ({ isValid: true })),
});

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createMockSpatialIndexManager = () => ({
  addEntity: jest.fn(),
  removeEntity: jest.fn(),
  updateEntityLocation: jest.fn(),
  getEntitiesInLocation: jest.fn(),
  buildIndex: jest.fn(),
  clearIndex: jest.fn(),
});

const createMockSafeEventDispatcher = () => ({
  dispatch: jest.fn(),
});

const TEST_DEFINITION_ID = 'test:def-invalid-data';
const MOCK_INSTANCE_ID = 'instance-invalid-data';
const COMPONENT_TYPE_ID = 'core:name';
const VALID_COMPONENT_DATA = { name: 'x' };

describe('EntityManager.addComponent invalid componentData handling', () => {
  let registry;
  let validator;
  let logger;
  let spatial;
  let manager;
  let mockEventDispatcher;

  beforeEach(() => {
    registry = createMockDataRegistry();
    validator = createMockSchemaValidator();
    logger = createMockLogger();
    spatial = createMockSpatialIndexManager();
    mockEventDispatcher = createMockSafeEventDispatcher()

    manager = new EntityManager(registry, validator, logger, mockEventDispatcher);

    const definitionData = {
      components: {
        [COMPONENT_TYPE_ID]: { ...VALID_COMPONENT_DATA },
      },
    };
    registry.getEntityDefinition.mockReturnValue(
      new EntityDefinition(TEST_DEFINITION_ID, definitionData)
    );
    manager.createEntityInstance(TEST_DEFINITION_ID, {
      instanceId: MOCK_INSTANCE_ID,
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    manager.clearAll();
  });

  it('handles null componentData correctly (sets override to null, no error, no validation)', () => {
    expect(() =>
      manager.addComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID, null)
    ).not.toThrow();

    expect(logger.error).not.toHaveBeenCalled();
    expect(validator.validate).not.toHaveBeenCalled();
    expect(
      manager.getComponentData(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID)
    ).toBeNull();
    // FIXED: The established design is that a component with a null override IS present.
    // The override is an explicit instruction to nullify, not to remove.
    expect(manager.hasComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID)).toBe(
      true
    );
  });

  it.each([
    ['undefined', undefined],
    ['"bad"', 'bad'],
    ['42', 42],
    ['true', true],
    ['Symbol(sym)', Symbol('sym')],
  ])(
    'throws descriptive error when componentData is %s (and is not an object or null)',
    (typeDescription, value) => {
      const receivedType = typeof value;
      const expectedErrorMessage = `EntityManager.addComponent: componentData for ${COMPONENT_TYPE_ID} on ${MOCK_INSTANCE_ID} must be an object or null. Received: ${receivedType}`;

      expect(() =>
        manager.addComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID, value)
      ).toThrow(expectedErrorMessage);

      // The logger receives a different context object than the one previously asserted.
      expect(logger.error).toHaveBeenCalledWith(expectedErrorMessage, {
        componentTypeId: COMPONENT_TYPE_ID,
        instanceId: MOCK_INSTANCE_ID,
        receivedType: receivedType,
      });
      expect(validator.validate).not.toHaveBeenCalled();
    }
  );
});
