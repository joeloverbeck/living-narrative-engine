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
  LLMInteractionError,
} from '../../../../src/errors/llmInteractionErrors.js';
import { ConfigurationError } from '../../../../src/errors/configurationError.js';
import PromptTooLongError from '../../../../src/errors/promptTooLongError.js';
import { LLMStrategyError } from '../../../../src/llms/errors/LLMStrategyError.js';

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

    it('should handle network timeout errors', () => {
      const error = new Error('Connection timeout');
      error.code = 'ETIMEDOUT';
      
      const context = { llmId: 'test-llm', operation: 'getAIDecision' };
      const mapped = errorMapper.mapHttpError(error, context);

      expect(mapped).toBeInstanceOf(LLMInteractionError);
      expect(mapped.message).toBe('Connection timeout');
      expect(mapped.llmId).toBe('test-llm');
    });

    it('should handle network connection reset errors', () => {
      const error = new Error('Connection reset');
      error.code = 'ECONNRESET';
      
      const mapped = errorMapper.mapHttpError(error);

      expect(mapped).toBeInstanceOf(LLMInteractionError);
      expect(mapped.message).toBe('Connection reset');
    });

    it('should handle generic NetworkError', () => {
      const error = new Error('Network error');
      error.name = 'NetworkError';
      
      const mapped = errorMapper.mapHttpError(error);

      expect(mapped).toBeInstanceOf(LLMInteractionError);
      expect(mapped.message).toBe('Network error');
    });

    it('should handle JSON processing errors', () => {
      const error = new Error('Invalid JSON response');
      error.name = 'JsonProcessingError';
      
      const context = { llmId: 'test-llm', operation: 'parseResponse' };
      const mapped = errorMapper.mapHttpError(error, context);

      expect(mapped).toBeInstanceOf(MalformedResponseError);
      expect(mapped.message).toBe('Invalid JSON response');
      expect(mapped.llmId).toBe('test-llm');
    });

    it('should return domain errors as-is', () => {
      const domainError = new ApiKeyError('API key invalid', { llmId: 'test' });
      
      const mapped = errorMapper.mapHttpError(domainError);

      expect(mapped).toBe(domainError);
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

    it('should log critical errors with error level', () => {
      const error = new ApiKeyError('Invalid API key', { llmId: 'test' });
      const context = { llmId: 'test-llm', operation: 'authenticate' };

      errorMapper.logError(error, context);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid API key',
        expect.objectContaining({
          message: 'Invalid API key',
          errorName: 'ApiKeyError',
          errorType: 'ApiKeyError',
          llmId: 'test-llm',
          operation: 'authenticate',
        })
      );
    });

    it('should log warning errors with warn level', () => {
      const error = new InsufficientCreditsError('No credits', { llmId: 'test' });
      const context = { llmId: 'test-llm', operation: 'generate' };

      errorMapper.logError(error, context);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No credits',
        expect.objectContaining({
          message: 'No credits',
          errorName: 'InsufficientCreditsError',
          errorType: 'InsufficientCreditsError',
          llmId: 'test-llm',
          operation: 'generate',
        })
      );
    });

    it('should log rate limiting errors with warn level', () => {
      const error = new Error('Rate limited');
      error.status = 429;
      const context = { llmId: 'test-llm', operation: 'generate' };

      errorMapper.logError(error, context);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Rate limited',
        expect.objectContaining({
          message: 'Rate limited',
          status: 429,
          llmId: 'test-llm',
          operation: 'generate',
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

    it('should return bad_request for 422', () => {
      expect(errorMapper.getErrorTypeFromStatus(422)).toBe('bad_request');
    });

    it('should return generic for rate limiting (429)', () => {
      expect(errorMapper.getErrorTypeFromStatus(429)).toBe('generic');
    });

    it('should return generic for server errors', () => {
      expect(errorMapper.getErrorTypeFromStatus(500)).toBe('generic');
      expect(errorMapper.getErrorTypeFromStatus(502)).toBe('generic');
      expect(errorMapper.getErrorTypeFromStatus(503)).toBe('generic');
      expect(errorMapper.getErrorTypeFromStatus(504)).toBe('generic');
    });

    it('should return generic for unknown status codes', () => {
      expect(errorMapper.getErrorTypeFromStatus(418)).toBe('generic');
      expect(errorMapper.getErrorTypeFromStatus(999)).toBe('generic');
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

    it('should extract configuration error metadata', () => {
      const error = new ConfigurationError('Invalid config', {
        llmId: 'test',
        problematicField: 'apiKey',
      });
      error.problematicFields = ['apiKey', 'model'];

      const details = errorMapper.extractErrorDetails(error);

      expect(details).toMatchObject({
        message: 'Invalid config',
        isConfigurationError: true,
        problematicFields: ['apiKey', 'model'],
      });
    });

    it('should extract configuration error with single problematic field', () => {
      const error = new ConfigurationError('Invalid config', {
        llmId: 'test',
        problematicField: 'temperature',
      });

      const details = errorMapper.extractErrorDetails(error);

      expect(details).toMatchObject({
        message: 'Invalid config',
        isConfigurationError: true,
        problematicFields: 'temperature',
      });
    });

    it('should extract original error details from error property', () => {
      const originalError = new Error('Root cause');
      originalError.name = 'RootError';
      
      const error = new Error('Wrapped error');
      error.originalError = originalError;

      const details = errorMapper.extractErrorDetails(error);

      expect(details).toMatchObject({
        message: 'Wrapped error',
        originalError: {
          message: 'Root cause',
          name: 'RootError',
          type: 'Error',
        },
      });
    });

    it('should extract original error details from context', () => {
      const originalError = new Error('Context root cause');
      originalError.name = 'ContextRootError';
      
      const error = new Error('Main error');
      const context = { originalError, llmId: 'test' };

      const details = errorMapper.extractErrorDetails(error, context);

      expect(details).toMatchObject({
        message: 'Main error',
        llmId: 'test',
        originalError: {
          message: 'Context root cause',
          name: 'ContextRootError',
          type: 'Error',
        },
      });
    });
  });

  describe('domain error detection', () => {
    it('should detect all supported domain error types', () => {
      const domainErrors = [
        new LLMInteractionError('LLM error', { llmId: 'test' }),
        new ApiKeyError('API key error', { llmId: 'test' }),
        new InsufficientCreditsError('Credits error', { llmId: 'test' }),
        new ContentPolicyError('Policy error', { llmId: 'test' }),
        new PermissionError('Permission error', { llmId: 'test' }),
        new BadRequestError('Bad request error', { llmId: 'test' }),
        new MalformedResponseError('Malformed response', { llmId: 'test' }),
        new ConfigurationError('Config error', { llmId: 'test' }),
        new PromptTooLongError('Prompt too long', { llmId: 'test' }),
        new LLMStrategyError('Strategy error', { llmId: 'test' }),
      ];

      domainErrors.forEach((domainError) => {
        const result = errorMapper.mapHttpError(domainError);
        expect(result).toBe(domainError);
      });
    });

    it('should not detect regular errors as domain errors', () => {
      const regularError = new Error('Regular error');
      const result = errorMapper.mapHttpError(regularError);
      
      expect(result).not.toBe(regularError);
      expect(result).toBeInstanceOf(LLMInteractionError);
    });
  });
});
