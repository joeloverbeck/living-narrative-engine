import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { createEntityDefinition } from '../../common/entities/entityFactories.js';

let uniqueIdCounter = 0;
const createUniqueId = (prefix) =>
  `${prefix}_${Date.now()}_${++uniqueIdCounter}`;

describe('Complete Clothing Removal Workflow - E2E', () => {
  let container;
  let entityManager;
  let clothingAccessibilityService;
  let logger;
  let dataRegistry;

  beforeAll(async () => {
    // Create and configure full DI container
    container = new AppContainer();
    await configureContainer(container, {
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document,
    });

    // Get services from container
    entityManager = container.resolve(tokens.IEntityManager);
    clothingAccessibilityService = container.resolve(
      tokens.ClothingAccessibilityService
    );
    logger = container.resolve(tokens.ILogger);
    dataRegistry = container.resolve(tokens.IDataRegistry);

    if (!clothingAccessibilityService) {
      throw new Error('ClothingAccessibilityService not available');
    }

    logger.info('Clothing Removal Workflow E2E: Services initialized');
  });

  afterAll(() => {
    if (container) {
      logger.info('Clothing Removal Workflow E2E: Tests completed');
    }
  });

  /**
   * Helper to create test entities with proper registration
   *
   * @param entityId
   * @param components
   */
  async function createTestEntity(entityId, components = {}) {
    const definition = createEntityDefinition(entityId, components);
    dataRegistry.store('entityDefinitions', entityId, definition);
    await entityManager.createEntityInstance(entityId, {
      instanceId: entityId,
      definitionId: entityId,
    });
    return definition;
  }

  let testContext;

  beforeEach(() => {
    testContext = {
      actorId: createUniqueId('actor'),
      jacketId: createUniqueId('jacket'),
      shirtId: createUniqueId('shirt'),
      beltId: createUniqueId('belt'),
      pantsId: createUniqueId('pants'),
    };
  });

  it('should enforce removal order - full outfit with blocking', async () => {
    const { actorId, jacketId, shirtId, beltId, pantsId } = testContext;

    // Create actor with full equipment
    await createTestEntity(actorId, {
      'core:actor': {},
      'clothing:equipment': {
        equipped: {
          torso_upper: {
            outer: jacketId,
            base: shirtId,
          },
          torso_lower: {
            accessories: beltId,
          },
          legs: {
            base: pantsId,
          },
        },
      },
    });

    // Create clothing items
    await createTestEntity(jacketId, {
      'clothing:wearable': {
        layer: 'outer',
        equipmentSlots: { primary: 'torso_upper' },
      },
      'clothing:coverage_mapping': {
        covers: ['torso_upper'],
        coveragePriority: 'outer',
      },
    });

    await createTestEntity(shirtId, {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'torso_upper' },
      },
      'clothing:coverage_mapping': {
        covers: ['torso_upper'],
        coveragePriority: 'base',
      },
    });

    await createTestEntity(beltId, {
      'clothing:wearable': {
        layer: 'accessories',
        equipmentSlots: { primary: 'torso_lower' },
      },
      'clothing:coverage_mapping': {
        covers: ['torso_lower'],
        coveragePriority: 'accessories',
      },
      'clothing:blocks_removal': {
        blockedSlots: [
          { slot: 'legs', layers: ['base'], blockType: 'must_remove_first' },
        ],
      },
    });

    await createTestEntity(pantsId, {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'legs' },
      },
      'clothing:coverage_mapping': {
        covers: ['legs'],
        coveragePriority: 'base',
      },
    });

    // Test initial state
    const removableItems = clothingAccessibilityService.getAccessibleItems(
      actorId,
      { mode: 'topmost' }
    );

    // Initially: jacket (topmost in torso_upper), belt (topmost in torso_lower) removable
    // Pants should be blocked by belt
    // Shirt is NOT in topmost_clothing because jacket covers it
    expect(removableItems).toContain(jacketId);
    expect(removableItems).toContain(beltId);
    expect(removableItems).not.toContain(shirtId); // Hidden under jacket
    expect(removableItems).not.toContain(pantsId); // Blocked by belt
  });

  it('should allow pants removal when belt is not equipped', async () => {
    const actorId = createUniqueId('actor');
    const pantsId = createUniqueId('pants');

    // Create actor with only pants equipped (no belt)
    await createTestEntity(actorId, {
      'core:actor': {},
      'clothing:equipment': {
        equipped: {
          legs: { base: pantsId },
        },
      },
    });

    await createTestEntity(pantsId, {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'legs' },
      },
      'clothing:coverage_mapping': {
        covers: ['legs'],
        coveragePriority: 'base',
      },
    });

    // Test state
    const removableItems = clothingAccessibilityService.getAccessibleItems(
      actorId,
      { mode: 'topmost' }
    );

    // Pants should be removable (no belt to block them)
    expect(removableItems).toContain(pantsId);
  });

  it('should prevent removal of blocked items', async () => {
    const actorId = createUniqueId('actor');
    const beltId = createUniqueId('belt');
    const pantsId = createUniqueId('pants');

    // Create actor with belt and pants equipped
    await createTestEntity(actorId, {
      'core:actor': {},
      'clothing:equipment': {
        equipped: {
          torso_lower: { accessories: beltId },
          legs: { base: pantsId },
        },
      },
    });

    await createTestEntity(beltId, {
      'clothing:wearable': {
        layer: 'accessories',
        equipmentSlots: { primary: 'torso_lower' },
      },
      'clothing:coverage_mapping': {
        covers: ['torso_lower'],
        coveragePriority: 'accessories',
      },
      'clothing:blocks_removal': {
        blockedSlots: [
          { slot: 'legs', layers: ['base'], blockType: 'must_remove_first' },
        ],
      },
    });

    await createTestEntity(pantsId, {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'legs' },
      },
      'clothing:coverage_mapping': {
        covers: ['legs'],
        coveragePriority: 'base',
      },
    });

    // Act: Check what's removable
    const removableItems = clothingAccessibilityService.getAccessibleItems(
      actorId,
      { mode: 'topmost' }
    );

    // Assert: Pants should NOT be removable (blocked by belt)
    expect(removableItems).not.toContain(pantsId);

    // Belt should be removable
    expect(removableItems).toContain(beltId);
  });

  it('should verify blocking works across different actors', async () => {
    // Test with Actor A - belt + pants (blocked)
    const actorAId = createUniqueId('actorA');
    const beltAId = createUniqueId('beltA');
    const pantsAId = createUniqueId('pantsA');

    await createTestEntity(actorAId, {
      'core:actor': {},
      'clothing:equipment': {
        equipped: {
          torso_lower: { accessories: beltAId },
          legs: { base: pantsAId },
        },
      },
    });

    await createTestEntity(beltAId, {
      'clothing:wearable': {
        layer: 'accessories',
        equipmentSlots: { primary: 'torso_lower' },
      },
      'clothing:coverage_mapping': {
        covers: ['torso_lower'],
        coveragePriority: 'accessories',
      },
      'clothing:blocks_removal': {
        blockedSlots: [
          { slot: 'legs', layers: ['base'], blockType: 'must_remove_first' },
        ],
      },
    });

    await createTestEntity(pantsAId, {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'legs' },
      },
      'clothing:coverage_mapping': {
        covers: ['legs'],
        coveragePriority: 'base',
      },
    });

    // Verify blocking for Actor A
    const removableA = clothingAccessibilityService.getAccessibleItems(
      actorAId,
      { mode: 'topmost' }
    );
    expect(removableA).toContain(beltAId);
    expect(removableA).not.toContain(pantsAId); // Blocked by belt

    // Test with Actor B - only pants (not blocked)
    const actorBId = createUniqueId('actorB');
    const pantsBId = createUniqueId('pantsB');

    await createTestEntity(actorBId, {
      'core:actor': {},
      'clothing:equipment': {
        equipped: {
          legs: { base: pantsBId },
        },
      },
    });

    await createTestEntity(pantsBId, {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'legs' },
      },
      'clothing:coverage_mapping': {
        covers: ['legs'],
        coveragePriority: 'base',
      },
    });

    // Verify no blocking for Actor B
    const removableB = clothingAccessibilityService.getAccessibleItems(
      actorBId,
      { mode: 'topmost' }
    );
    expect(removableB).toContain(pantsBId); // Not blocked (no belt)
  });
});

describe('Multi-Actor Clothing Removal - E2E', () => {
  let container;
  let entityManager;
  let clothingAccessibilityService;
  let logger;
  let dataRegistry;

  beforeAll(async () => {
    // Create and configure full DI container
    container = new AppContainer();
    await configureContainer(container, {
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document,
    });

    // Get services from container
    entityManager = container.resolve(tokens.IEntityManager);
    clothingAccessibilityService = container.resolve(
      tokens.ClothingAccessibilityService
    );
    logger = container.resolve(tokens.ILogger);
    dataRegistry = container.resolve(tokens.IDataRegistry);

    if (!clothingAccessibilityService) {
      throw new Error('ClothingAccessibilityService not available');
    }

    logger.info('Multi-Actor Clothing Removal E2E: Services initialized');
  });

  afterAll(() => {
    if (container) {
      logger.info('Multi-Actor Clothing Removal E2E: Tests completed');
    }
  });

  /**
   * Helper to create test entities with proper registration
   *
   * @param entityId
   * @param components
   */
  async function createTestEntity(entityId, components = {}) {
    const definition = createEntityDefinition(entityId, components);
    dataRegistry.store('entityDefinitions', entityId, definition);
    await entityManager.createEntityInstance(entityId, {
      instanceId: entityId,
      definitionId: entityId,
    });
    return definition;
  }

  it('should enforce blocking consistently for any actor', async () => {
    const targetId = createUniqueId('target');
    const beltId = createUniqueId('belt');
    const pantsId = createUniqueId('pants');

    // Create target with belt and pants equipped
    await createTestEntity(targetId, {
      'core:actor': {},
      'clothing:equipment': {
        equipped: {
          torso_lower: { accessories: beltId },
          legs: { base: pantsId },
        },
      },
    });

    await createTestEntity(beltId, {
      'clothing:wearable': {
        layer: 'accessories',
        equipmentSlots: { primary: 'torso_lower' },
      },
      'clothing:coverage_mapping': {
        covers: ['torso_lower'],
        coveragePriority: 'accessories',
      },
      'clothing:blocks_removal': {
        blockedSlots: [
          { slot: 'legs', layers: ['base'], blockType: 'must_remove_first' },
        ],
      },
    });

    await createTestEntity(pantsId, {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'legs' },
      },
      'clothing:coverage_mapping': {
        covers: ['legs'],
        coveragePriority: 'base',
      },
    });

    // Check what's removable from target
    const removableItems = clothingAccessibilityService.getAccessibleItems(
      targetId,
      { mode: 'topmost' }
    );

    // Pants should NOT be removable (blocked by belt)
    expect(removableItems).not.toContain(pantsId);

    // Belt should be removable
    expect(removableItems).toContain(beltId);
  });
});
