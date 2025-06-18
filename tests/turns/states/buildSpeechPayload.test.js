import { describe, it, expect } from '@jest/globals';
import { buildSpeechPayload } from '../../../src/turns/states/helpers/buildSpeechPayload.js';

describe('buildSpeechPayload', () => {
  it('returns null when speech is missing or blank', () => {
    expect(buildSpeechPayload({})).toBeNull();
    expect(buildSpeechPayload({ speech: '   ' })).toBeNull();
    expect(buildSpeechPayload({ speech: null })).toBeNull();
  });

  it('trims speech and includes optional fields', () => {
    const payload = buildSpeechPayload({
      speech: ' hi ',
      thoughts: ' think ',
      notes: [' first ', 'second'],
    });
    expect(payload).toEqual({
      speechContent: 'hi',
      thoughts: 'think',
      notes: 'first\nsecond',
    });
  });

  it('handles notes as a string', () => {
    const payload = buildSpeechPayload({ speech: 'a', notes: ' note ' });
    expect(payload).toEqual({ speechContent: 'a', notes: 'note' });
  });
});
