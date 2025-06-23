// tests/unit/data/textDataFetcher.test.js

import TextDataFetcher from '../../../src/data/textDataFetcher.js';

describe('TextDataFetcher', () => {
  let fetcher;

  beforeEach(() => {
    fetcher = new TextDataFetcher();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete global.fetch;
  });

  describe('constructor', () => {
    it('should create an instance of TextDataFetcher', () => {
      expect(fetcher).toBeInstanceOf(TextDataFetcher);
    });
  });

  describe('fetch', () => {
    describe('input validation', () => {
      it('should throw error for undefined identifier', async () => {
        await expect(fetcher.fetch(undefined)).rejects.toThrow(
          'TextDataFetcher: fetch requires a valid non-empty string identifier (URL or path).'
        );
      });

      it('should throw error for null identifier', async () => {
        await expect(fetcher.fetch(null)).rejects.toThrow(
          'TextDataFetcher: fetch requires a valid non-empty string identifier (URL or path).'
        );
      });

      it('should throw error for empty string identifier', async () => {
        await expect(fetcher.fetch('')).rejects.toThrow(
          'TextDataFetcher: fetch requires a valid non-empty string identifier (URL or path).'
        );
      });

      it('should throw error for whitespace-only identifier', async () => {
        await expect(fetcher.fetch('   ')).rejects.toThrow(
          'TextDataFetcher: fetch requires a valid non-empty string identifier (URL or path).'
        );
      });

      it('should throw error for non-string identifier', async () => {
        await expect(fetcher.fetch(123)).rejects.toThrow(
          'TextDataFetcher: fetch requires a valid non-empty string identifier (URL or path).'
        );
      });
    });

    describe('successful fetch', () => {
      it('should return raw text content from response', async () => {
        const mockText = 'directions := location.core:exits[].target';
        const mockResponse = {
          ok: true,
          text: jest.fn().mockResolvedValue(mockText),
        };

        global.fetch.mockResolvedValue(mockResponse);

        const result = await fetcher.fetch('./test.scope');

        expect(global.fetch).toHaveBeenCalledWith('./test.scope');
        expect(mockResponse.text).toHaveBeenCalled();
        expect(result).toBe(mockText);
      });

      it('should handle multi-line scope content', async () => {
        const mockText = `directions := location.core:exits[].target
environment := entities(core:position)[
    {"and": [ 
        {"==": [{"var": "entity.components.core:position.locationId"}, 
        {"var": "location.id"}]}, 
        {"!=": [{"var": "entity.id"}, {"var": "actor.id"}]} 
        ]
    }]`;
        const mockResponse = {
          ok: true,
          text: jest.fn().mockResolvedValue(mockText),
        };

        global.fetch.mockResolvedValue(mockResponse);

        const result = await fetcher.fetch('./test.scope');

        expect(result).toBe(mockText);
      });

      it('should handle empty text content', async () => {
        const mockResponse = {
          ok: true,
          text: jest.fn().mockResolvedValue(''),
        };

        global.fetch.mockResolvedValue(mockResponse);

        const result = await fetcher.fetch('./empty.scope');

        expect(result).toBe('');
      });
    });

    describe('HTTP errors', () => {
      it('should throw error for 404 response', async () => {
        const mockResponse = {
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: jest.fn().mockResolvedValue('File not found'),
        };

        global.fetch.mockResolvedValue(mockResponse);

        await expect(fetcher.fetch('./missing.scope')).rejects.toThrow(
          'HTTP error! status: 404 (Not Found) fetching ./missing.scope. Response body: File not found'
        );
      });

      it('should throw error for 500 response', async () => {
        const mockResponse = {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: jest.fn().mockResolvedValue('Server error'),
        };

        global.fetch.mockResolvedValue(mockResponse);

        await expect(fetcher.fetch('./test.scope')).rejects.toThrow(
          'HTTP error! status: 500 (Internal Server Error) fetching ./test.scope. Response body: Server error'
        );
      });

      it('should handle error reading response body', async () => {
        const mockResponse = {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: jest.fn().mockRejectedValue(new Error('Cannot read body')),
        };

        global.fetch.mockResolvedValue(mockResponse);

        await expect(fetcher.fetch('./test.scope')).rejects.toThrow(
          'HTTP error! status: 500 (Internal Server Error) fetching ./test.scope. Response body: (Could not read response body: Cannot read body)'
        );
      });

      it('should truncate very long response bodies', async () => {
        const longResponse = 'a'.repeat(600);
        const mockResponse = {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: jest.fn().mockResolvedValue(longResponse),
        };

        global.fetch.mockResolvedValue(mockResponse);

        try {
          await fetcher.fetch('./test.scope');
          fail('Expected an error to be thrown');
        } catch (error) {
          // Verify that the error message contains the truncated response body
          expect(error.message).toContain('Response body:');
          expect(error.message.length).toBeLessThan(700); // Original would be ~900+ chars
        }
      });
    });

    describe('network errors', () => {
      it('should handle fetch network error', async () => {
        global.fetch.mockRejectedValue(new Error('Failed to fetch'));

        await expect(fetcher.fetch('./test.scope')).rejects.toThrow(
          'TextDataFetcher failed for ./test.scope: Failed to fetch'
        );
      });

      it('should re-throw specific errors', async () => {
        const specificError = new Error('Specific network error');
        global.fetch.mockRejectedValue(specificError);

        await expect(fetcher.fetch('./test.scope')).rejects.toThrow(
          'Specific network error'
        );
      });

      it('should handle non-Error objects', async () => {
        global.fetch.mockRejectedValue('string error');

        await expect(fetcher.fetch('./test.scope')).rejects.toThrow(
          'TextDataFetcher encountered an unknown error fetching ./test.scope: string error'
        );
      });
    });

    describe('console logging', () => {
      it('should log errors to console', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        const error = new Error('Test error');
        global.fetch.mockRejectedValue(error);

        await expect(fetcher.fetch('./test.scope')).rejects.toThrow();

        expect(consoleSpy).toHaveBeenCalledWith(
          'TextDataFetcher: Error fetching or parsing ./test.scope:',
          error
        );

        consoleSpy.mockRestore();
      });
    });
  });
}); 