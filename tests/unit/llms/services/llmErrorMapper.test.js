/**
 * @file Unit tests for LLMErrorMapper service
 * @see src/llms/services/llmErrorMapper.js
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { LLMErrorMapper } from '../../../../src/llms/services/llmErrorMapper.js';
import {
  ApiKeyError,
  InsufficientCreditsError,
  ContentPolicyError,
  PermissionError,
  BadRequestError,
  MalformedResponseError,
} from '../../../../src/errors/llmInteractionErrors.js';
import { ConfigurationError } from '../../../../src/errors/configurationError.js';

describe('LLMErrorMapper', () => {
  let errorMapper;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    errorMapper = new LLMErrorMapper({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should create instance with valid logger', () => {
      expect(errorMapper).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'LLMErrorMapper: Instance created.'
      );
    });

    it('should throw error with invalid logger', () => {
      expect(() => new LLMErrorMapper({ logger: null })).toThrow(
        'Missing required dependency: ILogger.'
      );
      expect(() => new LLMErrorMapper({ logger: {} })).toThrow(
        "Invalid or missing method 'info' on dependency 'ILogger'."
      );
    });
  });

  describe('mapHttpError', () => {
    it('should map 401 status to ApiKeyError', () => {
      const error = new Error('Unauthorized');
      error.name = 'HttpClientError';
      error.status = 401;
      error.responseBody = { message: 'Invalid API key' };

      const context = { llmId: 'test-llm', operation: 'getAIDecision' };
      const mapped = errorMapper.mapHttpError(error, context);

      expect(mapped).toBeInstanceOf(ApiKeyError);
      expect(mapped.message).toBe('Unauthorized');
    });

    it('should map 402 status to InsufficientCreditsError', () => {
      const error = new Error('Payment Required');
      error.name = 'HttpClientError';
      error.status = 402;

      const mapped = errorMapper.mapHttpError(error);

      expect(mapped).toBeInstanceOf(InsufficientCreditsError);
      expect(mapped.message).toBe('Payment Required');
    });

    it('should map 403 status to PermissionError', () => {
      const error = new Error('Forbidden');
      error.name = 'HttpClientError';
      error.status = 403;

      const mapped = errorMapper.mapHttpError(error);

      expect(mapped).toBeInstanceOf(PermissionError);
      expect(mapped.message).toBe('Forbidden');
    });

    it('should map 400 status to BadRequestError', () => {
      const error = new Error('Bad Request');
      error.name = 'HttpClientError';
      error.status = 400;

      const mapped = errorMapper.mapHttpError(error);

      expect(mapped).toBeInstanceOf(BadRequestError);
      expect(mapped.message).toBe('Bad Request');
    });

    it('should detect content policy violations in response body', () => {
      const error = new Error('Bad Request');
      error.name = 'HttpClientError';
      error.status = 400;
      error.responseBody = {
        error: {
          message: 'Content policy violation detected',
        },
      };

      const mapped = errorMapper.mapHttpError(error);

      expect(mapped).toBeInstanceOf(BadRequestError);
    });

    it('should map ConfigurationError directly', () => {
      const error = new ConfigurationError('Config issue', { llmId: 'test' });

      const mapped = errorMapper.mapHttpError(error);

      expect(mapped).toBe(error);
    });

    it('should map unknown errors to generic Error', () => {
      const error = new Error('Unknown error');

      const mapped = errorMapper.mapHttpError(error);

      expect(mapped).toBeInstanceOf(Error);
      expect(mapped.message).toBe('Unknown error');
    });
  });

  describe('createDomainError', () => {
    it('should create ApiKeyError', () => {
      const error = errorMapper.createDomainError('api_key', 'Invalid key', {
        llmId: 'test',
      });

      expect(error).toBeInstanceOf(ApiKeyError);
      expect(error.message).toBe('Invalid key');
    });

    it('should create InsufficientCreditsError', () => {
      const error = errorMapper.createDomainError(
        'insufficient_credits',
        'No credits'
      );

      expect(error).toBeInstanceOf(InsufficientCreditsError);
    });

    it('should create ContentPolicyError', () => {
      const error = errorMapper.createDomainError(
        'content_policy',
        'Policy violation'
      );

      expect(error).toBeInstanceOf(ContentPolicyError);
    });

    it('should create PermissionError', () => {
      const error = errorMapper.createDomainError(
        'permission',
        'Access denied'
      );

      expect(error).toBeInstanceOf(PermissionError);
    });

    it('should create BadRequestError', () => {
      const error = errorMapper.createDomainError('bad_request', 'Bad request');

      expect(error).toBeInstanceOf(BadRequestError);
    });

    it('should create MalformedResponseError', () => {
      const error = errorMapper.createDomainError(
        'malformed_response',
        'Invalid response'
      );

      expect(error).toBeInstanceOf(MalformedResponseError);
    });

    it('should create ConfigurationError', () => {
      const error = errorMapper.createDomainError(
        'configuration',
        'Config error',
        { llmId: 'test' }
      );

      expect(error).toBeInstanceOf(ConfigurationError);
    });

    it('should create generic Error for unknown types', () => {
      const error = errorMapper.createDomainError('generic', 'Generic error');

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Generic error');
    });
  });

  describe('logError', () => {
    it('should log error with context', () => {
      const error = new Error('Test error');
      const context = {
        llmId: 'test-llm',
        operation: 'getAIDecision',
        status: 500,
      };

      errorMapper.logError(error, context);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Test error',
        expect.objectContaining({
          message: 'Test error',
          errorName: 'Error',
          errorType: 'Error',
          llmId: 'test-llm',
          operation: 'getAIDecision',
          status: 500,
          timestamp: expect.any(String),
        })
      );
    });

    it('should handle errors without context', () => {
      const error = new Error('Test error');

      errorMapper.logError(error);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Test error',
        expect.objectContaining({
          message: 'Test error',
          errorName: 'Error',
          errorType: 'Error',
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('getErrorTypeFromStatus', () => {
    it('should return api_key for 401', () => {
      expect(errorMapper.getErrorTypeFromStatus(401)).toBe('api_key');
    });

    it('should return insufficient_credits for 402', () => {
      expect(errorMapper.getErrorTypeFromStatus(402)).toBe(
        'insufficient_credits'
      );
    });

    it('should return permission for 403', () => {
      expect(errorMapper.getErrorTypeFromStatus(403)).toBe('permission');
    });

    it('should return bad_request for 400', () => {
      expect(errorMapper.getErrorTypeFromStatus(400)).toBe('bad_request');
    });

    it('should detect content policy violations in response body', () => {
      const responseBody = {
        error: { message: 'content policy violation' },
      };
      expect(errorMapper.getErrorTypeFromStatus(403, responseBody)).toBe(
        'content_policy'
      );
    });

    it('should return generic for unknown status codes', () => {
      expect(errorMapper.getErrorTypeFromStatus(500)).toBe('generic');
      expect(errorMapper.getErrorTypeFromStatus(418)).toBe('generic');
    });
  });

  describe('isConfigurationError', () => {
    it('should return true for ConfigurationError', () => {
      const error = new ConfigurationError('Config issue');
      expect(errorMapper.isConfigurationError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(errorMapper.isConfigurationError(new Error('Generic'))).toBe(
        false
      );
      expect(errorMapper.isConfigurationError(new ApiKeyError('Key'))).toBe(
        false
      );
    });
  });

  describe('extractErrorDetails', () => {
    it('should extract details from HttpClientError', () => {
      const error = new Error('HTTP Error');
      error.name = 'HttpClientError';
      error.status = 404;
      error.responseBody = { error: 'Not found' };

      const details = errorMapper.extractErrorDetails(error, { llmId: 'test' });

      expect(details).toEqual({
        message: 'HTTP Error',
        errorName: 'HttpClientError',
        errorType: 'Error',
        timestamp: expect.any(String),
        status: 404,
        responseBody: { error: 'Not found' },
        llmId: 'test',
        stack: expect.any(String),
      });
    });

    it('should extract basic error details', () => {
      const error = new Error('Simple error');

      const details = errorMapper.extractErrorDetails(error);

      expect(details).toEqual({
        message: 'Simple error',
        errorName: 'Error',
        errorType: 'Error',
        timestamp: expect.any(String),
        stack: expect.any(String),
      });
    });

    it('should merge context into details', () => {
      const error = new Error('Test');
      const context = {
        llmId: 'test-llm',
        operation: 'test-op',
        custom: 'value',
      };

      const details = errorMapper.extractErrorDetails(error, context);

      expect(details).toMatchObject({
        llmId: 'test-llm',
        operation: 'test-op',
        message: 'Test',
        errorName: 'Error',
        errorType: 'Error',
        timestamp: expect.any(String),
      });
    });
  });
});
