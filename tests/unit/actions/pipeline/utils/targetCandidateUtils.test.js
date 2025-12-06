import { describe, expect, it } from '@jest/globals';
import { extractCandidateId } from '../../../../../src/actions/pipeline/utils/targetCandidateUtils.js';

describe('targetCandidateUtils.extractCandidateId', () => {
  it('returns null when candidate is missing or falsy', () => {
    expect(extractCandidateId(undefined)).toBeNull();
    expect(extractCandidateId(null)).toBeNull();
    expect(extractCandidateId(false)).toBeNull();
  });

  it('returns the direct candidate id when provided', () => {
    expect(
      extractCandidateId({ id: 'entity-123', entity: { id: 'other-entity' } })
    ).toBe('entity-123');
  });

  it('falls back to the nested entity id when direct id is unavailable', () => {
    expect(extractCandidateId({ entity: { id: 'nested-id' } })).toBe(
      'nested-id'
    );
  });

  it('returns null when no string identifiers are available', () => {
    expect(extractCandidateId({ id: '' })).toBeNull();
    expect(extractCandidateId({ id: 42, entity: { id: 99 } })).toBeNull();
    expect(extractCandidateId({ entity: {} })).toBeNull();
  });
});
