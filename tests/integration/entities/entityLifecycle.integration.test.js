import Entity from '../../../src/entities/entity.js';
import EntityInstanceData from '../../../src/entities/entityInstanceData.js';
import { createEntityInstance } from '../../common/entities/entityFactories.js';

describe('Entity integration with EntityInstanceData', () => {
  test('supports component lifecycle interactions using real instance data', () => {
    const instanceId = 'integration:entity_instance';
    const definitionId = 'integration:entity_definition';

    const baseComponents = {
      'core:name': { displayName: 'Integration Entity' },
      'core:stats': { attack: 5, defense: 2 },
    };

    const overrides = {
      'core:inventory': { slots: 2, capacity: 20 },
      'core:status': { active: true },
    };

    const entity = createEntityInstance({
      instanceId,
      definitionId,
      baseComponents,
      overrides,
    });

    expect(entity).toBeInstanceOf(Entity);
    expect(entity.instanceData).toBeInstanceOf(EntityInstanceData);

    expect(entity.id).toBe(instanceId);
    expect(entity.definitionId).toBe(definitionId);

    expect(entity.toString()).toBe(
      'Entity[' +
        `${instanceId} (Def: ${definitionId})] Components: core:name, core:stats, core:inventory, core:status`
    );

    expect(entity.componentTypeIds).toEqual([
      'core:name',
      'core:stats',
      'core:inventory',
      'core:status',
    ]);

    expect(entity.componentEntries).toEqual([
      ['core:name', { displayName: 'Integration Entity' }],
      ['core:stats', { attack: 5, defense: 2 }],
      ['core:inventory', { slots: 2, capacity: 20 }],
      ['core:status', { active: true }],
    ]);

    expect(entity.allComponentData).toEqual([
      { displayName: 'Integration Entity' },
      { attack: 5, defense: 2 },
      { slots: 2, capacity: 20 },
      { active: true },
    ]);

    expect(entity.getComponent('core:name')).toEqual({
      displayName: 'Integration Entity',
    });
    expect(entity.getComponent('core:name')).toEqual(
      entity.getComponentData('core:name')
    );

    expect(entity.getAllComponents()).toEqual({
      'core:name': { displayName: 'Integration Entity' },
      'core:stats': { attack: 5, defense: 2 },
      'core:inventory': { slots: 2, capacity: 20 },
      'core:status': { active: true },
    });
    expect(entity.components).toEqual(entity.getAllComponents());

    expect(entity.addComponent('core:affinity', { element: 'fire' })).toBe(
      true
    );
    expect(entity.getComponentData('core:affinity')).toEqual({
      element: 'fire',
    });

    expect(
      entity.modifyComponent('core:inventory', {
        slots: 3,
        contents: ['rope'],
      })
    ).toBe(true);
    expect(entity.getComponentData('core:inventory')).toEqual({
      slots: 3,
      capacity: 20,
      contents: ['rope'],
    });

    expect(
      entity.modifyComponent('core:stamina', {
        current: 10,
      })
    ).toBe(true);
    expect(entity.getComponentData('core:stamina')).toEqual({ current: 10 });

    expect(entity.removeComponent('core:status')).toBe(true);
    expect(entity.hasComponentOverride('core:status')).toBe(false);
    expect(entity.hasComponent('core:status')).toBe(false);
    expect(entity.getComponentData('core:status')).toBeUndefined();

    expect(entity.componentTypeIds).toEqual([
      'core:name',
      'core:stats',
      'core:inventory',
      'core:affinity',
      'core:stamina',
    ]);
    expect(entity.componentEntries).toEqual([
      ['core:name', { displayName: 'Integration Entity' }],
      ['core:stats', { attack: 5, defense: 2 }],
      ['core:inventory', { slots: 3, capacity: 20, contents: ['rope'] }],
      ['core:affinity', { element: 'fire' }],
      ['core:stamina', { current: 10 }],
    ]);
    expect(entity.getAllComponents()).toEqual({
      'core:name': { displayName: 'Integration Entity' },
      'core:stats': { attack: 5, defense: 2 },
      'core:inventory': { slots: 3, capacity: 20, contents: ['rope'] },
      'core:affinity': { element: 'fire' },
      'core:stamina': { current: 10 },
    });

    expect(() => entity.addComponent('  ', { value: true })).toThrow(
      `Invalid componentTypeId provided to addComponent for entity ${instanceId}. Expected non-empty string.`
    );
  });

  test('logs debug information for park bench component aggregation', () => {
    const consoleDebugSpy = jest.spyOn(console, 'debug');

    const benchEntity = createEntityInstance({
      instanceId: 'p_erotica:park_bench_instance',
      definitionId: 'p_erotica:park_bench',
      baseComponents: {
        'positioning:allows_sitting': { permitted: true },
        'environment:location': { area: 'plaza' },
      },
    });

    const componentTypeIds = benchEntity.componentTypeIds;

    expect(componentTypeIds).toEqual([
      'positioning:allows_sitting',
      'environment:location',
    ]);
    expect(consoleDebugSpy).toHaveBeenCalled();
    expect(consoleDebugSpy).toHaveBeenCalledWith(
      '[DEBUG] EntityDefinition created for park bench:',
      expect.objectContaining({
        id: 'p_erotica:park_bench',
        componentKeys: componentTypeIds,
        hasAllowsSitting: true,
      })
    );

    consoleDebugSpy.mockRestore();
  });

  test('throws when constructed without EntityInstanceData dependency', () => {
    expect(() => new Entity()).toThrow(
      'Entity must be initialized with an EntityInstanceData object.'
    );
    expect(() => new Entity({})).toThrow(
      'Entity must be initialized with an EntityInstanceData object.'
    );
  });
});
