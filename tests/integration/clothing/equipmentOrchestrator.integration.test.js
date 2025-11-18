import { beforeEach, describe, expect, it } from '@jest/globals';
import { EquipmentOrchestrator } from '../../../src/clothing/orchestration/equipmentOrchestrator.js';
import { LayerCompatibilityService } from '../../../src/clothing/validation/layerCompatibilityService.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';

class RecordingLogger {
  constructor() {
    this.debugEntries = [];
    this.infoEntries = [];
    this.warnEntries = [];
    this.errorEntries = [];
  }

  debug(message, metadata) {
    this.debugEntries.push({ message, metadata });
  }

  info(message, metadata) {
    this.infoEntries.push({ message, metadata });
  }

  warn(message, metadata) {
    this.warnEntries.push({ message, metadata });
  }

  error(message, metadata) {
    this.errorEntries.push({ message, metadata });
  }
}

class RecordingEventDispatcher {
  constructor() {
    this.events = [];
  }

  async dispatch(eventName, payload) {
    this.events.push({ eventName, payload });
    return { success: true };
  }

  subscribe() {
    return () => {};
  }

  unsubscribe() {}
}

describe('EquipmentOrchestrator integration', () => {
  /** @type {SimpleEntityManager} */
  let entityManager;
  /** @type {RecordingLogger} */
  let logger;
  /** @type {RecordingEventDispatcher} */
  let eventDispatcher;
  /** @type {LayerCompatibilityService} */
  let layerService;
  /** @type {EquipmentOrchestrator} */
  let orchestrator;

  const actorId = 'entity:actor';

  beforeEach(async () => {
    entityManager = new SimpleEntityManager();
    logger = new RecordingLogger();
    eventDispatcher = new RecordingEventDispatcher();
    layerService = new LayerCompatibilityService({
      entityManager,
      logger,
    });
    orchestrator = new EquipmentOrchestrator({
      entityManager,
      logger,
      eventDispatcher,
      layerCompatibilityService: layerService,
    });

    await entityManager.addComponent(actorId, 'clothing:equipment', {
      equipped: {},
    });
  });

  /**
   *
   * @param clothingItemId
   * @param root0
   * @param root0.layer
   * @param root0.primarySlot
   * @param root0.secondarySlots
   * @param root0.additionalProps
   */
  async function addWearable(
    clothingItemId,
    {
      layer,
      primarySlot,
      secondarySlots,
      additionalProps = {},
    }
  ) {
    await entityManager.addComponent(clothingItemId, 'clothing:wearable', {
      layer,
      equipmentSlots: {
        primary: primarySlot,
        ...(secondarySlots ? { secondary: secondarySlots } : {}),
      },
      ...additionalProps,
    });
  }

  /**
   *
   * @param slotId
   */
  function getEquipped(slotId) {
    const equipment = entityManager.getComponentData(
      actorId,
      'clothing:equipment'
    );
    return equipment?.equipped?.[slotId] ?? {};
  }

  it('equips a new item by auto-removing conflicting layers and dispatches an event', async () => {
    await addWearable('item:oldShirt', {
      layer: 'base',
      primarySlot: 'torso',
    });
    await addWearable('item:newShirt', {
      layer: 'base',
      primarySlot: 'torso',
    });

    await entityManager.addComponent(actorId, 'clothing:equipment', {
      equipped: {
        torso: { base: 'item:oldShirt' },
      },
    });

    const result = await orchestrator.orchestrateEquipment({
      entityId: actorId,
      clothingItemId: 'item:newShirt',
    });

    expect(result.success).toBe(true);
    const torsoEquipment = getEquipped('torso');
    expect(torsoEquipment.base).toBe('item:newShirt');
    expect(
      Object.values(torsoEquipment || {}).includes('item:oldShirt')
    ).toBe(false);
    expect(eventDispatcher.events).toHaveLength(1);
    expect(eventDispatcher.events[0]).toEqual(
      expect.objectContaining({
        eventName: 'clothing:equipped',
        payload: expect.objectContaining({
          entityId: actorId,
          clothingItemId: 'item:newShirt',
          conflictResolution: 'auto_remove',
        }),
      })
    );
  });

  it('returns validation errors when the actor or clothing item is missing', async () => {
    const result = await orchestrator.orchestrateEquipment({
      entityId: 'entity:missing',
      clothingItemId: 'item:missing',
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Entity 'entity:missing' not found",
        "Clothing item 'item:missing' not found",
        "Item 'item:missing' is not wearable",
      ])
    );
  });

  it('rejects equipment requests when the item lacks wearable data', async () => {
    await entityManager.addComponent('item:nonWearable', 'core:description', {
      text: 'Decorative pin',
    });

    const result = await orchestrator.orchestrateEquipment({
      entityId: actorId,
      clothingItemId: 'item:nonWearable',
    });

    expect(result.success).toBe(false);
    expect(result.errors).toContain("Item 'item:nonWearable' is not wearable");
  });

  it('rejects equipment when a wearable loses its slot definition between validation and execution', async () => {
    class FlakyEntityManager extends SimpleEntityManager {
      constructor() {
        super();
        this.callCount = 0;
      }

      getComponentData(id, type) {
        const data = super.getComponentData(id, type);
        if (id === 'item:vanishing' && type === 'clothing:wearable') {
          this.callCount += 1;
          if (this.callCount === 2) {
            this.removeComponent(id, 'clothing:wearable');
            return null;
          }
        }
        return data;
      }
    }

    entityManager = new FlakyEntityManager();
    logger = new RecordingLogger();
    eventDispatcher = new RecordingEventDispatcher();
    layerService = new LayerCompatibilityService({
      entityManager,
      logger,
    });
    orchestrator = new EquipmentOrchestrator({
      entityManager,
      logger,
      eventDispatcher,
      layerCompatibilityService: layerService,
    });

    await entityManager.addComponent(actorId, 'clothing:equipment', {
      equipped: {},
    });
    await entityManager.addComponent('item:vanishing', 'clothing:wearable', {
      layer: 'base',
      equipmentSlots: { primary: 'torso' },
    });

    const result = await orchestrator.orchestrateEquipment({
      entityId: actorId,
      clothingItemId: 'item:vanishing',
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual([
      "Item 'item:vanishing' is not wearable",
    ]);
  });

  it('fails when the wearable component lacks a primary slot definition', async () => {
    await entityManager.addComponent('item:brokenHarness', 'clothing:wearable', {
      layer: 'outer',
      equipmentSlots: {},
    });

    const result = await orchestrator.orchestrateEquipment({
      entityId: actorId,
      clothingItemId: 'item:brokenHarness',
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual([
      "Item 'item:brokenHarness' has invalid equipment slot configuration",
    ]);
  });

  it('fails gracefully when layer requirements are not met', async () => {
    await addWearable('item:coat', {
      layer: 'outer',
      primarySlot: 'torso',
    });

    const result = await orchestrator.orchestrateEquipment({
      entityId: actorId,
      clothingItemId: 'item:coat',
    });

    expect(result.success).toBe(false);
    expect(result.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'layer_requirement', requiredLayer: 'base' }),
      ])
    );
    expect(result.errors).toContain(
      "Cannot equip item: Layer 'outer' requires 'base' layer to be present"
    );
  });

  it('cascades dependent items when unequipping base layers', async () => {
    await addWearable('item:shirt', {
      layer: 'base',
      primarySlot: 'torso',
    });
    await addWearable('item:coat', {
      layer: 'outer',
      primarySlot: 'torso',
    });

    await entityManager.addComponent(actorId, 'clothing:equipment', {
      equipped: {
        torso: {
          base: 'item:shirt',
          outer: 'item:coat',
        },
      },
    });

    const result = await orchestrator.orchestrateUnequipment({
      entityId: actorId,
      clothingItemId: 'item:shirt',
      cascadeUnequip: true,
      reason: 'test',
    });

    expect(result.success).toBe(true);
    expect(result.cascadeItems).toEqual(['item:coat']);
    const torsoEquipment = getEquipped('torso');
    expect(torsoEquipment.base).toBeUndefined();
    expect(torsoEquipment.outer).toBeUndefined();
    expect(eventDispatcher.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventName: 'clothing:unequipped',
          payload: expect.objectContaining({
            entityId: actorId,
            clothingItemId: 'item:shirt',
            cascadeCount: 1,
          }),
        }),
      ])
    );
  });

  it('returns detailed errors when attempting to unequip a non-existent item', async () => {
    const result = await orchestrator.orchestrateUnequipment({
      entityId: actorId,
      clothingItemId: 'item:unknown',
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(['Item is not currently equipped']);
  });

  it('indicates when equipment data lacks the requested item despite other entries', async () => {
    await addWearable('item:other', {
      layer: 'base',
      primarySlot: 'torso',
    });

    await entityManager.addComponent(actorId, 'clothing:equipment', {
      equipped: { torso: { base: 'item:other' } },
    });

    const result = await orchestrator.orchestrateUnequipment({
      entityId: actorId,
      clothingItemId: 'item:notPresent',
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(['Item is not currently equipped']);
  });

  it('validates compatibility and surfaces warnings for layer conflicts', async () => {
    await addWearable('item:existingCoat', {
      layer: 'outer',
      primarySlot: 'torso',
    });
    await addWearable('item:newCoat', {
      layer: 'outer',
      primarySlot: 'torso',
    });
    await addWearable('item:shirt', {
      layer: 'base',
      primarySlot: 'torso',
    });

    await entityManager.addComponent(actorId, 'clothing:equipment', {
      equipped: {
        torso: {
          base: 'item:shirt',
          outer: 'item:existingCoat',
        },
      },
    });

    const result = await orchestrator.validateEquipmentCompatibility({
      entityId: actorId,
      clothingItemId: 'item:newCoat',
    });

    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual(['1 layer conflict(s) detected']);
    expect(result.compatibility.layers.hasConflicts).toBe(true);
    expect(result.compatibility.layers.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'layer_overlap',
          conflictingItemId: 'item:existingCoat',
        }),
      ])
    );
  });

  it('reports compatibility success when no layer conflicts are detected', async () => {
    await addWearable('item:plainShirt', {
      layer: 'base',
      primarySlot: 'torso',
    });

    const result = await orchestrator.validateEquipmentCompatibility({
      entityId: actorId,
      clothingItemId: 'item:plainShirt',
    });

    expect(result.valid).toBe(true);
    expect(result.warnings).toBeUndefined();
    expect(result.compatibility.layers).toEqual({
      hasConflicts: false,
      conflicts: [],
    });
  });

  it('skips layer conflict checks when wearable data disappears mid-validation', async () => {
    class FlakyCompatibilityEntityManager extends SimpleEntityManager {
      constructor() {
        super();
        this.readCount = 0;
      }

      getComponentData(id, type) {
        const data = super.getComponentData(id, type);
        if (id === 'item:transient' && type === 'clothing:wearable') {
          this.readCount += 1;
          if (this.readCount === 2) {
            this.removeComponent(id, 'clothing:wearable');
            return null;
          }
        }
        return data;
      }
    }

    entityManager = new FlakyCompatibilityEntityManager();
    logger = new RecordingLogger();
    eventDispatcher = new RecordingEventDispatcher();
    layerService = new LayerCompatibilityService({
      entityManager,
      logger,
    });
    orchestrator = new EquipmentOrchestrator({
      entityManager,
      logger,
      eventDispatcher,
      layerCompatibilityService: layerService,
    });

    await entityManager.addComponent(actorId, 'clothing:equipment', {
      equipped: {},
    });
    await entityManager.addComponent('item:transient', 'clothing:wearable', {
      layer: 'base',
      equipmentSlots: { primary: 'torso' },
    });

    const result = await orchestrator.validateEquipmentCompatibility({
      entityId: actorId,
      clothingItemId: 'item:transient',
    });

    expect(result.valid).toBe(true);
    expect(result.compatibility).toEqual({});
    expect(result.warnings).toBeUndefined();
  });

  it('reports validation errors when compatibility checks fail basic requirements', async () => {
    const result = await orchestrator.validateEquipmentCompatibility({
      entityId: 'entity:missing',
      clothingItemId: 'item:missing',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Entity 'entity:missing' not found",
        "Clothing item 'item:missing' not found",
        "Item 'item:missing' is not wearable",
      ])
    );
  });

  it('propagates equipment errors from the entity manager without dispatching events', async () => {
    class ThrowingEntityManager extends SimpleEntityManager {
      async addComponent(id, type, data) {
        if (type === 'clothing:equipment' && data?.equipped?.torso?.base === 'item:newShirt') {
          throw new Error('Storage failure');
        }
        return super.addComponent(id, type, data);
      }
    }

    entityManager = new ThrowingEntityManager();
    logger = new RecordingLogger();
    eventDispatcher = new RecordingEventDispatcher();
    layerService = new LayerCompatibilityService({
      entityManager,
      logger,
    });
    orchestrator = new EquipmentOrchestrator({
      entityManager,
      logger,
      eventDispatcher,
      layerCompatibilityService: layerService,
    });

    await entityManager.addComponent(actorId, 'clothing:equipment', {
      equipped: {
        torso: { base: 'item:oldShirt' },
      },
    });

    await entityManager.addComponent('item:oldShirt', 'clothing:wearable', {
      layer: 'base',
      equipmentSlots: { primary: 'torso' },
    });
    await entityManager.addComponent('item:newShirt', 'clothing:wearable', {
      layer: 'base',
      equipmentSlots: { primary: 'torso' },
    });

    const result = await orchestrator.orchestrateEquipment({
      entityId: actorId,
      clothingItemId: 'item:newShirt',
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(['Storage failure']);
    expect(eventDispatcher.events).toHaveLength(0);
  });

  it('returns specific errors when unequipping without equipment data', async () => {
    const localManager = new SimpleEntityManager();
    logger = new RecordingLogger();
    eventDispatcher = new RecordingEventDispatcher();
    layerService = new LayerCompatibilityService({
      entityManager: localManager,
      logger,
    });
    orchestrator = new EquipmentOrchestrator({
      entityManager: localManager,
      logger,
      eventDispatcher,
      layerCompatibilityService: layerService,
    });

    const result = await orchestrator.orchestrateUnequipment({
      entityId: actorId,
      clothingItemId: 'item:shirt',
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(['Item is not currently equipped']);
  });

  it('unequips items without cascade when the target is present', async () => {
    await addWearable('item:simpleShirt', {
      layer: 'base',
      primarySlot: 'torso',
    });

    await entityManager.addComponent(actorId, 'clothing:equipment', {
      equipped: { torso: { base: 'item:simpleShirt' } },
    });

    const result = await orchestrator.orchestrateUnequipment({
      entityId: actorId,
      clothingItemId: 'item:simpleShirt',
    });

    expect(result.success).toBe(true);
    expect(getEquipped('torso').base).toBeUndefined();
    expect(eventDispatcher.events.at(-1)).toEqual(
      expect.objectContaining({ eventName: 'clothing:unequipped' })
    );
  });

  it('counts successful cascade unequipment operations', async () => {
    await addWearable('item:baseLayer', {
      layer: 'base',
      primarySlot: 'torso',
    });
    await addWearable('item:outerLayer', {
      layer: 'outer',
      primarySlot: 'torso',
    });

    await entityManager.addComponent(actorId, 'clothing:equipment', {
      equipped: {
        torso: { base: 'item:baseLayer', outer: 'item:outerLayer' },
      },
    });

    class DependencyAwareLayerService extends LayerCompatibilityService {
      async findDependentItems() {
        return ['item:outerLayer'];
      }
    }

    layerService = new DependencyAwareLayerService({
      entityManager,
      logger,
    });
    orchestrator = new EquipmentOrchestrator({
      entityManager,
      logger,
      eventDispatcher,
      layerCompatibilityService: layerService,
    });

    const result = await orchestrator.orchestrateUnequipment({
      entityId: actorId,
      clothingItemId: 'item:baseLayer',
      cascadeUnequip: true,
    });

    expect(result.success).toBe(true);
    expect(result.cascadeItems).toEqual(['item:outerLayer']);
    expect(getEquipped('torso')).toEqual({});
  });

  it('continues orchestration when cascade unequipment fails to remove a dependency', async () => {
    class CascadeRaceEntityManager extends SimpleEntityManager {
      constructor() {
        super();
        this.attempt = 0;
      }

      getComponentData(id, type) {
        const data = super.getComponentData(id, type);
        if (id === actorId && type === 'clothing:equipment') {
          if (this.attempt === 0 && data?.equipped?.torso?.outer) {
            const clone = JSON.parse(JSON.stringify(data));
            delete clone.equipped.torso.outer;
            super.addComponent(id, type, clone);
            this.attempt += 1;
            return clone;
          }
          this.attempt += 1;
        }
        return data;
      }
    }

    entityManager = new CascadeRaceEntityManager();
    logger = new RecordingLogger();
    eventDispatcher = new RecordingEventDispatcher();
    layerService = new LayerCompatibilityService({
      entityManager,
      logger,
    });
    orchestrator = new EquipmentOrchestrator({
      entityManager,
      logger,
      eventDispatcher,
      layerCompatibilityService: layerService,
    });

    await entityManager.addComponent(actorId, 'clothing:equipment', {
      equipped: {
        torso: { base: 'item:baseLayer', outer: 'item:outerLayer' },
      },
    });
    await entityManager.addComponent('item:baseLayer', 'clothing:wearable', {
      layer: 'base',
      equipmentSlots: { primary: 'torso' },
    });
    await entityManager.addComponent('item:outerLayer', 'clothing:wearable', {
      layer: 'outer',
      equipmentSlots: { primary: 'torso' },
    });

    class DependencyLayerService extends LayerCompatibilityService {
      async findDependentItems() {
        return ['item:outerLayer'];
      }
    }

    layerService = new DependencyLayerService({
      entityManager,
      logger,
    });
    orchestrator = new EquipmentOrchestrator({
      entityManager,
      logger,
      eventDispatcher,
      layerCompatibilityService: layerService,
    });

    const result = await orchestrator.orchestrateUnequipment({
      entityId: actorId,
      clothingItemId: 'item:baseLayer',
      cascadeUnequip: true,
    });

    expect(result.success).toBe(true);
    expect(result.cascadeItems).toEqual(['item:outerLayer']);
  });

  it('initializes equipment data when equipping onto entities without existing records', async () => {
    entityManager.removeComponent(actorId, 'clothing:equipment');

    await addWearable('item:freshBoots', {
      layer: 'base',
      primarySlot: 'feet',
    });

    const result = await orchestrator.orchestrateEquipment({
      entityId: actorId,
      clothingItemId: 'item:freshBoots',
    });

    expect(result.success).toBe(true);
    const equipmentData = entityManager.getComponentData(
      actorId,
      'clothing:equipment'
    );
    expect(equipmentData).toEqual({
      equipped: { feet: { base: 'item:freshBoots' } },
    });
  });

  it('aggregates errors when conflicts cannot be resolved automatically', async () => {
    await addWearable('item:newHelm', {
      layer: 'outer',
      primarySlot: 'head',
    });

    await entityManager.addComponent(actorId, 'clothing:equipment', {
      equipped: { head: {} },
    });

    const throwingConflict = {
      type: 'layer_overlap',
      _accessed: false,
      get conflictingItemId() {
        if (!this._accessed) {
          this._accessed = true;
          throw new Error('conflict data unavailable');
        }
        return 'item:temperamental';
      },
    };

    const fallbackConflict = {
      type: 'layer_overlap',
      itemId: 'item:fallback',
      attempts: 0,
      get conflictingItemId() {
        this.attempts += 1;
        if (this.attempts === 1) {
          throw new Error('initial failure');
        }
        return undefined;
      },
    };

    const unknownConflict = {
      type: 'layer_overlap',
      attempts: 0,
      get conflictingItemId() {
        this.attempts += 1;
        if (this.attempts === 1) {
          throw new Error('no metadata available');
        }
        return undefined;
      },
    };

    class ScriptedLayerService extends LayerCompatibilityService {
      async checkLayerConflicts() {
        return {
          hasConflicts: true,
          conflicts: [
            { type: 'layer_overlap' },
            { type: 'layer_overlap', conflictingItemId: 'item:nonexistent' },
            throwingConflict,
            fallbackConflict,
            unknownConflict,
          ],
        };
      }
    }

    layerService = new ScriptedLayerService({
      entityManager,
      logger,
    });
    orchestrator = new EquipmentOrchestrator({
      entityManager,
      logger,
      eventDispatcher,
      layerCompatibilityService: layerService,
    });

    const result = await orchestrator.orchestrateEquipment({
      entityId: actorId,
      clothingItemId: 'item:newHelm',
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual([
      'Cannot resolve conflict: No item specified for layer_overlap conflict',
      "Failed to remove conflicting item 'item:nonexistent'",
      "Error removing conflicting item 'item:temperamental': conflict data unavailable",
      "Error removing conflicting item 'item:fallback': initial failure",
      "Error removing conflicting item 'unknown': no metadata available",
    ]);
  });

  it('reports failures when conflicts reference equipment data without entries', async () => {
    await addWearable('item:newCloak', {
      layer: 'outer',
      primarySlot: 'torso',
    });

    await entityManager.addComponent(actorId, 'clothing:equipment', {});

    class MissingEquipmentLayerService extends LayerCompatibilityService {
      async checkLayerConflicts() {
        return {
          hasConflicts: true,
          conflicts: [
            { type: 'layer_overlap', conflictingItemId: 'item:ghost' },
          ],
        };
      }
    }

    layerService = new MissingEquipmentLayerService({
      entityManager,
      logger,
    });
    orchestrator = new EquipmentOrchestrator({
      entityManager,
      logger,
      eventDispatcher,
      layerCompatibilityService: layerService,
    });

    const result = await orchestrator.orchestrateEquipment({
      entityId: actorId,
      clothingItemId: 'item:newCloak',
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual([
      "Failed to remove conflicting item 'item:ghost'",
    ]);
  });

  it('uses conflict details when layer requirements cannot be met automatically', async () => {
    await addWearable('item:detailedCloak', {
      layer: 'outer',
      primarySlot: 'torso',
    });

    class DetailedConflictLayerService extends LayerCompatibilityService {
      async checkLayerConflicts() {
        return {
          hasConflicts: true,
          conflicts: [
            {
              type: 'layer_requirement',
              requiredLayer: 'base',
              details: 'Base coverage required for insulation',
            },
          ],
        };
      }
    }

    layerService = new DetailedConflictLayerService({
      entityManager,
      logger,
    });
    orchestrator = new EquipmentOrchestrator({
      entityManager,
      logger,
      eventDispatcher,
      layerCompatibilityService: layerService,
    });

    const result = await orchestrator.orchestrateEquipment({
      entityId: actorId,
      clothingItemId: 'item:detailedCloak',
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual([
      'Cannot equip item: Base coverage required for insulation',
    ]);
  });

  it('falls back to the default layer requirement message when details are missing', async () => {
    await addWearable('item:detailFreeCloak', {
      layer: 'outer',
      primarySlot: 'torso',
    });

    class MissingDetailLayerService extends LayerCompatibilityService {
      async checkLayerConflicts() {
        return {
          hasConflicts: true,
          conflicts: [
            { type: 'layer_requirement', requiredLayer: 'base' },
          ],
        };
      }
    }

    layerService = new MissingDetailLayerService({
      entityManager,
      logger,
    });
    orchestrator = new EquipmentOrchestrator({
      entityManager,
      logger,
      eventDispatcher,
      layerCompatibilityService: layerService,
    });

    const result = await orchestrator.orchestrateEquipment({
      entityId: actorId,
      clothingItemId: 'item:detailFreeCloak',
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual([
      'Cannot equip item: Missing required base layer',
    ]);
  });

  it('returns an error when the layer service throws during equipment orchestration', async () => {
    await addWearable('item:buggyShirt', {
      layer: 'base',
      primarySlot: 'torso',
    });

    class ExplodingLayerService extends LayerCompatibilityService {
      async checkLayerConflicts() {
        throw new Error('Layer database unavailable');
      }
    }

    layerService = new ExplodingLayerService({
      entityManager,
      logger,
    });
    orchestrator = new EquipmentOrchestrator({
      entityManager,
      logger,
      eventDispatcher,
      layerCompatibilityService: layerService,
    });

    const result = await orchestrator.orchestrateEquipment({
      entityId: actorId,
      clothingItemId: 'item:buggyShirt',
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(['Layer database unavailable']);
    expect(logger.errorEntries.at(-1)).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('Error orchestrating equipment'),
      })
    );
  });

  it('propagates dispatcher failures during unequipment', async () => {
    await addWearable('item:shirt', {
      layer: 'base',
      primarySlot: 'torso',
    });

    await entityManager.addComponent(actorId, 'clothing:equipment', {
      equipped: { torso: { base: 'item:shirt' } },
    });

    class ThrowingDispatcher extends RecordingEventDispatcher {
      async dispatch() {
        throw new Error('Dispatch failure');
      }
    }

    eventDispatcher = new ThrowingDispatcher();
    orchestrator = new EquipmentOrchestrator({
      entityManager,
      logger,
      eventDispatcher,
      layerCompatibilityService: layerService,
    });

    const result = await orchestrator.orchestrateUnequipment({
      entityId: actorId,
      clothingItemId: 'item:shirt',
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(['Dispatch failure']);
    expect(logger.errorEntries.at(-1)).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('Error orchestrating unequipment'),
      })
    );
  });

  it('handles race conditions where equipment disappears before unequipment completes', async () => {
    class VanishingEntityManager extends SimpleEntityManager {
      constructor() {
        super();
        this.readCount = 0;
      }

      getComponentData(id, type) {
        const data = super.getComponentData(id, type);
        if (
          id === actorId &&
          type === 'clothing:equipment' &&
          data?.equipped &&
          this.readCount === 1
        ) {
          const cloned = JSON.parse(JSON.stringify(data));
          delete cloned.equipped.torso.base;
          super.addComponent(id, type, cloned);
          return cloned;
        }
        this.readCount += type === 'clothing:equipment' ? 1 : 0;
        return data;
      }
    }

    entityManager = new VanishingEntityManager();
    logger = new RecordingLogger();
    eventDispatcher = new RecordingEventDispatcher();
    layerService = new LayerCompatibilityService({
      entityManager,
      logger,
    });
    orchestrator = new EquipmentOrchestrator({
      entityManager,
      logger,
      eventDispatcher,
      layerCompatibilityService: layerService,
    });

    await entityManager.addComponent(actorId, 'clothing:equipment', {
      equipped: { torso: { base: 'item:shirt' } },
    });
    await entityManager.addComponent('item:shirt', 'clothing:wearable', {
      layer: 'base',
      equipmentSlots: { primary: 'torso' },
    });

    const result = await orchestrator.orchestrateUnequipment({
      entityId: actorId,
      clothingItemId: 'item:shirt',
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(['Item not found in equipment']);
  });

  it('returns validation errors when compatibility checks throw unexpectedly', async () => {
    await addWearable('item:compatibilityTest', {
      layer: 'base',
      primarySlot: 'torso',
    });

    class FailingLayerService extends LayerCompatibilityService {
      async checkLayerConflicts() {
        throw new Error('Compatibility cache corrupt');
      }
    }

    layerService = new FailingLayerService({
      entityManager,
      logger,
    });
    orchestrator = new EquipmentOrchestrator({
      entityManager,
      logger,
      eventDispatcher,
      layerCompatibilityService: layerService,
    });

    const result = await orchestrator.validateEquipmentCompatibility({
      entityId: actorId,
      clothingItemId: 'item:compatibilityTest',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['Compatibility cache corrupt']);
    expect(logger.errorEntries.at(-1)).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('Error validating compatibility'),
      })
    );
  });

  it('surfaces failures when entity manager rejects unequipment updates', async () => {
    class RejectingEntityManager extends SimpleEntityManager {
      async addComponent(id, type, data) {
        if (
          id === actorId &&
          type === 'clothing:equipment' &&
          data?.equipped &&
          !data.equipped.torso?.base
        ) {
          throw new Error('Update rejected');
        }
        return super.addComponent(id, type, data);
      }
    }

    entityManager = new RejectingEntityManager();
    logger = new RecordingLogger();
    eventDispatcher = new RecordingEventDispatcher();
    layerService = new LayerCompatibilityService({
      entityManager,
      logger,
    });
    orchestrator = new EquipmentOrchestrator({
      entityManager,
      logger,
      eventDispatcher,
      layerCompatibilityService: layerService,
    });

    await entityManager.addComponent(actorId, 'clothing:equipment', {
      equipped: { torso: { base: 'item:shirt' } },
    });
    await entityManager.addComponent('item:shirt', 'clothing:wearable', {
      layer: 'base',
      equipmentSlots: { primary: 'torso' },
    });

    const result = await orchestrator.orchestrateUnequipment({
      entityId: actorId,
      clothingItemId: 'item:shirt',
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(['Update rejected']);
  });
});
