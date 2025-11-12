import { describe, it, expect, beforeEach } from '@jest/globals';
import AbstractPreconditionSimulator from '../../../src/goap/simulation/abstractPreconditionSimulator.js';
import NoOpLogger from '../../../src/logging/noOpLogger.js';

describe('AbstractPreconditionSimulator Integration', () => {
  let simulator;

  beforeEach(() => {
    simulator = new AbstractPreconditionSimulator({
      logger: new NoOpLogger()
    });
  });

  it('treats actors without inventory components as having unlimited capacity', () => {
    const worldState = {
      entities: {
        actor1: {
          components: {}
        },
        item1: {
          components: {
            'items:item': { weight: 5 }
          }
        }
      }
    };

    const result = simulator.simulate('hasInventoryCapacity', ['actor1', 'item1'], worldState);

    expect(result).toBe(true);
  });

  it('accounts for current inventory weight when checking capacity', () => {
    const worldState = {
      entities: {
        actor1: {
          components: {
            'items:inventory': {
              max_weight: 25,
              items: ['item_existing_heavy', 'item_existing_missing', 'item_existing_light']
            }
          }
        },
        item_existing_heavy: {
          components: {
            'items:item': { weight: 12 }
          }
        },
        item_existing_light: {
          components: {
            'items:item': { weight: 4 }
          }
        },
        // Intentionally omit the items:item component for item_existing_missing
        item_existing_missing: {
          components: {}
        },
        item_to_pick_up: {
          components: {
            'items:item': { weight: 10 }
          }
        }
      }
    };

    const result = simulator.simulate(
      'hasInventoryCapacity',
      ['actor1', 'item_to_pick_up'],
      worldState
    );

    expect(result).toBe(false);
  });
});
