import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import UnwieldItemHandler from '../../../../src/logic/operationHandlers/unwieldItemHandler.js';
import * as grabbingUtils from '../../../../src/utils/grabbingUtils.js';

// Mock the grabbingUtils module
jest.mock('../../../../src/utils/grabbingUtils.js', () => ({
  unlockAppendagesHoldingItem: jest.fn(),
}));

const WIELDING_COMPONENT_ID = 'positioning:wielding';
const ITEM_UNWIELDED_EVENT = 'items:item_unwielded';

const makeLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const makeEntityManager = () => ({
  getComponentData: jest.fn(),
  addComponent: jest.fn(),
  removeComponent: jest.fn(),
});

const makeEventDispatcher = () => ({
  dispatch: jest.fn(),
});

describe('UnwieldItemHandler', () => {
  let handler;
  let mockLogger;
  let mockEntityManager;
  let mockSafeEventDispatcher;
  let executionContext;

  beforeEach(() => {
    // Create fresh mocks
    mockLogger = makeLogger();
    mockEntityManager = makeEntityManager();
    mockSafeEventDispatcher = makeEventDispatcher();

    // Create handler instance
    handler = new UnwieldItemHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockSafeEventDispatcher,
    });

    // Setup execution context
    executionContext = {
      logger: mockLogger,
    };

    // Default mock for unlockAppendagesHoldingItem
    grabbingUtils.unlockAppendagesHoldingItem.mockResolvedValue({
      success: true,
      unlockedParts: ['left_hand'],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('UnwieldItemHandler setup', () => {
    test('should create instance with valid dependencies', () => {
      expect(handler).toBeInstanceOf(UnwieldItemHandler);
    });

    test('should have execute method', () => {
      expect(typeof handler.execute).toBe('function');
    });
  });

  describe('Parameter Validation', () => {
    test('should return error when actorEntity is empty', async () => {
      const params = { actorEntity: '', itemEntity: 'item-001' };

      const result = await handler.execute(params, executionContext);

      expect(result).toEqual({ success: false, error: 'validation_failed' });
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    test('should return error when actorEntity is missing', async () => {
      const params = { itemEntity: 'item-001' };

      const result = await handler.execute(params, executionContext);

      expect(result).toEqual({ success: false, error: 'validation_failed' });
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    test('should return error when actorEntity is whitespace only', async () => {
      const params = { actorEntity: '   ', itemEntity: 'item-001' };

      const result = await handler.execute(params, executionContext);

      expect(result).toEqual({ success: false, error: 'validation_failed' });
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    test('should return error when itemEntity is empty', async () => {
      const params = { actorEntity: 'actor-001', itemEntity: '' };

      const result = await handler.execute(params, executionContext);

      expect(result).toEqual({ success: false, error: 'validation_failed' });
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    test('should return error when itemEntity is missing', async () => {
      const params = { actorEntity: 'actor-001' };

      const result = await handler.execute(params, executionContext);

      expect(result).toEqual({ success: false, error: 'validation_failed' });
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    test('should return error when itemEntity is whitespace only', async () => {
      const params = { actorEntity: 'actor-001', itemEntity: '   ' };

      const result = await handler.execute(params, executionContext);

      expect(result).toEqual({ success: false, error: 'validation_failed' });
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    test('should return error when params is null', async () => {
      const result = await handler.execute(null, executionContext);

      expect(result).toEqual({ success: false, error: 'validation_failed' });
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    test('should return error when params is undefined', async () => {
      const result = await handler.execute(undefined, executionContext);

      expect(result).toEqual({ success: false, error: 'validation_failed' });
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });
  });

  describe('Idempotent Behavior', () => {
    test('should succeed when actor has no wielding component', async () => {
      const params = { actorEntity: 'actor-001', itemEntity: 'item-001' };
      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = await handler.execute(params, executionContext);

      expect(result).toEqual({ success: true });
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'actor-001',
        WIELDING_COMPONENT_ID
      );
      expect(mockEntityManager.removeComponent).not.toHaveBeenCalled();
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    test('should succeed when item is not in wielded_item_ids', async () => {
      const params = { actorEntity: 'actor-001', itemEntity: 'item-999' };
      mockEntityManager.getComponentData.mockReturnValue({
        wielded_item_ids: ['item-001', 'item-002'],
      });

      const result = await handler.execute(params, executionContext);

      expect(result).toEqual({ success: true });
      expect(mockEntityManager.removeComponent).not.toHaveBeenCalled();
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    test('should succeed when wielded_item_ids is undefined', async () => {
      const params = { actorEntity: 'actor-001', itemEntity: 'item-001' };
      mockEntityManager.getComponentData.mockReturnValue({});

      const result = await handler.execute(params, executionContext);

      expect(result).toEqual({ success: true });
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    test('should succeed when wielded_item_ids is empty array', async () => {
      const params = { actorEntity: 'actor-001', itemEntity: 'item-001' };
      mockEntityManager.getComponentData.mockReturnValue({
        wielded_item_ids: [],
      });

      const result = await handler.execute(params, executionContext);

      expect(result).toEqual({ success: true });
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('Single Item Wielding', () => {
    test('should remove wielding component when unwielding only item', async () => {
      const params = { actorEntity: 'actor-001', itemEntity: 'item-001' };
      mockEntityManager.getComponentData.mockReturnValue({
        wielded_item_ids: ['item-001'],
      });

      const result = await handler.execute(params, executionContext);

      expect(result).toEqual({ success: true });
      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'actor-001',
        WIELDING_COMPONENT_ID
      );
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    test('should call unlockAppendagesHoldingItem for the item', async () => {
      const params = { actorEntity: 'actor-001', itemEntity: 'item-001' };
      mockEntityManager.getComponentData.mockReturnValue({
        wielded_item_ids: ['item-001'],
      });

      await handler.execute(params, executionContext);

      expect(grabbingUtils.unlockAppendagesHoldingItem).toHaveBeenCalledWith(
        mockEntityManager,
        'actor-001',
        'item-001'
      );
    });

    test('should dispatch event with empty remaining items array', async () => {
      const params = { actorEntity: 'actor-001', itemEntity: 'item-001' };
      mockEntityManager.getComponentData.mockReturnValue({
        wielded_item_ids: ['item-001'],
      });

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ITEM_UNWIELDED_EVENT,
        {
          actorEntity: 'actor-001',
          itemEntity: 'item-001',
          remainingWieldedItems: [],
        }
      );
    });
  });

  describe('Multiple Items Wielding', () => {
    test('should keep component when other items still wielded', async () => {
      const params = { actorEntity: 'actor-001', itemEntity: 'item-002' };
      mockEntityManager.getComponentData.mockReturnValue({
        wielded_item_ids: ['item-001', 'item-002', 'item-003'],
      });

      const result = await handler.execute(params, executionContext);

      expect(result).toEqual({ success: true });
      expect(mockEntityManager.removeComponent).not.toHaveBeenCalled();
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'actor-001',
        WIELDING_COMPONENT_ID,
        {
          wielded_item_ids: ['item-001', 'item-003'],
        }
      );
    });

    test('should update wielded_item_ids array correctly', async () => {
      const params = { actorEntity: 'actor-001', itemEntity: 'item-001' };
      mockEntityManager.getComponentData.mockReturnValue({
        wielded_item_ids: ['item-001', 'item-002'],
      });

      await handler.execute(params, executionContext);

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'actor-001',
        WIELDING_COMPONENT_ID,
        {
          wielded_item_ids: ['item-002'],
        }
      );
    });

    test('should preserve other component data when updating', async () => {
      const params = { actorEntity: 'actor-001', itemEntity: 'item-001' };
      mockEntityManager.getComponentData.mockReturnValue({
        wielded_item_ids: ['item-001', 'item-002'],
        someOtherField: 'preserved',
      });

      await handler.execute(params, executionContext);

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'actor-001',
        WIELDING_COMPONENT_ID,
        {
          wielded_item_ids: ['item-002'],
          someOtherField: 'preserved',
        }
      );
    });

    test('should call unlockAppendagesHoldingItem for specific item only', async () => {
      const params = { actorEntity: 'actor-001', itemEntity: 'item-002' };
      mockEntityManager.getComponentData.mockReturnValue({
        wielded_item_ids: ['item-001', 'item-002', 'item-003'],
      });

      await handler.execute(params, executionContext);

      expect(grabbingUtils.unlockAppendagesHoldingItem).toHaveBeenCalledWith(
        mockEntityManager,
        'actor-001',
        'item-002'
      );
      expect(grabbingUtils.unlockAppendagesHoldingItem).toHaveBeenCalledTimes(
        1
      );
    });
  });

  describe('Event Dispatch', () => {
    test('should dispatch items:item_unwielded on successful unwield', async () => {
      const params = { actorEntity: 'actor-001', itemEntity: 'item-001' };
      mockEntityManager.getComponentData.mockReturnValue({
        wielded_item_ids: ['item-001'],
      });

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ITEM_UNWIELDED_EVENT,
        expect.objectContaining({
          actorEntity: 'actor-001',
          itemEntity: 'item-001',
        })
      );
    });

    test('should include remaining items in event payload', async () => {
      const params = { actorEntity: 'actor-001', itemEntity: 'item-002' };
      mockEntityManager.getComponentData.mockReturnValue({
        wielded_item_ids: ['item-001', 'item-002', 'item-003'],
      });

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ITEM_UNWIELDED_EVENT,
        {
          actorEntity: 'actor-001',
          itemEntity: 'item-002',
          remainingWieldedItems: ['item-001', 'item-003'],
        }
      );
    });

    test('should not dispatch event when actor has no wielding component', async () => {
      const params = { actorEntity: 'actor-001', itemEntity: 'item-001' };
      mockEntityManager.getComponentData.mockReturnValue(null);

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    test('should not dispatch event when item was not wielded', async () => {
      const params = { actorEntity: 'actor-001', itemEntity: 'item-999' };
      mockEntityManager.getComponentData.mockReturnValue({
        wielded_item_ids: ['item-001', 'item-002'],
      });

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle exception from unlockAppendagesHoldingItem', async () => {
      const params = { actorEntity: 'actor-001', itemEntity: 'item-001' };
      mockEntityManager.getComponentData.mockReturnValue({
        wielded_item_ids: ['item-001'],
      });
      const testError = new Error('Failed to unlock appendages');
      grabbingUtils.unlockAppendagesHoldingItem.mockRejectedValue(testError);

      const result = await handler.execute(params, executionContext);

      expect(result).toEqual({
        success: false,
        error: 'Failed to unlock appendages',
      });
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should handle exception from removeComponent', async () => {
      const params = { actorEntity: 'actor-001', itemEntity: 'item-001' };
      mockEntityManager.getComponentData.mockReturnValue({
        wielded_item_ids: ['item-001'],
      });
      mockEntityManager.removeComponent.mockRejectedValue(
        new Error('Remove failed')
      );

      const result = await handler.execute(params, executionContext);

      expect(result).toEqual({
        success: false,
        error: 'Remove failed',
      });
    });

    test('should handle exception from addComponent', async () => {
      const params = { actorEntity: 'actor-001', itemEntity: 'item-001' };
      mockEntityManager.getComponentData.mockReturnValue({
        wielded_item_ids: ['item-001', 'item-002'],
      });
      mockEntityManager.addComponent.mockRejectedValue(new Error('Add failed'));

      const result = await handler.execute(params, executionContext);

      expect(result).toEqual({
        success: false,
        error: 'Add failed',
      });
    });
  });

  describe('Logger Integration', () => {
    test('should use logger from execution context when available', async () => {
      const contextLogger = makeLogger();
      const customContext = { logger: contextLogger };
      const params = { actorEntity: 'actor-001', itemEntity: 'item-001' };
      mockEntityManager.getComponentData.mockReturnValue({
        wielded_item_ids: ['item-001'],
      });

      await handler.execute(params, customContext);

      expect(contextLogger.debug).toHaveBeenCalled();
    });

    test('should handle execution context without logger', async () => {
      const params = { actorEntity: 'actor-001', itemEntity: 'item-001' };
      mockEntityManager.getComponentData.mockReturnValue({
        wielded_item_ids: ['item-001'],
      });

      // Should not throw error and still execute successfully
      const result = await handler.execute(params, {});

      expect(result).toEqual({ success: true });
    });

    test('should handle undefined execution context', async () => {
      const params = { actorEntity: 'actor-001', itemEntity: 'item-001' };
      mockEntityManager.getComponentData.mockReturnValue({
        wielded_item_ids: ['item-001'],
      });

      const result = await handler.execute(params, undefined);

      expect(result).toEqual({ success: true });
    });
  });
});
