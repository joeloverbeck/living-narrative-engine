import { describe, expect, it } from '@jest/globals';
import { LayerCompatibilityService } from '../../../src/clothing/validation/layerCompatibilityService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
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

class ThrowingEntityManager extends SimpleEntityManager {
  constructor(entities, options) {
    super(entities);
    this.throwOn = options?.throwOn ?? new Map();
  }

  getComponentData(id, type) {
    if (this.throwOn.has(type)) {
      throw this.throwOn.get(type);
    }
    return super.getComponentData(id, type);
  }
}

/**
 *
 * @param id
 * @param layer
 * @param primarySlot
 * @param extras
 */
function buildWearable(id, layer, primarySlot, extras = {}) {
  const wearable = {
    layer,
    equipmentSlots: { primary: primarySlot },
  };

  if (extras.secondarySlots) {
    wearable.equipmentSlots.secondary = extras.secondarySlots;
  }

  if (extras.additionalProps) {
    Object.assign(wearable, extras.additionalProps);
  }

  return {
    id,
    components: { 'clothing:wearable': wearable },
  };
}

/**
 *
 * @param root0
 * @param root0.equipment
 * @param root0.wearables
 * @param root0.entityManagerFactory
 */
function createServiceEnvironment({
  equipment,
  wearables = [],
  entityManagerFactory,
} = {}) {
  const actorId = 'entity:test';
  const baseEntity = {
    id: actorId,
    components: equipment
      ? { 'clothing:equipment': { equipped: equipment } }
      : {},
  };

  const entities = [baseEntity, ...wearables];
  const entityManager = entityManagerFactory
    ? entityManagerFactory(entities)
    : new SimpleEntityManager(entities);
  const logger = new RecordingLogger();
  const service = new LayerCompatibilityService({ entityManager, logger });

  return { actorId, entityManager, logger, service };
}

describe('LayerCompatibilityService integration', () => {
  it('returns no conflicts when the actor lacks equipment data', async () => {
    const wearable = buildWearable('item:new', 'base', 'torso');
    const { actorId, service } = createServiceEnvironment({
      wearables: [wearable],
    });

    const result = await service.checkLayerConflicts(
      actorId,
      'item:new',
      'base',
      'torso'
    );

    expect(result.hasConflicts).toBe(false);
    expect(result.conflicts).toEqual([]);
    expect(result.resolutionSuggestions).toBeUndefined();
  });

  it('throws an InvalidArgumentError when the item is not wearable', async () => {
    const { actorId, service, logger } = createServiceEnvironment({
      equipment: { torso: {} },
    });

    await expect(
      service.checkLayerConflicts(actorId, 'item:unknown', 'base', 'torso')
    ).rejects.toBeInstanceOf(InvalidArgumentError);
    expect(logger.errorEntries).toHaveLength(1);
    expect(logger.errorEntries[0].message).toContain(
      'Error checking layer conflicts'
    );
  });

  it('detects direct, requirement, and secondary slot conflicts for outer layers', async () => {
    const wearable = buildWearable('item:new', 'outer', 'torso', {
      secondarySlots: ['back'],
    });
    const { actorId, service } = createServiceEnvironment({
      equipment: {
        torso: { outer: 'item:cloak' },
        back: { outer: 'item:cape' },
      },
      wearables: [wearable],
    });

    const result = await service.checkLayerConflicts(
      actorId,
      'item:new',
      'outer',
      'torso'
    );

    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'layer_overlap',
          conflictingItemId: 'item:cloak',
        }),
        expect.objectContaining({
          type: 'layer_requirement',
          requiredLayer: 'base',
        }),
        expect.objectContaining({
          type: 'secondary_slot_conflict',
          slotId: 'back',
        }),
      ])
    );
    expect(result.resolutionSuggestions).toContain(
      "Remove 'item:cloak' from outer layer"
    );
  });

  it('allows equipping base layers when outer equipment depends on them', async () => {
    const baseWearable = buildWearable('item:shirt', 'base', 'torso');
    const outerWearable = buildWearable('item:coat', 'outer', 'torso');
    const { actorId, service } = createServiceEnvironment({
      equipment: {
        torso: { outer: 'item:coat' },
      },
      wearables: [baseWearable, outerWearable],
    });

    const result = await service.checkLayerConflicts(
      actorId,
      'item:shirt',
      'base',
      'torso'
    );

    expect(result.hasConflicts).toBe(false);
    expect(result.conflicts).toEqual([]);
  });

  it('reports no conflicts when layer requirements are met and slots are available', async () => {
    const wearable = buildWearable('item:new', 'outer', 'torso', {
      secondarySlots: ['back'],
    });
    const { actorId, service } = createServiceEnvironment({
      equipment: {
        torso: { base: 'item:shirt' },
        back: {},
      },
      wearables: [wearable, buildWearable('item:shirt', 'base', 'torso')],
    });

    const result = await service.checkLayerConflicts(
      actorId,
      'item:new',
      'outer',
      'torso'
    );

    expect(result.hasConflicts).toBe(false);
    expect(result.conflicts).toEqual([]);
    expect(result.resolutionSuggestions).toBeUndefined();
  });

  it('rethrows errors from the entity manager while logging them', async () => {
    const wearable = buildWearable('item:new', 'base', 'torso');
    const { actorId, service, logger } = createServiceEnvironment({
      wearables: [wearable],
      entityManagerFactory: (entities) =>
        new ThrowingEntityManager(entities, {
          throwOn: new Map([
            ['clothing:equipment', new Error('database offline')],
          ]),
        }),
    });

    await expect(
      service.checkLayerConflicts(actorId, 'item:new', 'base', 'torso')
    ).rejects.toThrow('database offline');
    expect(logger.errorEntries).toHaveLength(1);
    expect(logger.errorEntries[0].metadata.error).toBeInstanceOf(Error);
  });

  it('validates layer ordering rules and logs missing inner layers', async () => {
    const { actorId, service, logger } = createServiceEnvironment();

    await expect(
      service.validateLayerOrdering(actorId, 'mystery', {})
    ).resolves.toBe(false);
    expect(logger.warnEntries).toHaveLength(1);

    const isValid = await service.validateLayerOrdering(actorId, 'outer', {
      outer: 'item:coat',
    });
    expect(isValid).toBe(false);
    expect(logger.debugEntries[0].message).toContain(
      'Missing required inner layer'
    );

    const validResult = await service.validateLayerOrdering(actorId, 'outer', {
      base: 'item:shirt',
      outer: 'item:coat',
    });
    expect(validResult).toBe(true);
  });

  it('returns false from validateLayerOrdering when unexpected errors occur', async () => {
    const { actorId, service, logger } = createServiceEnvironment();
    const equipment = {};
    Object.defineProperty(equipment, 'base', {
      get() {
        throw new Error('access failure');
      },
    });

    const result = await service.validateLayerOrdering(
      actorId,
      'outer',
      equipment
    );

    expect(result).toBe(false);
    expect(logger.errorEntries[0].message).toContain(
      'Error validating layer ordering'
    );
  });

  it('identifies dependent items that require a removed base layer', async () => {
    const wearableBase = buildWearable('item:shirt', 'base', 'torso');
    const wearableOuter = buildWearable('item:coat', 'outer', 'torso');
    const { actorId, service } = createServiceEnvironment({
      equipment: {
        torso: { base: 'item:shirt', outer: 'item:coat' },
      },
      wearables: [wearableBase, wearableOuter],
    });

    const dependents = await service.findDependentItems(
      actorId,
      'torso',
      'base'
    );

    expect(dependents).toEqual(['item:coat']);
  });

  it('returns an empty array when no dependents exist or slot is missing', async () => {
    const wearable = buildWearable('item:shirt', 'base', 'torso');
    const { actorId, service } = createServiceEnvironment({
      equipment: { torso: { base: 'item:shirt' } },
      wearables: [wearable],
    });

    await expect(
      service.findDependentItems(actorId, 'legs', 'base')
    ).resolves.toEqual([]);
  });

  it('swallows errors while searching for dependent items and returns []', async () => {
    const wearable = buildWearable('item:shirt', 'base', 'torso');
    const { actorId, service, logger } = createServiceEnvironment({
      wearables: [wearable],
      entityManagerFactory: (entities) =>
        new ThrowingEntityManager(entities, {
          throwOn: new Map([
            ['clothing:equipment', new Error('lookup failure')],
          ]),
        }),
    });

    const dependents = await service.findDependentItems(
      actorId,
      'torso',
      'base'
    );

    expect(dependents).toEqual([]);
    expect(logger.errorEntries[0].message).toContain(
      'Error finding dependent items'
    );
  });

  it('prioritizes suggested resolutions based on conflict types', async () => {
    const { service } = createServiceEnvironment();

    const strategies = await service.suggestResolutions([
      {
        type: 'layer_overlap',
        conflictingItemId: 'item:cloak',
        layer: 'outer',
        severity: 'high',
      },
      {
        type: 'size_mismatch',
        conflictingItemId: 'item:boots',
      },
      {
        type: 'layer_requirement',
        requiredLayer: 'base',
      },
      {
        type: 'ordering_violation',
      },
      {
        type: 'unknown',
      },
    ]);

    expect(strategies.map((s) => s.type)).toEqual([
      'auto_remove',
      'equip_required',
      'reorder_layers',
      'size_adjust',
      'manual_review',
    ]);
    expect(strategies[0].priority).toBe(1);
    expect(strategies[strategies.length - 1].priority).toBe(4);
  });
});
