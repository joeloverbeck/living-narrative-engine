import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { LlmRequestService } from '../src/services/llmRequestService.js';
import {
  HTTP_HEADER_CONTENT_TYPE,
  CONTENT_TYPE_JSON,
} from '../src/config/constants.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const baseConfig = {
  endpointUrl: 'http://example.com/llm',
  displayName: 'Example',
  apiType: 'openai',
};

describe('LlmRequestService uncovered branches', () => {
  let logger;
  let service;

  beforeEach(() => {
    logger = createLogger();
    service = new LlmRequestService(logger);
    jest.clearAllMocks();
  });

  test('_constructHeaders skips invalid client headers', () => {
    const headers = service._constructHeaders(
      { ...baseConfig, providerSpecificHeaders: { 'X-P': '1' } },
      null,
      null
    );
    expect(headers).toEqual({
      [HTTP_HEADER_CONTENT_TYPE]: CONTENT_TYPE_JSON,
      'X-P': '1',
    });
  });

  test('_sanitizePayloadForLogging keeps short message content', () => {
    const payload = { messages: [{ role: 'user', content: 'hello' }] };
    const result = service._sanitizePayloadForLogging(payload);
    expect(result.messages[0].content).toBe('hello');
  });
});
