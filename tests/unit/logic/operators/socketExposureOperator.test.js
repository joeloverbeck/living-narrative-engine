import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { SocketExposureOperator } from '../../../../src/logic/operators/socketExposureOperator.js';

describe('SocketExposureOperator', () => {
  let operator;
  let context;
  let mockLogger;
  let mockEntityManager;
  let mockIsSocketCovered;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
    };

    mockIsSocketCovered = {
      evaluateInternal: jest.fn().mockReturnValue(false),
      clearCache: jest.fn(),
    };

    operator = new SocketExposureOperator({
      entityManager: mockEntityManager,
      logger: mockLogger,
      isSocketCoveredOperator: mockIsSocketCovered,
    });

    context = { actor: { id: 'actor-1' } };
  });

  test('returns true when any socket is exposed by default', () => {
    mockIsSocketCovered.evaluateInternal
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    const result = operator.evaluate(
      ['actor', ['left_socket', 'right_socket']],
      context
    );

    expect(result).toBe(true);
    expect(mockIsSocketCovered.evaluateInternal).toHaveBeenNthCalledWith(
      1,
      'actor-1',
      ['left_socket'],
      context
    );
    expect(mockIsSocketCovered.evaluateInternal).toHaveBeenNthCalledWith(
      2,
      'actor-1',
      ['right_socket'],
      context
    );
  });

  test('honors all mode to require every socket to be exposed', () => {
    mockIsSocketCovered.evaluateInternal
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    const result = operator.evaluate(
      ['actor', ['left_socket', 'right_socket'], 'all'],
      context
    );

    expect(result).toBe(false);
  });

  test('supports invert to check coverage instead of exposure', () => {
    mockIsSocketCovered.evaluateInternal.mockReturnValue(true);

    const result = operator.evaluate(['actor', 'torso_socket', 'any', true], context);

    expect(result).toBe(true);
  });

  test('treats missing sockets as exposed by default', () => {
    mockIsSocketCovered.evaluateInternal.mockReturnValue(false);

    const result = operator.evaluate(
      ['actor', [null, 'left_socket'], 'all'],
      context
    );

    expect(result).toBe(true);
    expect(mockIsSocketCovered.evaluateInternal).toHaveBeenCalledTimes(1);
  });

  test('respects treatMissingAsExposed=false', () => {
    const result = operator.evaluate(
      ['actor', undefined, 'any', false, false],
      context
    );

    expect(result).toBe(false);
    expect(mockIsSocketCovered.evaluateInternal).not.toHaveBeenCalled();
  });

  test('clears cache through the underlying coverage operator', () => {
    operator.clearCache('actor-1');

    expect(mockIsSocketCovered.clearCache).toHaveBeenCalledWith('actor-1');
  });
});
