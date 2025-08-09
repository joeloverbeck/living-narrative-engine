import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ComponentMutationService from '../../../../src/entities/services/componentMutationService.js';
import {
  COMPONENT_ADDED_ID,
  COMPONENT_REMOVED_ID,
} from '../../../../src/constants/eventIds.js';
import { EntityNotFoundError } from '../../../../src/errors/entityNotFoundError.js';
import { ValidationError } from '../../../../src/errors/validationError.js';
import { ComponentOverrideNotFoundError } from '../../../../src/errors/componentOverrideNotFoundError.js';

const createService = ({ entity, monitoringCoordinator } = {}) => {
  const entityRepository = {
    get: jest.fn(() => entity),
    indexComponentAdd: jest.fn(),
    indexComponentRemove: jest.fn(),
  };
  const validator = { validate: jest.fn(() => ({ isValid: true })) };
  const logger = {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  };
  const eventDispatcher = { dispatch: jest.fn() };
  const cloner = jest.fn((d) => ({ ...d }));

  const service = new ComponentMutationService({
    entityRepository,
    validator,
    logger,
    eventDispatcher,
    cloner,
    monitoringCoordinator,
  });

  return {
    service,
    entityRepository,
    validator,
    logger,
    eventDispatcher,
    cloner,
    monitoringCoordinator,
  };
};

describe('ComponentMutationService.addComponent', () => {
  let entity;

  beforeEach(() => {
    entity = {
      addComponent: jest.fn(() => true),
      getComponentData: jest.fn(() => undefined),
      hasComponent: jest.fn(() => false),
    };
  });

  it('adds a component and emits event', () => {
    const { service, eventDispatcher, cloner } = createService({ entity });
    const data = { hp: 5 };

    service.addComponent('e1', 'core:health', data);

    expect(entity.addComponent).toHaveBeenCalledWith('core:health', { hp: 5 });
    expect(cloner).toHaveBeenCalled();
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(COMPONENT_ADDED_ID, {
      entity,
      componentTypeId: 'core:health',
      componentData: { hp: 5 },
      oldComponentData: undefined,
    });
  });

  it('throws EntityNotFoundError when entity missing', async () => {
    const { service, eventDispatcher } = createService({ entity: undefined });
    await expect(service.addComponent('missing', 'c', {})).rejects.toThrow(
      EntityNotFoundError
    );
    expect(eventDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('throws ValidationError when validation fails', async () => {
    const { service, validator } = createService({ entity });
    validator.validate.mockReturnValue({ isValid: false, errors: ['bad'] });
    await expect(service.addComponent('e1', 'c', {})).rejects.toThrow(
      ValidationError
    );
  });

  it('throws when entity update fails', async () => {
    entity.addComponent.mockReturnValue(false);
    const { service } = createService({ entity });
    await expect(service.addComponent('e1', 'c', {})).rejects.toThrow(
      "Failed to add component 'c' to entity 'e1'. Internal entity update failed."
    );
  });

  it('updates existing component and emits event with old data', async () => {
    const oldData = { hp: 3 };
    entity.hasComponent.mockReturnValue(true); // Existing component
    entity.getComponentData.mockReturnValue(oldData);
    const { service, eventDispatcher, entityRepository } = createService({
      entity,
    });
    const newData = { hp: 10 };

    await service.addComponent('e1', 'core:health', newData);

    expect(entity.addComponent).toHaveBeenCalledWith('core:health', newData);
    expect(entityRepository.indexComponentAdd).not.toHaveBeenCalled(); // No indexing for existing
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(COMPONENT_ADDED_ID, {
      entity,
      componentTypeId: 'core:health',
      componentData: newData,
      oldComponentData: oldData,
    });
  });
});

describe('ComponentMutationService.removeComponent', () => {
  let entity;

  beforeEach(() => {
    entity = {
      hasComponentOverride: jest.fn(() => true),
      removeComponent: jest.fn(() => true),
      getComponentData: jest.fn(() => ({ hp: 5 })),
      hasComponent: jest.fn(() => false), // Component completely removed after override removal
    };
  });

  it('successfully removes component override and emits event', async () => {
    const oldData = { hp: 5 };
    entity.getComponentData.mockReturnValue(oldData);
    const { service, eventDispatcher, entityRepository } = createService({
      entity,
    });

    await service.removeComponent('e1', 'core:health');

    expect(entity.hasComponentOverride).toHaveBeenCalledWith('core:health');
    expect(entity.removeComponent).toHaveBeenCalledWith('core:health');
    expect(entityRepository.indexComponentRemove).toHaveBeenCalledWith(
      'e1',
      'core:health'
    );
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      COMPONENT_REMOVED_ID,
      {
        entity,
        componentTypeId: 'core:health',
        oldComponentData: oldData,
      }
    );
  });

  it('removes override but does not update index if component still exists', async () => {
    entity.hasComponent.mockReturnValue(true); // Component still exists after override removal
    const { service, entityRepository } = createService({ entity });

    await service.removeComponent('e1', 'core:health');

    expect(entity.removeComponent).toHaveBeenCalledWith('core:health');
    expect(entityRepository.indexComponentRemove).not.toHaveBeenCalled();
  });

  it('throws EntityNotFoundError when entity not found', async () => {
    const { service } = createService({ entity: null });

    await expect(
      service.removeComponent('missing', 'core:health')
    ).rejects.toThrow(EntityNotFoundError);
  });

  it('throws ComponentOverrideNotFoundError when no override exists', async () => {
    entity.hasComponentOverride.mockReturnValue(false);
    const { service } = createService({ entity });

    await expect(service.removeComponent('e1', 'core:health')).rejects.toThrow(
      ComponentOverrideNotFoundError
    );
  });

  it('throws error when entity removeComponent fails', async () => {
    entity.removeComponent.mockReturnValue(false);
    const { service } = createService({ entity });

    await expect(service.removeComponent('e1', 'core:health')).rejects.toThrow(
      "Failed to remove component 'core:health' from entity 'e1'. Internal entity removal failed."
    );
  });
});

describe('ComponentMutationService.batchAddComponents', () => {
  let entity;

  beforeEach(() => {
    entity = {
      addComponent: jest.fn(() => true),
      getComponentData: jest.fn(() => undefined),
      hasComponent: jest.fn(() => false),
    };
  });

  it('successfully processes batch of components', async () => {
    const { service } = createService({ entity });
    const componentSpecs = [
      {
        instanceId: 'e1',
        componentTypeId: 'core:health',
        componentData: { hp: 10 },
      },
      {
        instanceId: 'e1',
        componentTypeId: 'core:position',
        componentData: { x: 5, y: 3 },
      },
    ];

    const result = await service.batchAddComponents(componentSpecs);

    expect(result.results).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.results[0].spec).toEqual(componentSpecs[0]);
    expect(result.results[0].result).toBe(true);
  });

  it('handles mixed success and failure scenarios', async () => {
    const { service, entityRepository } = createService();
    // First call succeeds (entity found), second call fails (entity not found)
    entityRepository.get.mockReturnValueOnce(entity).mockReturnValueOnce(null);

    const componentSpecs = [
      {
        instanceId: 'e1',
        componentTypeId: 'core:health',
        componentData: { hp: 10 },
      },
      {
        instanceId: 'missing',
        componentTypeId: 'core:position',
        componentData: { x: 5 },
      },
    ];

    const result = await service.batchAddComponents(componentSpecs);

    expect(result.results).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].spec).toEqual(componentSpecs[1]);
    expect(result.errors[0].error).toBeInstanceOf(EntityNotFoundError);
  });

  it('processes empty batch without errors', async () => {
    const { service } = createService({ entity });

    const result = await service.batchAddComponents([]);

    expect(result.results).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});

describe('ComponentMutationService - Monitoring Integration', () => {
  let entity, monitoringCoordinator;

  beforeEach(() => {
    entity = {
      addComponent: jest.fn(() => true),
      removeComponent: jest.fn(() => true),
      getComponentData: jest.fn(() => undefined),
      hasComponent: jest.fn(() => false),
      hasComponentOverride: jest.fn(() => true),
    };

    monitoringCoordinator = {
      executeMonitored: jest.fn((name, fn) => fn()),
      getCircuitBreaker: jest.fn(),
    };
  });

  it('uses monitoring for addComponent when coordinator provided', async () => {
    const { service } = createService({ entity, monitoringCoordinator });
    const data = { hp: 5 };

    await service.addComponent('e1', 'core:health', data);

    expect(monitoringCoordinator.executeMonitored).toHaveBeenCalledWith(
      'addComponent',
      expect.any(Function),
      {
        context: 'entity:e1,component:core:health',
        useCircuitBreaker: true,
      }
    );
  });

  it('uses monitoring for removeComponent when coordinator provided', async () => {
    const { service } = createService({ entity, monitoringCoordinator });

    await service.removeComponent('e1', 'core:health');

    expect(monitoringCoordinator.executeMonitored).toHaveBeenCalledWith(
      'removeComponent',
      expect.any(Function),
      {
        context: 'entity:e1,component:core:health',
        useCircuitBreaker: true,
      }
    );
  });

  it('validates MonitoringCoordinator dependency when provided', () => {
    const invalidMonitoringCoordinator = { badMethod: jest.fn() };

    expect(() => {
      createService({
        entity,
        monitoringCoordinator: invalidMonitoringCoordinator,
      });
    }).toThrow();
  });
});

describe('ComponentMutationService - Edge Cases', () => {
  let entity;

  beforeEach(() => {
    entity = {
      addComponent: jest.fn(() => true),
      getComponentData: jest.fn(() => undefined),
      hasComponent: jest.fn(() => false),
    };
  });

  it('handles undefined componentData correctly', async () => {
    const { service, cloner } = createService({ entity });

    await service.addComponent('e1', 'core:health', undefined);

    expect(cloner).not.toHaveBeenCalled();
    expect(entity.addComponent).toHaveBeenCalledWith('core:health', undefined);
  });

  it('validates component data and throws ValidationError on failure', async () => {
    const { service, validator } = createService({ entity });
    const validationErrors = [{ message: 'Invalid data' }];

    // Mock createValidateAndClone to throw validation error
    validator.validate.mockReturnValue({
      isValid: false,
      errors: validationErrors,
    });

    await expect(
      service.addComponent('e1', 'core:health', { invalid: 'data' })
    ).rejects.toThrow(ValidationError);
  });
});
