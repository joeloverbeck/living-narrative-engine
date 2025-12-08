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
});
