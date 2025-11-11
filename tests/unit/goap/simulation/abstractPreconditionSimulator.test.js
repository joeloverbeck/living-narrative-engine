import { describe, it, expect, beforeEach } from '@jest/globals';
import AbstractPreconditionSimulator from '../../../../src/goap/simulation/abstractPreconditionSimulator.js';

describe('AbstractPreconditionSimulator', () => {
  let simulator;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    simulator = new AbstractPreconditionSimulator({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should validate logger dependency', () => {
      expect(() => new AbstractPreconditionSimulator({ logger: null })).toThrow();
    });
  });

  describe('simulate - hasInventoryCapacity', () => {
    it('should return true when actor has capacity', () => {
      const worldState = {
        entities: {
          actor1: {
            components: {
              'items:inventory': {
                max_weight: 100,
                items: ['item1']
              }
            }
          },
          item1: {
            components: {
              'items:item': { weight: 10 }
            }
          },
          item2: {
            components: {
              'items:item': { weight: 20 }
            }
          }
        }
      };

      const result = simulator.simulate('hasInventoryCapacity', ['actor1', 'item2'], worldState);

      expect(result).toBe(true);
    });

    it('should return false when weight limit exceeded', () => {
      const worldState = {
        entities: {
          actor1: {
            components: {
              'items:inventory': {
                max_weight: 50,
                items: ['item1']
              }
            }
          },
          item1: {
            components: {
              'items:item': { weight: 40 }
            }
          },
          item2: {
            components: {
              'items:item': { weight: 20 }
            }
          }
        }
      };

      const result = simulator.simulate('hasInventoryCapacity', ['actor1', 'item2'], worldState);

      expect(result).toBe(false);
    });

    it('should return true when no inventory component (unlimited)', () => {
      const worldState = {
        entities: {
          actor1: {
            components: {}
          },
          item1: {
            components: {
              'items:item': { weight: 10 }
            }
          }
        }
      };

      const result = simulator.simulate('hasInventoryCapacity', ['actor1', 'item1'], worldState);

      expect(result).toBe(true);
    });

    it('should return false when item does not exist', () => {
      const worldState = {
        entities: {
          actor1: {
            components: {
              'items:inventory': { max_weight: 100, items: [] }
            }
          }
        }
      };

      const result = simulator.simulate('hasInventoryCapacity', ['actor1', 'nonexistent'], worldState);

      expect(result).toBe(false);
    });

    it('should handle items without weight', () => {
      const worldState = {
        entities: {
          actor1: {
            components: {
              'items:inventory': {
                max_weight: 100,
                items: []
              }
            }
          },
          item1: {
            components: {
              'items:item': {} // no weight property
            }
          }
        }
      };

      const result = simulator.simulate('hasInventoryCapacity', ['actor1', 'item1'], worldState);

      expect(result).toBe(true);
    });

    it('should handle inventory without max_weight (unlimited)', () => {
      const worldState = {
        entities: {
          actor1: {
            components: {
              'items:inventory': {
                items: ['item1']
              }
            }
          },
          item1: {
            components: {
              'items:item': { weight: 10 }
            }
          },
          item2: {
            components: {
              'items:item': { weight: 1000 }
            }
          }
        }
      };

      const result = simulator.simulate('hasInventoryCapacity', ['actor1', 'item2'], worldState);

      expect(result).toBe(true);
    });
  });

  describe('simulate - hasContainerCapacity', () => {
    it('should return true when container has capacity', () => {
      const worldState = {
        entities: {
          container1: {
            components: {
              'items:container': {
                max_capacity: 5,
                contents: ['item1', 'item2']
              }
            }
          },
          item3: {
            components: {
              'items:item': {}
            }
          }
        }
      };

      const result = simulator.simulate('hasContainerCapacity', ['container1', 'item3'], worldState);

      expect(result).toBe(true);
    });

    it('should return false when capacity limit reached', () => {
      const worldState = {
        entities: {
          container1: {
            components: {
              'items:container': {
                max_capacity: 3,
                contents: ['item1', 'item2', 'item3']
              }
            }
          },
          item4: {
            components: {
              'items:item': {}
            }
          }
        }
      };

      const result = simulator.simulate('hasContainerCapacity', ['container1', 'item4'], worldState);

      expect(result).toBe(false);
    });

    it('should return false when entity is not a container', () => {
      const worldState = {
        entities: {
          actor1: {
            components: {}
          },
          item1: {
            components: {
              'items:item': {}
            }
          }
        }
      };

      const result = simulator.simulate('hasContainerCapacity', ['actor1', 'item1'], worldState);

      expect(result).toBe(false);
    });

    it('should return false when item does not exist', () => {
      const worldState = {
        entities: {
          container1: {
            components: {
              'items:container': { max_capacity: 5, contents: [] }
            }
          }
        }
      };

      const result = simulator.simulate('hasContainerCapacity', ['container1', 'nonexistent'], worldState);

      expect(result).toBe(false);
    });

    it('should handle container without contents array', () => {
      const worldState = {
        entities: {
          container1: {
            components: {
              'items:container': {
                max_capacity: 5
              }
            }
          },
          item1: {
            components: {
              'items:item': {}
            }
          }
        }
      };

      const result = simulator.simulate('hasContainerCapacity', ['container1', 'item1'], worldState);

      expect(result).toBe(true);
    });

    it('should handle container without max_capacity (unlimited)', () => {
      const worldState = {
        entities: {
          container1: {
            components: {
              'items:container': {
                contents: ['item1', 'item2', 'item3', 'item4', 'item5']
              }
            }
          },
          item6: {
            components: {
              'items:item': {}
            }
          }
        }
      };

      const result = simulator.simulate('hasContainerCapacity', ['container1', 'item6'], worldState);

      expect(result).toBe(true);
    });
  });

  describe('simulate - hasComponent', () => {
    it('should return true when entity has component', () => {
      const worldState = {
        entities: {
          entity1: {
            components: {
              'test:component': { value: 42 }
            }
          }
        }
      };

      const result = simulator.simulate('hasComponent', ['entity1', 'test:component'], worldState);

      expect(result).toBe(true);
    });

    it('should return false when entity does not have component', () => {
      const worldState = {
        entities: {
          entity1: {
            components: {}
          }
        }
      };

      const result = simulator.simulate('hasComponent', ['entity1', 'test:component'], worldState);

      expect(result).toBe(false);
    });

    it('should return false when entity does not exist', () => {
      const worldState = {
        entities: {}
      };

      const result = simulator.simulate('hasComponent', ['nonexistent', 'test:component'], worldState);

      expect(result).toBe(false);
    });

    it('should return false when entity has no components', () => {
      const worldState = {
        entities: {
          entity1: {}
        }
      };

      const result = simulator.simulate('hasComponent', ['entity1', 'test:component'], worldState);

      expect(result).toBe(false);
    });
  });

  describe('simulate - unknown function', () => {
    it('should warn and return false for unknown simulator function', () => {
      const worldState = { entities: {} };

      const result = simulator.simulate('unknownFunction', ['param1'], worldState);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No simulator for abstract function: unknownFunction'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty worldState', () => {
      const worldState = {};

      const result = simulator.simulate('hasComponent', ['entity1', 'test:component'], worldState);

      expect(result).toBe(false);
    });

    it('should handle null worldState entities', () => {
      const worldState = { entities: null };

      const result = simulator.simulate('hasComponent', ['entity1', 'test:component'], worldState);

      expect(result).toBe(false);
    });

    it('should handle complex inventory calculations', () => {
      const worldState = {
        entities: {
          actor1: {
            components: {
              'items:inventory': {
                max_weight: 100,
                items: ['item1', 'item2', 'item3']
              }
            }
          },
          item1: {
            components: {
              'items:item': { weight: 25 }
            }
          },
          item2: {
            components: {
              'items:item': { weight: 30 }
            }
          },
          item3: {
            components: {
              'items:item': { weight: 15 }
            }
          },
          item4: {
            components: {
              'items:item': { weight: 35 }
            }
          }
        }
      };

      // Current weight: 25 + 30 + 15 = 70
      // Adding item4 (35): 70 + 35 = 105 > 100
      const result = simulator.simulate('hasInventoryCapacity', ['actor1', 'item4'], worldState);

      expect(result).toBe(false);
    });

    it('should handle inventory with exact capacity', () => {
      const worldState = {
        entities: {
          actor1: {
            components: {
              'items:inventory': {
                max_weight: 100,
                items: ['item1']
              }
            }
          },
          item1: {
            components: {
              'items:item': { weight: 70 }
            }
          },
          item2: {
            components: {
              'items:item': { weight: 30 }
            }
          }
        }
      };

      // Current: 70, adding 30 = exactly 100
      const result = simulator.simulate('hasInventoryCapacity', ['actor1', 'item2'], worldState);

      expect(result).toBe(true);
    });
  });
});
