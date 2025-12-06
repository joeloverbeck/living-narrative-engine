import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import EntityDefinition from '../../../../src/entities/entityDefinition.js';
import { IsRemovalBlockedOperator } from '../../../../src/logic/operators/isRemovalBlockedOperator.js';
import EntityManagerIntegrationTestBed from '../../../common/entities/entityManagerIntegrationTestBed.js';

describe('IsRemovalBlocked Operator integration with EntityManager', () => {
  let testBed;
  let entityManager;
  let actorDefinition;
  let wearableDefinition;
  let actor;
  let belt;
  let pants;
  let operator;

  const registerDefinition = (definition) => {
    testBed.registry.store('entityDefinitions', definition.id, definition);
  };

  const createWearable = async (instanceId, components = {}) => {
    const instance = await entityManager.createEntityInstance(
      wearableDefinition.id,
      { instanceId }
    );

    for (const [componentId, data] of Object.entries(components)) {
      await entityManager.addComponent(instance.id, componentId, data);
    }

    return instance;
  };

  const equipItem = async (actorId, itemId, slot, layer) => {
    const equipment = entityManager.getComponentData(
      actorId,
      'clothing:equipment'
    ) || {
      equipped: {},
    };

    if (!equipment.equipped[slot]) {
      equipment.equipped[slot] = {};
    }
    if (!equipment.equipped[slot][layer]) {
      equipment.equipped[slot][layer] = [];
    }

    if (!Array.isArray(equipment.equipped[slot][layer])) {
      equipment.equipped[slot][layer] = [equipment.equipped[slot][layer]];
    }

    equipment.equipped[slot][layer].push(itemId);

    await entityManager.addComponent(actorId, 'clothing:equipment', equipment);
  };

  const evaluate = (contextOverrides = {}) => {
    const context = {
      actor: { id: actor.id },
      targetItem: { id: pants.id },
      ...contextOverrides,
    };
    return operator.evaluate(['actor', 'targetItem'], context);
  };

  beforeEach(async () => {
    testBed = new EntityManagerIntegrationTestBed();
    entityManager = testBed.entityManager;

    actorDefinition = new EntityDefinition('integration:actor', {
      description: 'integration actor',
      components: {},
    });

    wearableDefinition = new EntityDefinition('integration:wearable', {
      description: 'integration wearable item',
      components: {},
    });

    registerDefinition(actorDefinition);
    registerDefinition(wearableDefinition);

    actor = await entityManager.createEntityInstance(actorDefinition.id, {
      instanceId: 'actor-1',
    });

    belt = await createWearable('belt-1', {
      'clothing:wearable': {
        layer: 'accessories',
        equipmentSlots: { primary: 'torso_lower' },
      },
      'clothing:blocks_removal': {
        blockedSlots: [
          {
            slot: 'legs',
            layers: ['base'],
            blockType: 'must_remove_first',
          },
        ],
      },
    });

    pants = await createWearable('pants-1', {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'legs' },
      },
    });

    // Initialize equipment component
    await entityManager.addComponent(actor.id, 'clothing:equipment', {
      equipped: {},
    });

    operator = new IsRemovalBlockedOperator({
      entityManager,
      logger: testBed.logger,
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  it('should return false when actor has no equipment', () => {
    expect(evaluate()).toBe(false);
  });

  it('should return false when target item is not wearable', async () => {
    const nonWearable = await entityManager.createEntityInstance(
      wearableDefinition.id,
      { instanceId: 'non-wearable' }
    );

    const context = {
      actor: { id: actor.id },
      targetItem: { id: nonWearable.id },
    };

    expect(operator.evaluate(['actor', 'targetItem'], context)).toBe(false);
  });

  it('should return true when removal is blocked by slot rules', async () => {
    // Equip belt first (blocks pants removal)
    await equipItem(actor.id, belt.id, 'torso_lower', 'accessories');
    // Equip pants
    await equipItem(actor.id, pants.id, 'legs', 'base');

    expect(evaluate()).toBe(true);
  });

  it('should return false when no items block removal', async () => {
    // Only equip pants (no blockers)
    await equipItem(actor.id, pants.id, 'legs', 'base');

    expect(evaluate()).toBe(false);
  });

  it('should handle operator with invalid arguments', () => {
    const context = {
      actor: null,
      targetItem: null,
    };

    expect(operator.evaluate(['actor', 'targetItem'], context)).toBe(false);
  });
});
