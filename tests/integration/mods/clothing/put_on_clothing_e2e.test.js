/**
 * @file End-to-end integration test for the clothing:put_on_clothing flow.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import UnequipClothingHandler from '../../../../src/logic/operationHandlers/unequipClothingHandler.js';
import { EquipmentOrchestrator } from '../../../../src/clothing/orchestration/equipmentOrchestrator.js';
import { LayerCompatibilityService } from '../../../../src/clothing/validation/layerCompatibilityService.js';

const ACTION_ID = 'clothing:put_on_clothing';

describe('clothing:put_on_clothing end-to-end', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('clothing', ACTION_ID);
  });

  afterEach(() => {
    testFixture?.cleanup();
  });

  it('drops clothing, picks it up, and puts it on with logs and perception', async () => {
    const actorBuilder = new ModEntityBuilder('actor_put_on_e2e')
      .withName('Casey')
      .asActor()
      .withGrabbingHands(2)
      .withComponent('clothing:equipment', {
        equipped: { torso_upper: { base: 'travel_cloak' } },
      })
      .withComponent('items:inventory', {
        items: [],
        capacity: { maxWeight: 10, maxItems: 5 },
      })
      .withComponent('core:position', { locationId: 'grove' });

    const actor = actorBuilder.build();
    const handEntities = actorBuilder.getHandEntities();

    const clothing = new ModEntityBuilder('travel_cloak')
      .withName('cloak')
      .withComponent('clothing:wearable', {
        layer: 'base',
        equipmentSlots: { primary: 'torso_upper' },
      })
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 1 })
      .build();

    testFixture.reset([actor, ...handEntities, clothing]);

    const equipmentOrchestrator = new EquipmentOrchestrator({
      entityManager: testFixture.entityManager,
      logger: testFixture.logger,
      eventDispatcher: testFixture.eventBus,
      layerCompatibilityService: new LayerCompatibilityService({
        entityManager: testFixture.entityManager,
        logger: testFixture.logger,
      }),
    });

    const unequipHandler = new UnequipClothingHandler({
      entityManager: testFixture.entityManager,
      logger: testFixture.logger,
      safeEventDispatcher: testFixture.eventBus,
      equipmentOrchestrator,
    });

    await unequipHandler.execute(
      {
        entity_ref: 'actor',
        clothing_item_id: clothing.id,
        destination: 'ground',
      },
      {
        evaluationContext: { actor: { id: actor.id }, context: {} },
        logger: testFixture.logger,
        ruleId: 'test-unequip',
      }
    );

    const afterUnequip = testFixture.entityManager.getComponentData(
      actor.id,
      'clothing:equipment'
    );
    expect(afterUnequip.equipped.torso_upper?.base).toBeUndefined();

    const groundPosition = testFixture.entityManager.getComponentData(
      clothing.id,
      'core:position'
    );
    expect(groundPosition).toEqual({ locationId: 'grove' });

    const inventory = testFixture.entityManager.getComponentData(
      actor.id,
      'items:inventory'
    );
    const updatedInventory = {
      ...inventory,
      items: [...inventory.items, clothing.id],
    };
    await testFixture.entityManager.addComponent(
      actor.id,
      'items:inventory',
      updatedInventory
    );

    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: actor.id,
      actionId: ACTION_ID,
      targetId: clothing.id,
      originalInput: 'put on cloak',
    });

    const equipment = testFixture.entityManager.getComponentData(
      actor.id,
      'clothing:equipment'
    );
    expect(equipment.equipped.torso_upper.base).toBe(clothing.id);

    const finalInventory = testFixture.entityManager.getComponentData(
      actor.id,
      'items:inventory'
    );
    expect(finalInventory.items).not.toContain(clothing.id);

    const logEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(logEvent).toBeDefined();
    expect(logEvent.payload.descriptionText).toBe('Casey puts on cloak.');
    expect(logEvent.payload.targetId).toBe(clothing.id);

    const equipEvent = testFixture.events.find(
      (e) => e.eventType === 'clothing:equipped'
    );
    expect(equipEvent).toBeDefined();
    expect(equipEvent.payload.clothingItemId).toBe(clothing.id);
  });
});
