/**
 * @file Test suite that proves the behavior of ResolveDirectionHandler.
 * @see tests/logic/operationHandlers/resolveDirectionHandler.test.js
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import ResolveDirectionHandler from '../../../../src/logic/operationHandlers/resolveDirectionHandler.js';

// --- Mocks ---

/**
 * Creates a mock ILogger.
 *
 * @returns {import('../../../../src/interfaces/coreServices.js').ILogger}
 */
const makeMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

/**
 * Creates a mock IWorldContext.
 *
 * @returns {{ getTargetLocationForDirection: jest.Mock }}
 */
const makeMockWorldContext = () => ({
  getTargetLocationForDirection: jest.fn(),
});

/**
 * Creates a mock ExecutionContext.
 *
 * @returns {{ evaluationContext: { context: object } }}
 */
const makeMockExecCtx = () => ({
  evaluationContext: {
    context: {},
  },
});

// --- Test Suite ---

describe('ResolveDirectionHandler', () => {
  let mockWorldContext;
  let mockLogger;
  let mockExecCtx;
  let handler;

  beforeEach(() => {
    mockLogger = makeMockLogger();
    mockWorldContext = makeMockWorldContext();
    mockExecCtx = makeMockExecCtx();
    handler = new ResolveDirectionHandler({
      worldContext: mockWorldContext,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // 1. Constructor Tests
  // -----------------------------------------------------------------------------
  describe('Constructor', () => {
    test('should throw an error if the worldContext dependency is missing', () => {
      expect(() => new ResolveDirectionHandler({ logger: mockLogger })).toThrow(
        'Missing required dependency: ResolveDirectionHandler: worldContext.'
      );
    });

    test('should throw an error if worldContext is invalid (missing getTargetLocationForDirection)', () => {
      const invalidContext = {};
      expect(
        () =>
          new ResolveDirectionHandler({
            worldContext: invalidContext,
            logger: mockLogger,
          })
      ).toThrow(
        "Invalid or missing method 'getTargetLocationForDirection' on dependency 'ResolveDirectionHandler: worldContext'."
      );
    });

    test('should initialize successfully with valid dependencies', () => {
      expect(
        () =>
          new ResolveDirectionHandler({
            logger: mockLogger,
            worldContext: mockWorldContext,
          })
      ).not.toThrow();
    });
  });

  // 2. Parameter Validation Tests
  // -----------------------------------------------------------------------------
  describe('Execute Parameter Validation', () => {
    test.each([
      ['null params', null],
      ['undefined params', undefined],
      ['params with no result_variable', {}],
      ['params with null result_variable', { result_variable: null }],
      ['params with non-string result_variable', { result_variable: 123 }],
      ['params with empty string result_variable', { result_variable: '' }],
      ['params with whitespace result_variable', { result_variable: '   ' }],
    ])('should log a warning and abort given %s', (caseName, params) => {
      handler.execute(params, mockExecCtx);

      if (params === null || params === undefined) {
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'ResolveDirectionHandler: RESOLVE_DIRECTION: params missing or invalid.',
          { params }
        );
      } else {
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'ResolveDirectionHandler: RESOLVE_DIRECTION: Invalid or missing "result_variable" parameter. Operation aborted.'
        );
      }
      expect(
        mockWorldContext.getTargetLocationForDirection
      ).not.toHaveBeenCalled();
      expect(mockExecCtx.evaluationContext.context).toEqual({});
    });

    test('should proceed if other parameters are missing but result_variable is valid', () => {
      // Arrange
      const params = { result_variable: 'destination' };
      mockWorldContext.getTargetLocationForDirection.mockReturnValue(
        'default_target'
      );

      // Act
      handler.execute(params, mockExecCtx);

      // Assert
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(
        mockWorldContext.getTargetLocationForDirection
      ).toHaveBeenCalledTimes(1);
      expect(
        mockWorldContext.getTargetLocationForDirection
      ).toHaveBeenCalledWith({
        current_location_id: undefined,
        direction_taken: undefined,
      });
      expect(mockExecCtx.evaluationContext.context.destination).toBe(
        'default_target'
      );
    });
  });

  // 3. Core Logic Tests
  // -----------------------------------------------------------------------------
  describe('Execute Core Logic', () => {
    test('should call getTargetLocationForDirection with correct parameters', () => {
      // Arrange
      const params = {
        current_location_id: 'room_a',
        direction: 'north',
        result_variable: 'target_room',
      };

      // Act
      handler.execute(params, mockExecCtx);

      // Assert
      expect(
        mockWorldContext.getTargetLocationForDirection
      ).toHaveBeenCalledTimes(1);
      expect(
        mockWorldContext.getTargetLocationForDirection
      ).toHaveBeenCalledWith({
        current_location_id: 'room_a',
        direction_taken: 'north',
      });
    });

    test('should store the resolved location in the specified result_variable', () => {
      // Arrange
      const params = {
        current_location_id: 'room_a',
        direction: 'east',
        result_variable: 'destination',
      };
      const expectedTarget = 'room_b';
      mockWorldContext.getTargetLocationForDirection.mockReturnValue(
        expectedTarget
      );

      // Act
      handler.execute(params, mockExecCtx);

      // Assert
      expect(mockExecCtx.evaluationContext.context.destination).toBe(
        expectedTarget
      );
    });

    test('should log the resolution details at debug level', () => {
      // Arrange
      const params = {
        current_location_id: 'room_c',
        direction: 'west',
        result_variable: 'next_loc',
      };
      const expectedTarget = 'room_d';
      mockWorldContext.getTargetLocationForDirection.mockReturnValue(
        expectedTarget
      );

      // Act
      handler.execute(params, mockExecCtx);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ResolveDirectionHandler: RESOLVE_DIRECTION → next_loc = room_d'
      );
    });

    test('should trim whitespace from the result_variable name', () => {
      // Arrange
      const params = {
        current_location_id: 'room_z',
        direction: 'down',
        result_variable: '  padded_var  ', // Note the whitespace
      };
      const expectedTarget = 'cellar';
      mockWorldContext.getTargetLocationForDirection.mockReturnValue(
        expectedTarget
      );

      // Act
      handler.execute(params, mockExecCtx);

      // Assert
      // Check that the property without spaces was set.
      expect(mockExecCtx.evaluationContext.context.padded_var).toBe(
        expectedTarget
      );
      // Check that the original padded key was not used.
      expect(mockExecCtx.evaluationContext.context).not.toHaveProperty(
        '  padded_var  '
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ResolveDirectionHandler: RESOLVE_DIRECTION → padded_var = cellar'
      );
    });
  });

  // 4. Edge Cases
  // -----------------------------------------------------------------------------
  describe('Execute Edge Cases', () => {
    test('should handle a null return from getTargetLocationForDirection', () => {
      // Arrange
      const params = {
        current_location_id: 'room_x',
        direction: 'south',
        result_variable: 'found_room',
      };
      mockWorldContext.getTargetLocationForDirection.mockReturnValue(null);

      // Act
      handler.execute(params, mockExecCtx);

      // Assert
      expect(mockExecCtx.evaluationContext.context.found_room).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ResolveDirectionHandler: RESOLVE_DIRECTION → found_room = null'
      );
    });

    test('should handle an undefined return from getTargetLocationForDirection', () => {
      // Arrange
      const params = {
        current_location_id: 'room_y',
        direction: 'up',
        result_variable: 'found_room',
      };
      mockWorldContext.getTargetLocationForDirection.mockReturnValue(undefined);

      // Act
      handler.execute(params, mockExecCtx);

      // Assert
      expect(mockExecCtx.evaluationContext.context.found_room).toBeUndefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ResolveDirectionHandler: RESOLVE_DIRECTION → found_room = undefined'
      );
    });
  });
});
