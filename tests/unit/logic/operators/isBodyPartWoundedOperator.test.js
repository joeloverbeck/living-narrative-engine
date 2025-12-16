import { IsBodyPartWoundedOperator } from '../../../../src/logic/operators/isBodyPartWoundedOperator.js';

describe('IsBodyPartWoundedOperator', () => {
  let operator;
  let dependencies;
  let context;
  let partComponents;
  let throwForPartHealth;

  beforeEach(() => {
    partComponents = {};
    throwForPartHealth = false;

    dependencies = {
      entityManager: {
        getComponentData: jest.fn((entityId, componentId) => {
          if (entityId === 'actor-1' && componentId === 'anatomy:body') {
            return { root: 'root-1' };
          }

          if (entityId === 'part-1') {
            if (componentId === 'anatomy:part_health' && throwForPartHealth) {
              throw new Error('part health read failed');
            }
            return partComponents[componentId];
          }

          return null;
        }),
      },
      bodyGraphService: {
        buildAdjacencyCache: jest.fn(),
      },
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };

    operator = new IsBodyPartWoundedOperator(dependencies);
    context = { actor: { id: 'actor-1' } };
  });

  it('returns true when health is below max', () => {
    partComponents['anatomy:part_health'] = { currentHealth: 5, maxHealth: 10 };

    const result = operator.evaluate(['actor', 'part-1'], context);

    expect(result).toBe(true);
  });

  it('returns false when excludeVitalOrgans is true and part is vital', () => {
    partComponents['anatomy:part_health'] = { currentHealth: 5, maxHealth: 10 };
    partComponents['anatomy:vital_organ'] = { organType: 'heart' };

    const result = operator.evaluate(
      ['actor', 'part-1', { excludeVitalOrgans: true }],
      context
    );

    expect(result).toBe(false);
  });

  it('allows boolean shorthand to exclude vital organs', () => {
    partComponents['anatomy:part_health'] = { currentHealth: 5, maxHealth: 10 };
    partComponents['anatomy:vital_organ'] = { organType: 'heart' };

    const result = operator.evaluate(['actor', 'part-1', true], context);

    expect(result).toBe(false);
  });

  it('requires configured components when provided', () => {
    partComponents['anatomy:part_health'] = { currentHealth: 2, maxHealth: 8 };
    partComponents['anatomy:bleeding'] = { severity: 'minor' };

    const result = operator.evaluate(
      [
        'actor',
        'part-1',
        { requireComponents: ['anatomy:bleeding', 'anatomy:infection'] },
      ],
      context
    );

    expect(result).toBe(false);
  });

  it('falls back to part reference components when entityManager throws', () => {
    throwForPartHealth = true;

    const partRef = {
      id: 'part-1',
      components: {
        'anatomy:part_health': { currentHealth: 1, maxHealth: 5 },
        'anatomy:bleeding': { severity: 'moderate' },
      },
    };

    const result = operator.evaluate(
      ['actor', partRef, { requireComponents: ['anatomy:bleeding'] }],
      context
    );

    expect(result).toBe(true);
    expect(dependencies.logger.debug).toHaveBeenCalled();
  });

  it('returns false when parameters are invalid', () => {
    const result = operator.evaluate(['actor'], context);

    expect(result).toBe(false);
    expect(dependencies.logger.warn).toHaveBeenCalledWith(
      'isBodyPartWounded: Invalid parameters'
    );
  });

  // --- Invalid Part References (lines 44-47, 100) ---
  describe('Invalid Part References', () => {
    it('returns false when part reference is empty object', () => {
      const result = operator.evaluate(['actor', {}], context);

      expect(result).toBe(false);
      expect(dependencies.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid part reference')
      );
    });

    it('returns false when part reference is null', () => {
      const result = operator.evaluate(['actor', null], context);

      expect(result).toBe(false);
      expect(dependencies.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid part reference')
      );
    });

    it('returns false when part reference object lacks id and getComponentData', () => {
      const result = operator.evaluate(['actor', { foo: 'bar' }], context);

      expect(result).toBe(false);
      expect(dependencies.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid part reference')
      );
    });
  });

  // --- Health Not Below Max (line 54) ---
  describe('Health Comparison', () => {
    it('returns false when health equals max (full health)', () => {
      partComponents['anatomy:part_health'] = { currentHealth: 10, maxHealth: 10 };

      const result = operator.evaluate(['actor', 'part-1'], context);

      expect(result).toBe(false);
    });

    it('returns false when health exceeds max (over-healed)', () => {
      partComponents['anatomy:part_health'] = { currentHealth: 15, maxHealth: 10 };

      const result = operator.evaluate(['actor', 'part-1'], context);

      expect(result).toBe(false);
    });
  });

  // --- Complex Object Resolution (lines 86-96) ---
  describe('Complex Object Resolution', () => {
    it('resolves part ID from object with only _id property', () => {
      partComponents['anatomy:part_health'] = { currentHealth: 5, maxHealth: 10 };
      const partRef = {
        _id: 'part-1',
        getComponentData: jest.fn(),
      };

      const result = operator.evaluate(['actor', partRef], context);

      expect(result).toBe(true);
    });

    it('returns false when object has getComponentData but no id or _id', () => {
      const partRef = {
        getComponentData: jest.fn(),
      };

      const result = operator.evaluate(['actor', partRef], context);

      expect(result).toBe(false);
      expect(dependencies.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid part reference')
      );
    });

    it('resolves part ID from object with numeric id', () => {
      dependencies.entityManager.getComponentData = jest.fn(
        (entityId, componentId) => {
          if (entityId === 'actor-1' && componentId === 'anatomy:body') {
            return { root: 'root-1' };
          }
          if (entityId === 123) {
            return componentId === 'anatomy:part_health'
              ? { currentHealth: 5, maxHealth: 10 }
              : null;
          }
          return null;
        }
      );
      const partRef = { id: 123 };

      const result = operator.evaluate(['actor', partRef], context);

      expect(result).toBe(true);
    });

    it('resolves part ID from string reference', () => {
      partComponents['anatomy:part_health'] = { currentHealth: 3, maxHealth: 8 };

      const result = operator.evaluate(['actor', 'part-1'], context);

      expect(result).toBe(true);
    });

    it('resolves part ID from numeric reference', () => {
      dependencies.entityManager.getComponentData = jest.fn(
        (entityId, componentId) => {
          if (entityId === 'actor-1' && componentId === 'anatomy:body') {
            return { root: 'root-1' };
          }
          if (entityId === 456) {
            return componentId === 'anatomy:part_health'
              ? { currentHealth: 2, maxHealth: 6 }
              : null;
          }
          return null;
        }
      );

      const result = operator.evaluate(['actor', 456], context);

      expect(result).toBe(true);
    });
  });

  // --- Invalid Health Component (line 131) ---
  describe('Invalid Health Component', () => {
    it('returns false when health component is null', () => {
      partComponents['anatomy:part_health'] = null;

      const result = operator.evaluate(['actor', 'part-1'], context);

      expect(result).toBe(false);
    });

    it('returns false when health component is a primitive string', () => {
      partComponents['anatomy:part_health'] = 'invalid';

      const result = operator.evaluate(['actor', 'part-1'], context);

      expect(result).toBe(false);
    });

    it('returns false when health component is a number', () => {
      partComponents['anatomy:part_health'] = 42;

      const result = operator.evaluate(['actor', 'part-1'], context);

      expect(result).toBe(false);
    });
  });

  // --- Non-numeric Health Values (line 136) ---
  describe('Non-numeric Health Values', () => {
    it('returns false when currentHealth is not a number', () => {
      partComponents['anatomy:part_health'] = {
        currentHealth: 'five',
        maxHealth: 10,
      };

      const result = operator.evaluate(['actor', 'part-1'], context);

      expect(result).toBe(false);
    });

    it('returns false when maxHealth is not a number', () => {
      partComponents['anatomy:part_health'] = {
        currentHealth: 5,
        maxHealth: null,
      };

      const result = operator.evaluate(['actor', 'part-1'], context);

      expect(result).toBe(false);
    });

    it('returns false when currentHealth is undefined', () => {
      partComponents['anatomy:part_health'] = { maxHealth: 10 };

      const result = operator.evaluate(['actor', 'part-1'], context);

      expect(result).toBe(false);
    });

    it('returns false when maxHealth is undefined', () => {
      partComponents['anatomy:part_health'] = { currentHealth: 5 };

      const result = operator.evaluate(['actor', 'part-1'], context);

      expect(result).toBe(false);
    });
  });

  // --- Invalid maxHealth (line 140) ---
  describe('Invalid maxHealth', () => {
    it('returns false when maxHealth is zero', () => {
      partComponents['anatomy:part_health'] = { currentHealth: 0, maxHealth: 0 };

      const result = operator.evaluate(['actor', 'part-1'], context);

      expect(result).toBe(false);
    });

    it('returns false when maxHealth is negative', () => {
      partComponents['anatomy:part_health'] = {
        currentHealth: 5,
        maxHealth: -10,
      };

      const result = operator.evaluate(['actor', 'part-1'], context);

      expect(result).toBe(false);
    });
  });

  // --- Empty Object from EntityManager (line 153) ---
  describe('Empty Object Handling', () => {
    it('returns false when health component is empty object from entityManager', () => {
      partComponents['anatomy:part_health'] = {};

      const result = operator.evaluate(['actor', 'part-1'], context);

      expect(result).toBe(false);
    });

    it('returns false when components dictionary has empty object for health', () => {
      dependencies.entityManager.getComponentData = jest.fn(
        (entityId, componentId) => {
          if (entityId === 'actor-1' && componentId === 'anatomy:body') {
            return { root: 'root-1' };
          }
          return undefined;
        }
      );

      const partRef = {
        id: 'part-1',
        components: {
          'anatomy:part_health': {},
        },
      };

      const result = operator.evaluate(['actor', partRef], context);

      expect(result).toBe(false);
    });
  });

  // --- Fallback to partRef.getComponentData (lines 165-174) ---
  describe('Fallback to partRef.getComponentData', () => {
    it('falls back to partRef.getComponentData when entityManager returns undefined', () => {
      dependencies.entityManager.getComponentData = jest.fn(
        (entityId, componentId) => {
          if (entityId === 'actor-1' && componentId === 'anatomy:body') {
            return { root: 'root-1' };
          }
          return undefined;
        }
      );

      const partRef = {
        id: 'part-1',
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:part_health') {
            return { currentHealth: 3, maxHealth: 10 };
          }
          return undefined;
        }),
      };

      const result = operator.evaluate(['actor', partRef], context);

      expect(result).toBe(true);
      expect(partRef.getComponentData).toHaveBeenCalledWith(
        'anatomy:part_health'
      );
    });

    it('handles error from partRef.getComponentData gracefully', () => {
      dependencies.entityManager.getComponentData = jest.fn(
        (entityId, componentId) => {
          if (entityId === 'actor-1' && componentId === 'anatomy:body') {
            return { root: 'root-1' };
          }
          return undefined;
        }
      );

      const partRef = {
        id: 'part-1',
        getComponentData: jest.fn(() => {
          throw new Error('getComponentData failed');
        }),
        components: {
          'anatomy:part_health': { currentHealth: 2, maxHealth: 8 },
        },
      };

      const result = operator.evaluate(['actor', partRef], context);

      expect(result).toBe(true);
      expect(dependencies.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Failed to read'),
        expect.any(Error)
      );
    });

    it('returns false when partRef.getComponentData returns empty object', () => {
      dependencies.entityManager.getComponentData = jest.fn(
        (entityId, componentId) => {
          if (entityId === 'actor-1' && componentId === 'anatomy:body') {
            return { root: 'root-1' };
          }
          return undefined;
        }
      );

      const partRef = {
        id: 'part-1',
        getComponentData: jest.fn(() => ({})),
      };

      const result = operator.evaluate(['actor', partRef], context);

      expect(result).toBe(false);
    });

    it('returns false when all fallback methods fail to provide health', () => {
      dependencies.entityManager.getComponentData = jest.fn(
        (entityId, componentId) => {
          if (entityId === 'actor-1' && componentId === 'anatomy:body') {
            return { root: 'root-1' };
          }
          return undefined;
        }
      );

      const partRef = {
        id: 'part-1',
        getComponentData: jest.fn(() => undefined),
        components: {},
      };

      const result = operator.evaluate(['actor', partRef], context);

      expect(result).toBe(false);
    });
  });
});
