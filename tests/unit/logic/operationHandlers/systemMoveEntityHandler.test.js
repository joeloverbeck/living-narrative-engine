/**
 * @file Test suite for the SystemMoveEntityHandler.
 * @see tests/logic/operationHandlers/systemMoveEntityHandler.test.js
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import SystemMoveEntityHandler from '../../../../src/logic/operationHandlers/systemMoveEntityHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';
import { expectNoDispatch } from '../../../common/engine/dispatchTestUtils.js';

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
 * Creates a mock EntityManager.
 *
 * @returns {import('../../../../src/entities/entityManager.js').default}
 */
const makeMockEntityManager = () => ({
  getComponentData: jest.fn(),
  addComponent: jest.fn(),
});

/**
 * Creates a mock ISafeEventDispatcher.
 *
 * @returns {import('../../../../src/interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher}
 */
const makeMockSafeEventDispatcher = () => ({
  dispatch: jest.fn(),
});

/**
 * Creates a mock ExecutionContext.
 *
 * @param {object} [evalContext] - The evaluation context to set.
 * @returns {import('../../../../src/logic/defs.js').ExecutionContext}
 */
const makeMockExecCtx = (evalContext = {}) => ({
  evaluationContext: evalContext,
  logger: makeMockLogger(), // Give the context its own logger to spy on
});

// --- Test Suite ---

describe('SystemMoveEntityHandler', () => {
  let mockEntityManager;
  let mockSafeEventDispatcher;
  let mockLogger;
  let handler;

  beforeEach(() => {
    mockLogger = makeMockLogger();
    mockEntityManager = makeMockEntityManager();
    mockSafeEventDispatcher = makeMockSafeEventDispatcher();
    handler = new SystemMoveEntityHandler({
      entityManager: mockEntityManager,
      safeEventDispatcher: mockSafeEventDispatcher,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // 1. Parameter Validation Tests
  // -----------------------------------------------------------------------------
  describe('Execute: Parameter Validation', () => {
    test.each([
      ['missing entity_ref', { target_location_id: 'loc-b' }],
      ['missing target_location_id', { entity_ref: 'player' }],
      ['null entity_ref', { entity_ref: null, target_location_id: 'loc-b' }],
      [
        'null target_location_id',
        { entity_ref: 'player', target_location_id: null },
      ],
      ['empty params object', {}],
    ])('should log a warning and abort given %s', async (caseName, params) => {
      // Arrange
      const execCtx = makeMockExecCtx();

      // Act
      await handler.execute(params, execCtx);

      // Assert
      expect(execCtx.logger.warn).toHaveBeenCalledWith(
        'SYSTEM_MOVE_ENTITY: "entity_ref" and "target_location_id" are required.'
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
      expectNoDispatch(mockSafeEventDispatcher.dispatch);
    });
  });

  // 2. Entity Resolution Tests
  // -----------------------------------------------------------------------------
  describe('Execute: Entity Resolution', () => {
    const params = { entity_ref: 'some_ref', target_location_id: 'loc-b' };

    test('should fail if entity_ref resolves to null', async () => {
      // Arrange
      const execCtx = makeMockExecCtx();
      const invalidParams = { entity_ref: '', target_location_id: 'loc-b' };

      // Act
      await handler.execute(invalidParams, execCtx);

      // Assert
      expect(execCtx.logger.warn).toHaveBeenCalledWith(
        'SYSTEM_MOVE_ENTITY: Could not resolve entity_ref.',
        { entity_ref: '' }
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    test('should resolve entity_ref "actor" from execution context', async () => {
      // Arrange
      const execCtx = makeMockExecCtx({ actor: { id: 'actor-1' } });
      mockEntityManager.getComponentData.mockReturnValue(null); // Abort after resolution for this test

      // Act
      await handler.execute(
        { entity_ref: 'actor', target_location_id: 'loc-b' },
        execCtx
      );

      // Assert
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'actor-1',
        'core:position'
      );
    });

    test('should resolve entity_ref "target" from execution context', async () => {
      // Arrange
      const execCtx = makeMockExecCtx({ target: { id: 'target-1' } });
      mockEntityManager.getComponentData.mockReturnValue(null); // Abort

      // Act
      await handler.execute(
        { entity_ref: 'target', target_location_id: 'loc-b' },
        execCtx
      );

      // Assert
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'target-1',
        'core:position'
      );
    });

    test('should resolve entity_ref from a direct string ID', async () => {
      // Arrange
      const execCtx = makeMockExecCtx();
      mockEntityManager.getComponentData.mockReturnValue(null); // Abort

      // Act
      await handler.execute(
        { entity_ref: 'direct-id', target_location_id: 'loc-b' },
        execCtx
      );

      // Assert
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'direct-id',
        'core:position'
      );
    });

    test('should resolve entity_ref from an object { entityId: "..." }', async () => {
      // Arrange
      const execCtx = makeMockExecCtx();
      mockEntityManager.getComponentData.mockReturnValue(null); // Abort

      // Act
      await handler.execute(
        { entity_ref: { entityId: 'object-id' }, target_location_id: 'loc-b' },
        execCtx
      );

      // Assert
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'object-id',
        'core:position'
      );
    });
  });

  // 3. Core Logic Tests
  // -----------------------------------------------------------------------------
  describe('Execute: Core Logic', () => {
    const entityId = 'player';
    const fromLocationId = 'loc-a';
    const toLocationId = 'loc-b';
    const execCtx = makeMockExecCtx();
    const params = { entity_ref: entityId, target_location_id: toLocationId };

    test('should successfully move an entity and dispatch an event', async () => {
      // Arrange
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: fromLocationId,
      });
      mockEntityManager.addComponent.mockReturnValue(true); // Success

      // Act
      await handler.execute(params, execCtx);

      // Assert
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        entityId,
        'core:position'
      );
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        entityId,
        'core:position',
        { locationId: toLocationId }
      );
      expect(execCtx.logger.debug).toHaveBeenCalledWith(
        `SYSTEM_MOVE_ENTITY: Moved entity "${entityId}" from "${fromLocationId}" to "${toLocationId}".`
      );
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:entity_moved',
        {
          eventName: 'core:entity_moved',
          entityId: entityId,
          previousLocationId: fromLocationId,
          currentLocationId: toLocationId,
          direction: 'teleport',
          originalCommand: 'system:follow',
        }
      );
    });

    test('should abort if the entity is already in the target location', async () => {
      // Arrange
      const sameLocationParams = {
        entity_ref: entityId,
        target_location_id: fromLocationId,
      };
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: fromLocationId,
      });

      // Act
      await handler.execute(sameLocationParams, execCtx);

      // Assert
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        entityId,
        'core:position'
      );
      expect(execCtx.logger.debug).toHaveBeenCalledWith(
        `SYSTEM_MOVE_ENTITY: Entity "${entityId}" is already in location "${fromLocationId}". No move needed.`
      );
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
      expectNoDispatch(mockSafeEventDispatcher.dispatch);
    });

    test('should abort and warn if the entity has no core:position component', async () => {
      // Arrange
      mockEntityManager.getComponentData.mockReturnValue(null);

      // Act
      await handler.execute(params, execCtx);

      // Assert
      expect(execCtx.logger.warn).toHaveBeenCalledWith(
        `SYSTEM_MOVE_ENTITY: Entity "${entityId}" has no 'core:position' component. Cannot move.`
      );
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
      expectNoDispatch(mockSafeEventDispatcher.dispatch);
    });

    test('should abort and warn if addComponent reports failure', async () => {
      // Arrange
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: fromLocationId,
      });
      mockEntityManager.addComponent.mockReturnValue(false); // Failure

      // Act
      await handler.execute(params, execCtx);

      // Assert
      expect(execCtx.logger.warn).toHaveBeenCalledWith(
        `SYSTEM_MOVE_ENTITY: EntityManager reported failure for addComponent on entity "${entityId}".`
      );
      expectNoDispatch(mockSafeEventDispatcher.dispatch);
    });
  });

  // 4. Error Handling
  // -----------------------------------------------------------------------------
  describe('Execute: Error Handling', () => {
    test('should dispatch an error if getComponentData throws', async () => {
      // Arrange
      const error = new Error('Database connection lost');
      mockEntityManager.getComponentData.mockImplementation(() => {
        throw error;
      });
      const execCtx = makeMockExecCtx();
      const params = { entity_ref: 'player', target_location_id: 'loc-b' };

      // Act
      await handler.execute(params, execCtx);

      // Assert
      expect(execCtx.logger.error).not.toHaveBeenCalled();
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: `SYSTEM_MOVE_ENTITY: Failed to move entity "player". Error: ${error.message}`,
        })
      );
    });

    test('should dispatch an error if addComponent throws', async () => {
      // Arrange
      const error = new Error('Failed to write component');
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'loc-a',
      });
      mockEntityManager.addComponent.mockImplementation(() => {
        throw error;
      });
      const execCtx = makeMockExecCtx();
      const params = { entity_ref: 'player', target_location_id: 'loc-b' };

      // Act
      await handler.execute(params, execCtx);

      // Assert
      expect(execCtx.logger.error).not.toHaveBeenCalled();
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: `SYSTEM_MOVE_ENTITY: Failed to move entity "player". Error: ${error.message}`,
        })
      );
    });
  });
});
