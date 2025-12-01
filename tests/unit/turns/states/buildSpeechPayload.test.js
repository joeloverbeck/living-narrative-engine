import { describe, it, expect } from '@jest/globals';
import { buildSpeechPayload } from '../../../../src/turns/states/helpers/buildSpeechPayload.js';

describe('buildSpeechPayload', () => {
  it('returns null when speech is missing or blank', () => {
    expect(buildSpeechPayload({})).toBeNull();
    expect(buildSpeechPayload({ speech: '   ' })).toBeNull();
    expect(buildSpeechPayload({ speech: null })).toBeNull();
  });

  it('trims speech and includes optional fields', () => {
    const notes = [' first ', 'second'];
    const payload = buildSpeechPayload({
      speech: ' hi ',
      thoughts: ' think ',
      notes: notes,
    });
    expect(payload).toEqual({
      speechContent: 'hi',
      thoughts: 'think',
      notes: notes,
    });
  });

  it('handles notes as a string', () => {
    const notes = ' note ';
    const payload = buildSpeechPayload({ speech: 'a', notes: notes });
    expect(payload).toEqual({
      speechContent: 'a',
      notes: notes,
    });
  });

  it('excludes notes when notes are falsy', () => {
    const payload = buildSpeechPayload({ speech: 'hello' });
    expect(payload).toEqual({ speechContent: 'hello' });
    expect(payload).not.toHaveProperty('notes');
  });

  it('includes notes for structured notes', () => {
    const notes = {
      text: 'Character observation',
      subject: 'Alice',
      subjectType: 'character',
    };
    const payload = buildSpeechPayload({
      speech: 'hello',
      notes: notes,
    });
    expect(payload).toEqual({
      speechContent: 'hello',
      notes: notes,
    });
  });

  it('marks suppressDisplay when previewDisplayed is true', () => {
    const payload = buildSpeechPayload({
      speech: 'Preview line',
      previewDisplayed: true,
    });
    expect(payload).toEqual({
      speechContent: 'Preview line',
      suppressDisplay: true,
    });
  });
});
