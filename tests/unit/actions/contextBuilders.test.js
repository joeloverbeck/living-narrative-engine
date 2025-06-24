import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  buildActorContext,
  buildEntityTargetContext,
} from '../../../src/actions/validation/contextBuilders.js';
import { ENTITY as TARGET_TYPE_ENTITY } from '../../../src/constants/actionTargetTypes.js';

// We mock the createComponentAccessor to isolate the context builders' logic.
jest.mock('../../../src/logic/componentAccessor.js', () => ({
  createComponentAccessor: jest.fn((id) => ({ accessorFor: id })),
}));

import { createComponentAccessor } from '../../../src/logic/componentAccessor.js';

const mockEntityManager = {
  getComponentData: jest.fn(),
};
const mockLogger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('contextBuilders', () => {
  describe('buildActorContext', () => {
    it('returns id and component accessor', () => {
      const result = buildActorContext('actor1', mockEntityManager, mockLogger);
      expect(result).toEqual({
        id: 'actor1',
        components: { accessorFor: 'actor1' },
      });
      expect(createComponentAccessor).toHaveBeenCalledWith(
        'actor1',
        mockEntityManager,
        mockLogger
      );
    });
  });

  describe('buildEntityTargetContext', () => {
    it('returns expected structure', () => {
      const result = buildEntityTargetContext(
        'target1',
        mockEntityManager,
        mockLogger
      );

      // FIX: The expectation is updated to match the new, leaner object structure.
      // The obsolete `direction`, `blocker`, and `exitDetails` properties have been removed.
      expect(result).toEqual({
        type: TARGET_TYPE_ENTITY,
        id: 'target1',
        components: { accessorFor: 'target1' },
      });
      expect(createComponentAccessor).toHaveBeenCalledWith(
        'target1',
        mockEntityManager,
        mockLogger
      );
    });
  });
});
