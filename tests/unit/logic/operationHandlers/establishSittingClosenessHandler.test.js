/**
 * @file Unit tests for EstablishSittingClosenessHandler
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EstablishSittingClosenessHandler from '../../../../src/logic/operationHandlers/establishSittingClosenessHandler.js';
import * as proximityUtils from '../../../../src/utils/proximityUtils.js';
import * as movementUtils from '../../../../src/utils/movementUtils.js';
import * as contextVariableUtils from '../../../../src/utils/contextVariableUtils.js';
import * as evaluationContextUtils from '../../../../src/utils/evaluationContextUtils.js';
import { safeDispatchError } from '../../../../src/utils/safeDispatchErrorUtils.js';

// Mock dependencies
jest.mock('../../../../src/utils/proximityUtils.js');
jest.mock('../../../../src/utils/movementUtils.js', () => ({
  updateMovementLock: jest.fn(),
}));
jest.mock('../../../../src/utils/contextVariableUtils.js');
jest.mock('../../../../src/utils/evaluationContextUtils.js');
jest.mock('../../../../src/utils/safeDispatchErrorUtils.js');

describe('EstablishSittingClosenessHandler', () => {
  let handler;
  let mockLogger;
  let mockEntityManager;
  let mockDispatcher;
  let mockClosenessCircleService;
  let executionContext;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    // Setup mock entity manager
    mockEntityManager = {
      getComponentData: jest.fn(),
      addComponent: jest.fn(),
    };

    // Setup mock dispatcher
    mockDispatcher = {
      dispatch: jest.fn(),
    };

    // Setup mock closeness circle service
    mockClosenessCircleService = {
      merge: jest.fn(),
      repair: jest.fn(),
    };

    // Setup execution context
    executionContext = {
      evaluationContext: {
        context: {},
      },
    };

    // Create handler instance
    handler = new EstablishSittingClosenessHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockDispatcher,
      closenessCircleService: mockClosenessCircleService,
    });

    // Setup default mocks
    proximityUtils.validateProximityParameters.mockReturnValue(true);
    proximityUtils.findAdjacentOccupants.mockReturnValue([]);
    evaluationContextUtils.ensureEvaluationContext.mockReturnValue(true);
    contextVariableUtils.tryWriteContextVariable.mockReturnValue({ success: true });
  });

  describe('Parameter Validation', () => {
    it('should validate required parameters', async () => {
      const parameters = {
        furniture_id: 'couch:1',
        actor_id: 'alice',
        spot_index: 1,
      };

      mockEntityManager.getComponentData.mockReturnValue({
        spots: [null, 'alice', null],
      });

      await handler.execute(parameters, executionContext);

      expect(proximityUtils.validateProximityParameters).toHaveBeenCalledWith(
        'couch:1',
        'alice',
        1,
        expect.objectContaining({
          info: expect.any(Function),
          error: expect.any(Function),
        })
      );
    });

    it('should handle furniture without allows_sitting component', async () => {
      const parameters = {
        furniture_id: 'invalid:1',
        actor_id: 'alice',
        spot_index: 0,
      };

      mockEntityManager.getComponentData.mockReturnValue(null);

      await handler.execute(parameters, executionContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'EstablishSittingClosenessHandler: Failed to establish sitting closeness',
        expect.objectContaining({
          furnitureId: 'invalid:1',
          error: expect.stringContaining('does not have allows_sitting component'),
        })
      );
      expect(safeDispatchError).toHaveBeenCalled();
    });

    it('should store false result on validation failure', async () => {
      const parameters = {
        furniture_id: 'invalid:1',
        actor_id: 'alice',
        spot_index: 0,
        result_variable: 'result',
      };

      mockEntityManager.getComponentData.mockReturnValue(null);

      await handler.execute(parameters, executionContext);

      expect(contextVariableUtils.tryWriteContextVariable).toHaveBeenCalledWith(
        'result',
        false,
        executionContext,
        mockDispatcher,
        expect.objectContaining({
          info: expect.any(Function),
          error: expect.any(Function),
        })
      );
    });
  });

  describe('Adjacent Actor Detection', () => {
    it('should identify single adjacent actor correctly', async () => {
      const parameters = {
        furniture_id: 'couch:1',
        actor_id: 'bob',
        spot_index: 1,
      };

      const furnitureComponent = {
        spots: ['alice', null, null],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent) // First call for validation
        .mockReturnValueOnce(furnitureComponent) // Second call for adjacency
        .mockReturnValue(null); // For closeness components

      proximityUtils.findAdjacentOccupants.mockReturnValue(['alice']);
      mockClosenessCircleService.merge.mockReturnValue(['alice', 'bob']);

      await handler.execute(parameters, executionContext);

      expect(proximityUtils.findAdjacentOccupants).toHaveBeenCalledWith(
        furnitureComponent,
        1
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'EstablishSittingClosenessHandler: Sitting closeness established successfully',
        expect.objectContaining({
          adjacentActors: ['alice'],
        })
      );
    });

    it('should identify multiple adjacent actors for middle position', async () => {
      const parameters = {
        furniture_id: 'couch:1',
        actor_id: 'bob',
        spot_index: 1,
      };

      const furnitureComponent = {
        spots: ['alice', null, 'charlie'],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent) // First call for validation
        .mockReturnValueOnce(furnitureComponent) // Second call for adjacency
        .mockReturnValue(null); // For closeness components

      proximityUtils.findAdjacentOccupants.mockReturnValue(['alice', 'charlie']);
      mockClosenessCircleService.merge
        .mockReturnValueOnce(['alice', 'bob']) // First merge with alice
        .mockReturnValueOnce(['bob', 'charlie']); // Second merge with charlie

      await handler.execute(parameters, executionContext);

      expect(proximityUtils.findAdjacentOccupants).toHaveBeenCalledWith(
        furnitureComponent,
        1
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'EstablishSittingClosenessHandler: Sitting closeness established successfully',
        expect.objectContaining({
          adjacentActors: ['alice', 'charlie'],
        })
      );
    });

    it('should handle no adjacent actors gracefully', async () => {
      const parameters = {
        furniture_id: 'couch:1',
        actor_id: 'alice',
        spot_index: 1,
        result_variable: 'result',
      };

      const furnitureComponent = {
        spots: [null, null, null],
      };

      mockEntityManager.getComponentData.mockReturnValue(furnitureComponent);
      proximityUtils.findAdjacentOccupants.mockReturnValue([]);

      await handler.execute(parameters, executionContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'EstablishSittingClosenessHandler: No adjacent actors found for closeness establishment',
        expect.objectContaining({
          actorId: 'alice',
        })
      );
      expect(contextVariableUtils.tryWriteContextVariable).toHaveBeenCalledWith(
        'result',
        false, // No closeness established returns false
        executionContext,
        mockDispatcher,
        expect.objectContaining({
          info: expect.any(Function),
          error: expect.any(Function),
        })
      );
      expect(mockClosenessCircleService.merge).not.toHaveBeenCalled();
    });

    it('should handle furniture component with null spots array', async () => {
      const parameters = {
        furniture_id: 'couch:1',
        actor_id: 'alice',
        spot_index: 1,
      };

      const furnitureComponent = {
        spots: null, // Null spots array
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent) // Validation call
        .mockReturnValueOnce(furnitureComponent); // Adjacent detection call

      await handler.execute(parameters, executionContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'EstablishSittingClosenessHandler: No adjacent actors found for closeness establishment',
        expect.objectContaining({
          actorId: 'alice',
        })
      );
      expect(mockClosenessCircleService.merge).not.toHaveBeenCalled();
    });
  });

  describe('Closeness Establishment', () => {
    it('should create bidirectional closeness between two actors', async () => {
      const parameters = {
        furniture_id: 'couch:1',
        actor_id: 'alice',
        spot_index: 0,
      };

      const furnitureComponent = {
        spots: ['alice', 'bob', null],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent) // First call for validation
        .mockReturnValueOnce(furnitureComponent) // Second call for adjacency
        .mockReturnValueOnce(null) // Alice's closeness (none)
        .mockReturnValueOnce(null); // Bob's closeness (none)

      proximityUtils.findAdjacentOccupants.mockReturnValue(['bob']);
      mockClosenessCircleService.merge.mockReturnValue(['alice', 'bob']);

      await handler.execute(parameters, executionContext);

      // Verify both actors get updated with each other in partner lists
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'alice',
        'positioning:closeness',
        { partners: ['bob'] }
      );
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'bob',
        'positioning:closeness',
        { partners: ['alice'] }
      );
    });

    it('should merge existing closeness circles correctly', async () => {
      const parameters = {
        furniture_id: 'couch:1',
        actor_id: 'charlie',
        spot_index: 1,
      };

      const furnitureComponent = {
        spots: ['alice', 'charlie', null],
      };

      // Alice already has Bob as partner
      const aliceCloseness = { partners: ['bob'] };
      const bobCloseness = { partners: ['alice'] };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent) // First call for validation
        .mockReturnValueOnce(furnitureComponent) // Second call for adjacency
        .mockReturnValueOnce(null) // Charlie's closeness (none)
        .mockReturnValueOnce(aliceCloseness); // Alice's existing closeness

      proximityUtils.findAdjacentOccupants.mockReturnValue(['alice']);

      await handler.execute(parameters, executionContext);

      // Production code no longer uses merge service - direct partner updates only
      // Charlie and Alice become direct partners (no transitive relationship with Bob)
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'alice',
        'positioning:closeness',
        { partners: ['bob', 'charlie'] } // Alice keeps Bob and adds Charlie
      );
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'charlie',
        'positioning:closeness',
        { partners: ['alice'] } // Charlie only gets Alice as direct neighbor
      );
      // Note: Bob is NOT updated because he's not adjacent to Charlie
      expect(mockClosenessCircleService.merge).not.toHaveBeenCalled();
    });

    it('should preserve manual closeness relationships', async () => {
      const parameters = {
        furniture_id: 'couch:1',
        actor_id: 'charlie',
        spot_index: 0,
      };

      const furnitureComponent = {
        spots: ['charlie', 'alice', null],
      };

      // Alice has manual closeness with Bob
      const aliceCloseness = { partners: ['bob'] };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent) // First call for validation
        .mockReturnValueOnce(furnitureComponent) // Second call for adjacency
        .mockReturnValueOnce(null) // Charlie's closeness
        .mockReturnValueOnce(aliceCloseness); // Alice's existing closeness

      proximityUtils.findAdjacentOccupants.mockReturnValue(['alice']);
      mockClosenessCircleService.merge.mockReturnValue(['alice', 'bob', 'charlie']);

      await handler.execute(parameters, executionContext);

      // Verify Alice keeps Bob and adds Charlie
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'alice',
        'positioning:closeness',
        { partners: expect.arrayContaining(['bob', 'charlie']) }
      );
    });
  });

  describe('Movement Lock Updates', () => {
    it('should update movement locks for all affected actors', async () => {
      const parameters = {
        furniture_id: 'couch:1',
        actor_id: 'alice',
        spot_index: 0,
      };

      const furnitureComponent = {
        spots: ['alice', 'bob', null],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent)
        .mockReturnValueOnce(furnitureComponent)
        .mockReturnValue(null);

      proximityUtils.findAdjacentOccupants.mockReturnValue(['bob']);
      mockClosenessCircleService.merge.mockReturnValue(['alice', 'bob']);
      movementUtils.updateMovementLock.mockResolvedValue();

      await handler.execute(parameters, executionContext);

      expect(movementUtils.updateMovementLock).toHaveBeenCalledWith(
        mockEntityManager,
        'alice',
        true
      );
      expect(movementUtils.updateMovementLock).toHaveBeenCalledWith(
        mockEntityManager,
        'bob',
        true
      );
    });

    it('should handle movement lock failures gracefully', async () => {
      const parameters = {
        furniture_id: 'couch:1',
        actor_id: 'alice',
        spot_index: 0,
      };

      const furnitureComponent = {
        spots: ['alice', 'bob', null],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent)
        .mockReturnValueOnce(furnitureComponent)
        .mockReturnValue(null);

      proximityUtils.findAdjacentOccupants.mockReturnValue(['bob']);
      mockClosenessCircleService.merge.mockReturnValue(['alice', 'bob']);
      
      const lockError = new Error('Lock failed');
      movementUtils.updateMovementLock
        .mockResolvedValueOnce() // Alice succeeds
        .mockRejectedValueOnce(lockError); // Bob fails

      await handler.execute(parameters, executionContext);

      expect(safeDispatchError).toHaveBeenCalledWith(
        mockDispatcher,
        'ESTABLISH_SITTING_CLOSENESS: failed locking movement',
        expect.objectContaining({
          id: 'bob',
          error: 'Lock failed',
        }),
        expect.objectContaining({
          info: expect.any(Function),
          error: expect.any(Function),
        })
      );
      
      // Operation should still succeed overall
      expect(mockLogger.info).toHaveBeenCalledWith(
        'EstablishSittingClosenessHandler: Sitting closeness established successfully',
        expect.any(Object)
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing furniture component gracefully', async () => {
      const parameters = {
        furniture_id: 'missing:1',
        actor_id: 'alice',
        spot_index: 0,
      };

      mockEntityManager.getComponentData.mockReturnValue(null);

      await handler.execute(parameters, executionContext);

      expect(safeDispatchError).toHaveBeenCalledWith(
        mockDispatcher,
        'ESTABLISH_SITTING_CLOSENESS_FAILED',
        expect.objectContaining({
          furnitureId: 'missing:1',
          reason: expect.stringContaining('does not have allows_sitting component'),
        }),
        expect.objectContaining({
          info: expect.any(Function),
          error: expect.any(Function),
        })
      );
    });

    it('should handle single-spot furniture with no adjacent possibilities', async () => {
      const parameters = {
        furniture_id: 'chair:1',
        actor_id: 'alice',
        spot_index: 0,
        result_variable: 'result',
      };

      const furnitureComponent = {
        spots: ['alice'], // Single spot
      };

      mockEntityManager.getComponentData.mockReturnValue(furnitureComponent);
      proximityUtils.findAdjacentOccupants.mockReturnValue([]);

      await handler.execute(parameters, executionContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'EstablishSittingClosenessHandler: No adjacent actors found for closeness establishment',
        expect.any(Object)
      );
      expect(contextVariableUtils.tryWriteContextVariable).toHaveBeenCalledWith(
        'result',
        false, // No closeness established returns false
        executionContext,
        mockDispatcher,
        expect.objectContaining({
          info: expect.any(Function),
          error: expect.any(Function),
        })
      );
    });

    it('should handle validation parameter errors', async () => {
      const parameters = {
        furniture_id: 'couch:1',
        actor_id: 'alice',
        spot_index: 0,
      };

      const validationError = new Error('Invalid parameter');
      proximityUtils.validateProximityParameters.mockImplementation(() => {
        throw validationError;
      });

      mockEntityManager.getComponentData.mockReturnValue({
        spots: ['alice', null, null],
      });

      await handler.execute(parameters, executionContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'EstablishSittingClosenessHandler: Failed to establish sitting closeness',
        expect.objectContaining({
          error: 'Invalid parameter',
        })
      );
      expect(safeDispatchError).toHaveBeenCalled();
    });

    it('should handle context variable writing when context is missing', async () => {
      const parameters = {
        furniture_id: 'couch:1',
        actor_id: 'alice',
        spot_index: 0,
        result_variable: 'result',
      };

      const furnitureComponent = {
        spots: [null, null, null],
      };

      mockEntityManager.getComponentData.mockReturnValue(furnitureComponent);
      proximityUtils.findAdjacentOccupants.mockReturnValue([]);
      evaluationContextUtils.ensureEvaluationContext.mockReturnValue(false);

      await handler.execute(parameters, executionContext);

      expect(contextVariableUtils.tryWriteContextVariable).not.toHaveBeenCalled();
    });

    it('should handle successful execution with missing evaluation context for result variable', async () => {
      const parameters = {
        furniture_id: 'couch:1',
        actor_id: 'alice',
        spot_index: 0,
        result_variable: 'result',
      };

      const furnitureComponent = {
        spots: ['alice', 'bob', null],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent)
        .mockReturnValueOnce(furnitureComponent)
        .mockReturnValue(null);

      proximityUtils.findAdjacentOccupants.mockReturnValue(['bob']);
      mockClosenessCircleService.merge.mockReturnValue(['alice', 'bob']);
      evaluationContextUtils.ensureEvaluationContext.mockReturnValue(false);

      await handler.execute(parameters, executionContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'EstablishSittingClosenessHandler: Sitting closeness established successfully',
        expect.any(Object)
      );
      expect(contextVariableUtils.tryWriteContextVariable).not.toHaveBeenCalled();
    });
  });

  describe('Constructor Validation', () => {
    it('should validate required dependencies', () => {
      expect(
        () =>
          new EstablishSittingClosenessHandler({
            logger: null,
            entityManager: mockEntityManager,
            safeEventDispatcher: mockDispatcher,
            closenessCircleService: mockClosenessCircleService,
          })
      ).toThrow();
    });

    it('should validate entity manager methods', () => {
      const invalidEntityManager = { getComponentData: jest.fn() }; // Missing addComponent

      expect(
        () =>
          new EstablishSittingClosenessHandler({
            logger: mockLogger,
            entityManager: invalidEntityManager,
            safeEventDispatcher: mockDispatcher,
            closenessCircleService: mockClosenessCircleService,
          })
      ).toThrow();
    });

    it('should validate dispatcher methods', () => {
      const invalidDispatcher = {}; // Missing dispatch method

      expect(
        () =>
          new EstablishSittingClosenessHandler({
            logger: mockLogger,
            entityManager: mockEntityManager,
            safeEventDispatcher: invalidDispatcher,
            closenessCircleService: mockClosenessCircleService,
          })
      ).toThrow();
    });

    it('should validate closeness circle service methods', () => {
      const invalidService = { merge: jest.fn() }; // Missing repair

      expect(
        () =>
          new EstablishSittingClosenessHandler({
            logger: mockLogger,
            entityManager: mockEntityManager,
            safeEventDispatcher: mockDispatcher,
            closenessCircleService: invalidService,
          })
      ).toThrow();
    });
  });
});