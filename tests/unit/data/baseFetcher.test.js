import {
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
  jest,
} from '@jest/globals';
import WorkspaceDataFetcher from '../../../src/data/workspaceDataFetcher.js';
import TextDataFetcher from '../../../src/data/textDataFetcher.js';

describe('WorkspaceDataFetcher', () => {
  let fetcher;
  let originalFetch;

  beforeEach(() => {
    fetcher = new WorkspaceDataFetcher();
    originalFetch = global.fetch;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
    global.fetch = originalFetch;
  });

  it('returns parsed JSON when fetch succeeds', async () => {
    const data = { foo: 'bar' };
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue(data),
    };
    global.fetch.mockResolvedValue(mockResponse);

    await expect(fetcher.fetch('/path')).resolves.toEqual(data);
    expect(global.fetch).toHaveBeenCalledWith('/path');
    expect(mockResponse.json).toHaveBeenCalled();
  });

  it('propagates fetch errors', async () => {
    global.fetch.mockRejectedValue(new Error('Failed to fetch'));

    await expect(fetcher.fetch('/bad')).rejects.toThrow(
      'WorkspaceDataFetcher failed for /bad: Failed to fetch'
    );
  });
});

describe('TextDataFetcher', () => {
  let fetcher;
  let originalFetch;

  beforeEach(() => {
    fetcher = new TextDataFetcher();
    originalFetch = global.fetch;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
    global.fetch = originalFetch;
  });

  it('returns text when fetch succeeds', async () => {
    const text = 'hello world';
    const mockResponse = {
      ok: true,
      text: jest.fn().mockResolvedValue(text),
    };
    global.fetch.mockResolvedValue(mockResponse);

    await expect(fetcher.fetch('/file')).resolves.toBe(text);
    expect(global.fetch).toHaveBeenCalledWith('/file');
    expect(mockResponse.text).toHaveBeenCalled();
  });

  it('throws on http error', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: jest.fn().mockResolvedValue('missing'),
    };
    global.fetch.mockResolvedValue(mockResponse);

    await expect(fetcher.fetch('/missing')).rejects.toThrow(
      'HTTP error! status: 404 (Not Found) fetching /missing. Response body: missing'
    );
  });
});
