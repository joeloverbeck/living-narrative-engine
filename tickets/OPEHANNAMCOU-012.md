# OPEHANNAMCOU-012: Create ID format property tests

## Summary

Create property-based tests for component/event ID format validation. These tests ensure the `modId:identifier` format is consistently validated and that edge cases are handled correctly.

## Files to Touch

- `tests/unit/validation/componentIdFormat.property.test.js` (NEW FILE)

## Out of Scope

- DO NOT modify any handler source files
- DO NOT modify constants files
- DO NOT modify existing tests
- DO NOT modify schema files

## Changes

Create property-based tests for component/event ID format:

### Test Structure

```javascript
import { describe, it, expect } from '@jest/globals';

describe('Component ID Format Properties', () => {
  describe('Valid Format Acceptance', () => {
    it('any valid modId:identifier format passes schema', () => {
      // Property: for any valid modId and identifier, format passes
      const validCases = [
        'core:actor',
        'my_mod:component',
        'mod-with-dashes:identifier',
        'mod123:component_name',
        'a:b', // minimal valid
        'containers-core:liquid_container',
        'drinking:drinkable',
      ];

      for (const id of validCases) {
        expect(isValidComponentId(id)).toBe(true);
      }
    });

    it('accepts modIds with allowed characters', () => {
      // modId can contain: lowercase letters, numbers, underscores, hyphens
      const validModIds = [
        'core',
        'my_mod',
        'mod-name',
        'mod123',
        'mod_123_name',
        'mod-123-name',
      ];

      for (const modId of validModIds) {
        expect(isValidComponentId(`${modId}:component`)).toBe(true);
      }
    });

    it('accepts identifiers with allowed characters', () => {
      // identifier can contain: lowercase letters, numbers, underscores
      const validIdentifiers = [
        'component',
        'my_component',
        'component123',
        'component_123_name',
      ];

      for (const identifier of validIdentifiers) {
        expect(isValidComponentId(`mod:${identifier}`)).toBe(true);
      }
    });
  });

  describe('Invalid Format Rejection', () => {
    it('rejects IDs without colon separator', () => {
      const invalidCases = [
        'noColonHere',
        'just_a_string',
        '',
      ];

      for (const id of invalidCases) {
        expect(isValidComponentId(id)).toBe(false);
      }
    });

    it('rejects IDs with empty namespace', () => {
      expect(isValidComponentId(':identifier')).toBe(false);
    });

    it('rejects IDs with empty identifier', () => {
      expect(isValidComponentId('namespace:')).toBe(false);
    });

    it('rejects IDs with invalid characters', () => {
      const invalidCases = [
        'Mod:component', // uppercase in modId
        'mod:Component', // uppercase in identifier
        'mod:component!', // special character
        'mod:component space', // space
        'mod:component.name', // period
        'mod:component/name', // slash
      ];

      for (const id of invalidCases) {
        expect(isValidComponentId(id)).toBe(false);
      }
    });

    it('rejects IDs with multiple colons', () => {
      // Only one colon should be allowed (or define behavior for multiple)
      expect(isValidComponentId('mod:sub:component')).toBe(false);
      // OR if multiple colons are valid:
      // expect(extractNamespace('mod:sub:component')).toBe('mod');
    });
  });

  describe('Namespace Extraction Properties', () => {
    it('can always extract mod namespace from any valid component ID', () => {
      // Property: given any valid component ID, can extract modId
      const testCases = [
        { id: 'core:actor', expected: 'core' },
        { id: 'drinking:drinkable', expected: 'drinking' },
        { id: 'containers-core:liquid_container', expected: 'containers-core' },
      ];

      for (const { id, expected } of testCases) {
        expect(extractNamespace(id)).toBe(expected);
      }
    });

    it('extractNamespace is inverse of constructId', () => {
      // Property: extractNamespace(constructId(modId, identifier)) === modId
      const modId = 'my_mod';
      const identifier = 'my_component';

      const constructedId = `${modId}:${identifier}`;
      expect(extractNamespace(constructedId)).toBe(modId);
    });
  });

  describe('Identifier Extraction Properties', () => {
    it('can always extract identifier from any valid component ID', () => {
      const testCases = [
        { id: 'core:actor', expected: 'actor' },
        { id: 'drinking:drinkable', expected: 'drinkable' },
        { id: 'containers-core:liquid_container', expected: 'liquid_container' },
      ];

      for (const { id, expected } of testCases) {
        expect(extractIdentifier(id)).toBe(expected);
      }
    });
  });

  describe('Edge Cases', () => {
    it('handles minimal valid IDs', () => {
      expect(isValidComponentId('a:b')).toBe(true);
      expect(extractNamespace('a:b')).toBe('a');
      expect(extractIdentifier('a:b')).toBe('b');
    });

    it('handles long IDs', () => {
      const longModId = 'a'.repeat(100);
      const longIdentifier = 'b'.repeat(100);
      const longId = `${longModId}:${longIdentifier}`;

      expect(isValidComponentId(longId)).toBe(true);
      expect(extractNamespace(longId)).toBe(longModId);
    });

    it('handles unicode characters appropriately', () => {
      // Define expected behavior for unicode
      // Probably should reject for consistency
      expect(isValidComponentId('mod:cömponent')).toBe(false);
    });

    it('handles null and undefined gracefully', () => {
      expect(isValidComponentId(null)).toBe(false);
      expect(isValidComponentId(undefined)).toBe(false);
      expect(extractNamespace(null)).toBeNull();
      expect(extractNamespace(undefined)).toBeNull();
    });
  });
});

// Helper function signatures (to be implemented or imported)
function isValidComponentId(id) {
  // Validates format: modId:identifier
  // Returns boolean
}

function extractNamespace(id) {
  // Extracts modId from modId:identifier
  // Returns string or null
}

function extractIdentifier(id) {
  // Extracts identifier from modId:identifier
  // Returns string or null
}
```

## Acceptance Criteria

### Tests That Must Pass

- `NODE_ENV=test npx jest tests/unit/validation/componentIdFormat.property.test.js --no-coverage` passes
- `npx eslint tests/unit/validation/componentIdFormat.property.test.js` passes

### Invariants

- Tests validate format constraints from spec invariants section
- Tests cover edge cases (empty, special chars, multiple colons)
- Tests verify bidirectional properties (construct → extract → same value)
- Tests handle null/undefined gracefully
- Tests document expected behavior for ambiguous cases

## Dependencies

None - this test can be implemented independently

## Implementation Order

Phase 4: Validation Tests (can be done in parallel with other Phase 4 tickets)

## Notes

These are property-based tests that validate the fundamental format constraints. They should:

1. Define what makes a valid component/event ID
2. Ensure extraction functions are reliable
3. Document edge case handling
4. Provide a specification through tests

Consider using a property-based testing library like `fast-check` if available, but the tests can also be implemented with explicit test cases as shown above.

The naming convention from the spec: "Component/event IDs MUST use the format `modId:identifier` where `modId` matches the owning mod's directory name."
