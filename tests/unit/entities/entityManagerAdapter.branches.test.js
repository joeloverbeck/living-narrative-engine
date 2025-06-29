import { describe, it, expect, jest } from '@jest/globals';
import { EntityManagerAdapter } from '../../../src/entities/entityManagerAdapter.js';

describe('EntityManagerAdapter additional coverage', () => {
  it('delegates various methods to the wrapped entity manager', () => {
    const entityManager = {
      getEntityInstance: jest.fn(() => 'e1'),
      createEntityInstance: jest.fn(() => 'e2'),
      reconstructEntity: jest.fn(() => 'e3'),
      getComponentData: jest.fn(() => 'e4'),
      hasComponent: jest.fn(() => true),
      hasComponentOverride: jest.fn(() => false),
      getEntitiesWithComponent: jest.fn(() => ['e5']),
      addComponent: jest.fn(() => 'added'),
      removeComponent: jest.fn(() => 'removed'),
      getEntityIds: jest.fn(() => ['id']),
      findEntities: jest.fn(() => ['found']),
      getAllComponentTypesForEntity: jest.fn(() => ['comp']),
    };
    const locationQueryService = {
      getEntitiesInLocation: jest.fn(() => new Set(['loc'])),
    };
    const adapter = new EntityManagerAdapter({
      entityManager,
      locationQueryService,
    });

    expect(adapter.getEntityInstance('id')).toBe('e1');
    expect(entityManager.getEntityInstance).toHaveBeenCalledWith('id');

    expect(adapter.createEntityInstance('def')).toBe('e2');
    expect(entityManager.createEntityInstance).toHaveBeenCalledWith('def', {});

    expect(adapter.reconstructEntity('data')).toBe('e3');
    expect(entityManager.reconstructEntity).toHaveBeenCalledWith('data');

    expect(adapter.getComponentData('id', 'comp')).toBe('e4');
    expect(entityManager.getComponentData).toHaveBeenCalledWith('id', 'comp');

    expect(adapter.hasComponent('id', 'comp')).toBe(true);
    expect(entityManager.hasComponent).toHaveBeenCalledWith('id', 'comp');

    expect(adapter.hasComponentOverride('id', 'comp')).toBe(false);
    expect(entityManager.hasComponentOverride).toHaveBeenCalledWith(
      'id',
      'comp'
    );

    expect(adapter.getEntitiesWithComponent('cType')).toEqual(['e5']);
    expect(entityManager.getEntitiesWithComponent).toHaveBeenCalledWith(
      'cType'
    );

    expect(adapter.addComponent('id', 'comp', 'data')).toBe('added');
    expect(entityManager.addComponent).toHaveBeenCalledWith(
      'id',
      'comp',
      'data'
    );

    expect(adapter.removeComponent('id', 'comp')).toBe('removed');
    expect(entityManager.removeComponent).toHaveBeenCalledWith('id', 'comp');

    expect(adapter.getEntityIds()).toEqual(['id']);
    expect(entityManager.getEntityIds).toHaveBeenCalled();

    expect(adapter.findEntities({})).toEqual(['found']);
    expect(entityManager.findEntities).toHaveBeenCalledWith({});

    expect(adapter.getAllComponentTypesForEntity('id')).toEqual(['comp']);
    expect(entityManager.getAllComponentTypesForEntity).toHaveBeenCalledWith(
      'id'
    );

    expect(adapter.getEntitiesInLocation('L')).toEqual(new Set(['loc']));
    expect(locationQueryService.getEntitiesInLocation).toHaveBeenCalledWith(
      'L'
    );
  });
});
