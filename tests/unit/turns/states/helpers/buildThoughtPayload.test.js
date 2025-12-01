/**
 * @file Tests for buildThoughtPayload helper function
 */

import { describe, it, expect } from '@jest/globals';
import { buildThoughtPayload } from '../../../../../src/turns/states/helpers/buildThoughtPayload.js';

describe('buildThoughtPayload', () => {
  const mockEntityId = 'test-entity-123';

  it('should build payload with thoughts only', () => {
    const decisionMeta = {
      thoughts: 'I wonder what they are thinking...',
    };

    const result = buildThoughtPayload(decisionMeta, mockEntityId);

    expect(result).toEqual({
      entityId: mockEntityId,
      thoughts: 'I wonder what they are thinking...',
    });
  });

  it('should build payload with thoughts and notes', () => {
    const decisionMeta = {
      thoughts: 'This is suspicious...',
      notes: [
        {
          text: 'Noticed something odd',
          subject: 'observation',
          subjectType: 'event',
        },
      ],
    };

    const result = buildThoughtPayload(decisionMeta, mockEntityId);

    expect(result).toEqual({
      entityId: mockEntityId,
      thoughts: 'This is suspicious...',
      notes: [
        {
          text: 'Noticed something odd',
          subject: 'observation',
          subjectType: 'event',
        },
      ],
    });
  });

  it('should trim whitespace from thoughts', () => {
    const decisionMeta = {
      thoughts: '   Thinking deeply...   ',
    };

    const result = buildThoughtPayload(decisionMeta, mockEntityId);

    expect(result).toEqual({
      entityId: mockEntityId,
      thoughts: 'Thinking deeply...',
    });
  });

  it('should return null when thoughts are empty string', () => {
    const decisionMeta = {
      thoughts: '',
      notes: ['some notes'],
    };

    const result = buildThoughtPayload(decisionMeta, mockEntityId);

    expect(result).toBeNull();
  });

  it('should return null when thoughts are only whitespace', () => {
    const decisionMeta = {
      thoughts: '   \t\n   ',
      notes: ['some notes'],
    };

    const result = buildThoughtPayload(decisionMeta, mockEntityId);

    expect(result).toBeNull();
  });

  it('should return null when thoughts are null', () => {
    const decisionMeta = {
      thoughts: null,
      notes: ['some notes'],
    };

    const result = buildThoughtPayload(decisionMeta, mockEntityId);

    expect(result).toBeNull();
  });

  it('should return null when thoughts are undefined', () => {
    const decisionMeta = {
      thoughts: undefined,
      notes: ['some notes'],
    };

    const result = buildThoughtPayload(decisionMeta, mockEntityId);

    expect(result).toBeNull();
  });

  it('should return null when thoughts are not a string', () => {
    const decisionMeta = {
      thoughts: 123,
      notes: ['some notes'],
    };

    const result = buildThoughtPayload(decisionMeta, mockEntityId);

    expect(result).toBeNull();
  });

  it('should return null when decisionMeta is null', () => {
    const result = buildThoughtPayload(null, mockEntityId);

    expect(result).toBeNull();
  });

  it('should return null when decisionMeta is undefined', () => {
    const result = buildThoughtPayload(undefined, mockEntityId);

    expect(result).toBeNull();
  });

  it('should exclude notes when they are falsy', () => {
    const decisionMeta = {
      thoughts: 'Just thinking...',
      notes: null,
    };

    const result = buildThoughtPayload(decisionMeta, mockEntityId);

    expect(result).toEqual({
      entityId: mockEntityId,
      thoughts: 'Just thinking...',
    });
    expect(result).not.toHaveProperty('notes');
  });

  it('should include notes when they are empty array', () => {
    const decisionMeta = {
      thoughts: 'Thinking about nothing...',
      notes: [],
    };

    const result = buildThoughtPayload(decisionMeta, mockEntityId);

    expect(result).toEqual({
      entityId: mockEntityId,
      thoughts: 'Thinking about nothing...',
      notes: [],
    });
  });

  it('should mark suppressDisplay when previewDisplayed is true', () => {
    const result = buildThoughtPayload(
      { thoughts: 'Maybe wait', previewDisplayed: true },
      mockEntityId
    );

    expect(result).toEqual({
      entityId: mockEntityId,
      thoughts: 'Maybe wait',
      suppressDisplay: true,
    });
  });
});
