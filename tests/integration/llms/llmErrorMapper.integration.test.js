import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { LLMErrorMapper } from '../../../src/llms/services/llmErrorMapper.js';
import {
  ApiKeyError,
  InsufficientCreditsError,
  ContentPolicyError,
  PermissionError,
  BadRequestError,
  LLMInteractionError,
  MalformedResponseError,
} from '../../../src/errors/llmInteractionErrors.js';
import { ConfigurationError } from '../../../src/errors/configurationError.js';
import PromptTooLongError from '../../../src/errors/promptTooLongError.js';
import { LLMStrategyError } from '../../../src/llms/errors/LLMStrategyError.js';

const createLogger = () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
});

describe('Integration – LLMErrorMapper interacting with real domain errors', () => {
  let mapper;
  let logger;

  beforeEach(() => {
    logger = createLogger();
    mapper = new LLMErrorMapper({ logger });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('maps transport errors and reuses existing domain errors without losing context', () => {
    const existingDomainError = new PermissionError('already handled', {
      llmId: 'alpha-llm',
      status: 403,
    });
    expect(mapper.mapHttpError(existingDomainError)).toBe(existingDomainError);

    const strategyError = new LLMStrategyError('strategy failure');
    expect(mapper.mapHttpError(strategyError)).toBe(strategyError);

    const promptError = new PromptTooLongError('prompt too long');
    expect(mapper.mapHttpError(promptError)).toBe(promptError);

    const unauthorized = mapper.mapHttpError(new Error('missing api key'), {
      status: 401,
      llmId: 'beta-llm',
      responseBody: { error: 'no key' },
    });
    expect(unauthorized).toBeInstanceOf(ApiKeyError);
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.llmId).toBe('beta-llm');

    const policyViolation = mapper.mapHttpError(new Error('forbidden'), {
      status: 403,
      responseBody: { detail: 'Policy violation detected' },
    });
    expect(policyViolation).toBeInstanceOf(ContentPolicyError);

    const permissionFailure = mapper.mapHttpError(new Error('denied'), {
      status: 403,
      responseBody: { error: 'insufficient scope' },
    });
    expect(permissionFailure).toBeInstanceOf(PermissionError);

    const badRequest = mapper.mapHttpError(new Error('bad request'), {
      status: 400,
      responseBody: { detail: 'invalid json' },
    });
    expect(badRequest).toBeInstanceOf(BadRequestError);

    const networkReset = mapper.mapHttpError(
      Object.assign(new Error('socket reset'), { code: 'ECONNRESET' }),
      { llmId: 'gamma-llm', operation: 'completion' }
    );
    expect(networkReset).toBeInstanceOf(LLMInteractionError);
    expect(networkReset.llmId).toBe('gamma-llm');

    const jsonFailure = mapper.mapHttpError(
      Object.assign(new Error('could not parse'), {
        name: 'JsonProcessingError',
      }),
      { llmId: 'delta-llm' }
    );
    expect(jsonFailure).toBeInstanceOf(MalformedResponseError);

    const fallback = mapper.mapHttpError(new Error('generic failure'), {
      llmId: 'epsilon-llm',
      operation: 'chat-completion',
    });
    expect(fallback).toBeInstanceOf(LLMInteractionError);
    expect(fallback.llmId).toBe('epsilon-llm');
  });

  it('creates domain errors with detailed context and supports all categories', () => {
    const original = new Error('root cause');
    const configurationIssue = mapper.createDomainError(
      'configuration',
      'missing endpoint',
      {
        llmId: 'cfg-llm',
        problematicField: 'endpointUrl',
        originalError: original,
      }
    );
    expect(configurationIssue).toBeInstanceOf(ConfigurationError);
    expect(configurationIssue.problematicField).toBe('endpointUrl');
    expect(configurationIssue.llmId).toBe('cfg-llm');

    const malformed = mapper.createDomainError(
      'malformed_response',
      'invalid payload',
      {
        llmId: 'malformed-llm',
      }
    );
    expect(malformed).toBeInstanceOf(MalformedResponseError);
    expect(malformed.llmId).toBe('malformed-llm');

    const generic = mapper.createDomainError('generic', 'temporary outage', {
      status: 503,
      llmId: 'fallback-llm',
    });
    expect(generic).toBeInstanceOf(LLMInteractionError);
    expect(generic.status).toBe(503);

    expect(mapper.getErrorTypeFromStatus(401)).toBe('api_key');
    expect(
      mapper.getErrorTypeFromStatus(403, {
        message: 'Content policy violation',
      })
    ).toBe('content_policy');
    expect(
      mapper.getErrorTypeFromStatus(403, { message: 'access denied' })
    ).toBe('permission');
    expect(mapper.getErrorTypeFromStatus(422)).toBe('bad_request');
    expect(mapper.getErrorTypeFromStatus(429)).toBe('generic');
    expect(mapper.getErrorTypeFromStatus(500)).toBe('generic');
  });

  it('logs errors at severity-aware levels and exposes structured details', () => {
    const initialErrorCalls = logger.error.mock.calls.length;
    const initialWarnCalls = logger.warn.mock.calls.length;
    const initialDebugCalls = logger.debug.mock.calls.length;

    const apiKeyError = new ApiKeyError('key missing', { llmId: 'crit-llm' });
    mapper.logError(apiKeyError, { llmId: 'crit-llm', operation: 'startup' });
    expect(logger.error).toHaveBeenCalledTimes(initialErrorCalls + 1);
    const criticalPayload = logger.error.mock.calls[initialErrorCalls][1];
    expect(criticalPayload.llmId).toBe('crit-llm');

    const creditError = new InsufficientCreditsError('credits exhausted', {
      llmId: 'warn-llm',
      status: 402,
    });
    mapper.logError(creditError, { llmId: 'warn-llm', operation: 'summarize' });
    expect(logger.warn).toHaveBeenCalledTimes(initialWarnCalls + 1);

    const transient = new LLMInteractionError('retry later', {
      llmId: 'debug-llm',
    });
    mapper.logError(transient, { llmId: 'debug-llm', operation: 'chat' });
    expect(logger.debug).toHaveBeenCalledTimes(initialDebugCalls + 1);

    const downstream = new Error('downstream');
    const configurationError = new ConfigurationError('invalid value', {
      problematicField: 'apiKey',
      originalError: downstream,
    });
    const extracted = mapper.extractErrorDetails(configurationError, {
      llmId: 'cfg-llm',
      operation: 'validate-config',
      status: 500,
      responseBody: { error: 'invalid' },
      originalError: downstream,
    });

    expect(extracted.isConfigurationError).toBe(true);
    expect(extracted.problematicFields).toBe('apiKey');
    expect(extracted.llmId).toBe('cfg-llm');
    expect(extracted.status).toBe(500);
    expect(extracted.responseBody).toEqual({ error: 'invalid' });
    expect(extracted.originalError?.message).toBe('downstream');
    expect(typeof extracted.timestamp).toBe('string');

    expect(mapper.isConfigurationError(configurationError)).toBe(true);
    expect(mapper.isConfigurationError({ problematicField: 'timeout' })).toBe(
      true
    );
    expect(mapper.isConfigurationError(new Error('plain error'))).toBe(false);
  });
});
