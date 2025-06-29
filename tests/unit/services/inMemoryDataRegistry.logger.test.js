import { describe, it, expect } from '@jest/globals';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';

describe('InMemoryDataRegistry logger usage', () => {
  it('uses provided logger for errors and warnings', () => {
    const mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
    };
    const registry = new InMemoryDataRegistry({ logger: mockLogger });

    // Trigger error via invalid store parameters
    registry.store('', 'id', {});
    expect(mockLogger.error).toHaveBeenCalledTimes(1);

    // Store a player definition without a valid locationId to trigger warn
    registry.store('entityDefinitions', 'player:1', {
      id: 'player:1',
      components: {
        'core:player': {},
        'core:position': { locationId: '' },
      },
    });
    registry.getStartingLocationId();
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
  });
});
