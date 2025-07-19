/**
 * @file Unit tests for TurnContext entity manager integration.
 * Tests location setup logic and entity manager access patterns.
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { mock, mockDeep } from 'jest-mock-extended';
import { TurnContext } from '../../../../src/turns/context/turnContext.js';
import { POSITION_COMPONENT_ID } from '../../../../src/constants/componentIds.js';

// Type imports for better IDE support
/** @typedef {import('../../../../src/entities/entity.js').default} Entity */
/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../src/turns/interfaces/IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy */
/** @typedef {import('../../../../src/turns/handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler */

describe('TurnContext Entity Manager Integration', () => {
  /** @type {ILogger} */
  let mockLogger;
  /** @type {Entity} */
  let mockActor;
  /** @type {IActorTurnStrategy} */
  let mockStrategy;
  /** @type {Function} */
  let mockOnEndTurnCallback;
  /** @type {BaseTurnHandler} */
  let mockHandlerInstance;
  /** @type {object} */
  let mockEntityManager;

  beforeEach(() => {
    mockLogger = mockDeep();
    mockActor = mock();
    mockActor.id = 'test-actor';

    mockStrategy = mockDeep();
    mockStrategy.decideAction = jest.fn();

    mockOnEndTurnCallback = jest.fn();
    mockHandlerInstance = mockDeep();

    mockEntityManager = mockDeep();
    mockEntityManager.getComponentData = jest.fn();
    mockEntityManager.getEntityInstance = jest.fn();
  });

  /**
   *
   * @param services
   */
  function createTurnContext(services = null) {
    const defaultServices = {
      entityManager: mockEntityManager,
      promptCoordinator: mockDeep(),
      safeEventDispatcher: mockDeep(),
      turnEndPort: mockDeep(),
    };

    const turnContext = new TurnContext({
      actor: mockActor,
      logger: mockLogger,
      services: services || defaultServices,
      strategy: mockStrategy,
      onEndTurnCallback: mockOnEndTurnCallback,
      handlerInstance: mockHandlerInstance,
    });

    return turnContext;
  }

  describe('Constructor entity manager setup', () => {
    test('should expose entityManager from services', () => {
      const turnContext = createTurnContext();

      expect(turnContext.entityManager).toBe(mockEntityManager);
    });

    test('should set entityManager to null when not provided in services', () => {
      const servicesWithoutEM = {
        promptCoordinator: mockDeep(),
        safeEventDispatcher: mockDeep(),
        turnEndPort: mockDeep(),
      };

      const turnContext = createTurnContext(servicesWithoutEM);

      expect(turnContext.entityManager).toBeNull();
    });

    test('should set actingEntity alias to actor', () => {
      const turnContext = createTurnContext();

      expect(turnContext.actingEntity).toBe(mockActor);
    });
  });

  describe('Location setup logic - lines 109-123', () => {
    test('should attempt location setup during construction', () => {
      createTurnContext();

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'test-actor',
        POSITION_COMPONENT_ID
      );
    });

    test('should skip location setup when entityManager is null', () => {
      const servicesWithoutEM = {
        promptCoordinator: mockDeep(),
        safeEventDispatcher: mockDeep(),
        turnEndPort: mockDeep(),
      };

      const turnContext = createTurnContext(servicesWithoutEM);

      expect(turnContext.currentLocation).toBeUndefined();
    });

    test('should skip location setup when entityManager lacks getComponentData method', () => {
      const invalidEntityManager = { someOtherMethod: jest.fn() };
      const servicesWithInvalidEM = {
        entityManager: invalidEntityManager,
        promptCoordinator: mockDeep(),
        safeEventDispatcher: mockDeep(),
        turnEndPort: mockDeep(),
      };

      const turnContext = createTurnContext(servicesWithInvalidEM);

      expect(turnContext.currentLocation).toBeUndefined();
    });

    describe('With valid entity manager - lines 114-123', () => {
      test('should retrieve position data from actor', () => {
        createTurnContext();

        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          'test-actor',
          POSITION_COMPONENT_ID
        );
      });

      test('should skip location setup when position data is null', () => {
        mockEntityManager.getComponentData.mockReturnValue(null);

        const turnContext = createTurnContext();

        expect(turnContext.currentLocation).toBeUndefined();
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      });

      test('should skip location setup when position data is undefined', () => {
        mockEntityManager.getComponentData.mockReturnValue(undefined);

        const turnContext = createTurnContext();

        expect(turnContext.currentLocation).toBeUndefined();
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      });

      test('should skip location setup when position data has no locationId', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          someOtherField: 'value',
        });

        const turnContext = createTurnContext();

        expect(turnContext.currentLocation).toBeUndefined();
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      });

      test('should skip location setup when locationId is null', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          locationId: null,
        });

        const turnContext = createTurnContext();

        expect(turnContext.currentLocation).toBeUndefined();
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      });

      test('should skip location setup when locationId is empty string', () => {
        mockEntityManager.getComponentData.mockReturnValue({ locationId: '' });

        const turnContext = createTurnContext();

        expect(turnContext.currentLocation).toBeUndefined();
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      });

      describe('With valid position data - lines 118-123', () => {
        test('should set currentLocation from entity manager when entity exists', () => {
          const positionData = { locationId: 'test-location-id' };
          const locationEntity = {
            id: 'test-location-id',
            name: 'Test Location',
          };

          mockEntityManager.getComponentData.mockReturnValue(positionData);
          mockEntityManager.getEntityInstance.mockReturnValue(locationEntity);

          const turnContext = createTurnContext();

          expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
            'test-location-id'
          );
          expect(turnContext.currentLocation).toBe(locationEntity);
        });

        test('should create fallback location object when entity manager returns null', () => {
          const positionData = { locationId: 'test-location-id' };

          mockEntityManager.getComponentData.mockReturnValue(positionData);
          mockEntityManager.getEntityInstance.mockReturnValue(null);

          const turnContext = createTurnContext();

          expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
            'test-location-id'
          );
          expect(turnContext.currentLocation).toEqual({
            id: 'test-location-id',
          });
        });

        test('should create fallback location object when entity manager returns undefined', () => {
          const positionData = { locationId: 'test-location-id' };

          mockEntityManager.getComponentData.mockReturnValue(positionData);
          mockEntityManager.getEntityInstance.mockReturnValue(undefined);

          const turnContext = createTurnContext();

          expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
            'test-location-id'
          );
          expect(turnContext.currentLocation).toEqual({
            id: 'test-location-id',
          });
        });

        test('should handle complex position data with additional fields', () => {
          const positionData = {
            locationId: 'test-location-id',
            x: 10,
            y: 20,
            facing: 'north',
          };
          const locationEntity = {
            id: 'test-location-id',
            name: 'Test Location',
          };

          mockEntityManager.getComponentData.mockReturnValue(positionData);
          mockEntityManager.getEntityInstance.mockReturnValue(locationEntity);

          const turnContext = createTurnContext();

          expect(turnContext.currentLocation).toBe(locationEntity);
        });

        test('should use nullish coalescing operator correctly for fallback', () => {
          const positionData = { locationId: 'test-location-id' };

          mockEntityManager.getComponentData.mockReturnValue(positionData);
          mockEntityManager.getEntityInstance.mockReturnValue(null);

          const turnContext = createTurnContext();

          // Test that the fallback object is created with correct structure
          expect(turnContext.currentLocation).toEqual({
            id: 'test-location-id',
          });
          expect(turnContext.currentLocation).not.toBeNull();
          expect(turnContext.currentLocation).not.toBeUndefined();
        });
      });
    });
  });

  describe('Entity manager access patterns', () => {
    test('should provide direct access to entityManager for low-level helpers', () => {
      const turnContext = createTurnContext();

      // This tests the comment: "expose the EM so low-level helpers can touch it directly"
      expect(turnContext.entityManager).toBe(mockEntityManager);
      expect(turnContext.entityManager).not.toBeNull();
    });

    test('should handle null entityManager gracefully', () => {
      const servicesWithoutEM = {
        promptCoordinator: mockDeep(),
        safeEventDispatcher: mockDeep(),
        turnEndPort: mockDeep(),
      };

      const turnContext = createTurnContext(servicesWithoutEM);

      expect(turnContext.entityManager).toBeNull();
      expect(turnContext.currentLocation).toBeUndefined();
    });
  });
});
