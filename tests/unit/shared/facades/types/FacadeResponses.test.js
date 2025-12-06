import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import {
  createSuccessResponse,
  createErrorResponse,
  createQueryResponse,
  createModificationResponse,
  createBulkResponse,
  createValidationResponse,
  createGraphResponse,
  createDescriptionResponse,
  withTiming,
  isSuccessResponse,
  isErrorResponse,
  getErrorInfo,
  getResponseData,
} from '../../../../../src/shared/facades/types/FacadeResponses.js';

/** @type {jest.SpyInstance<number, []>} */
let nowSpy;
const ORIGINAL_ENV = process.env.NODE_ENV;

describe('FacadeResponses utilities', () => {
  beforeEach(() => {
    nowSpy = jest.spyOn(Date, 'now');
  });

  afterEach(() => {
    nowSpy.mockRestore();
    process.env.NODE_ENV = ORIGINAL_ENV;
  });

  describe('createSuccessResponse', () => {
    it('builds a success payload with metadata and optional flags', () => {
      nowSpy.mockImplementation(() => 1700000000000);

      const response = createSuccessResponse(
        { id: 'entity-1' },
        'fetchEntity',
        {
          duration: 42,
          requestId: 'req-7',
          performance: { db: 5 },
          cached: true,
          cacheKey: 'entity-1',
          metadata: { correlationId: 'corr-9' },
        }
      );

      expect(response).toEqual({
        success: true,
        data: { id: 'entity-1' },
        cached: true,
        cacheKey: 'entity-1',
        metadata: {
          operationType: 'fetchEntity',
          timestamp: 1700000000000,
          duration: 42,
          correlationId: 'corr-9',
          requestId: 'req-7',
          performance: { db: 5 },
        },
      });
    });

    it('defaults optional flags when not provided', () => {
      nowSpy.mockImplementation(() => 1700001234567);

      const response = createSuccessResponse('ok', 'noop');

      expect(response).toEqual({
        success: true,
        data: 'ok',
        metadata: {
          operationType: 'noop',
          timestamp: 1700001234567,
          duration: 0,
        },
      });
    });
  });

  describe('createErrorResponse', () => {
    it('captures details from an Error instance and includes stack trace in development', () => {
      process.env.NODE_ENV = 'development';
      nowSpy.mockImplementation(() => 1700009876543);
      const error = new Error('boom');
      // @ts-expect-error augmenting for test coverage
      error.code = 'EXPLODE';
      // @ts-expect-error augmenting for test coverage
      error.details = { part: 'engine' };

      const response = createErrorResponse(error, 'explode', {
        duration: 17,
        requestId: 'req-9',
        metadata: { correlationId: 'corr-11' },
        context: [{ step: 'ignite' }],
      });

      expect(response.success).toBe(false);
      expect(response.metadata).toEqual({
        operationType: 'explode',
        timestamp: 1700009876543,
        duration: 17,
        correlationId: 'corr-11',
        requestId: 'req-9',
      });
      expect(response.error).toEqual(
        expect.objectContaining({
          code: 'EXPLODE',
          message: 'boom',
          type: 'Error',
          details: { part: 'engine' },
          stack: expect.stringContaining('Error: boom'),
          context: [{ step: 'ignite' }],
        })
      );
    });

    it('supports string and unknown error inputs', () => {
      nowSpy.mockImplementation(() => 1700002222000);

      const stringError = createErrorResponse('bad', 'stringOp');
      expect(stringError).toEqual({
        success: false,
        error: {
          code: 'FACADE_ERROR',
          message: 'bad',
          type: 'FacadeError',
        },
        metadata: {
          operationType: 'stringOp',
          timestamp: 1700002222000,
          duration: 0,
        },
      });

      const unknownError = createErrorResponse(123, 'unknownOp', {
        duration: 5,
      });
      expect(unknownError).toEqual({
        success: false,
        error: {
          code: 'INVALID_ERROR',
          message: 'Invalid error object provided',
          type: 'FacadeError',
        },
        metadata: {
          operationType: 'unknownOp',
          timestamp: 1700002222000,
          duration: 5,
        },
      });
    });
  });

  describe('createQueryResponse', () => {
    it('merges pagination defaults, filters, and sort options', () => {
      nowSpy.mockImplementation(() => 1700003333000);
      const result = createQueryResponse(
        [{ id: 1 }, { id: 2 }],
        { total: 10, offset: 2, limit: 2, hasMore: true },
        'listThings',
        {
          filters: { category: 'active' },
          sortBy: 'id',
          sortOrder: 'desc',
          metadata: { region: 'us' },
        }
      );

      expect(result).toEqual({
        success: true,
        data: [{ id: 1 }, { id: 2 }],
        metadata: {
          operationType: 'listThings',
          timestamp: 1700003333000,
          duration: 0,
          region: 'us',
        },
        pagination: {
          total: 10,
          count: 2,
          offset: 2,
          limit: 2,
          hasMore: true,
        },
        filters: { category: 'active' },
        sortBy: 'id',
        sortOrder: 'desc',
      });

      nowSpy.mockImplementation(() => 1700003333555);
      const defaultSorted = createQueryResponse(
        [{ id: 5 }],
        { total: 5 },
        'listThings',
        { sortBy: 'id' }
      );

      expect(defaultSorted.sortOrder).toBe('asc');
    });

    it('applies sensible defaults when pagination values are missing', () => {
      nowSpy.mockImplementation(() => 1700003333999);
      const result = createQueryResponse([{ id: 1 }], {}, 'listThings');

      expect(result.pagination).toEqual({
        total: 1,
        count: 1,
        offset: 0,
        hasMore: false,
      });
      expect(result.sortBy).toBeUndefined();
      expect(result.filters).toBeUndefined();
    });
  });

  describe('createModificationResponse', () => {
    it('attaches change details and optional metadata', () => {
      nowSpy.mockImplementation(() => 1700004444000);
      const response = createModificationResponse(
        { id: 'item-1' },
        { added: [{ id: 'new' }] },
        'modifyItem',
        {
          affectedEntities: [{ id: 'linked' }],
          validation: { valid: true },
          rollbackAvailable: true,
        }
      );

      expect(response).toEqual({
        success: true,
        data: { id: 'item-1' },
        metadata: {
          operationType: 'modifyItem',
          timestamp: 1700004444000,
          duration: 0,
        },
        changes: { added: [{ id: 'new' }] },
        affectedEntities: [{ id: 'linked' }],
        validation: { valid: true },
        rollbackAvailable: true,
      });

      nowSpy.mockImplementation(() => 1700004444999);
      const baseline = createModificationResponse(
        { id: 'item-2' },
        { removed: [{ id: 'old' }] },
        'modifyItem'
      );

      expect(baseline).toMatchObject({
        success: true,
        data: { id: 'item-2' },
        changes: { removed: [{ id: 'old' }] },
      });
      expect(baseline).not.toHaveProperty('affectedEntities');
      expect(baseline).not.toHaveProperty('validation');
      expect(baseline).not.toHaveProperty('rollbackAvailable');
    });
  });

  describe('createBulkResponse', () => {
    it('marks progress and partial completion flags when provided', () => {
      nowSpy.mockImplementation(() => 1700005555000);
      const response = createBulkResponse(
        { processed: 10, successful: 8, failed: 2 },
        'bulkOp',
        { progress: { percent: 80 }, partial: true }
      );

      expect(response).toEqual({
        success: true,
        data: { processed: 10, successful: 8, failed: 2 },
        metadata: {
          operationType: 'bulkOp',
          timestamp: 1700005555000,
          duration: 0,
        },
        progress: { percent: 80 },
        partial: true,
      });

      nowSpy.mockImplementation(() => 1700005555999);
      const baseline = createBulkResponse(
        { processed: 1, successful: 1, failed: 0 },
        'bulkOp'
      );

      expect(baseline).not.toHaveProperty('progress');
      expect(baseline).not.toHaveProperty('partial');
    });
  });

  describe('createValidationResponse', () => {
    it('exposes validation extras when supplied', () => {
      nowSpy.mockImplementation(() => 1700006666000);
      const response = createValidationResponse(
        { valid: false, errors: [] },
        'validate',
        {
          suggestions: ['fix'],
          autoFixApplied: false,
          fixedIssues: [{ id: 1 }],
        }
      );

      expect(response).toEqual({
        success: true,
        data: { valid: false, errors: [] },
        metadata: {
          operationType: 'validate',
          timestamp: 1700006666000,
          duration: 0,
        },
        suggestions: ['fix'],
        autoFixApplied: false,
        fixedIssues: [{ id: 1 }],
      });

      nowSpy.mockImplementation(() => 1700006666999);
      const baseline = createValidationResponse({ valid: true }, 'validate');

      expect(baseline).not.toHaveProperty('suggestions');
      expect(baseline).not.toHaveProperty('autoFixApplied');
      expect(baseline).not.toHaveProperty('fixedIssues');
    });
  });

  describe('createGraphResponse', () => {
    it('includes analysis and validation information when present', () => {
      nowSpy.mockImplementation(() => 1700007777000);
      const response = createGraphResponse({ nodes: [], edges: [] }, 'graph', {
        analysis: { score: 1 },
        validation: { valid: true },
      });

      expect(response).toEqual({
        success: true,
        data: { nodes: [], edges: [] },
        metadata: {
          operationType: 'graph',
          timestamp: 1700007777000,
          duration: 0,
        },
        analysis: { score: 1 },
        validation: { valid: true },
      });

      nowSpy.mockImplementation(() => 1700007777999);
      const baseline = createGraphResponse({ nodes: [] }, 'graph');

      expect(baseline).not.toHaveProperty('analysis');
      expect(baseline).not.toHaveProperty('validation');
    });
  });

  describe('createDescriptionResponse', () => {
    it('carries generation metadata when supplied', () => {
      nowSpy.mockImplementation(() => 1700008888000);
      const response = createDescriptionResponse(
        { description: 'text' },
        'describe',
        { generationMetadata: { engine: 'gpt' } }
      );

      expect(response).toEqual({
        success: true,
        data: { description: 'text' },
        metadata: {
          operationType: 'describe',
          timestamp: 1700008888000,
          duration: 0,
        },
        generationMetadata: { engine: 'gpt' },
      });

      nowSpy.mockImplementation(() => 1700008888999);
      const baseline = createDescriptionResponse(
        { description: 'text' },
        'describe'
      );

      expect(baseline).not.toHaveProperty('generationMetadata');
    });
  });

  describe('withTiming', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('wraps raw operation results in a success response with timing', async () => {
      nowSpy
        .mockImplementationOnce(() => 1000)
        .mockImplementationOnce(() => 1600)
        .mockImplementation(() => 2000);

      const response = await withTiming(
        async () => ({ value: 42 }),
        'compute',
        { requestId: 'req-123' }
      );

      expect(response.success).toBe(true);
      expect(response.data).toEqual({ value: 42 });
      expect(response.metadata).toEqual({
        operationType: 'compute',
        timestamp: 2000,
        duration: 600,
        requestId: 'req-123',
      });
    });

    it('updates duration on pre-built responses', async () => {
      nowSpy
        .mockImplementationOnce(() => 500)
        .mockImplementationOnce(() => 900)
        .mockImplementation(() => 950);

      const response = await withTiming(
        async () => ({
          success: true,
          data: 'ready',
          metadata: { operationType: 'existing', duration: 0 },
        }),
        'existing',
        { metadata: { extra: true } }
      );

      expect(response).toEqual({
        success: true,
        data: 'ready',
        metadata: { operationType: 'existing', duration: 400 },
      });

      nowSpy.mockImplementation(() => 1200);
      const responseWithoutMetadata = await withTiming(
        async () => ({ success: true }),
        'existing'
      );

      expect(responseWithoutMetadata).toEqual({
        success: true,
        metadata: { duration: 0 },
      });
    });

    it('converts thrown errors into error responses with duration', async () => {
      nowSpy
        .mockImplementationOnce(() => 300)
        .mockImplementationOnce(() => 800)
        .mockImplementation(() => 850);

      const error = new Error('fail');

      const response = await withTiming(
        async () => {
          throw error;
        },
        'failingOp',
        { requestId: 'req-x' }
      );

      expect(response.success).toBe(false);
      expect(response.error).toEqual(
        expect.objectContaining({
          message: 'fail',
          type: 'Error',
        })
      );
      expect(response.metadata.operationType).toBe('failingOp');
      expect(response.metadata.duration).toBe(500);
      expect(response.metadata.requestId).toBe('req-x');
    });
  });

  describe('response helpers', () => {
    it('determines success and error states', () => {
      const success = createSuccessResponse('value', 'op');
      const error = createErrorResponse('bad', 'op');

      expect(isSuccessResponse(success)).toBe(true);
      expect(isSuccessResponse(error)).toBe(false);
      expect(isSuccessResponse(null)).toBeFalsy();

      expect(isErrorResponse(success)).toBe(false);
      expect(isErrorResponse(error)).toBe(true);
      expect(isErrorResponse(undefined)).toBeFalsy();
    });

    it('extracts data and error payloads', () => {
      const success = createSuccessResponse({ item: 1 }, 'op');
      const error = createErrorResponse('bad', 'op');

      expect(getResponseData(success)).toEqual({ item: 1 });
      expect(getResponseData(error)).toBeNull();

      expect(getErrorInfo(success)).toBeNull();
      expect(getErrorInfo(error)).toEqual({
        code: 'FACADE_ERROR',
        message: 'bad',
        type: 'FacadeError',
      });
    });
  });
});
