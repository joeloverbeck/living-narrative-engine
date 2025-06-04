/** @jest-environment node */ // <--- ADD THIS LINE AT THE TOP

// structuredCloneCheck.test.js
import { describe, expect, it } from '@jest/globals';

describe('Environment Check', () => {
  it('should have structuredClone globally available', () => {
    console.log('Minimal test running with Node version:', process.version);
    expect(typeof structuredClone).toBe('function');
  });
});
