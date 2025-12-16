// tests/unit/domUI/location/presenceMessageBuilder.test.js
/**
 * @file Unit tests for presenceMessageBuilder helper.
 */

import { describe, it, expect } from '@jest/globals';
import {
  getPresenceMessage,
  PRESENCE_MESSAGES,
} from '../../../../src/domUI/location/presenceMessageBuilder.js';

describe('getPresenceMessage', () => {
  describe('NONE message (count = 0)', () => {
    it('should return NONE message when count is 0', () => {
      const result = getPresenceMessage(0);
      expect(result).toBe(PRESENCE_MESSAGES.NONE);
    });
  });

  describe('ONE message (count = 1)', () => {
    it('should return ONE message when count is 1', () => {
      const result = getPresenceMessage(1);
      expect(result).toBe(PRESENCE_MESSAGES.ONE);
    });
  });

  describe('FEW message (count = 2-3)', () => {
    it('should return FEW message when count is 2', () => {
      const result = getPresenceMessage(2);
      expect(result).toBe(PRESENCE_MESSAGES.FEW);
    });

    it('should return FEW message when count is 3', () => {
      const result = getPresenceMessage(3);
      expect(result).toBe(PRESENCE_MESSAGES.FEW);
    });
  });

  describe('SEVERAL message (count >= 4)', () => {
    it('should return SEVERAL message when count is 4', () => {
      const result = getPresenceMessage(4);
      expect(result).toBe(PRESENCE_MESSAGES.SEVERAL);
    });

    it('should return SEVERAL message when count is 10', () => {
      const result = getPresenceMessage(10);
      expect(result).toBe(PRESENCE_MESSAGES.SEVERAL);
    });

    it('should return SEVERAL message when count is 100', () => {
      const result = getPresenceMessage(100);
      expect(result).toBe(PRESENCE_MESSAGES.SEVERAL);
    });
  });
});

describe('PRESENCE_MESSAGES constant', () => {
  it('should export NONE message with correct text', () => {
    expect(PRESENCE_MESSAGES.NONE).toBe(
      "You can't see anything in the dark, but you sense no other presence here."
    );
  });

  it('should export ONE message with correct text', () => {
    expect(PRESENCE_MESSAGES.ONE).toBe(
      "You can't see anything in the dark, but you sense a presence here."
    );
  });

  it('should export FEW message with correct text', () => {
    expect(PRESENCE_MESSAGES.FEW).toBe(
      "You can't see anything in the dark, but you sense a few presences here."
    );
  });

  it('should export SEVERAL message with correct text', () => {
    expect(PRESENCE_MESSAGES.SEVERAL).toBe(
      "You can't see anything in the dark, but you sense several presences here."
    );
  });

  it('should have exactly 4 message types', () => {
    expect(Object.keys(PRESENCE_MESSAGES)).toHaveLength(4);
    expect(Object.keys(PRESENCE_MESSAGES)).toEqual([
      'NONE',
      'ONE',
      'FEW',
      'SEVERAL',
    ]);
  });
});
