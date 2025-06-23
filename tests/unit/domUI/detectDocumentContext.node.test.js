/** @jest-environment node */
import { describe, it, expect, jest } from '@jest/globals';
import { detectDocumentContext } from '../../../src/domUI/documentContext.js';

describe('detectDocumentContext (node environment)', () => {
  it('returns null and logs an error when no document is available', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const ctx = detectDocumentContext();
    expect(ctx).toBeNull();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('Could not determine a valid document context')
    );
  });
});
