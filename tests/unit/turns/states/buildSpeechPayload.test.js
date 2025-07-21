import { describe, it, expect } from '@jest/globals';
import { buildSpeechPayload } from '../../../../src/turns/states/helpers/buildSpeechPayload.js';

describe('buildSpeechPayload', () => {
  it('returns null when speech is missing or blank', () => {
    expect(buildSpeechPayload({})).toBeNull();
    expect(buildSpeechPayload({ speech: '   ' })).toBeNull();
    expect(buildSpeechPayload({ speech: null })).toBeNull();
  });

  it('trims speech and includes optional fields', () => {
    const notesRaw = [' first ', 'second'];
    const payload = buildSpeechPayload({
      speech: ' hi ',
      thoughts: ' think ',
      notes: notesRaw,
    });
    expect(payload).toEqual({
      speechContent: 'hi',
      thoughts: 'think',
      notes: 'first\nsecond',
      notesRaw: notesRaw,
    });
  });

  it('handles notes as a string', () => {
    const notesRaw = ' note ';
    const payload = buildSpeechPayload({ speech: 'a', notes: notesRaw });
    expect(payload).toEqual({ 
      speechContent: 'a', 
      notes: 'note',
      notesRaw: notesRaw
    });
  });

  it('excludes notesRaw when notes are falsy', () => {
    const payload = buildSpeechPayload({ speech: 'hello' });
    expect(payload).toEqual({ speechContent: 'hello' });
    expect(payload).not.toHaveProperty('notesRaw');
  });

  it('includes notesRaw for structured notes', () => {
    const notesRaw = {
      text: 'Character observation',
      subject: 'Alice',
      subjectType: 'character'
    };
    const payload = buildSpeechPayload({ 
      speech: 'hello',
      notes: notesRaw 
    });
    expect(payload).toEqual({
      speechContent: 'hello',
      notes: '[character] Alice: Character observation',
      notesRaw: notesRaw
    });
  });
});
