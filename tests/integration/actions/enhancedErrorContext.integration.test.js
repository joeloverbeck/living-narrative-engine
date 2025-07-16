/**
 * @file Integration tests for enhanced error context system
 * @description Tests the complete error flow with enhanced context, traces, and suggestions
 */

import { jest } from '@jest/globals';
import { ActionDiscoveryServiceTestBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';
import {
  ERROR_PHASES,
  FIX_TYPES,
} from '../../../src/actions/errors/actionErrorTypes.js';

describe('Enhanced Error Context Integration Tests', () => {
  let testBed;

  beforeEach(() => {
    testBed = new ActionDiscoveryServiceTestBed();

    // Set up entity manager with test data
    testBed.mocks.entityManager.getEntity.mockImplementation((id) => ({
      id,
      type: 'actor',
      components: {
        'core:location': { value: 'tavern' },
        'core:health': { value: 100 },
      },
    }));

    testBed.mocks.entityManager.getAllComponents.mockImplementation(() => ({
      'core:location': { value: 'tavern' },
      'core:health': { value: 100 },
    }));

    // Set up game data repository with test data
    testBed.mocks.gameDataRepository.getComponentDefinition.mockImplementation(
      (id) => ({
        id,
        name: `Component ${id}`,
        description: `Test component ${id}`,
      })
    );

    testBed.mocks.gameDataRepository.getConditionDefinition.mockImplementation(
      (id) => ({
        id,
        name: `Condition ${id}`,
        description: `Test condition ${id}`,
      })
    );

    // Set up action index with test data
    testBed.mocks.actionIndex.getCandidateActions.mockImplementation(() => [
      {
        id: 'test-action',
        name: 'Test Action',
        description: 'A test action',
        prerequisites: [{ logic: { '==': [1, 1] } }],
        scope: 'self',
      },
    ]);
  });

  afterEach(() => {
    testBed?.cleanup();
  });

  describe('Discovery Phase Error Context', () => {
    it('should create enhanced error context for action candidate retrieval failures', async () => {
      // Arrange
      const retrievalError = new Error('Failed to retrieve candidates');
      retrievalError.name = 'ActionRetrievalError';

      testBed.mocks.actionIndex.getCandidateActions.mockImplementation(() => {
        throw retrievalError;
      });

      // Act
      const result = await testBed.service.getValidActions(
        { id: 'actor123' },
        {}
      );

      // Assert
      expect(result.errors).toHaveLength(1);
      const errorContext = result.errors[0];

      expect(errorContext).toMatchObject({
        actionId: 'candidateRetrieval',
        targetId: null,
        error: retrievalError,
        phase: ERROR_PHASES.DISCOVERY,
        timestamp: expect.any(Number),
      });

      expect(errorContext.actorSnapshot).toMatchObject({
        id: 'actor123',
        location: expect.any(String),
        components: expect.any(Object),
        metadata: expect.any(Object),
      });

      expect(errorContext.suggestedFixes).toEqual(expect.any(Array));
      expect(errorContext.environmentContext).toMatchObject({
        errorName: 'ActionRetrievalError',
        phase: ERROR_PHASES.DISCOVERY,
      });
    });
  });

  describe('Basic Error Context Functions', () => {
    it('should create enhanced error context for action processing failures', async () => {
      // Arrange
      const processingError = new Error('Processing failed');
      processingError.name = 'ProcessingError';

      testBed.mocks.prerequisiteEvaluationService.evaluate.mockImplementation(
        () => {
          throw processingError;
        }
      );

      testBed.mocks.targetResolutionService.resolveTargets.mockReturnValue({
        targets: [{ type: 'none', entityId: null }],
      });

      testBed.mocks.actionCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'test command',
      });

      // Act
      const result = await testBed.service.getValidActions(
        { id: 'actor123' },
        {}
      );

      // Assert
      expect(result.errors).toHaveLength(1);
      const errorContext = result.errors[0];

      expect(errorContext).toMatchObject({
        actionId: 'test-action',
        error: processingError,
        phase: expect.any(String),
        timestamp: expect.any(Number),
      });

      expect(errorContext.actorSnapshot).toMatchObject({
        id: 'actor123',
        location: expect.any(String),
        components: expect.any(Object),
        metadata: expect.any(Object),
      });

      expect(errorContext.suggestedFixes).toEqual(expect.any(Array));
      expect(errorContext.environmentContext).toMatchObject({
        errorName: 'ProcessingError',
        phase: expect.any(String),
      });
    });
  });
});
