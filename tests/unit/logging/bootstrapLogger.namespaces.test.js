import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { resolveDebugNamespaces } from '../../../src/logging/bootstrapLogger.js';

describe('bootstrapLogger - resolveDebugNamespaces', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = process.env.DEBUG_NAMESPACES;
  });

  afterEach(() => {
    // Restore original environment
    if (originalEnv === undefined) {
      delete process.env.DEBUG_NAMESPACES;
    } else {
      process.env.DEBUG_NAMESPACES = originalEnv;
    }
  });

  it('should return empty Set when DEBUG_NAMESPACES is not set', () => {
    delete process.env.DEBUG_NAMESPACES;
    const namespaces = resolveDebugNamespaces();
    expect(namespaces).toBeInstanceOf(Set);
    expect(namespaces.size).toBe(0);
  });

  it('should return empty Set when DEBUG_NAMESPACES is empty string', () => {
    process.env.DEBUG_NAMESPACES = '';
    const namespaces = resolveDebugNamespaces();
    expect(namespaces.size).toBe(0);
  });

  it('should parse single namespace', () => {
    process.env.DEBUG_NAMESPACES = 'engine:init';
    const namespaces = resolveDebugNamespaces();
    expect(namespaces.has('engine:init')).toBe(true);
    expect(namespaces.size).toBe(1);
  });

  it('should parse multiple namespaces', () => {
    process.env.DEBUG_NAMESPACES = 'engine:init,ai:memory,ui:render';
    const namespaces = resolveDebugNamespaces();
    expect(namespaces.has('engine:init')).toBe(true);
    expect(namespaces.has('ai:memory')).toBe(true);
    expect(namespaces.has('ui:render')).toBe(true);
    expect(namespaces.size).toBe(3);
  });

  it('should trim whitespace from namespace names', () => {
    process.env.DEBUG_NAMESPACES = '  engine:init  ,  ai:memory  ';
    const namespaces = resolveDebugNamespaces();
    expect(namespaces.has('engine:init')).toBe(true);
    expect(namespaces.has('ai:memory')).toBe(true);
    expect(namespaces.size).toBe(2);
  });

  it('should filter out empty namespace strings', () => {
    process.env.DEBUG_NAMESPACES = 'engine:init,,ai:memory,  ,';
    const namespaces = resolveDebugNamespaces();
    expect(namespaces.has('engine:init')).toBe(true);
    expect(namespaces.has('ai:memory')).toBe(true);
    expect(namespaces.size).toBe(2);
  });

  it('should handle complex namespace patterns', () => {
    process.env.DEBUG_NAMESPACES = 'core:engine:init,module:sub:feature';
    const namespaces = resolveDebugNamespaces();
    expect(namespaces.has('core:engine:init')).toBe(true);
    expect(namespaces.has('module:sub:feature')).toBe(true);
    expect(namespaces.size).toBe(2);
  });

  it('should deduplicate namespaces', () => {
    process.env.DEBUG_NAMESPACES = 'engine:init,ai:memory,engine:init';
    const namespaces = resolveDebugNamespaces();
    expect(namespaces.size).toBe(2); // Set automatically deduplicates
    expect(namespaces.has('engine:init')).toBe(true);
    expect(namespaces.has('ai:memory')).toBe(true);
  });
});
