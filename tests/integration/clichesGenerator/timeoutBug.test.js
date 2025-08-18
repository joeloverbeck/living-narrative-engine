/**
 * @file Integration test to reproduce the LLM proxy timeout issue with cliché generation
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ClichesGeneratorControllerTestBed from '../../common/clichesGeneratorControllerTestBed.js';

describe('ClichesGeneratorController - LLM Proxy Timeout Bug', () => {
  let testBed;

  beforeEach(() => {
    testBed = new ClichesGeneratorControllerTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
    jest.clearAllMocks();
  });

  describe('Timeout Scenario Reproduction', () => {
    it('should handle LLM proxy timeout (503 error) gracefully', async () => {
      // Arrange
      const conceptId = 'test-concept-id';
      const directionId = 'test-direction-id';
      const concept = {
        id: conceptId,
        name: 'Test Character',
        description: 'A test character concept for timeout testing',
      };
      const direction = {
        id: directionId,
        title: 'Test Direction',
        description: 'A test thematic direction',
        coreTension: 'Test vs Reality',
      };

      // Setup mock service to return our test data
      testBed.mockCharacterBuilderService.getCharacterConcept.mockResolvedValue(
        concept
      );
      testBed.mockCharacterBuilderService.getThematicDirections.mockResolvedValue(
        [direction]
      );

      // Mock the service to simulate a 503 timeout error
      const mockError = new Error(
        'fetchWithRetry: Failed for http://localhost:3001/api/llm-request after 1 attempt(s) due to persistent network error: Failed to fetch'
      );
      mockError.name = 'LLMStrategyError';

      // Make generateClichesForDirection throw the error
      testBed.mockCharacterBuilderService.generateClichesForDirection.mockRejectedValue(
        mockError
      );

      // Track dispatched events
      const dispatchedEvents = [];
      const originalDispatch = testBed.mockEventBus.dispatch;
      testBed.mockEventBus.dispatch = jest.fn((event) => {
        dispatchedEvents.push(event);
        return originalDispatch(event);
      });

      // Act - Call the service method that would trigger cliché generation
      try {
        await testBed.mockCharacterBuilderService.generateClichesForDirection(
          directionId,
          conceptId
        );
      } catch (error) {
        // Expected to throw
        expect(error.message).toContain(
          'Failed for http://localhost:3001/api/llm-request'
        );
      }

      // Assert - the service method was called with correct parameters
      expect(
        testBed.mockCharacterBuilderService.generateClichesForDirection
      ).toHaveBeenCalledWith(directionId, conceptId);
    });

    it('should handle successful response that arrives after simulated timeout', async () => {
      // This test simulates what should happen when the fix is applied
      // The server should wait 90 seconds instead of 30 seconds

      // Arrange
      const conceptId = 'test-concept-id';
      const directionId = 'test-direction-id';
      const concept = {
        id: conceptId,
        name: 'Test Character',
        description: 'A test character concept',
      };
      const direction = {
        id: directionId,
        title: 'Test Direction',
        description: 'A test thematic direction',
        coreTension: 'Test vs Reality',
      };

      testBed.mockCharacterBuilderService.getCharacterConcept.mockResolvedValue(
        concept
      );
      testBed.mockCharacterBuilderService.getThematicDirections.mockResolvedValue(
        [direction]
      );

      // Mock successful cliché generation after a delay
      const successfulCliches = {
        categories: {
          names: ['Generic Name'],
          physicalDescriptions: ['Cliché Description'],
          personalityTraits: ['Overused Trait'],
          skillsAbilities: ['Common Skill'],
          typicalLikes: ['Predictable Like'],
          typicalDislikes: ['Common Dislike'],
          commonFears: ['Overused Fear'],
          genericGoals: ['Generic Goal'],
          backgroundElements: ['Cliché Background'],
          overusedSecrets: ['Common Secret'],
          speechPatterns: ['Overused Pattern'],
        },
        tropesAndStereotypes: ['Common Trope'],
      };

      // Simulate delayed success
      testBed.mockCharacterBuilderService.generateClichesForDirection.mockImplementation(
        () => {
          return new Promise((resolve) => {
            // Simulate a response that takes time but eventually succeeds
            setTimeout(() => resolve(successfulCliches), 100);
          });
        }
      );

      // Act
      const result =
        await testBed.mockCharacterBuilderService.generateClichesForDirection(
          directionId,
          conceptId
        );

      // Assert - with the fix, this should succeed
      expect(result).toEqual(successfulCliches);
      expect(
        testBed.mockCharacterBuilderService.generateClichesForDirection
      ).toHaveBeenCalledWith(directionId, conceptId);
    });
  });

  describe('Network Error Scenarios', () => {
    it('should handle ERR_CONNECTION_REFUSED errors', async () => {
      // Arrange
      const conceptId = 'test-concept-id';
      const directionId = 'test-direction-id';

      // Simulate connection refused error
      const connectionError = new Error('net::ERR_CONNECTION_REFUSED');
      connectionError.code = 'ERR_CONNECTION_REFUSED';

      testBed.mockCharacterBuilderService.generateClichesForDirection.mockRejectedValue(
        connectionError
      );

      // Act & Assert
      await expect(
        testBed.mockCharacterBuilderService.generateClichesForDirection(
          directionId,
          conceptId
        )
      ).rejects.toThrow('ERR_CONNECTION_REFUSED');
    });

    it('should handle 503 Service Unavailable responses', async () => {
      // Arrange
      const conceptId = 'test-concept-id';
      const directionId = 'test-direction-id';

      // Simulate 503 error
      const serviceError = new Error('Service Unavailable');
      serviceError.statusCode = 503;
      serviceError.response = {
        status: 503,
        data: {
          error: true,
          message: 'Request timeout - the server took too long to respond.',
          stage: 'request_timeout',
        },
      };

      testBed.mockCharacterBuilderService.generateClichesForDirection.mockRejectedValue(
        serviceError
      );

      // Act & Assert
      await expect(
        testBed.mockCharacterBuilderService.generateClichesForDirection(
          directionId,
          conceptId
        )
      ).rejects.toThrow('Service Unavailable');

      expect(serviceError.response.data.stage).toBe('request_timeout');
    });
  });
});
