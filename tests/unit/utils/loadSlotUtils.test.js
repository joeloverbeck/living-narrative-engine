import { describe, it, expect, jest } from '@jest/globals';
import { fetchAndFormatLoadSlots } from '../../../src/utils/loadSlotUtils.js';
import { formatSaveFileMetadata } from '../../../src/domUI/helpers/slotDataFormatter.js';

describe('loadSlotUtils', () => {
  it('sorts slots by timestamp and keeps corrupted last', async () => {
    const service = {
      listManualSaveSlots: jest.fn().mockResolvedValue([
        {
          identifier: 'old',
          saveName: 'Old',
          timestamp: '2023-01-01T00:00:00Z',
          playtimeSeconds: 1,
          isCorrupted: false,
        },
        {
          identifier: 'new',
          saveName: 'New',
          timestamp: '2023-02-01T00:00:00Z',
          playtimeSeconds: 2,
          isCorrupted: false,
        },
        {
          identifier: 'bad',
          saveName: 'Bad',
          timestamp: '2023-03-01T00:00:00Z',
          playtimeSeconds: 3,
          isCorrupted: true,
        },
      ]),
    };

    const result = await fetchAndFormatLoadSlots(service);

    expect(service.listManualSaveSlots).toHaveBeenCalled();
    expect(result.map((s) => s.identifier)).toEqual(['new', 'old', 'bad']);
  });

  it('maps slot metadata using formatSaveFileMetadata', async () => {
    const save = {
      identifier: 'id',
      saveName: 'Name',
      timestamp: '2023-01-01T00:00:00Z',
      playtimeSeconds: 4,
      isCorrupted: false,
    };
    const service = {
      listManualSaveSlots: jest.fn().mockResolvedValue([save]),
    };

    const result = await fetchAndFormatLoadSlots(service);

    expect(result[0].slotItemMeta).toEqual(formatSaveFileMetadata(save));
  });

  it('unwraps persistence results returned by the save load service', async () => {
    const newest = {
      identifier: 'new',
      saveName: 'New',
      timestamp: '2024-02-01T00:00:00Z',
      playtimeSeconds: 10,
      isCorrupted: false,
    };
    const oldest = {
      identifier: 'old',
      saveName: 'Old',
      timestamp: '2024-01-01T00:00:00Z',
      playtimeSeconds: 5,
      isCorrupted: false,
    };
    const payload = [oldest, newest];
    const service = {
      listManualSaveSlots: jest
        .fn()
        .mockResolvedValue({ success: true, data: payload }),
    };

    const result = await fetchAndFormatLoadSlots(service);

    expect(service.listManualSaveSlots).toHaveBeenCalledTimes(1);
    expect(result.map((slot) => slot.identifier)).toEqual(['new', 'old']);
    expect(payload).toEqual([oldest, newest]);
  });

  it('throws an error when the persistence result indicates failure', async () => {
    const service = {
      listManualSaveSlots: jest.fn().mockResolvedValue({
        success: false,
        userFriendlyError: 'Could not read directory',
      }),
    };

    await expect(fetchAndFormatLoadSlots(service)).rejects.toThrow(
      'Could not read directory'
    );
  });
});
