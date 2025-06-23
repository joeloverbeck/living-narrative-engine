import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { extractValidFilenames } from '../../../../src/loaders/helpers/filenameUtils.js';

describe('extractValidFilenames', () => {
  let logger;

  beforeEach(() => {
    logger = { warn: jest.fn(), debug: jest.fn() };
  });

  it('returns trimmed filenames', () => {
    const manifest = { content: { actions: [' a.json ', 'b.json'] } };
    const result = extractValidFilenames(manifest, 'actions', 'modA', logger);
    expect(result).toEqual(['a.json', 'b.json']);
  });

  it('logs warning when value is not an array', () => {
    const manifest = { content: { actions: 'bad' } };
    const result = extractValidFilenames(manifest, 'actions', 'modA', logger);
    expect(result).toEqual([]);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('filters invalid entries', () => {
    const manifest = { content: { actions: [123, ' file.json ', null] } };
    const result = extractValidFilenames(manifest, 'actions', 'modA', logger);
    expect(result).toEqual(['file.json']);
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });
});
