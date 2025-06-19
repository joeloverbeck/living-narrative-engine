/**
 * @file Integration tests for the EntityManager class.
 * @see tests/integration/entityCreationFromDefAndInstance.integration.test.js
 */

import EntityManager from '../../src/entities/entityManager.js';
import Entity from '../../src/entities/entity.js';
import EntityDefinition from '../../src/entities/entityDefinition.js';
import InMemoryDataRegistry from '../../src/data/inMemoryDataRegistry.js';

// Mocks for constructor dependencies
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockSchemaValidator = {
  validate: jest.fn().mockReturnValue({ isValid: true }),
  addSchema: jest.fn(),
  removeSchema: jest.fn(),
  getValidator: jest.fn(),
  isSchemaLoaded: jest.fn(),
};

const mockSpatialIndexManager = {
  addEntity: jest.fn(),
  removeEntity: jest.fn(),
  updateEntityLocation: jest.fn(),
  clearIndex: jest.fn(),
};

const createMockSafeEventDispatcher = () => ({
  dispatch: jest.fn(),
});

describe('EntityManager Integration Tests', () => {
  let entityManager;
  let dataRegistry;
  let mockEventDispatcher;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Use a real InMemoryDataRegistry to simulate a post-load state
    dataRegistry = new InMemoryDataRegistry();

    mockEventDispatcher = createMockSafeEventDispatcher();

    // Instantiate EntityManager with real registry and mocked services
    entityManager = new EntityManager(
      dataRegistry,
      mockSchemaValidator,
      mockLogger,
      mockEventDispatcher
    );
  });

  /**
   * @description Test case for Ticket TEST-INT-01.
   * Verifies the integration between DataRegistry and EntityManager for creating
   * a complete Entity object from a definition and instance data, ensuring
   * that instance-specific component overrides are correctly applied.
   */
  test('should create an entity instance by merging definition and instance overrides', () => {
    // Arrange: Set up test data and registry state
    const definitionId = 'core:goblin';
    const instanceId = 'core:goblin_sentry';

    // 1. Create the base EntityDefinition for a goblin
    const goblinDefinitionData = {
      id: definitionId,
      description: 'A standard goblin creature.',
      components: {
        'core:name': { name: 'Goblin' },
        'core:health': { max: 15, current: 15 },
      },
    };
    const goblinDefinition = new EntityDefinition(
      definitionId,
      goblinDefinitionData
    );

    // 2. Populate the mock DataRegistry to simulate it being loaded
    dataRegistry.store('entity_definitions', definitionId, goblinDefinition);

    // 3. Define the instance-specific overrides
    const componentOverrides = {
      'core:health': { max: 25 }, // This should override the definition's max health
    };

    // Act: Call the method under test
    const entity = entityManager.createEntityInstance(definitionId, {
      instanceId,
      componentOverrides,
    });

    // Assert: Verify the resulting entity state
    // [x] Assert that the call returns a valid Entity object.
    expect(entity).toBeInstanceOf(Entity);

    // [x] Assert that entity.id is 'core:goblin_sentry'.
    expect(entity.id).toBe(instanceId);

    // [x] Assert that entity.definitionId is 'core:goblin'.
    expect(entity.definitionId).toBe(definitionId);

    // [x] Assert that overridden component values are correctly applied.
    const healthData = entity.getComponentData('core:health');
    expect(healthData).toBeDefined();
    expect(healthData.max).toBe(25); // The override value
    // The 'current' property was not in the override, so it should not be present
    // in the final component, as overrides replace the whole component object.
    expect(healthData.current).toBeUndefined();

    // [x] Assert that non-overridden components are correctly inherited.
    const nameData = entity.getComponentData('core:name');
    expect(nameData).toBeDefined();
    expect(nameData.name).toBe('Goblin'); // The definition's default value
  });

  /**
   * @description Test case for Ticket TEST-INT-02.
   * Verifies that the EntityManager fails gracefully when attempting to create
   * an entity from a `definitionId` that is not present in the DataRegistry.
   */
  test('should throw an error when creating an instance with a missing definition', () => {
    // Arrange
    const nonExistentDefinitionId = 'core:non_existent_template';
    const instanceId = 'core:ghost';
    const expectedErrorMessage = `Entity definition not found: '${nonExistentDefinitionId}'`;

    // Act & Assert
    // [x] Assert that the call throws a descriptive Error.
    expect(() => {
      entityManager.createEntityInstance(nonExistentDefinitionId, {
        instanceId,
      });
    }).toThrow(expectedErrorMessage);

    // [x] Assert that no partial or invalid entity is tracked by the manager.
    const entity = entityManager.getEntityInstance(instanceId);
    expect(entity).toBeUndefined();

    // Double-check the internal tracking map as well for good measure.
    expect(entityManager.activeEntities.has(instanceId)).toBe(false);
  });
});
