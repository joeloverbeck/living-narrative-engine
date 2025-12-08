import { HasPartWithStatusEffectOperator } from '../../../../src/logic/operators/hasPartWithStatusEffectOperator.js';

describe('HasPartWithStatusEffectOperator', () => {
  let operator;
  let mockDependencies;
  let mockContext;

  beforeEach(() => {
    mockDependencies = {
      entityManager: {
        getComponentData: jest.fn(),
      },
      bodyGraphService: {
        hasPartWithStatusEffect: jest.fn(),
        buildAdjacencyCache: jest.fn(),
      },
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };
    operator = new HasPartWithStatusEffectOperator(mockDependencies);
    mockContext = {};
  });

  it('returns true when a matching status effect exists', () => {
    const bodyComponent = { root: 'root123' };
    mockDependencies.entityManager.getComponentData.mockReturnValue(
      bodyComponent
    );
    mockDependencies.bodyGraphService.hasPartWithStatusEffect.mockReturnValue(
      true
    );
    mockContext.actor = { id: 'actor123' };

    const result = operator.evaluate(
      ['actor', 'anatomy:bleeding', 'severity', { op: '===', value: 'minor' }],
      mockContext
    );

    expect(
      mockDependencies.bodyGraphService.buildAdjacencyCache
    ).toHaveBeenCalledWith('root123');
    expect(
      mockDependencies.bodyGraphService.hasPartWithStatusEffect
    ).toHaveBeenCalledWith(
      bodyComponent,
      'anatomy:bleeding',
      'severity',
      { op: '===', value: 'minor' },
      'actor123'
    );
    expect(result).toBe(true);
  });

  it('returns false for invalid component id', () => {
    mockContext.actor = { id: 'actor123' };
    mockDependencies.entityManager.getComponentData.mockReturnValue({
      root: 'root123',
    });

    const result = operator.evaluate(['actor', null], mockContext);

    expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
      'hasPartWithStatusEffect: Invalid componentId parameter'
    );
    expect(result).toBe(false);
  });

  it('returns false when body component is missing', () => {
    mockContext.actor = { id: 'actor123' };
    mockDependencies.entityManager.getComponentData.mockReturnValue(null);

    const result = operator.evaluate(
      ['actor', 'anatomy:bleeding', 'severity', { op: '===', value: 'minor' }],
      mockContext
    );

    expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
      'hasPartWithStatusEffect: Entity actor123 has no anatomy:body component'
    );
    expect(result).toBe(false);
  });

  it('handles errors gracefully', () => {
    mockContext.actor = { id: 'actor123' };
    mockDependencies.entityManager.getComponentData.mockImplementation(() => {
      throw new Error('kaboom');
    });

    const result = operator.evaluate(['actor', 'anatomy:bleeding'], mockContext);

    expect(mockDependencies.logger.error).toHaveBeenCalledWith(
      'hasPartWithStatusEffect: Error during evaluation',
      expect.any(Error)
    );
    expect(result).toBe(false);
  });
});
