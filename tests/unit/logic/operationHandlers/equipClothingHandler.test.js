/**
 * @file Unit tests for EquipClothingHandler
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import EquipClothingHandler from '../../../../src/logic/operationHandlers/equipClothingHandler.js';

describe('EquipClothingHandler', () => {
  let handler;
  let mockEntityManager;
  let mockEquipmentOrchestrator;
  let mockLogger;
  let mockDispatcher;
  let executionContext;

  beforeEach(() => {
    let equipmentState = {
      equipped: {
        torso: { outer: 'cape1' },
      },
    };
    let inventoryState = {
      items: ['coat1', 'apple'],
    };

    mockEntityManager = {
      hasComponent: jest.fn((entityId, componentId) => {
        if (componentId === 'clothing:equipment') return true;
        if (componentId === 'inventory:inventory') return true;
        if (componentId === 'core:inventory') return false;
        if (componentId === 'core:position') return true;
        return false;
      }),
      getComponentData: jest.fn((_, componentId) => {
        if (componentId === 'clothing:equipment') return equipmentState;
        if (componentId === 'inventory:inventory') return inventoryState;
        if (componentId === 'core:position')
          return { locationId: 'room_001' };
        return undefined;
      }),
      addComponent: jest.fn((_, componentId, data) => {
        if (componentId === 'inventory:inventory') {
          inventoryState = data;
        }
        if (componentId === 'clothing:equipment') {
          equipmentState = data;
        }
      }),
    };

    mockEquipmentOrchestrator = {
      orchestrateEquipment: jest.fn(async () => {
        // Simulate the orchestrator swapping the equipped item
        const newEquipment = {
          equipped: {
            torso: { outer: 'coat1' },
          },
        };
        mockEntityManager.addComponent(
          executionContext.evaluationContext.actor.id,
          'clothing:equipment',
          newEquipment
        );
        return { success: true, previousItem: 'cape1' };
      }),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    mockDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };

    handler = new EquipClothingHandler({
      entityManager: mockEntityManager,
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
      equipmentOrchestrator: mockEquipmentOrchestrator,
    });

    executionContext = {
      evaluationContext: {
        actor: { id: 'actor-1' },
        target: { id: 'coat1' },
        context: {},
      },
      ruleId: 'test-rule',
      logger: mockLogger,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('equips clothing, removes it from inventory, and stores success flag', async () => {
    const params = {
      entity_ref: 'actor',
      clothing_item_id: 'coat1',
      result_variable: 'equipSuccess',
    };

    await handler.execute(params, executionContext);

    expect(mockEquipmentOrchestrator.orchestrateEquipment).toHaveBeenCalledWith(
      {
        entityId: 'actor-1',
        clothingItemId: 'coat1',
      }
    );

    // Item was removed from inventory and displaced conflict was added back
    const inventory = mockEntityManager.getComponentData(
      'actor-1',
      'inventory:inventory'
    );
    expect(inventory.items).toContain('cape1');
    expect(inventory.items).not.toContain('coat1');

    expect(executionContext.evaluationContext.context.equipSuccess).toBe(true);
  });

  it('returns false when params are invalid', async () => {
    const params = {
      entity_ref: 'actor',
      clothing_item_id: '',
      result_variable: 'equipSuccess',
    };

    await handler.execute(params, executionContext);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'EQUIP_CLOTHING: clothing_item_id must be a non-empty string',
      { clothing_item_id: '' }
    );
    expect(mockEquipmentOrchestrator.orchestrateEquipment).not.toHaveBeenCalled();
    expect(executionContext.evaluationContext.context.equipSuccess).toBe(false);
  });

  it('returns false when destination is invalid', async () => {
    const params = {
      entity_ref: 'actor',
      clothing_item_id: 'coat1',
      destination: 'stash',
      result_variable: 'equipSuccess',
    };

    await handler.execute(params, executionContext);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'EQUIP_CLOTHING: Invalid destination "stash". Must be "inventory" or "ground"',
      { destination: 'stash' }
    );
    expect(mockEquipmentOrchestrator.orchestrateEquipment).not.toHaveBeenCalled();
    expect(executionContext.evaluationContext.context.equipSuccess).toBe(false);
  });

  it('returns false when clothing:equipment is missing', async () => {
    mockEntityManager.hasComponent = jest.fn((entityId, componentId) => {
      if (componentId === 'clothing:equipment') return false;
      if (componentId === 'inventory:inventory') return true;
      if (componentId === 'core:inventory') return false;
      if (componentId === 'core:position') return true;
      return false;
    });

    const params = {
      entity_ref: 'actor',
      clothing_item_id: 'coat1',
      result_variable: 'equipSuccess',
    };

    await handler.execute(params, executionContext);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'EQUIP_CLOTHING: Entity "actor-1" does not have clothing:equipment component'
    );
    expect(mockEquipmentOrchestrator.orchestrateEquipment).not.toHaveBeenCalled();
    expect(executionContext.evaluationContext.context.equipSuccess).toBe(false);
  });

  it('places displaced items on the ground when destination is ground and inventory is absent', async () => {
    mockEntityManager.hasComponent = jest.fn((entityId, componentId) => {
      if (componentId === 'clothing:equipment') return true;
      if (componentId === 'inventory:inventory') return false;
      if (componentId === 'core:inventory') return false;
      if (componentId === 'core:position') return true;
      return false;
    });

    let equipmentState = {
      equipped: { torso: { outer: 'cape1' } },
    };
    mockEntityManager.getComponentData = jest.fn((_, componentId) => {
      if (componentId === 'clothing:equipment') return equipmentState;
      if (componentId === 'core:position')
        return { locationId: 'room_002' };
      return undefined;
    });
    mockEntityManager.addComponent = jest.fn((entityId, componentId, data) => {
      if (componentId === 'clothing:equipment') {
        equipmentState = data;
      }
    });

    mockEquipmentOrchestrator.orchestrateEquipment.mockImplementationOnce(
      async () => {
        equipmentState = { equipped: { torso: { outer: 'coat1' } } };
        return { success: true, previousItem: 'cape1' };
      }
    );

    const params = {
      entity_ref: 'actor',
      clothing_item_id: 'coat1',
      destination: 'ground',
      result_variable: 'equipSuccess',
    };

    await handler.execute(params, executionContext);

    expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
      'cape1',
      'core:position',
      { locationId: 'room_002' }
    );
    expect(executionContext.evaluationContext.context.equipSuccess).toBe(true);
  });

  it('returns false when equipment fails', async () => {
    mockEquipmentOrchestrator.orchestrateEquipment.mockResolvedValueOnce({
      success: false,
      errors: ['boom'],
    });

    const params = {
      entity_ref: 'actor',
      clothing_item_id: 'coat1',
      result_variable: 'equipSuccess',
    };

    await handler.execute(params, executionContext);

    expect(executionContext.evaluationContext.context.equipSuccess).toBe(false);
    expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
  });

  it('dispatches an error and leaves state unchanged when orchestration throws', async () => {
    mockEquipmentOrchestrator.orchestrateEquipment.mockImplementationOnce(() => {
      throw new Error('orchestrator failure');
    });

    const params = {
      entity_ref: 'actor',
      clothing_item_id: 'coat1',
      result_variable: 'equipSuccess',
    };

    await handler.execute(params, executionContext);

    expect(mockDispatcher.dispatch).toHaveBeenCalled();
    expect(mockEquipmentOrchestrator.orchestrateEquipment).toHaveBeenCalledTimes(1);
    expect(executionContext.evaluationContext.context.equipSuccess).toBe(false);
    expect(mockEntityManager.getComponentData('actor-1', 'clothing:equipment')).toEqual({
      equipped: { torso: { outer: 'cape1' } },
    });
    expect(mockEntityManager.getComponentData('actor-1', 'inventory:inventory')).toEqual({
      items: ['coat1', 'apple'],
    });
  });

  it('returns early when params is null', async () => {
    await handler.execute(null, executionContext);

    expect(mockEquipmentOrchestrator.orchestrateEquipment).not.toHaveBeenCalled();
  });

  it('returns early when params is undefined', async () => {
    await handler.execute(undefined, executionContext);

    expect(mockEquipmentOrchestrator.orchestrateEquipment).not.toHaveBeenCalled();
  });

  it('returns false when entity_ref is invalid object', async () => {
    const params = {
      entity_ref: { invalid: 'object' },
      clothing_item_id: 'coat1',
      result_variable: 'equipSuccess',
    };

    await handler.execute(params, executionContext);

    expect(mockEquipmentOrchestrator.orchestrateEquipment).not.toHaveBeenCalled();
    expect(executionContext.evaluationContext.context.equipSuccess).toBe(false);
  });

  it('succeeds without writing result when result_variable is omitted', async () => {
    const params = {
      entity_ref: 'actor',
      clothing_item_id: 'coat1',
    };

    await handler.execute(params, executionContext);

    expect(mockEquipmentOrchestrator.orchestrateEquipment).toHaveBeenCalled();
    expect(executionContext.evaluationContext.context.equipSuccess).toBeUndefined();
  });

  it('handles equipment component without equipped property', async () => {
    let equipmentState = {};
    let inventoryState = { items: ['coat1', 'apple'] };

    mockEntityManager.getComponentData = jest.fn((_, componentId) => {
      if (componentId === 'clothing:equipment') return equipmentState;
      if (componentId === 'inventory:inventory') return inventoryState;
      if (componentId === 'core:position') return { locationId: 'room_001' };
      return undefined;
    });
    mockEntityManager.addComponent = jest.fn((_, componentId, data) => {
      if (componentId === 'inventory:inventory') {
        inventoryState = data;
      }
      if (componentId === 'clothing:equipment') {
        equipmentState = data;
      }
    });

    mockEquipmentOrchestrator.orchestrateEquipment.mockImplementationOnce(
      async () => {
        equipmentState = { equipped: { torso: { outer: 'coat1' } } };
        return { success: true };
      }
    );

    const params = {
      entity_ref: 'actor',
      clothing_item_id: 'coat1',
      result_variable: 'equipSuccess',
    };

    await handler.execute(params, executionContext);

    expect(mockEquipmentOrchestrator.orchestrateEquipment).toHaveBeenCalled();
    expect(executionContext.evaluationContext.context.equipSuccess).toBe(true);
  });

  it('handles inventory without items array during removal', async () => {
    let equipmentState = { equipped: { torso: { outer: 'cape1' } } };

    mockEntityManager.getComponentData = jest.fn((_, componentId) => {
      if (componentId === 'clothing:equipment') return equipmentState;
      if (componentId === 'inventory:inventory') return { items: null };
      if (componentId === 'core:position') return { locationId: 'room_001' };
      return undefined;
    });
    mockEntityManager.addComponent = jest.fn((_, componentId, data) => {
      if (componentId === 'clothing:equipment') {
        equipmentState = data;
      }
    });

    mockEquipmentOrchestrator.orchestrateEquipment.mockImplementationOnce(
      async () => {
        equipmentState = { equipped: { torso: { outer: 'coat1' } } };
        return { success: true };
      }
    );

    const params = {
      entity_ref: 'actor',
      clothing_item_id: 'coat1',
      result_variable: 'equipSuccess',
    };

    await handler.execute(params, executionContext);

    expect(mockEquipmentOrchestrator.orchestrateEquipment).toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('not found in inventories')
    );
    expect(executionContext.evaluationContext.context.equipSuccess).toBe(true);
  });

  it('handles item not present in inventory during removal', async () => {
    let equipmentState = { equipped: { torso: { outer: 'cape1' } } };
    let inventoryState = { items: ['apple', 'bread'] };

    mockEntityManager.getComponentData = jest.fn((_, componentId) => {
      if (componentId === 'clothing:equipment') return equipmentState;
      if (componentId === 'inventory:inventory') return inventoryState;
      if (componentId === 'core:position') return { locationId: 'room_001' };
      return undefined;
    });
    mockEntityManager.addComponent = jest.fn((_, componentId, data) => {
      if (componentId === 'inventory:inventory') {
        inventoryState = data;
      }
      if (componentId === 'clothing:equipment') {
        equipmentState = data;
      }
    });

    mockEquipmentOrchestrator.orchestrateEquipment.mockImplementationOnce(
      async () => {
        equipmentState = { equipped: { torso: { outer: 'coat1' } } };
        return { success: true };
      }
    );

    const params = {
      entity_ref: 'actor',
      clothing_item_id: 'coat1',
      result_variable: 'equipSuccess',
    };

    await handler.execute(params, executionContext);

    expect(mockEquipmentOrchestrator.orchestrateEquipment).toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('not found in inventories')
    );
    expect(executionContext.evaluationContext.context.equipSuccess).toBe(true);
  });

  it('falls back to ground when inventory has invalid items array for displaced item', async () => {
    let equipmentState = { equipped: { torso: { outer: 'cape1' } } };

    mockEntityManager.hasComponent = jest.fn((entityId, componentId) => {
      if (componentId === 'clothing:equipment') return true;
      if (componentId === 'inventory:inventory') return true;
      if (componentId === 'core:inventory') return false;
      if (componentId === 'core:position') return true;
      return false;
    });
    mockEntityManager.getComponentData = jest.fn((_, componentId) => {
      if (componentId === 'clothing:equipment') return equipmentState;
      if (componentId === 'inventory:inventory') return { items: 'not-an-array' };
      if (componentId === 'core:position') return { locationId: 'room_001' };
      return undefined;
    });
    mockEntityManager.addComponent = jest.fn((_, componentId, data) => {
      if (componentId === 'clothing:equipment') {
        equipmentState = data;
      }
    });

    mockEquipmentOrchestrator.orchestrateEquipment.mockImplementationOnce(
      async () => {
        equipmentState = { equipped: { torso: { outer: 'coat1' } } };
        return { success: true };
      }
    );

    const params = {
      entity_ref: 'actor',
      clothing_item_id: 'coat1',
      destination: 'inventory',
      result_variable: 'equipSuccess',
    };

    await handler.execute(params, executionContext);

    expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
      'cape1',
      'core:position',
      { locationId: 'room_001' }
    );
    expect(executionContext.evaluationContext.context.equipSuccess).toBe(true);
  });

  it('skips adding displaced item when already in inventory', async () => {
    let equipmentState = { equipped: { torso: { outer: 'cape1' } } };
    let inventoryState = { items: ['coat1', 'cape1', 'apple'] };

    mockEntityManager.getComponentData = jest.fn((_, componentId) => {
      if (componentId === 'clothing:equipment') return equipmentState;
      if (componentId === 'inventory:inventory') return inventoryState;
      if (componentId === 'core:position') return { locationId: 'room_001' };
      return undefined;
    });
    mockEntityManager.addComponent = jest.fn((_, componentId, data) => {
      if (componentId === 'inventory:inventory') {
        inventoryState = data;
      }
      if (componentId === 'clothing:equipment') {
        equipmentState = data;
      }
    });

    mockEquipmentOrchestrator.orchestrateEquipment.mockImplementationOnce(
      async () => {
        equipmentState = { equipped: { torso: { outer: 'coat1' } } };
        return { success: true };
      }
    );

    const params = {
      entity_ref: 'actor',
      clothing_item_id: 'coat1',
      destination: 'inventory',
      result_variable: 'equipSuccess',
    };

    await handler.execute(params, executionContext);

    expect(mockEquipmentOrchestrator.orchestrateEquipment).toHaveBeenCalled();
    const addInventoryCalls = mockEntityManager.addComponent.mock.calls.filter(
      ([, componentId]) => componentId === 'inventory:inventory'
    );
    const lastInventoryState = addInventoryCalls.length > 0
      ? addInventoryCalls[addInventoryCalls.length - 1][2]
      : inventoryState;
    expect(lastInventoryState.items.filter((id) => id === 'cape1').length).toBe(1);
    expect(executionContext.evaluationContext.context.equipSuccess).toBe(true);
  });

  it('logs warning when ground placement fails due to missing position', async () => {
    let equipmentState = { equipped: { torso: { outer: 'cape1' } } };

    mockEntityManager.hasComponent = jest.fn((entityId, componentId) => {
      if (componentId === 'clothing:equipment') return true;
      if (componentId === 'inventory:inventory') return false;
      if (componentId === 'core:inventory') return false;
      if (componentId === 'core:position') return true;
      return false;
    });
    mockEntityManager.getComponentData = jest.fn((_, componentId) => {
      if (componentId === 'clothing:equipment') return equipmentState;
      if (componentId === 'core:position') return {};
      return undefined;
    });
    mockEntityManager.addComponent = jest.fn((_, componentId, data) => {
      if (componentId === 'clothing:equipment') {
        equipmentState = data;
      }
    });

    mockEquipmentOrchestrator.orchestrateEquipment.mockImplementationOnce(
      async () => {
        equipmentState = { equipped: { torso: { outer: 'coat1' } } };
        return { success: true };
      }
    );

    const params = {
      entity_ref: 'actor',
      clothing_item_id: 'coat1',
      destination: 'ground',
      result_variable: 'equipSuccess',
    };

    await handler.execute(params, executionContext);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Unable to place')
    );
    expect(executionContext.evaluationContext.context.equipSuccess).toBe(true);
  });

  it('skips inventory removal when remove_from_inventory is false', async () => {
    let inventoryState = { items: ['coat1', 'apple'] };

    mockEntityManager.getComponentData = jest.fn((_, componentId) => {
      if (componentId === 'clothing:equipment')
        return { equipped: { torso: { outer: 'cape1' } } };
      if (componentId === 'inventory:inventory') return inventoryState;
      if (componentId === 'core:position') return { locationId: 'room_001' };
      return undefined;
    });

    mockEquipmentOrchestrator.orchestrateEquipment.mockImplementationOnce(
      async () => {
        return { success: true };
      }
    );

    const params = {
      entity_ref: 'actor',
      clothing_item_id: 'coat1',
      remove_from_inventory: false,
      result_variable: 'equipSuccess',
    };

    await handler.execute(params, executionContext);

    expect(mockEquipmentOrchestrator.orchestrateEquipment).toHaveBeenCalled();
    expect(inventoryState.items).toContain('coat1');
    expect(executionContext.evaluationContext.context.equipSuccess).toBe(true);
  });

  it('handles equipment slots with non-object values', async () => {
    let equipmentState = {
      equipped: {
        torso: 'just-a-string',
        head: null,
        feet: { outer: 123 },
      },
    };
    let inventoryState = { items: ['coat1', 'apple'] };

    mockEntityManager.getComponentData = jest.fn((_, componentId) => {
      if (componentId === 'clothing:equipment') return equipmentState;
      if (componentId === 'inventory:inventory') return inventoryState;
      if (componentId === 'core:position') return { locationId: 'room_001' };
      return undefined;
    });
    mockEntityManager.addComponent = jest.fn((_, componentId, data) => {
      if (componentId === 'inventory:inventory') {
        inventoryState = data;
      }
      if (componentId === 'clothing:equipment') {
        equipmentState = data;
      }
    });

    mockEquipmentOrchestrator.orchestrateEquipment.mockImplementationOnce(
      async () => {
        equipmentState = { equipped: { torso: { outer: 'coat1' } } };
        return { success: true };
      }
    );

    const params = {
      entity_ref: 'actor',
      clothing_item_id: 'coat1',
      result_variable: 'equipSuccess',
    };

    await handler.execute(params, executionContext);

    expect(mockEquipmentOrchestrator.orchestrateEquipment).toHaveBeenCalled();
    expect(executionContext.evaluationContext.context.equipSuccess).toBe(true);
  });
});
