import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  jest,
} from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}));

const fetcherModuleFile = fileURLToPath(
  new URL('../../../scripts/utils/nodeDataFetcher.js', import.meta.url)
);
const projectRoot = path.resolve(path.dirname(fetcherModuleFile), '..', '..');

let NodeDataFetcher;
let fsPromises;

describe('NodeDataFetcher', () => {
  let fetcher;

  beforeAll(async () => {
    ({ default: NodeDataFetcher } = await import(
      '../../../scripts/utils/nodeDataFetcher.js'
    ));
    ({ promises: fsPromises } = await import('fs'));
  });

  beforeEach(() => {
    fetcher = new NodeDataFetcher();
    fsPromises.readFile.mockReset();
  });

  it('rejects invalid identifiers', async () => {
    await expect(fetcher.fetch('')).rejects.toThrow(
      'NodeDataFetcher: fetch requires a valid non-empty string identifier (file path).'
    );
    await expect(fetcher.fetch(null)).rejects.toThrow(Error);
    await expect(fetcher.fetch(42)).rejects.toThrow(Error);
    await expect(fetcher.fetch('   ')).rejects.toThrow(Error);
    expect(fsPromises.readFile).not.toHaveBeenCalled();
  });

  it('reads and parses JSON from a relative path', async () => {
    const relativePath = 'tests/fixtures/sample.json';
    const expectedAbsolutePath = path.resolve(projectRoot, relativePath);

    fsPromises.readFile.mockResolvedValueOnce('{"greeting":"hello"}');

    const result = await fetcher.fetch(relativePath);

    expect(result).toEqual({ greeting: 'hello' });
    expect(fsPromises.readFile).toHaveBeenCalledTimes(1);
    expect(fsPromises.readFile).toHaveBeenCalledWith(
      expectedAbsolutePath,
      'utf-8'
    );
  });

  it('uses absolute identifiers without rewriting', async () => {
    const absolutePath = path.resolve('/tmp', 'data.json');
    fsPromises.readFile.mockResolvedValueOnce('{"value":42}');

    const result = await fetcher.fetch(absolutePath);

    expect(result).toEqual({ value: 42 });
    expect(fsPromises.readFile).toHaveBeenCalledTimes(1);
    expect(fsPromises.readFile).toHaveBeenCalledWith(absolutePath, 'utf-8');
  });

  it('throws a descriptive error when the file is missing', async () => {
    const relativePath = 'missing/data.json';
    const expectedAbsolutePath = path.resolve(projectRoot, relativePath);
    const enoent = Object.assign(new Error('not found'), { code: 'ENOENT' });

    fsPromises.readFile.mockRejectedValueOnce(enoent);

    await expect(fetcher.fetch(relativePath)).rejects.toThrow(
      `NodeDataFetcher: File not found at ${relativePath} (resolved to ${expectedAbsolutePath})`
    );
  });

  it('falls back to the original identifier when the resolved path is unavailable', async () => {
    const relativePath = 'missing/data.json';
    const enoent = Object.assign(new Error('still missing'), {
      code: 'ENOENT',
    });

    const realResolve = path.resolve;
    const resolveSpy = jest.spyOn(path, 'resolve');
    const calls = [];
    resolveSpy.mockImplementation((...args) => {
      calls.push(args);
      return calls.length === 1 ? realResolve(...args) : '';
    });

    fsPromises.readFile.mockRejectedValueOnce(enoent);

    await expect(fetcher.fetch(relativePath)).rejects.toThrow(
      `NodeDataFetcher: File not found at ${relativePath} (resolved to ${relativePath})`
    );

    resolveSpy.mockRestore();
  });

  it('translates JSON parse failures into descriptive errors', async () => {
    fsPromises.readFile.mockResolvedValueOnce('invalid json');

    await expect(fetcher.fetch('broken.json')).rejects.toThrow(
      'NodeDataFetcher: Invalid JSON in file broken.json:'
    );
  });

  it('logs and rethrows unexpected read errors', async () => {
    const error = new Error('permission denied');
    fsPromises.readFile.mockRejectedValueOnce(error);
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await expect(fetcher.fetch('data.json')).rejects.toBe(error);
    expect(consoleSpy).toHaveBeenCalledWith(
      'NodeDataFetcher: Error reading or parsing data.json:',
      error
    );

    consoleSpy.mockRestore();
  });
});
