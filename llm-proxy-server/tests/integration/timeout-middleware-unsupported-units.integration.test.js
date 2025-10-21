/**
 * @file timeout-middleware-unsupported-units.integration.test.js
 * @description Verifies that the timeout size-limit configuration gracefully
 *              handles custom limits that use unsupported units by falling
 *              back to byte calculations while still enforcing the hard
 *              security ceiling without relying on mocked collaborators.
 */

import { describe, expect, it } from '@jest/globals';

import { createSizeLimitConfig } from '../../src/middleware/timeout.js';
import { SECURITY_MAX_REQUEST_SIZE_BYTES } from '../../src/config/constants.js';

describe('Timeout middleware size limit handling with unsupported units', () => {
  it('still enforces the hard security ceiling when verify is invoked with an oversized buffer', () => {
    const sizeLimitConfig = createSizeLimitConfig({
      jsonLimit: '5zb',
      enforceMaxLimit: true,
    });

    const invokeVerify = () =>
      sizeLimitConfig.json.verify(
        { headers: { 'content-type': 'application/json' } },
        {},
        Buffer.alloc(SECURITY_MAX_REQUEST_SIZE_BYTES + 32)
      );

    expect(invokeVerify).toThrow('Request payload too large');
  });

  it('permits small payload buffers even when the configured limit uses an unknown unit', () => {
    const sizeLimitConfig = createSizeLimitConfig({
      jsonLimit: '5zb',
      enforceMaxLimit: true,
    });

    const invokeVerify = () =>
      sizeLimitConfig.json.verify(
        { headers: { 'content-type': 'application/json' } },
        {},
        Buffer.from('{"data":"ok"}')
      );

    expect(invokeVerify).not.toThrow();
  });
});
