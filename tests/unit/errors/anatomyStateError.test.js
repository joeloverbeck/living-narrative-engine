import { describe, it, expect } from '@jest/globals';
import { AnatomyStateError } from '../../../src/errors/anatomyStateError.js';
import { AnatomyVisualizationError } from '../../../src/errors/anatomyVisualizationError.js';

describe('AnatomyStateError', () => {
  describe('constructor', () => {
    it('should create an instance of AnatomyStateError', () => {
      const error = new AnatomyStateError('Test error');
      expect(error).toBeInstanceOf(AnatomyStateError);
      expect(error).toBeInstanceOf(AnatomyVisualizationError);
      expect(error).toBeInstanceOf(Error);
    });

    it('should set proper default values when no options provided', () => {
      const error = new AnatomyStateError('Test error');
      expect(error.name).toBe('AnatomyStateError');
      expect(error.message).toBe('Test error');
      expect(error.currentState).toBeNull();
      expect(error.targetState).toBeNull();
      expect(error.operation).toBeNull();
      expect(error.stateData).toBeNull();
      expect(error.reason).toBeNull();
      expect(error.code).toBe('ANATOMY_STATE_ERROR');
      expect(error.severity).toBe('MEDIUM');
    });

    it('should set all provided options correctly', () => {
      const options = {
        currentState: 'IDLE',
        targetState: 'LOADING',
        operation: 'entity_selection',
        stateData: { entityId: 'test-entity' },
        reason: 'invalid_transition',
        metadata: { test: 'value' },
      };

      const error = new AnatomyStateError('Test error', options);
      expect(error.currentState).toBe('IDLE');
      expect(error.targetState).toBe('LOADING');
      expect(error.operation).toBe('entity_selection');
      expect(error.stateData).toEqual({ entityId: 'test-entity' });
      expect(error.reason).toBe('invalid_transition');
      expect(error.metadata).toEqual({ test: 'value' });
    });

    it('should use static method values passed through options', () => {
      const error = new AnatomyStateError('Test error', {
        currentState: 'IDLE',
        targetState: 'LOADING',
        operation: 'entity_selection',
        reason: 'transition_not_allowed',
      });

      expect(error.userMessage).toBe(
        'Could not select the entity for visualization.'
      );
      // Suggestions are determined by _getSuggestions based on operation and reason
      expect(error.suggestions).toContain(
        'Wait for the current operation to complete'
      );
      expect(error.suggestions).toContain('Try resetting the visualizer');
    });

    it('should pass parent options to super class', () => {
      const error = new AnatomyStateError('Test error', {
        currentState: 'ERROR',
        targetState: 'IDLE',
        operation: 'reset',
        severity: 'HIGH',
        recoverable: false,
      });

      expect(error.severity).toBe('HIGH');
      expect(error.recoverable).toBe(false);
    });
  });

  describe('invalidStateTransition', () => {
    it('should create error with correct properties', () => {
      const error = AnatomyStateError.invalidStateTransition(
        'IDLE',
        'ERROR',
        'entity_selection'
      );

      expect(error).toBeInstanceOf(AnatomyStateError);
      expect(error.message).toBe(
        'Invalid state transition from IDLE to ERROR during entity_selection'
      );
      expect(error.code).toBe('INVALID_STATE_TRANSITION');
      expect(error.currentState).toBe('IDLE');
      expect(error.targetState).toBe('ERROR');
      expect(error.operation).toBe('entity_selection');
      expect(error.reason).toBe('transition_not_allowed');
      expect(error.severity).toBe('HIGH');
      expect(error.recoverable).toBe(true);
      // The static method passes userMessage and suggestions directly in options
      // which override the _getUserMessage and _getSuggestions methods
      expect(error.userMessage).toBe(
        'The anatomy visualizer is in an invalid state for this operation.'
      );
      expect(error.suggestions).toEqual([
        'Wait for the current operation to complete',
        'Try resetting the visualizer',
        'Refresh the page if the problem persists',
      ]);
    });
  });

  describe('initializationFailed', () => {
    it('should create error with correct properties and cause', () => {
      const cause = new Error('Network error');
      const error = AnatomyStateError.initializationFailed(
        'Network connection failed',
        cause
      );

      expect(error).toBeInstanceOf(AnatomyStateError);
      expect(error.message).toBe(
        'State initialization failed: Network connection failed'
      );
      expect(error.code).toBe('STATE_INITIALIZATION_FAILED');
      expect(error.currentState).toBe('UNINITIALIZED');
      expect(error.targetState).toBe('IDLE');
      expect(error.operation).toBe('initialization');
      expect(error.reason).toBe('Network connection failed');
      expect(error.cause).toBe(cause);
      expect(error.severity).toBe('CRITICAL');
      expect(error.recoverable).toBe(false);
      // The static method passes userMessage and suggestions directly in options
      expect(error.userMessage).toBe(
        'The anatomy visualizer could not be initialized.'
      );
      expect(error.suggestions).toEqual([
        'Refresh the page to restart the visualizer',
        'Check your browser console for more details',
        'Ensure your browser supports required features',
      ]);
    });
  });

  describe('operationTimeout', () => {
    it('should create error with correct properties', () => {
      const error = AnatomyStateError.operationTimeout(
        'anatomy_loading',
        5000,
        'LOADING'
      );

      expect(error).toBeInstanceOf(AnatomyStateError);
      expect(error.message).toBe(
        'Operation anatomy_loading timed out after 5000ms in state LOADING'
      );
      expect(error.code).toBe('OPERATION_TIMEOUT');
      expect(error.currentState).toBe('LOADING');
      expect(error.operation).toBe('anatomy_loading');
      expect(error.reason).toBe('timeout');
      expect(error.metadata).toEqual({ timeout: 5000 });
      expect(error.severity).toBe('MEDIUM');
      expect(error.recoverable).toBe(true);
      // The static method passes userMessage and suggestions directly in options
      expect(error.userMessage).toBe(
        'The operation is taking longer than expected.'
      );
      expect(error.suggestions).toEqual([
        'Try the operation again',
        'Check your network connection',
        'The entity may have complex anatomy that takes time to process',
      ]);
    });
  });

  describe('stateCorruption', () => {
    it('should create error with correct properties', () => {
      const stateData = { entities: [], selected: 'invalid-id' };
      const error = AnatomyStateError.stateCorruption(
        'RENDERING',
        stateData,
        'missing_entity_data'
      );

      expect(error).toBeInstanceOf(AnatomyStateError);
      expect(error.message).toBe(
        'State corruption detected in RENDERING: missing_entity_data'
      );
      expect(error.code).toBe('STATE_CORRUPTION');
      expect(error.currentState).toBe('RENDERING');
      expect(error.stateData).toEqual(stateData);
      expect(error.reason).toBe('missing_entity_data');
      expect(error.severity).toBe('HIGH');
      expect(error.recoverable).toBe(false);
      // The static method passes userMessage and suggestions directly in options
      expect(error.userMessage).toBe(
        'The anatomy visualizer state has become corrupted.'
      );
      expect(error.suggestions).toEqual([
        'Reset the visualizer to clear the corrupted state',
        'Refresh the page to restart completely',
        'Try selecting a different entity',
      ]);
    });
  });

  describe('concurrentOperationConflict', () => {
    it('should create error with correct properties', () => {
      const error = AnatomyStateError.concurrentOperationConflict(
        'anatomy_loading',
        'entity_selection',
        'LOADING'
      );

      expect(error).toBeInstanceOf(AnatomyStateError);
      expect(error.message).toBe(
        'Cannot perform entity_selection while anatomy_loading is in progress in state LOADING'
      );
      expect(error.code).toBe('CONCURRENT_OPERATION_CONFLICT');
      expect(error.currentState).toBe('LOADING');
      expect(error.operation).toBe('entity_selection');
      expect(error.reason).toBe('concurrent_operation');
      expect(error.metadata).toEqual({
        currentOperation: 'anatomy_loading',
        attemptedOperation: 'entity_selection',
      });
      expect(error.severity).toBe('MEDIUM');
      expect(error.recoverable).toBe(true);
      // The static method passes userMessage and suggestions directly in options
      expect(error.userMessage).toBe(
        'Another operation is currently in progress.'
      );
      expect(error.suggestions).toEqual([
        'Wait for the current operation to complete',
        'Try again in a few moments',
        'Cancel the current operation if possible',
      ]);
    });
  });

  describe('missingRequiredStateData', () => {
    it('should create error with correct properties', () => {
      const error = AnatomyStateError.missingRequiredStateData(
        'RENDERING',
        'anatomy_data',
        'rendering'
      );

      expect(error).toBeInstanceOf(AnatomyStateError);
      expect(error.message).toBe(
        "Missing required state data 'anatomy_data' for operation rendering in state RENDERING"
      );
      expect(error.code).toBe('MISSING_REQUIRED_STATE_DATA');
      expect(error.currentState).toBe('RENDERING');
      expect(error.operation).toBe('rendering');
      expect(error.reason).toBe('missing_anatomy_data');
      expect(error.severity).toBe('HIGH');
      expect(error.recoverable).toBe(true);
      // The static method passes userMessage and suggestions directly in options
      expect(error.userMessage).toBe(
        'Required information is missing for this operation.'
      );
      expect(error.suggestions).toEqual([
        'Try starting the process over',
        'Select an entity first if none is selected',
        'Ensure all required steps have been completed',
      ]);
    });
  });

  describe('_getUserMessage', () => {
    it('should return correct message for initialization operation', () => {
      const error = new AnatomyStateError('Test', {
        operation: 'initialization',
      });
      expect(error.userMessage).toBe(
        'The anatomy visualizer could not be started.'
      );
    });

    it('should return correct message for entity_selection operation', () => {
      const error = new AnatomyStateError('Test', {
        operation: 'entity_selection',
      });
      expect(error.userMessage).toBe(
        'Could not select the entity for visualization.'
      );
    });

    it('should return correct message for anatomy_loading operation', () => {
      const error = new AnatomyStateError('Test', {
        operation: 'anatomy_loading',
      });
      expect(error.userMessage).toBe(
        'Could not load anatomy data for the selected entity.'
      );
    });

    it('should return correct message for rendering operation', () => {
      const error = new AnatomyStateError('Test', {
        operation: 'rendering',
      });
      expect(error.userMessage).toBe(
        'Could not render the anatomy visualization.'
      );
    });

    it('should return correct message for reset operation', () => {
      const error = new AnatomyStateError('Test', {
        operation: 'reset',
      });
      expect(error.userMessage).toBe('Could not reset the anatomy visualizer.');
    });

    it('should return correct message for retry operation', () => {
      const error = new AnatomyStateError('Test', {
        operation: 'retry',
      });
      expect(error.userMessage).toBe('Could not retry the previous operation.');
    });

    it('should return correct message when currentState is ERROR', () => {
      const error = new AnatomyStateError('Test', {
        currentState: 'ERROR',
        operation: 'unknown',
      });
      expect(error.userMessage).toBe(
        'The anatomy visualizer is in an error state.'
      );
    });

    it('should return correct message when currentState is LOADING', () => {
      const error = new AnatomyStateError('Test', {
        currentState: 'LOADING',
        operation: 'unknown',
      });
      expect(error.userMessage).toBe('An operation is already in progress.');
    });

    it('should return default message for unknown operation and state', () => {
      const error = new AnatomyStateError('Test', {
        currentState: 'IDLE',
        operation: 'unknown',
      });
      expect(error.userMessage).toBe(
        'The anatomy visualizer encountered a state error.'
      );
    });
  });

  describe('_getSuggestions', () => {
    it('should return suggestions for transition_not_allowed reason', () => {
      const error = new AnatomyStateError('Test', {
        reason: 'transition_not_allowed',
      });
      expect(error.suggestions).toEqual([
        'Wait for the current operation to complete',
        'Try resetting the visualizer',
      ]);
    });

    it('should return suggestions for timeout reason', () => {
      const error = new AnatomyStateError('Test', {
        reason: 'timeout',
      });
      expect(error.suggestions).toEqual([
        'Try the operation again',
        'Check your network connection',
      ]);
    });

    it('should return suggestions for concurrent_operation reason', () => {
      const error = new AnatomyStateError('Test', {
        reason: 'concurrent_operation',
      });
      expect(error.suggestions).toEqual([
        'Wait for the current operation to finish',
        'Try again in a few moments',
      ]);
    });

    it('should return suggestions for initialization operation with no specific reason', () => {
      const error = new AnatomyStateError('Test', {
        operation: 'initialization',
        reason: 'other',
      });
      expect(error.suggestions).toEqual([
        'Refresh the page to restart',
        'Check browser compatibility',
      ]);
    });

    it('should return suggestions for entity_selection operation with no specific reason', () => {
      const error = new AnatomyStateError('Test', {
        operation: 'entity_selection',
        reason: 'other',
      });
      expect(error.suggestions).toEqual([
        'Try selecting a different entity',
        'Ensure the entity has valid data',
      ]);
    });

    it('should return suggestions for anatomy_loading operation with no specific reason', () => {
      const error = new AnatomyStateError('Test', {
        operation: 'anatomy_loading',
        reason: 'other',
      });
      expect(error.suggestions).toEqual([
        'Check your network connection',
        'Try a different entity',
      ]);
    });

    it('should return suggestions for rendering operation with no specific reason', () => {
      const error = new AnatomyStateError('Test', {
        operation: 'rendering',
        reason: 'other',
      });
      expect(error.suggestions).toEqual([
        'Try refreshing the page',
        'Select an entity with simpler anatomy',
      ]);
    });

    it('should return default suggestions for unknown operation and reason', () => {
      const error = new AnatomyStateError('Test', {
        operation: 'unknown',
        reason: 'unknown',
      });
      expect(error.suggestions).toEqual([
        'Try refreshing the page',
        'Reset the visualizer if possible',
      ]);
    });

    it('should return default suggestions when operation and reason are null', () => {
      // When both are null, it goes to default case in switch statement
      const message = AnatomyStateError._getSuggestions(null, null);
      expect(message).toEqual([
        'Try refreshing the page',
        'Reset the visualizer if possible',
      ]);
    });
  });
});
