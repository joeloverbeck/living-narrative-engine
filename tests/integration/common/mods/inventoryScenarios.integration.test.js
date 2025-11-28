import {
  describe,
  it,
  expect,
  afterEach,
} from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

const fixtures = [];

const createFixture = async (actionId) => {
  const fixture = await ModTestFixture.forAction('items', actionId);
  fixtures.push(fixture);
  return fixture;
};

afterEach(() => {
  while (fixtures.length > 0) {
    const fixture = fixtures.pop();
    fixture.cleanup();
  }
});

describe('Inventory scenario helpers - integration', () => {
  it('executes pick_up_item using the pickup scenario helper', async () => {
    const fixture = await createFixture('items:pick_up_item');
    const scenario = fixture.createPickupScenario({
      actor: { id: 'picker', name: 'Picker' },
      item: { id: 'pickup_target', weight: 0.1 },
    });

    await fixture.executeAction('picker', 'pickup_target');

    const actor = fixture.entityManager.getEntityInstance('picker');
    expect(actor.components['items:inventory'].items).toContain('pickup_target');
    const item = fixture.entityManager.getEntityInstance('pickup_target');
    expect(item.components['core:position']).toBeUndefined();
    expect(scenario.groundItem.id).toBe('pickup_target');
  });

  it('executes drop_item using the drop scenario helper', async () => {
    const fixture = await createFixture('items:drop_item');
    // Load additional condition required by the rule's "or" block
    await fixture.loadDependencyConditions([
      'items:event-is-action-drop-wielded-item',
    ]);
    const scenario = fixture.createDropItemScenario({
      actor: { id: 'dropper' },
      item: { id: 'drop_target', weight: 0.2 },
    });

    await fixture.executeAction('dropper', 'drop_target');

    const actor = fixture.entityManager.getEntityInstance('dropper');
    expect(actor.components['items:inventory'].items).not.toContain('drop_target');

    const dropped = fixture.entityManager.getEntityInstance('drop_target');
    expect(dropped.components['core:position'].locationId).toBe(
      scenario.room.id
    );
  });

  it('executes give_item using the inventory transfer helper', async () => {
    const fixture = await createFixture('items:give_item');
    const scenario = fixture.createInventoryTransfer({
      giverId: 'giver',
      receiverId: 'receiver',
      item: { id: 'gift', weight: 0.3 },
    });

    await fixture.executeAction('giver', 'receiver', {
      additionalPayload: { secondaryId: 'gift' },
    });

    const giver = fixture.entityManager.getEntityInstance('giver');
    const receiver = fixture.entityManager.getEntityInstance('receiver');
    expect(giver.components['items:inventory'].items).not.toContain('gift');
    expect(receiver.components['items:inventory'].items).toContain('gift');
    expect(scenario.transferItem.id).toBe('gift');
  });

  it('opens locked and unlocked containers using the container helper', async () => {
    const unlockedFixture = await createFixture('items:open_container');
    const unlockedScenario = unlockedFixture.createOpenContainerScenario({
      actor: { id: 'unlocked_actor' },
      container: { id: 'unlocked_crate', isOpen: false },
      contents: [{ id: 'book', weight: 0.5 }],
    });

    await unlockedFixture.executeAction('unlocked_actor', 'unlocked_crate');

    const unlockedContainer = unlockedFixture.entityManager.getEntityInstance(
      'unlocked_crate'
    );
    expect(unlockedContainer.components['items:container'].isOpen).toBe(true);
    expect(unlockedScenario.actor.id).toBe('unlocked_actor');

    const lockedFixture = await createFixture('items:open_container');
    const lockedScenario = lockedFixture.createOpenContainerScenario({
      actor: {
        id: 'locked_actor',
        inventoryItems: [{ id: 'vault_key', weight: 0.1 }],
      },
      container: { id: 'locked_vault', requiresKey: true, isOpen: false },
      contents: [{ id: 'treasure', weight: 1 }],
      keyItem: { id: 'vault_key', weight: 0.1 },
    });

    await lockedFixture.executeAction('locked_actor', 'locked_vault');

    const lockedContainer = lockedFixture.entityManager.getEntityInstance(
      'locked_vault'
    );
    expect(lockedContainer.components['items:container'].isOpen).toBe(true);
    expect(lockedScenario.actorInventoryItems.map((item) => item.id)).toContain(
      'vault_key'
    );
  });

  it('moves items into containers using the put in container helper', async () => {
    const fixture = await createFixture('items:put_in_container');
    const scenario = fixture.createPutInContainerScenario({
      actor: { id: 'storer' },
      container: { id: 'storage_crate' },
      item: { id: 'supply_crate', weight: 1 },
    });

    await fixture.executeAction('storer', 'storage_crate', {
      additionalPayload: { secondaryId: 'supply_crate' },
    });

    const container = fixture.entityManager.getEntityInstance('storage_crate');
    expect(container.components['items:container'].contents).toContain(
      'supply_crate'
    );

    const actor = fixture.entityManager.getEntityInstance('storer');
    expect(actor.components['items:inventory'].items).not.toContain(
      'supply_crate'
    );
    expect(scenario.heldItem.id).toBe('supply_crate');
  });

  it('rejects put in container when container capacity is full', async () => {
    const fixture = await createFixture('items:put_in_container');
    const scenario = fixture.createPutInContainerScenario({
      actor: { id: 'overloader' },
      container: {
        id: 'full_crate',
        capacity: { maxItems: 1, maxWeight: 0.5 },
      },
      containerContents: [{ id: 'existing_supply', weight: 0.5 }],
      item: { id: 'extra_supply', weight: 0.3 },
    });

    await fixture.executeAction('overloader', 'full_crate', {
      additionalPayload: { secondaryId: 'extra_supply' },
    });

    const container = fixture.entityManager.getEntityInstance('full_crate');
    expect(container.components['items:container'].contents).not.toContain(
      'extra_supply'
    );
    const actor = fixture.entityManager.getEntityInstance('overloader');
    expect(actor.components['items:inventory'].items).toContain('extra_supply');
    const successEvent = fixture.events.find(
      (event) => event.eventType === 'items:item_put_in_container'
    );
    expect(successEvent).toBeUndefined();
    expect(scenario.containerCapacity.maxItems).toBeGreaterThan(0);
  });
});
