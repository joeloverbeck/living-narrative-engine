import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { buildActorContext } from '../../../src/actions/validation/contextBuilders.js';

// We mock the createComponentAccessor to isolate the context builders' logic.
jest.mock('../../../src/logic/componentAccessor.js', () => ({
  createComponentAccessor: jest.fn((id) => ({ accessorFor: id })),
}));

import { createComponentAccessor } from '../../../src/logic/componentAccessor.js';

const mockEntityManager = {
  getComponentData: jest.fn(),
};
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

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
});
