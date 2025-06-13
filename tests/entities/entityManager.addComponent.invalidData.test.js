import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import EntityManager from '../../src/entities/entityManager.js';

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

  beforeEach(() => {
    registry = createMockDataRegistry();
    validator = createMockSchemaValidator();
    logger = createMockLogger();
    spatial = createMockSpatialIndexManager();
    manager = new EntityManager(registry, validator, logger, spatial);

    registry.getEntityDefinition.mockReturnValue({
      id: TEST_DEFINITION_ID,
      components: {
        [COMPONENT_TYPE_ID]: { ...VALID_COMPONENT_DATA },
      },
    });
    manager.createEntityInstance(TEST_DEFINITION_ID, MOCK_INSTANCE_ID);
    jest.clearAllMocks();
  });

  afterEach(() => {
    manager.clearAll();
  });

  it.each([null, undefined, 'bad', 42, true, Symbol('sym')])(
    'throws descriptive error when componentData is %p',
    (badData) => {
      expect(() =>
        manager.addComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID, badData)
      ).toThrow(
        `EntityManager.addComponent: Invalid component data for type '${COMPONENT_TYPE_ID}' on entity '${MOCK_INSTANCE_ID}'.`
      );
      expect(logger.error).toHaveBeenCalledWith(
        `EntityManager.addComponent: Invalid component data for type '${COMPONENT_TYPE_ID}' on entity '${MOCK_INSTANCE_ID}'.`
      );
      expect(validator.validate).not.toHaveBeenCalled();
    }
  );
});
