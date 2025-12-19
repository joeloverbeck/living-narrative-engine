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
import { ComponentStateValidator } from '../../../../src/utils/componentStateValidator.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';
import { EntityNotFoundError } from '../../../../src/errors/entityNotFoundError.js';
import * as closenessCircleService from '../../../../src/logic/services/closenessCircleService.js';

// Mock dependencies
jest.mock('../../../../src/utils/proximityUtils.js');
jest.mock('../../../../src/utils/movementUtils.js', () => ({
  updateMovementLock: jest.fn(),
}));
jest.mock('../../../../src/utils/contextVariableUtils.js');
jest.mock('../../../../src/utils/evaluationContextUtils.js');
jest.mock('../../../../src/utils/safeDispatchErrorUtils.js');
jest.mock('../../../../src/utils/componentStateValidator.js');
jest.mock('../../../../src/errors/invalidArgumentError.js');
jest.mock('../../../../src/errors/entityNotFoundError.js');
jest.mock('../../../../src/logic/services/closenessCircleService.js');

describe('EstablishSittingClosenessHandler', () => {
  let handler;
  let mockLogger;
  let mockEntityManager;
  let mockDispatcher;
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

    // Setup mock closeness circle service - production validates for both merge and repair
    closenessCircleService.repair = jest.fn((partners) => {
      // Mock the repair function to dedupe and sort
      return [...new Set(partners)].sort();
    });
    closenessCircleService.merge = jest.fn(); // Required by constructor validation even though unused

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
      closenessCircleService: closenessCircleService,
    });

    // Setup default mocks
    proximityUtils.validateProximityParameters.mockReturnValue(true);
    proximityUtils.findAdjacentOccupants.mockReturnValue([]);
    evaluationContextUtils.ensureEvaluationContext.mockReturnValue(true);
    contextVariableUtils.tryWriteContextVariable.mockReturnValue({
      success: true,
    });

    // Setup ComponentStateValidator mocks
    ComponentStateValidator.mockImplementation(() => ({
      validateFurnitureComponent: jest.fn(),
      validateClosenessComponent: jest.fn(),
      validateBidirectionalCloseness: jest.fn(),
    }));

    // Setup error class mocks
    InvalidArgumentError.mockImplementation((message) => {
      const error = new Error(message);
      error.name = 'InvalidArgumentError';
      return error;
    });

    EntityNotFoundError.mockImplementation((message) => {
      const error = new Error(message);
      error.name = 'EntityNotFoundError';
      return error;
    });
  });

  describe('Phase 1: Parameter Validation', () => {
    it('should validate required parameters using enhanced validation', async () => {
      const parameters = {
        furniture_id: 'couch:1',
        actor_id: 'alice',
        spot_index: 1,
      };

      mockEntityManager.getComponentData.mockReturnValue({
        spots: [null, 'alice', null],
      });

      const result = await handler.execute(parameters, executionContext);

      expect(proximityUtils.validateProximityParameters).toHaveBeenCalledWith(
        'couch:1',
        'alice',
        1,
        expect.objectContaining({
          info: expect.any(Function),
          error: expect.any(Function),
        })
      );
      expect(result).toEqual({
        success: true,
        adjacentActors: [],
      });
    });

    it('should throw InvalidArgumentError for parameter validation failures', async () => {
      const parameters = {
        furniture_id: 'invalid:1',
        actor_id: 'alice',
        spot_index: 0,
      };

      const validationError = new Error('Invalid furniture ID');
      proximityUtils.validateProximityParameters.mockImplementation(() => {
        throw validationError;
      });

      const result = await handler.execute(parameters, executionContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'Parameter validation failed for establish closeness'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'EstablishSittingClosenessHandler: Sitting closeness establishment failed',
        expect.objectContaining({
          operationId: expect.stringMatching(/^establish_\d+_[a-z0-9]+$/),
          errorType: 'Error',
        })
      );
    });

    it('should store false result on validation failure', async () => {
      const parameters = {
        furniture_id: 'invalid:1',
        actor_id: 'alice',
        spot_index: 0,
        result_variable: 'result',
      };

      const validationError = new Error('Invalid parameter');
      proximityUtils.validateProximityParameters.mockImplementation(() => {
        throw validationError;
      });

      const result = await handler.execute(parameters, executionContext);

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
      expect(result.success).toBe(false);
    });
  });

  describe('Phase 2: Component State Validation', () => {
    it('should validate furniture component using ComponentStateValidator', async () => {
      const parameters = {
        furniture_id: 'couch:1',
        actor_id: 'alice',
        spot_index: 1,
      };

      const furnitureComponent = {
        spots: [null, 'alice', null],
      };

      mockEntityManager.getComponentData.mockReturnValue(furnitureComponent);
      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(parameters, executionContext);

      expect(mockValidator.validateFurnitureComponent).toHaveBeenCalledWith(
        'couch:1',
        furnitureComponent,
        'establish closeness'
      );
      expect(mockValidator.validateClosenessComponent).toHaveBeenCalledWith(
        'alice',
        furnitureComponent, // Will be called with actor's closeness component
        'establish closeness'
      );
    });

    it('should validate spot index bounds', async () => {
      const parameters = {
        furniture_id: 'couch:1',
        actor_id: 'alice',
        spot_index: 5, // Index exceeds furniture capacity
      };

      const furnitureComponent = {
        spots: [null, 'alice', null], // Only 3 spots (0, 1, 2)
      };

      mockEntityManager.getComponentData.mockReturnValue(furnitureComponent);
      const mockValidator = {
        validateFurnitureComponent: jest.fn(), // This will pass
        validateClosenessComponent: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(parameters, executionContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'Spot index 5 exceeds furniture capacity (3)'
      );
    });
  });

  describe('Phase 3: Adjacent Actor Discovery', () => {
    it('should identify and validate adjacent actors', async () => {
      const parameters = {
        furniture_id: 'couch:1',
        actor_id: 'bob',
        spot_index: 1,
      };

      const furnitureComponent = {
        spots: ['alice', null, null],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent) // For furniture validation
        .mockReturnValueOnce(null) // For actor closeness validation
        .mockReturnValueOnce(null) // For adjacent actor closeness validation
        .mockReturnValue(null); // For subsequent closeness operations

      proximityUtils.findAdjacentOccupants.mockReturnValue(['alice']);

      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest.fn(),
        validateBidirectionalCloseness: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(parameters, executionContext);

      expect(proximityUtils.findAdjacentOccupants).toHaveBeenCalledWith(
        furnitureComponent,
        1
      );
      expect(mockValidator.validateClosenessComponent).toHaveBeenCalledWith(
        'alice',
        null // Adjacent actor's closeness component
      );
      expect(result.success).toBe(true);
      expect(result.adjacentActors).toEqual(['alice']);
    });

    it('should skip invalid adjacent actors with warning', async () => {
      const parameters = {
        furniture_id: 'couch:1',
        actor_id: 'bob',
        spot_index: 1,
      };

      const furnitureComponent = {
        spots: ['alice', null, 'charlie'],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent) // For furniture validation
        .mockReturnValueOnce(null) // For actor closeness validation
        .mockReturnValueOnce(null) // For alice's closeness validation
        .mockReturnValueOnce(null); // For charlie's closeness validation

      proximityUtils.findAdjacentOccupants.mockReturnValue([
        'alice',
        'charlie',
      ]);

      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest
          .fn()
          .mockImplementationOnce(() => {}) // Bob passes
          .mockImplementationOnce(() => {}) // Alice passes
          .mockImplementationOnce(() => {
            // Charlie fails
            throw new Error('Invalid closeness component');
          }),
        validateBidirectionalCloseness: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);
      // No merge service needed - production uses adjacent-only algorithm

      const result = await handler.execute(parameters, executionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'EstablishSittingClosenessHandler: Adjacent actor validation failed, skipping',
        expect.objectContaining({
          actorId: 'charlie',
          furnitureId: 'couch:1',
          error: 'Invalid closeness component',
        })
      );
      expect(result.adjacentActors).toEqual(['alice']); // Only alice should be included
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

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent) // For furniture validation
        .mockReturnValueOnce(null); // For actor closeness validation

      proximityUtils.findAdjacentOccupants.mockReturnValue([]);

      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(parameters, executionContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'EstablishSittingClosenessHandler: No adjacent actors found, closeness establishment skipped',
        expect.objectContaining({
          operationId: expect.stringMatching(/^establish_\d+_[a-z0-9]+$/),
          actorId: 'alice',
        })
      );
      expect(contextVariableUtils.tryWriteContextVariable).toHaveBeenCalledWith(
        'result',
        true, // Operation succeeded (no actors is valid)
        executionContext,
        mockDispatcher,
        expect.objectContaining({
          info: expect.any(Function),
          error: expect.any(Function),
        })
      );
      expect(result.success).toBe(true);
      expect(result.adjacentActors).toEqual([]);
      expect(closenessCircleService.repair).not.toHaveBeenCalled();
    });

    it('should handle furniture component validation failure', async () => {
      const parameters = {
        furniture_id: 'couch:1',
        actor_id: 'alice',
        spot_index: 1,
      };

      const furnitureComponent = {
        spots: null, // Invalid spots array
      };

      mockEntityManager.getComponentData.mockReturnValue(furnitureComponent);

      const mockValidator = {
        validateFurnitureComponent: jest.fn().mockImplementation(() => {
          throw new Error('Furniture has invalid spots array');
        }),
        validateClosenessComponent: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(parameters, executionContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Furniture has invalid spots array');
      expect(closenessCircleService.repair).not.toHaveBeenCalled();
    });
  });

  describe('Phase 4: Closeness Establishment with Repair', () => {
    it('should establish bidirectional closeness between adjacent actors', async () => {
      const parameters = {
        furniture_id: 'couch:1',
        actor_id: 'alice',
        spot_index: 0,
      };

      const furnitureComponent = {
        spots: ['alice', 'bob', null],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent) // Furniture validation
        .mockReturnValueOnce(null) // Alice's closeness validation
        .mockReturnValueOnce(null) // Bob's closeness validation
        .mockReturnValueOnce(null) // Alice's closeness for update
        .mockReturnValueOnce(null); // Bob's closeness for update

      proximityUtils.findAdjacentOccupants.mockReturnValue(['bob']);

      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest.fn(),
        validateBidirectionalCloseness: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(parameters, executionContext);

      // Verify repair is called to dedupe and sort the partner lists
      expect(closenessCircleService.repair).toHaveBeenCalledWith(['bob']); // Alice's new partners
      expect(closenessCircleService.repair).toHaveBeenCalledWith(['alice']); // Bob's new partners

      // Verify both actors get updated with their partner lists
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'alice',
        'positioning:closeness',
        { partners: ['bob'] } // Alice's partners
      );
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'bob',
        'positioning:closeness',
        { partners: ['alice'] } // Bob's partners
      );

      expect(result.success).toBe(true);
      expect(result.adjacentActors).toEqual(['bob']);
    });

    it('should add to existing closeness partners correctly', async () => {
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
      const charlieCloseness = null;

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent) // Furniture validation
        .mockReturnValueOnce(charlieCloseness) // Charlie's closeness validation
        .mockReturnValueOnce(aliceCloseness) // Alice's closeness validation
        .mockReturnValueOnce(charlieCloseness) // Charlie's closeness for update
        .mockReturnValueOnce(aliceCloseness); // Alice's closeness for update

      proximityUtils.findAdjacentOccupants.mockReturnValue(['alice']);

      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest.fn(),
        validateBidirectionalCloseness: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(parameters, executionContext);

      // Verify repair is called with the updated partner lists
      expect(closenessCircleService.repair).toHaveBeenCalledWith(['alice']); // Charlie's new partners
      expect(closenessCircleService.repair).toHaveBeenCalledWith([
        'bob',
        'charlie',
      ]); // Alice's updated partners

      // Only Alice and Charlie should be updated (adjacent relationship only)
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'alice',
        'positioning:closeness',
        { partners: ['bob', 'charlie'] } // Alice keeps Bob and adds Charlie
      );
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'charlie',
        'positioning:closeness',
        { partners: ['alice'] } // Charlie only gets Alice (adjacent)
      );
      // Bob should NOT be updated - he's not adjacent to Charlie
      expect(mockEntityManager.addComponent).not.toHaveBeenCalledWith(
        'bob',
        'positioning:closeness',
        expect.anything()
      );

      expect(result.success).toBe(true);
    });

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
        .mockReturnValue(null);

      proximityUtils.findAdjacentOccupants.mockReturnValue(['bob']);
      // No merge service needed - production uses adjacent-only algorithm
      movementUtils.updateMovementLock.mockResolvedValue();

      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest.fn(),
        validateBidirectionalCloseness: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(parameters, executionContext);

      // Verify movement locks updated for both actors
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
      expect(result.success).toBe(true);
    });
  });

  describe('Phase 5: Final State Validation', () => {
    it('should validate bidirectional closeness relationships', async () => {
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
        .mockReturnValue(null);

      proximityUtils.findAdjacentOccupants.mockReturnValue(['bob']);
      // No merge service needed - production uses adjacent-only algorithm

      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest.fn(),
        validateBidirectionalCloseness: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(parameters, executionContext);

      expect(mockValidator.validateBidirectionalCloseness).toHaveBeenCalledWith(
        mockEntityManager,
        'alice',
        'bob'
      );
      expect(result.success).toBe(true);
    });

    it('should log but not throw on final state validation failures', async () => {
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
        .mockReturnValue(null);

      proximityUtils.findAdjacentOccupants.mockReturnValue(['bob']);
      // No merge service needed - production uses adjacent-only algorithm

      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest.fn(),
        validateBidirectionalCloseness: jest.fn().mockImplementation(() => {
          throw new Error('Bidirectional validation failed');
        }),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(parameters, executionContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'EstablishSittingClosenessHandler: Final state validation failed',
        expect.objectContaining({
          error: 'Bidirectional validation failed',
          actorId: 'alice',
          adjacentActors: ['bob'],
        })
      );
      // Operation should still succeed despite validation failure
      expect(result.success).toBe(true);
    });
  });

  describe('Phase 6: Success and Error Handling', () => {
    it('should dispatch success event with operation details', async () => {
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
        .mockReturnValue(null);

      proximityUtils.findAdjacentOccupants.mockReturnValue(['bob']);
      // No merge service needed - production uses adjacent-only algorithm

      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest.fn(),
        validateBidirectionalCloseness: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(parameters, executionContext);

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'sitting:sitting_closeness_established',
        {
          actorId: 'alice',
          furnitureId: 'couch:1',
          adjacentActors: ['bob'],
          operationId: expect.stringMatching(/^establish_\d+_[a-z0-9]+$/),
        }
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'EstablishSittingClosenessHandler: Sitting closeness established successfully',
        expect.objectContaining({
          operationId: expect.stringMatching(/^establish_\d+_[a-z0-9]+$/),
          relationshipsEstablished: 1,
        })
      );
    });

    it('should dispatch error event with comprehensive context', async () => {
      const parameters = {
        furniture_id: 'couch:1',
        actor_id: 'alice',
        spot_index: 0,
      };

      const testError = new Error('Test error');
      proximityUtils.validateProximityParameters.mockImplementation(() => {
        throw testError;
      });

      const result = await handler.execute(parameters, executionContext);

      expect(safeDispatchError).toHaveBeenCalledWith(
        mockDispatcher,
        'Sitting closeness establishment failed',
        {
          actorId: 'alice',
          furnitureId: 'couch:1',
          operationId: expect.stringMatching(/^establish_\d+_[a-z0-9]+$/),
          error:
            'Parameter validation failed for establish closeness: Test error',
        },
        expect.objectContaining({
          info: expect.any(Function),
          error: expect.any(Function),
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'Parameter validation failed for establish closeness'
      );
    });

    it('should write result variable on both success and failure', async () => {
      const successParameters = {
        furniture_id: 'couch:1',
        actor_id: 'alice',
        spot_index: 0,
        result_variable: 'success_result',
      };

      const furnitureComponent = {
        spots: [null, null, null], // No adjacent actors
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent)
        .mockReturnValueOnce(null);

      proximityUtils.findAdjacentOccupants.mockReturnValue([]);

      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(successParameters, executionContext);

      expect(contextVariableUtils.tryWriteContextVariable).toHaveBeenCalledWith(
        'success_result',
        true, // Success case (no actors is valid)
        executionContext,
        mockDispatcher,
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });
  });

  describe('Enhanced Error Handling and Edge Cases', () => {
    it('should handle furniture component validation failures', async () => {
      const parameters = {
        furniture_id: 'missing:1',
        actor_id: 'alice',
        spot_index: 0,
      };

      mockEntityManager.getComponentData.mockReturnValue(null);

      const mockValidator = {
        validateFurnitureComponent: jest.fn().mockImplementation(() => {
          throw new EntityNotFoundError(
            'Furniture missing:1 missing allows_sitting component'
          );
        }),
        validateClosenessComponent: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(parameters, executionContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'Furniture missing:1 missing allows_sitting component'
      );
      expect(safeDispatchError).toHaveBeenCalledWith(
        mockDispatcher,
        'Sitting closeness establishment failed',
        expect.objectContaining({
          actorId: 'alice',
          furnitureId: 'missing:1',
          operationId: expect.stringMatching(/^establish_\d+_[a-z0-9]+$/),
        }),
        expect.any(Object)
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

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent) // Furniture validation
        .mockReturnValueOnce(null); // Actor closeness validation

      proximityUtils.findAdjacentOccupants.mockReturnValue([]);

      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(parameters, executionContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'EstablishSittingClosenessHandler: No adjacent actors found, closeness establishment skipped',
        expect.objectContaining({
          operationId: expect.stringMatching(/^establish_\d+_[a-z0-9]+$/),
        })
      );
      expect(contextVariableUtils.tryWriteContextVariable).toHaveBeenCalledWith(
        'result',
        true, // Operation succeeded (no actors is valid)
        executionContext,
        mockDispatcher,
        expect.objectContaining({
          info: expect.any(Function),
          error: expect.any(Function),
        })
      );
      expect(result.success).toBe(true);
      expect(result.adjacentActors).toEqual([]);
    });

    it('should provide detailed error context with operation tracking', async () => {
      const parameters = {
        furniture_id: 'couch:1',
        actor_id: 'alice',
        spot_index: 0,
      };

      const validationError = new Error('Invalid parameter');
      proximityUtils.validateProximityParameters.mockImplementation(() => {
        throw validationError;
      });

      const result = await handler.execute(parameters, executionContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'EstablishSittingClosenessHandler: Sitting closeness establishment failed',
        expect.objectContaining({
          operationId: expect.stringMatching(/^establish_\d+_[a-z0-9]+$/),
          actorId: 'alice',
          furnitureId: 'couch:1',
          spotIndex: 0,
          errorType: 'Error',
        })
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'Parameter validation failed for establish closeness'
      );
    });

    it('should handle movement lock failures during establishment', async () => {
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
        .mockReturnValue(null);

      proximityUtils.findAdjacentOccupants.mockReturnValue(['bob']);
      // No merge service needed - production uses adjacent-only algorithm

      // Movement lock fails for one actor
      const lockError = new Error('Movement lock failed');
      movementUtils.updateMovementLock
        .mockResolvedValueOnce() // Alice succeeds
        .mockRejectedValueOnce(lockError); // Bob fails

      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest.fn(),
        validateBidirectionalCloseness: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(parameters, executionContext);

      // Should still fail the entire operation if movement locks fail
      expect(result.success).toBe(false);
      expect(result.error).toContain('Movement lock failed');
    });

    it('should generate unique operation IDs for tracking', async () => {
      const parameters = {
        furniture_id: 'couch:1',
        actor_id: 'alice',
        spot_index: 0,
      };

      const furnitureComponent = {
        spots: [null, null, null], // No adjacent actors
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent) // First execution: furniture
        .mockReturnValueOnce(null) // First execution: actor closeness
        .mockReturnValueOnce(furnitureComponent) // Second execution: furniture
        .mockReturnValueOnce(null); // Second execution: actor closeness

      proximityUtils.findAdjacentOccupants.mockReturnValue([]);

      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      // Execute twice to ensure unique IDs
      const result1 = await handler.execute(parameters, executionContext);
      const result2 = await handler.execute(parameters, executionContext);

      // Both executions should be successful
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Check that operation IDs are different by examining the log calls
      const logCalls = mockLogger.info.mock.calls.filter((call) =>
        call[0].includes(
          'No adjacent actors found, closeness establishment skipped'
        )
      );
      expect(logCalls).toHaveLength(2);
      expect(logCalls[0][1].operationId).not.toBe(logCalls[1][1].operationId);
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
            closenessCircleService: closenessCircleService,
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
            closenessCircleService: closenessCircleService,
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
            closenessCircleService: closenessCircleService,
          })
      ).toThrow();
    });

    it('should validate closeness circle service methods', () => {
      const invalidService = {}; // Missing repair

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

    it('should maintain backwards compatibility with existing API', async () => {
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
        .mockReturnValue(null);

      proximityUtils.findAdjacentOccupants.mockReturnValue(['bob']);
      // No merge service needed - production uses adjacent-only algorithm

      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest.fn(),
        validateBidirectionalCloseness: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(parameters, executionContext);

      // Should return result object instead of void (new behavior)
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.adjacentActors).toEqual(['bob']);

      // Should still write context variable (backwards compatibility)
      expect(contextVariableUtils.tryWriteContextVariable).toHaveBeenCalledWith(
        'result',
        true,
        executionContext,
        mockDispatcher,
        expect.any(Object)
      );
    });
  });

  describe('Integration with Enhanced Components', () => {
    it('should integrate ComponentStateValidator correctly', async () => {
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
        .mockReturnValue(null);

      proximityUtils.findAdjacentOccupants.mockReturnValue(['bob']);
      // No merge service needed - production uses adjacent-only algorithm

      const validatorInstances = [];
      ComponentStateValidator.mockImplementation(({ logger }) => {
        const validatorInstance = {
          validateFurnitureComponent: jest.fn(),
          validateClosenessComponent: jest.fn(),
          validateBidirectionalCloseness: jest.fn(),
        };
        validatorInstances.push(validatorInstance);
        // Verify logger is passed correctly
        expect(logger).toBeDefined();
        expect(logger.info).toBeDefined();
        return validatorInstance;
      });

      const result = await handler.execute(parameters, executionContext);

      // Verify validator was created with correct dependency (3 times for this flow)
      expect(ComponentStateValidator).toHaveBeenCalledTimes(3);
      expect(ComponentStateValidator).toHaveBeenCalledWith({
        logger: expect.any(Object),
      });

      // Verify validator methods were called across all instances
      const allValidatorCalls = {
        validateFurnitureComponent: validatorInstances.some(
          (v) => v.validateFurnitureComponent.mock.calls.length > 0
        ),
        validateClosenessComponent: validatorInstances.some(
          (v) => v.validateClosenessComponent.mock.calls.length > 0
        ),
        validateBidirectionalCloseness: validatorInstances.some(
          (v) => v.validateBidirectionalCloseness.mock.calls.length > 0
        ),
      };

      expect(allValidatorCalls.validateFurnitureComponent).toBe(true);
      expect(allValidatorCalls.validateClosenessComponent).toBe(true);
      expect(allValidatorCalls.validateBidirectionalCloseness).toBe(true);
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
            closenessCircleService: closenessCircleService,
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
            closenessCircleService: closenessCircleService,
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
            closenessCircleService: closenessCircleService,
          })
      ).toThrow();
    });

    it('should validate closeness circle service methods', () => {
      const invalidService = {}; // Missing repair

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

  describe('Performance and Resource Management', () => {
    it('should handle large numbers of adjacent actors efficiently', async () => {
      const parameters = {
        furniture_id: 'long_couch:1',
        actor_id: 'alice',
        spot_index: 5, // Middle of a long couch
      };

      const furnitureComponent = {
        spots: Array(11)
          .fill(null)
          .map((_, i) => (i === 5 ? null : `actor_${i}`)), // 10 adjacent actors
      };
      furnitureComponent.spots[5] = null; // Alice's spot

      const adjacentActors = ['actor_4', 'actor_6']; // Just adjacent spots

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent)
        .mockReturnValue(null);

      proximityUtils.findAdjacentOccupants.mockReturnValue(adjacentActors);
      // No merge service needed - production uses adjacent-only algorithm

      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest.fn(),
        validateBidirectionalCloseness: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(parameters, executionContext);

      expect(result.success).toBe(true);
      expect(result.adjacentActors).toEqual(adjacentActors);

      // Should call validator for each adjacent actor
      expect(mockValidator.validateClosenessComponent).toHaveBeenCalledTimes(3); // Alice + 2 adjacent
      expect(
        mockValidator.validateBidirectionalCloseness
      ).toHaveBeenCalledTimes(2); // 2 relationships
    });
  });
});
