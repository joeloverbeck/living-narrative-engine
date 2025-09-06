/**
 * @file Test for DISPATCH_THOUGHT operation handler null-safety and validation
 * @description Tests the DispatchThoughtHandler to ensure proper handling of optional notes field
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import DispatchThoughtHandler from '../../../src/logic/operationHandlers/dispatchThoughtHandler.js';
import { DISPLAY_THOUGHT_ID } from '../../../src/constants/eventIds.js';

describe('DispatchThoughtHandler - Optional Notes Handling', () => {
  let testBed;
  let handler;
  let mockDispatcher;
  let executionContext;

  beforeEach(() => {
    testBed = createTestBed();
    
    mockDispatcher = {
      dispatch: jest.fn(),
    };

    handler = new DispatchThoughtHandler({
      dispatcher: mockDispatcher,
      logger: testBed.logger,
    });

    executionContext = {
      logger: testBed.logger,
    };
  });

  describe('Required Parameters Validation', () => {
    it('should require entity_id parameter', () => {
      // Arrange
      const params = {
        thoughts: 'Some thoughts here',
      };

      // Act
      handler.execute(params, executionContext);

      // Assert - should dispatch error event, not the main event
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('entity_id'),
        })
      );
      
      // Should not dispatch the main thought event
      expect(mockDispatcher.dispatch).not.toHaveBeenCalledWith(
        DISPLAY_THOUGHT_ID,
        expect.any(Object)
      );
    });

    it('should require thoughts parameter', () => {
      // Arrange
      const params = {
        entity_id: 'player',
      };

      // Act
      handler.execute(params, executionContext);

      // Assert - should dispatch error event, not the main event
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('thoughts'),
        })
      );
      
      // Should not dispatch the main thought event
      expect(mockDispatcher.dispatch).not.toHaveBeenCalledWith(
        DISPLAY_THOUGHT_ID,
        expect.any(Object)
      );
    });

    it('should reject empty string entity_id', () => {
      // Arrange
      const params = {
        entity_id: '',
        thoughts: 'Some thoughts',
      };

      // Act
      handler.execute(params, executionContext);

      // Assert - should dispatch error event, not the main event
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('entity_id'),
        })
      );
      
      // Should not dispatch the main thought event
      expect(mockDispatcher.dispatch).not.toHaveBeenCalledWith(
        DISPLAY_THOUGHT_ID,
        expect.any(Object)
      );
    });

    it('should reject empty string thoughts', () => {
      // Arrange
      const params = {
        entity_id: 'player',
        thoughts: '',
      };

      // Act
      handler.execute(params, executionContext);

      // Assert - should dispatch error event, not the main event
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('thoughts'),
        })
      );
      
      // Should not dispatch the main thought event
      expect(mockDispatcher.dispatch).not.toHaveBeenCalledWith(
        DISPLAY_THOUGHT_ID,
        expect.any(Object)
      );
    });
  });

  describe('Optional Notes Parameter Handling', () => {
    it('should dispatch event without notes when notes is undefined', () => {
      // Arrange
      const params = {
        entity_id: 'player',
        thoughts: 'Deep philosophical thoughts',
        // notes is undefined
      };

      // Act
      handler.execute(params, executionContext);

      // Assert
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(DISPLAY_THOUGHT_ID, {
        entityId: 'player',
        thoughts: 'Deep philosophical thoughts',
        // notes should not be present in payload
      });

      const dispatchCall = mockDispatcher.dispatch.mock.calls[0];
      const payload = dispatchCall[1];
      expect(payload).not.toHaveProperty('notes');
    });

    it('should dispatch event without notes when notes is null', () => {
      // Arrange
      const params = {
        entity_id: 'player',
        thoughts: 'Deep philosophical thoughts',
        notes: null,
      };

      // Act
      handler.execute(params, executionContext);

      // Assert - null notes should be excluded after our fix
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(DISPLAY_THOUGHT_ID, {
        entityId: 'player',
        thoughts: 'Deep philosophical thoughts',
        // notes should not be present when null
      });

      const dispatchCall = mockDispatcher.dispatch.mock.calls[0];
      const payload = dispatchCall[1];
      expect(payload).not.toHaveProperty('notes');
    });

    it('should dispatch event with notes when notes is a valid array of note objects', () => {
      // Arrange
      const params = {
        entity_id: 'player',
        thoughts: 'Deep philosophical thoughts',
        notes: [
          { text: 'Additional context notes' },
          { text: 'Another note', subject: 'memory', subjectType: 'emotion' }
        ],
      };

      // Act
      handler.execute(params, executionContext);

      // Assert
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(DISPLAY_THOUGHT_ID, {
        entityId: 'player',
        thoughts: 'Deep philosophical thoughts',
        notes: [
          { text: 'Additional context notes' },
          { text: 'Another note', subject: 'memory', subjectType: 'emotion' }
        ],
      });
    });

    it('should exclude empty string notes from payload', () => {
      // Arrange - after our fix, empty strings should be excluded
      const params = {
        entity_id: 'player',
        thoughts: 'Deep philosophical thoughts',
        notes: '',
      };

      // Act
      handler.execute(params, executionContext);

      // Assert - empty strings should be filtered out
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(DISPLAY_THOUGHT_ID, {
        entityId: 'player',
        thoughts: 'Deep philosophical thoughts',
        // notes should not be present
      });

      const dispatchCall = mockDispatcher.dispatch.mock.calls[0];
      const payload = dispatchCall[1];
      expect(payload).not.toHaveProperty('notes');
    });

    it('should exclude whitespace-only notes from payload', () => {
      // Arrange - after our fix, whitespace-only strings should be excluded
      const params = {
        entity_id: 'player',
        thoughts: 'Deep philosophical thoughts',
        notes: '   ',
      };

      // Act
      handler.execute(params, executionContext);

      // Assert - whitespace-only strings should be filtered out
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(DISPLAY_THOUGHT_ID, {
        entityId: 'player',
        thoughts: 'Deep philosophical thoughts',
        // notes should not be present
      });

      const dispatchCall = mockDispatcher.dispatch.mock.calls[0];
      const payload = dispatchCall[1];
      expect(payload).not.toHaveProperty('notes');
    });

    it('should exclude empty array notes from payload', () => {
      // Arrange - empty arrays should be excluded per production code logic
      const params = {
        entity_id: 'player',
        thoughts: 'Deep philosophical thoughts',
        notes: [],
      };

      // Act
      handler.execute(params, executionContext);

      // Assert - empty arrays should be filtered out
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(DISPLAY_THOUGHT_ID, {
        entityId: 'player',
        thoughts: 'Deep philosophical thoughts',
        // notes should not be present
      });

      const dispatchCall = mockDispatcher.dispatch.mock.calls[0];
      const payload = dispatchCall[1];
      expect(payload).not.toHaveProperty('notes');
    });

    it('should include notes array with single note object', () => {
      // Arrange
      const params = {
        entity_id: 'player',
        thoughts: 'Deep philosophical thoughts',
        notes: [{ text: 'A single structured note' }],
      };

      // Act
      handler.execute(params, executionContext);

      // Assert
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(DISPLAY_THOUGHT_ID, {
        entityId: 'player',
        thoughts: 'Deep philosophical thoughts',
        notes: [{ text: 'A single structured note' }],
      });
    });
  });

  describe('Template Processing Simulation', () => {
    it('should handle template-resolved undefined notes gracefully', () => {
      // Arrange - simulating what happens when template {event.payload.notes} resolves to undefined
      const params = {
        entity_id: 'player',
        thoughts: 'Template-generated thoughts',
        notes: undefined, // This is what the template system should produce for missing values
      };

      // Act
      handler.execute(params, executionContext);

      // Assert
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(DISPLAY_THOUGHT_ID, {
        entityId: 'player',
        thoughts: 'Template-generated thoughts',
        // notes should not be in payload when undefined
      });

      const dispatchCall = mockDispatcher.dispatch.mock.calls[0];
      const payload = dispatchCall[1];
      expect(payload).not.toHaveProperty('notes');
    });

    it('should handle template-resolved empty string notes', () => {
      // Arrange - simulating what happens when template resolves to empty string
      const params = {
        entity_id: 'player',
        thoughts: 'Template-generated thoughts',
        notes: '', // This might happen if template system produces empty strings
      };

      // Act
      handler.execute(params, executionContext);

      // Assert - empty strings should be filtered out after our fix
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(DISPLAY_THOUGHT_ID, {
        entityId: 'player',
        thoughts: 'Template-generated thoughts',
        // notes should not be present
      });

      const dispatchCall = mockDispatcher.dispatch.mock.calls[0];
      const payload = dispatchCall[1];
      expect(payload).not.toHaveProperty('notes');
    });
  });

  describe('Error Handling', () => {
    it('should handle dispatcher errors gracefully', () => {
      // Arrange
      const params = {
        entity_id: 'player',
        thoughts: 'Some thoughts',
      };

      // Mock dispatch to throw error only for the first call (main event), but not for error event
      let callCount = 0;
      mockDispatcher.dispatch.mockImplementation((eventType) => {
        callCount++;
        if (callCount === 1 && eventType === DISPLAY_THOUGHT_ID) {
          throw new Error('Dispatch failed');
        }
        return; // Don't throw for error events
      });

      // Act - should not throw
      expect(() => {
        handler.execute(params, executionContext);
      }).not.toThrow();

      // Assert
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(DISPLAY_THOUGHT_ID, expect.any(Object));
      // Error event should be dispatched
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('Error dispatching display_thought'),
        })
      );
    });
  });
});