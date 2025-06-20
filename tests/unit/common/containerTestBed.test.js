/**
 * @file Test suite for the generic ContainerTestBed helper.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ContainerTestBed from '../../common/containerTestBed.js';

describe('ContainerTestBed', () => {
  const TOKEN = 'token';
  let container;
  let testBed;

  beforeEach(() => {
    container = {
      resolve: jest.fn((tok) => (tok === TOKEN ? 'original' : undefined)),
    };
    testBed = new ContainerTestBed(container);
  });

  it('withTokenOverride replaces resolve and resets on cleanup', async () => {
    const custom = { foo: 'bar' };
    testBed.withTokenOverride(TOKEN, custom);

    expect(container.resolve(TOKEN)).toBe(custom);

    await testBed.cleanup();

    expect(container.resolve(TOKEN)).toBe('original');
  });
});
