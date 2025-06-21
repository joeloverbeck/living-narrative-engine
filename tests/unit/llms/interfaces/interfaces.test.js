// tests/llms/interfaces/interfaces.test.js
// -----------------------------------------------------------------------------
// Tests for basic interface classes exported in src/llms/interfaces.
// These classes are minimal and simply throw errors if their methods are called.
// These tests ensure that calling the interface methods results in the expected
// error being thrown so they contribute to coverage totals.
// -----------------------------------------------------------------------------

import { describe, it, expect } from '@jest/globals';
import { IApiKeyProvider } from '../../../../src/llms/interfaces/iApiKeyProvider.js';
import { IHttpClient } from '../../../../src/llms/interfaces/iHttpClient.js';
import { ILLMStrategy } from '../../../../src/llms/interfaces/iLLMStrategy.js';

/** Dummy objects for method arguments */
const dummyConfig = {};
const dummyEnv = {};
const dummyOptions = { method: 'GET' };

describe('LLM interface base classes', () => {
  it('IApiKeyProvider.getKey should reject with not implemented error', async () => {
    const provider = new IApiKeyProvider();
    await expect(provider.getKey(dummyConfig, dummyEnv)).rejects.toThrow(
      'IApiKeyProvider.getKey method not implemented.'
    );
  });

  it('IHttpClient.request should reject with not implemented error', async () => {
    const client = new IHttpClient();
    await expect(
      client.request('http://example.com', dummyOptions)
    ).rejects.toThrow('IHttpClient.request method not implemented.');
  });

  it('ILLMStrategy.execute should reject with not implemented error', async () => {
    const strategy = new ILLMStrategy();
    await expect(strategy.execute({})).rejects.toThrow(
      'ILLMStrategy.execute method not implemented.'
    );
  });
});
