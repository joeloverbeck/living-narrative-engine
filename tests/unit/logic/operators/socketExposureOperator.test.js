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
    // evaluateInternal is called with localContext (clone with _currentPath set)
    expect(mockIsSocketCovered.evaluateInternal).toHaveBeenNthCalledWith(
      1,
      'actor-1',
      ['left_socket'],
      expect.objectContaining({ _currentPath: 'actor' })
    );
    expect(mockIsSocketCovered.evaluateInternal).toHaveBeenNthCalledWith(
      2,
      'actor-1',
      ['right_socket'],
      expect.objectContaining({ _currentPath: 'actor' })
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

  describe('edge cases for full coverage', () => {
    test('returns false and logs error when isSocketCoveredOperator is missing', () => {
      const operatorWithoutDep = new SocketExposureOperator({
        entityManager: mockEntityManager,
        logger: mockLogger,
        isSocketCoveredOperator: null,
      });

      const result = operatorWithoutDep.evaluate(['actor', ['socket1']], context);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Missing isSocketCoveredOperator')
      );
    });

    test('returns false and logs warning when sockets parameter is missing', () => {
      // evaluateInternal receives operatorParams which is params.slice(1)
      // To trigger lines 48-51, we need operatorParams to be empty []
      // The base class evaluate() already checks for params.length < 2
      // We need to call evaluateInternal directly to test lines 48-51
      const result = operator.evaluateInternal('actor-1', [], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Missing required parameter: sockets')
      );
    });

    test('logs warning and defaults to any mode when invalid mode is provided', () => {
      mockIsSocketCovered.evaluateInternal.mockReturnValue(false);

      const result = operator.evaluate(['actor', 'socket1', 'invalid_mode'], context);

      expect(result).toBe(true); // exposed socket returns true in 'any' mode
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Invalid mode 'invalid_mode'")
      );
    });

    test('returns correct default for empty socket array with invert=true', () => {
      const result = operator.evaluate(['actor', [], 'any', true], context);

      // When results.length === 0: return inverted ? !treatMissing : treatMissing
      // invert=true, treatMissingAsExposed=true (default) → !true = false
      expect(result).toBe(false);
    });

    test('returns correct default for empty socket array with invert=false', () => {
      const result = operator.evaluate(['actor', [], 'any', false], context);

      // invert=false, treatMissingAsExposed=true (default) → true
      expect(result).toBe(true);
    });

    test('logs warning for invalid socketId values like numbers', () => {
      mockIsSocketCovered.evaluateInternal.mockReturnValue(false);

      operator.evaluate(['actor', [123, 'valid_socket']], context);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Invalid socketId '123', treating as exposed")
      );
    });

    test('logs warning with "covered" message when treatMissingAsExposed is false', () => {
      mockIsSocketCovered.evaluateInternal.mockReturnValue(false);

      // Pass treatMissingAsExposed=false (5th param after actor, sockets, mode, invert)
      operator.evaluate(['actor', [123, 'valid_socket'], 'any', false, false], context);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Invalid socketId '123', treating as covered")
      );
    });

    test('inverts invalid socketId result when invert=true', () => {
      mockIsSocketCovered.evaluateInternal.mockReturnValue(false);

      // Invalid socketId with invert=true tests line 93 invert branch
      // treatMissingAsExposed=true (default), so exposed=true, inverted → !true = false
      const result = operator.evaluate(['actor', [123], 'any', true], context);

      expect(result).toBe(false);
    });

    test('logs warning for empty string socketId', () => {
      mockIsSocketCovered.evaluateInternal.mockReturnValue(false);

      operator.evaluate(['actor', ['', 'valid_socket']], context);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Invalid socketId ''")
      );
    });

    test('handles clearCache gracefully when underlying operator lacks method', () => {
      const operatorWithPartialDep = new SocketExposureOperator({
        entityManager: mockEntityManager,
        logger: mockLogger,
        isSocketCoveredOperator: { evaluateInternal: jest.fn() }, // no clearCache
      });

      expect(() => operatorWithPartialDep.clearCache('entity-1')).not.toThrow();
    });

    test('returns treatMissingAsExposed=false value for empty results with invert=true', () => {
      const result = operator.evaluate(['actor', [], 'any', true, false], context);

      // invert=true, treatMissingAsExposed=false → !false = true
      expect(result).toBe(true);
    });

    test('returns treatMissingAsExposed=false value for empty results with invert=false', () => {
      const result = operator.evaluate(['actor', [], 'any', false, false], context);

      // invert=false, treatMissingAsExposed=false → false
      expect(result).toBe(false);
    });
  });
});
