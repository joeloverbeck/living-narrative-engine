import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  buildActorContext,
  buildDirectionContext,
  buildEntityTargetContext,
  resolveDirectionExit,
} from '../../../src/actions/validation/contextBuilders.js';

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
      expect(result).toEqual({
        type: 'entity',
        id: 'target1',
        direction: null,
        components: { accessorFor: 'target1' },
        blocker: null,
        exitDetails: null,
      });
      expect(createComponentAccessor).toHaveBeenCalledWith(
        'target1',
        mockEntityManager,
        mockLogger
      );
    });
  });
});
