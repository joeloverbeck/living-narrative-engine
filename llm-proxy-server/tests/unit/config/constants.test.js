import { afterEach, describe, expect, it } from '@jest/globals';
import path from 'path';
import { pathToFileURL } from 'url';
import { execFileSync } from 'child_process';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const CONSTANTS_PATH = path.join(
  process.cwd(),
  'src',
  'config',
  'constants.js'
);

const importConstantsWithEnv = async (nodeEnv) => {
  if (typeof nodeEnv === 'undefined') {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = nodeEnv;
  }

  const moduleUrl = pathToFileURL(CONSTANTS_PATH);
  moduleUrl.searchParams.set(
    'env',
    `${nodeEnv ?? 'unset'}-${Date.now()}-${Math.random()}`
  );
  return import(moduleUrl.href);
};

const readRateLimitValuesInChild = (nodeEnv) => {
  const childEnv = { ...process.env };
  if (typeof nodeEnv === 'undefined') {
    delete childEnv.NODE_ENV;
  } else {
    childEnv.NODE_ENV = nodeEnv;
  }

  const moduleUrl = pathToFileURL(CONSTANTS_PATH);
  const script = `import { RATE_LIMIT_GENERAL_MAX_REQUESTS, RATE_LIMIT_LLM_MAX_REQUESTS } from '${moduleUrl.href}';
console.log(JSON.stringify({ general: RATE_LIMIT_GENERAL_MAX_REQUESTS, llm: RATE_LIMIT_LLM_MAX_REQUESTS }));`;

  const output = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', script],
    {
      env: childEnv,
      encoding: 'utf8',
    }
  );

  return JSON.parse(output.trim());
};

afterEach(() => {
  if (typeof ORIGINAL_NODE_ENV === 'undefined') {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  }
});

describe('config/constants', () => {
  it('should list local API types that do not require proxy-managed keys', async () => {
    const { LOCAL_API_TYPES_REQUIRING_NO_PROXY_KEY } =
      await importConstantsWithEnv('test');

    expect(LOCAL_API_TYPES_REQUIRING_NO_PROXY_KEY).toEqual([
      'ollama',
      'llama_cpp_server_openai_compatible',
      'tgi_openai_compatible',
    ]);
    expect(new Set(LOCAL_API_TYPES_REQUIRING_NO_PROXY_KEY).size).toBe(
      LOCAL_API_TYPES_REQUIRING_NO_PROXY_KEY.length
    );
  });

  it('should expose retryable HTTP status codes as a unique ascending list', async () => {
    const { RETRYABLE_HTTP_STATUS_CODES } =
      await importConstantsWithEnv('test');

    const sortedCodes = [...RETRYABLE_HTTP_STATUS_CODES].sort((a, b) => a - b);
    expect(RETRYABLE_HTTP_STATUS_CODES).toEqual(sortedCodes);
    expect(new Set(RETRYABLE_HTTP_STATUS_CODES).size).toBe(
      RETRYABLE_HTTP_STATUS_CODES.length
    );
    expect(RETRYABLE_HTTP_STATUS_CODES).toEqual([408, 429, 500, 502, 503, 504]);
  });

  it('should adapt rate limiting thresholds according to NODE_ENV', () => {
    const development = readRateLimitValuesInChild('development');
    expect(development).toEqual({ general: 2000, llm: 100 });

    const production = readRateLimitValuesInChild('production');
    expect(production).toEqual({ general: 100, llm: 10 });

    const fallback = readRateLimitValuesInChild(undefined);
    expect(fallback).toEqual({ general: 2000, llm: 100 });
  });

  it('should expose security patterns covering IPv6 and dangerous headers', async () => {
    const {
      SECURITY_IPV6_LOOPBACK_ADDRESSES,
      SECURITY_IPV6_PRIVATE_PREFIXES,
      SECURITY_DANGEROUS_HEADER_NAMES,
      SECURITY_DANGEROUS_HEADER_PATTERN,
    } = await importConstantsWithEnv('test');

    expect(SECURITY_IPV6_LOOPBACK_ADDRESSES).toEqual([
      '::1',
      '::0',
      '0:0:0:0:0:0:0:1',
      '0:0:0:0:0:0:0:0',
    ]);

    expect(SECURITY_IPV6_PRIVATE_PREFIXES).toEqual([
      'fc',
      'fd',
      'fe8',
      'fe9',
      'fea',
      'feb',
      'fec',
      'fed',
      'fee',
      'fef',
      'ff',
    ]);

    expect(new Set(SECURITY_DANGEROUS_HEADER_NAMES).size).toBe(
      SECURITY_DANGEROUS_HEADER_NAMES.length
    );
    expect(SECURITY_DANGEROUS_HEADER_PATTERN.test('__proto__')).toBe(true);
    expect(SECURITY_DANGEROUS_HEADER_PATTERN.test('X-Custom-Header')).toBe(
      false
    );
  });
});
