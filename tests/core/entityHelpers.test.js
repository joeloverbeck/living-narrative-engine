import { jest } from '@jest/globals';
import {
  getOrBuildComponents,
  createEvaluationContext,
} from '../../src/scopeDsl/core/entityHelpers.js';

describe('entityHelpers', () => {
  describe('getOrBuildComponents', () => {
    it('returns null when entity is not found', () => {
      const gateway = { getEntityInstance: jest.fn(() => null) };
      const result = getOrBuildComponents('missing', null, gateway);
      expect(result).toBeNull();
    });

    it('builds components when componentTypeIds are present', () => {
      const entity = {
        id: 'e1',
        componentTypeIds: ['core:name'],
        // This mocked helper ignores the id argument
        getComponentData: () => ({ value: 'Entity One' }),
      };
      const gateway = {
        getEntityInstance: jest.fn(() => entity),
        getComponentData: jest.fn(() => ({ value: 'Entity One' })),
      };
      const result = getOrBuildComponents('e1', null, gateway);
      expect(result).toEqual({ 'core:name': { value: 'Entity One' } });
    });

    it('returns empty object and logs when componentTypeIds missing', () => {
      const entity = { id: 'e2' };
      const gateway = { getEntityInstance: jest.fn(() => entity) };
      const trace = { addLog: jest.fn() };
      const result = getOrBuildComponents('e2', null, gateway, trace);
      expect(result).toEqual({});
      expect(trace.addLog).toHaveBeenCalledWith(
        'warn',
        "Entity 'e2' does not expose componentTypeIds. Unable to retrieve components.",
        'EntityHelpers',
        { entityId: 'e2' }
      );
    });
  });

  describe('createEvaluationContext', () => {
    it('builds context with entity and actor components', () => {
      const gateway = {
        getEntityInstance: jest.fn(() => ({
          id: 'e1',
          componentTypeIds: ['core:name'],
          getComponentData: () => ({ value: 'Entity One' }),
        })),
      };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };
      const actor = {
        id: 'actor1',
        componentTypeIds: ['core:actor'],
        getComponentData: () => ({ type: 'npc' }),
      };
      const ctx = createEvaluationContext(
        'e1',
        actor,
        gateway,
        locationProvider
      );
      expect(ctx.entity.components).toEqual({
        'core:name': { value: 'Entity One' },
      });
      expect(ctx.actor.components).toEqual({
        'core:actor': { type: 'npc' },
      });
      expect(ctx.location).toEqual({ id: 'loc1' });
    });
  });
});
