/** @jest-environment node */

import { describe, it, expect } from '@jest/globals';
import {
  createMockDataFetcher,
  MockDataFetcher,
} from '../../common/mockFactories/index.js';
import fs from 'fs';

describe('createMockDataFetcher (in-memory)', () => {
  it('returns mapped data and clones results', async () => {
    const data = { value: 1 };
    const fetcher = createMockDataFetcher({
      pathToResponse: { '/test/path': data },
    });
    expect(fetcher).toBeInstanceOf(MockDataFetcher);

    const result1 = await fetcher.fetch('/test/path');
    expect(result1).toEqual(data);
    result1.value = 2;
    const result2 = await fetcher.fetch('/test/path');
    expect(result2).toEqual(data);
  });

  it('rejects for unmapped paths', async () => {
    const fetcher = createMockDataFetcher();
    await expect(fetcher.fetch('/missing')).rejects.toThrow('404');
  });
});

describe('createMockDataFetcher (disk)', () => {
  it('reads JSON files from disk when fromDisk is true', async () => {
    const fetcher = createMockDataFetcher({ fromDisk: true });
    const data = await fetcher.fetch('./data/game.json');
    const actual = JSON.parse(fs.readFileSync('data/game.json', 'utf8'));
    expect(data).toEqual(actual);
  });
});
