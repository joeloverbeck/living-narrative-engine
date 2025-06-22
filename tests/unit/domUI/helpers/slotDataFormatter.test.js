import { describe, it, expect } from '@jest/globals';
import {
  formatSaveFileMetadata,
  formatEmptySlot,
} from '../../../../src/domUI/helpers/slotDataFormatter.js';

describe('slotDataFormatter helpers', () => {
  it('formats uncorrupted metadata', () => {
    const meta = {
      saveName: 'Slot1',
      identifier: 'slot1',
      timestamp: '2024-01-01T00:00:00Z',
      playtimeSeconds: 65,
      isCorrupted: false,
    };
    const result = formatSaveFileMetadata(meta);
    expect(result.name).toBe('Slot1');
    expect(result.isCorrupted).toBe(false);
    expect(result.playtime).toContain('Playtime:');
    expect(result.timestamp.startsWith('Saved:')).toBe(true);
  });

  it('formats corrupted metadata with early return', () => {
    const meta = {
      saveName: 'Bad',
      identifier: 'bad1',
      timestamp: '2024-01-01T00:00:00Z',
      playtimeSeconds: 10,
      isCorrupted: true,
    };
    const result = formatSaveFileMetadata(meta);
    expect(result.isCorrupted).toBe(true);
    expect(result.timestamp).toBe('Timestamp: N/A');
    expect(result.playtime).toBe('');
  });

  it('creates empty slot metadata', () => {
    const result = formatEmptySlot('Empty');
    expect(result).toEqual({
      name: 'Empty',
      timestamp: '',
      playtime: '',
      isEmpty: true,
      isCorrupted: false,
    });
  });
});
