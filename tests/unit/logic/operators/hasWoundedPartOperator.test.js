import { HasWoundedPartOperator } from '../../../../src/logic/operators/hasWoundedPartOperator.js';

describe('HasWoundedPartOperator', () => {
  let operator;
  let mockDependencies;
  let mockContext;

  beforeEach(() => {
    mockDependencies = {
      entityManager: {
        getComponentData: jest.fn(),
      },
      bodyGraphService: {
        hasWoundedPart: jest.fn(),
        buildAdjacencyCache: jest.fn(),
      },
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };
    operator = new HasWoundedPartOperator(mockDependencies);
    mockContext = {};
  });

  it('returns true when a wounded part is found', () => {
    const bodyComponent = { root: 'root123' };
    mockDependencies.entityManager.getComponentData.mockReturnValue(
      bodyComponent
    );
    mockDependencies.bodyGraphService.hasWoundedPart.mockReturnValue(true);
    mockContext.actor = { id: 'actor123' };

    const result = operator.evaluate(['actor', {}], mockContext);

    expect(
      mockDependencies.entityManager.getComponentData
    ).toHaveBeenCalledWith('actor123', 'anatomy:body');
    expect(
      mockDependencies.bodyGraphService.buildAdjacencyCache
    ).toHaveBeenCalledWith('root123');
    expect(
      mockDependencies.bodyGraphService.hasWoundedPart
    ).toHaveBeenCalledWith(bodyComponent, 'actor123');
    expect(result).toBe(true);
  });

  it('returns false when no wounds are present', () => {
    const bodyComponent = { body: { root: 'root456' } };
    mockDependencies.entityManager.getComponentData.mockReturnValue(
      bodyComponent
    );
    mockDependencies.bodyGraphService.hasWoundedPart.mockReturnValue(false);
    mockContext.target = { id: 'target789' };

    const result = operator.evaluate(['target', null], mockContext);

    expect(
      mockDependencies.bodyGraphService.hasWoundedPart
    ).toHaveBeenCalledWith(bodyComponent, 'target789');
    expect(result).toBe(false);
  });

  it('returns false when entity is missing', () => {
    mockContext.actor = null;

    const result = operator.evaluate(['actor', {}], mockContext);

    expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
      'hasWoundedPart: No entity found at path actor'
    );
    expect(result).toBe(false);
  });

  it('returns false with invalid parameters', () => {
    const result = operator.evaluate(['actor'], mockContext);

    expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
      'hasWoundedPart: Invalid parameters'
    );
    expect(result).toBe(false);
  });

  it('returns false when body component is missing', () => {
    mockContext.actor = { id: 'actor123' };
    mockDependencies.entityManager.getComponentData.mockReturnValue(null);

    const result = operator.evaluate(['actor', {}], mockContext);

    expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
      'hasWoundedPart: Entity actor123 has no anatomy:body component'
    );
    expect(result).toBe(false);
  });

  it('handles errors gracefully', () => {
    mockContext.actor = { id: 'actor123' };
    mockDependencies.entityManager.getComponentData.mockImplementation(() => {
      throw new Error('boom');
    });

    const result = operator.evaluate(['actor', {}], mockContext);

    expect(mockDependencies.logger.error).toHaveBeenCalledWith(
      'hasWoundedPart: Error during evaluation',
      expect.any(Error)
    );
    expect(result).toBe(false);
  });
});
