/**
 * @file Unit tests for ExpressionStatusService
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import ExpressionStatusService from '../../../../src/expressionDiagnostics/services/ExpressionStatusService.js';

describe('ExpressionStatusService', () => {
  let mockLogger;
  let originalFetch;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Save original fetch
    originalFetch = global.fetch;

    // Mock fetch
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe('Constructor validation', () => {
    it('throws if logger is missing', () => {
      expect(() => {
        new ExpressionStatusService({ logger: null });
      }).toThrow();
    });

    it('throws if logger lacks required methods', () => {
      expect(() => {
        new ExpressionStatusService({ logger: { info: jest.fn() } });
      }).toThrow();
    });

    it('constructs successfully with valid logger', () => {
      expect(() => {
        new ExpressionStatusService({ logger: mockLogger });
      }).not.toThrow();
    });

    it('uses default baseUrl when not provided', () => {
      // eslint-disable-next-line no-unused-vars -- instantiation triggers logging we're testing
      const service = new ExpressionStatusService({ logger: mockLogger });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ExpressionStatusService: Instance created',
        { baseUrl: 'http://localhost:3001' }
      );
    });

    it('uses provided baseUrl', () => {
      const customUrl = 'http://custom:8080';
      // eslint-disable-next-line no-unused-vars -- instantiation triggers logging we're testing
      const service = new ExpressionStatusService({
        logger: mockLogger,
        baseUrl: customUrl,
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ExpressionStatusService: Instance created',
        { baseUrl: customUrl }
      );
    });
  });

  describe('updateStatus()', () => {
    it('sends POST request with correct payload', async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              message: 'Status updated',
              expressionId: 'expr:test',
            }),
        });

      const service = new ExpressionStatusService({ logger: mockLogger });
      await service.updateStatus('data/mods/test/expr.json', 'normal');

      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        'http://localhost:3001/api/expressions/update-status',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filePath: 'data/mods/test/expr.json',
            status: 'normal',
          }),
          signal: expect.any(AbortSignal),
        }
      );
    });

    it('returns success result on successful update', async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              message: 'Status updated successfully',
              expressionId: 'emotions:happy',
            }),
        });

      const service = new ExpressionStatusService({ logger: mockLogger });
      const result = await service.updateStatus('path/to/file.json', 'normal');

      expect(result).toEqual({
        success: true,
        message: 'Status updated successfully',
        expressionId: 'emotions:happy',
      });
    });

    it('returns failure result on API error response', async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: () =>
            Promise.resolve({
              error: true,
              message: 'File not found',
            }),
        });

      const service = new ExpressionStatusService({ logger: mockLogger });
      const result = await service.updateStatus('invalid/path.json', 'normal');

      expect(result).toEqual({
        success: false,
        errorType: 'validation_error',
        message: 'Request validation failed: File not found',
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ExpressionStatusService: Update failed',
        expect.objectContaining({
          errorType: 'validation_error',
          message: 'Request validation failed: File not found',
        })
      );
    });

    it('returns failure result when health check fails', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      const service = new ExpressionStatusService({ logger: mockLogger });
      const result = await service.updateStatus('path/to/file.json', 'normal');

      expect(result).toEqual({
        success: false,
        errorType: 'server_error',
        message: 'Server error: 503. Check server logs.',
      });
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ExpressionStatusService: Health check failed',
        expect.objectContaining({
          errorType: 'server_error',
          message: 'Server error: 503. Check server logs.',
        })
      );
    });

    it('returns failure result on network error', async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: true })
        .mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const service = new ExpressionStatusService({ logger: mockLogger });
      const result = await service.updateStatus('path/to/file.json', 'normal');

      expect(result).toEqual({
        success: false,
        errorType: 'connection_refused',
        message:
          'Cannot connect to server at http://localhost:3001. Ensure the LLM proxy server is running.',
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'ExpressionStatusService: Update failed',
        expect.objectContaining({
          errorType: 'connection_refused',
          error: 'Failed to fetch',
        })
      );
    });

    it('handles AbortError specifically for timeout', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      global.fetch.mockResolvedValueOnce({ ok: true }).mockRejectedValueOnce(
        abortError
      );

      const service = new ExpressionStatusService({ logger: mockLogger });
      const result = await service.updateStatus('path/to/file.json', 'normal');

      expect(result).toEqual({
        success: false,
        errorType: 'timeout',
        message: 'Request timed out after 10000ms. Server may be overloaded.',
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'ExpressionStatusService: Update failed',
        expect.objectContaining({
          errorType: 'timeout',
          error: 'The operation was aborted',
        })
      );
    });

    it('passes signal to fetch for abort handling', async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              message: 'Status updated',
              expressionId: 'expr:test',
            }),
        });

      const service = new ExpressionStatusService({ logger: mockLogger });
      await service.updateStatus('data/mods/test/expr.json', 'normal');

      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('logs info on successful update', async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              message: 'Updated',
              expressionId: 'test:expr',
            }),
        });

      const service = new ExpressionStatusService({ logger: mockLogger });
      await service.updateStatus('path/file.json', 'rare');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'ExpressionStatusService: Status updated',
        expect.objectContaining({
          filePath: 'path/file.json',
          expressionId: 'test:expr',
          status: 'rare',
        })
      );
    });
  });

  describe('scanAllStatuses()', () => {
    it('sends GET request to correct endpoint', async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              expressions: [],
            }),
        });

      const service = new ExpressionStatusService({ logger: mockLogger });
      await service.scanAllStatuses();

      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        'http://localhost:3001/api/expressions/scan-statuses',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('returns expressions array on success', async () => {
      const mockExpressions = [
        { id: 'expr:test1', filePath: 'path1.json', diagnosticStatus: 'normal' },
        { id: 'expr:test2', filePath: 'path2.json', diagnosticStatus: 'rare' },
      ];

      global.fetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              expressions: mockExpressions,
            }),
        });

      const service = new ExpressionStatusService({ logger: mockLogger });
      const result = await service.scanAllStatuses();

      expect(result).toEqual({
        success: true,
        expressions: mockExpressions,
      });
    });

    it('returns failure result on API error', async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () =>
            Promise.resolve({
              error: true,
              message: 'Scan failed',
            }),
        });

      const service = new ExpressionStatusService({ logger: mockLogger });
      const result = await service.scanAllStatuses();

      expect(result).toEqual({
        success: false,
        errorType: 'server_error',
        message: 'Server error: 500. Check server logs.',
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ExpressionStatusService: Scan failed',
        expect.objectContaining({
          errorType: 'server_error',
          message: 'Server error: 500. Check server logs.',
        })
      );
    });

    it('returns failure result when health check fails', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const service = new ExpressionStatusService({ logger: mockLogger });
      const result = await service.scanAllStatuses();

      expect(result).toEqual({
        success: false,
        errorType: 'server_error',
        message: 'Server error: 500. Check server logs.',
      });
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ExpressionStatusService: Health check failed',
        expect.objectContaining({
          errorType: 'server_error',
          message: 'Server error: 500. Check server logs.',
        })
      );
    });

    it('returns failure result on CORS-blocked response', async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: false,
          status: 0,
          type: 'opaque',
        });

      const service = new ExpressionStatusService({ logger: mockLogger });
      const result = await service.scanAllStatuses();

      expect(result).toEqual({
        success: false,
        errorType: 'cors_blocked',
        message: 'Server rejected request due to CORS policy. Check PROXY_ALLOWED_ORIGIN.',
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'ExpressionStatusService: Scan blocked by CORS'
      );
    });

    it('returns failure result on network error', async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: true })
        .mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const service = new ExpressionStatusService({ logger: mockLogger });
      const result = await service.scanAllStatuses();

      expect(result).toEqual({
        success: false,
        errorType: 'connection_refused',
        message:
          'Cannot connect to server at http://localhost:3001. Ensure the LLM proxy server is running.',
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'ExpressionStatusService: Scan failed',
        expect.objectContaining({
          errorType: 'connection_refused',
          error: 'Failed to fetch',
        })
      );
    });

    it('logs info with count on successful scan', async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              expressions: [
                { id: 'a' },
                { id: 'b' },
                { id: 'c' },
              ],
            }),
        });

      const service = new ExpressionStatusService({ logger: mockLogger });
      await service.scanAllStatuses();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'ExpressionStatusService: Scan completed',
        { count: 3 }
      );
    });

    it('handles missing expressions property', async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      const service = new ExpressionStatusService({ logger: mockLogger });
      const result = await service.scanAllStatuses();

      expect(result).toEqual({
        success: true,
        expressions: [],
      });
    });

    it('handles AbortError specifically for timeout', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      global.fetch.mockResolvedValueOnce({ ok: true }).mockRejectedValueOnce(
        abortError
      );

      const service = new ExpressionStatusService({ logger: mockLogger });
      const result = await service.scanAllStatuses();

      expect(result).toEqual({
        success: false,
        errorType: 'timeout',
        message: 'Request timed out after 30000ms. Server may be overloaded.',
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'ExpressionStatusService: Scan failed',
        expect.objectContaining({
          errorType: 'timeout',
          error: 'The operation was aborted',
        })
      );
    });

    it('passes signal to fetch for abort handling', async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              expressions: [],
            }),
        });

      const service = new ExpressionStatusService({ logger: mockLogger });
      await service.scanAllStatuses();

      // Verify fetch was called with an AbortSignal
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });
  });

  describe('getProblematicExpressions()', () => {
    let service;

    beforeEach(() => {
      service = new ExpressionStatusService({ logger: mockLogger });
    });

    it('filters out normal status', () => {
      const expressions = [
        { id: 'a', diagnosticStatus: 'normal' },
        { id: 'b', diagnosticStatus: 'rare' },
      ];

      const result = service.getProblematicExpressions(expressions);

      expect(result).toEqual([{ id: 'b', diagnosticStatus: 'rare' }]);
    });

    it('filters out frequent status', () => {
      const expressions = [
        { id: 'a', diagnosticStatus: 'frequent' },
        { id: 'b', diagnosticStatus: 'impossible' },
      ];

      const result = service.getProblematicExpressions(expressions);

      expect(result).toEqual([{ id: 'b', diagnosticStatus: 'impossible' }]);
    });

    it('includes unknown status as problematic', () => {
      const expressions = [
        { id: 'a', diagnosticStatus: 'unknown' },
        { id: 'b', diagnosticStatus: 'normal' },
      ];

      const result = service.getProblematicExpressions(expressions);

      expect(result).toEqual([{ id: 'a', diagnosticStatus: 'unknown' }]);
    });

    it('treats null/undefined status as unknown', () => {
      const expressions = [
        { id: 'a', diagnosticStatus: null },
        { id: 'b' }, // undefined diagnosticStatus
        { id: 'c', diagnosticStatus: 'normal' },
      ];

      const result = service.getProblematicExpressions(expressions);

      expect(result.length).toBe(2);
      expect(result.map((e) => e.id)).toEqual(['a', 'b']);
    });

    it('sorts by priority - impossible first', () => {
      const expressions = [
        { id: 'a', diagnosticStatus: 'rare' },
        { id: 'b', diagnosticStatus: 'impossible' },
        { id: 'c', diagnosticStatus: 'unknown' },
        { id: 'd', diagnosticStatus: 'extremely_rare' },
      ];

      const result = service.getProblematicExpressions(expressions);

      expect(result.map((e) => e.id)).toEqual(['b', 'c', 'd', 'a']);
    });

    it('limits results to maxCount', () => {
      const expressions = [
        { id: 'a', diagnosticStatus: 'impossible' },
        { id: 'b', diagnosticStatus: 'impossible' },
        { id: 'c', diagnosticStatus: 'impossible' },
      ];

      const result = service.getProblematicExpressions(expressions, 2);

      expect(result.length).toBe(2);
    });

    it('returns empty array when all expressions are normal/frequent', () => {
      const expressions = [
        { id: 'a', diagnosticStatus: 'normal' },
        { id: 'b', diagnosticStatus: 'frequent' },
      ];

      const result = service.getProblematicExpressions(expressions);

      expect(result).toEqual([]);
    });

    it('returns empty array for empty input', () => {
      const result = service.getProblematicExpressions([]);
      expect(result).toEqual([]);
    });

    it('uses default maxCount of 10', () => {
      const expressions = Array.from({ length: 15 }, (_, i) => ({
        id: `expr${i}`,
        diagnosticStatus: 'impossible',
      }));

      const result = service.getProblematicExpressions(expressions);

      expect(result.length).toBe(10);
    });
  });

  describe('getStatusColor()', () => {
    let service;

    beforeEach(() => {
      service = new ExpressionStatusService({ logger: mockLogger });
    });

    it('returns gray for unknown status', () => {
      expect(service.getStatusColor('unknown')).toBe('#BBBBBB');
    });

    it('returns red for impossible status', () => {
      expect(service.getStatusColor('impossible')).toBe('#CC3311');
    });

    it('returns orange for extremely_rare status', () => {
      expect(service.getStatusColor('extremely_rare')).toBe('#EE7733');
    });

    it('returns magenta for rare status', () => {
      expect(service.getStatusColor('rare')).toBe('#EE3377');
    });

    it('returns teal for normal status', () => {
      expect(service.getStatusColor('normal')).toBe('#009988');
    });

    it('returns indigo for frequent status', () => {
      expect(service.getStatusColor('frequent')).toBe('#332288');
    });

    it('returns gray for null status', () => {
      expect(service.getStatusColor(null)).toBe('#BBBBBB');
    });

    it('returns gray for undefined status', () => {
      expect(service.getStatusColor(undefined)).toBe('#BBBBBB');
    });

    it('returns gray for unknown status value', () => {
      expect(service.getStatusColor('invalid_status')).toBe('#BBBBBB');
    });
  });

  describe('getStatusPriority()', () => {
    let service;

    beforeEach(() => {
      service = new ExpressionStatusService({ logger: mockLogger });
    });

    it('returns 0 for impossible (highest priority)', () => {
      expect(service.getStatusPriority('impossible')).toBe(0);
    });

    it('returns 1 for unknown', () => {
      expect(service.getStatusPriority('unknown')).toBe(1);
    });

    it('returns 2 for extremely_rare', () => {
      expect(service.getStatusPriority('extremely_rare')).toBe(2);
    });

    it('returns 3 for rare', () => {
      expect(service.getStatusPriority('rare')).toBe(3);
    });

    it('returns 4 for normal', () => {
      expect(service.getStatusPriority('normal')).toBe(4);
    });

    it('returns 5 for frequent', () => {
      expect(service.getStatusPriority('frequent')).toBe(5);
    });

    it('returns 1 (unknown) for null status', () => {
      expect(service.getStatusPriority(null)).toBe(1);
    });

    it('returns 999 for unrecognized status', () => {
      expect(service.getStatusPriority('invalid')).toBe(999);
    });
  });

  describe('isProblematicStatus()', () => {
    let service;

    beforeEach(() => {
      service = new ExpressionStatusService({ logger: mockLogger });
    });

    it('returns true for impossible', () => {
      expect(service.isProblematicStatus('impossible')).toBe(true);
    });

    it('returns true for unknown', () => {
      expect(service.isProblematicStatus('unknown')).toBe(true);
    });

    it('returns true for extremely_rare', () => {
      expect(service.isProblematicStatus('extremely_rare')).toBe(true);
    });

    it('returns true for rare', () => {
      expect(service.isProblematicStatus('rare')).toBe(true);
    });

    it('returns false for normal', () => {
      expect(service.isProblematicStatus('normal')).toBe(false);
    });

    it('returns false for frequent', () => {
      expect(service.isProblematicStatus('frequent')).toBe(false);
    });

    it('returns true for null (treated as unknown)', () => {
      expect(service.isProblematicStatus(null)).toBe(true);
    });

    it('returns true for undefined (treated as unknown)', () => {
      expect(service.isProblematicStatus(undefined)).toBe(true);
    });
  });
});
