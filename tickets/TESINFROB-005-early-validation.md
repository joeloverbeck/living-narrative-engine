# TESINFROB-005: Early Validation in ModTestFixture.forAction()

**Priority**: Low | **Effort**: Small

## Description

Add early validation in `ModTestFixture.forAction()` to catch common issues before test execution begins, with helpful suggestions.

## Files to Touch

- `tests/common/mods/ModTestFixture.js` (modify)
- `tests/unit/common/mods/ModTestFixture.validation.test.js` (create)

## Out of Scope

- **DO NOT** change factory method signatures
- **DO NOT** add new public methods beyond validation
- **DO NOT** modify `systemLogicTestEnv.js`
- **DO NOT** change error handling for valid inputs
- **DO NOT** add scope mocking (that's TESINFROB-003)
- **DO NOT** add condition registration (that's TESINFROB-004)

## Implementation Details

### 1. Add validation to forAction()

In `tests/common/mods/ModTestFixture.js`, add validation to `forAction()`:

```javascript
import fs from 'fs';
import { findSimilar } from '../../../src/utils/suggestionUtils.js';

class ModTestFixture {
  // ... existing code ...

  /**
   * Create a fixture for testing a specific action.
   *
   * @param {string} modId - Mod identifier
   * @param {string} actionId - Full namespaced action ID (e.g., 'mod:action')
   * @param {string} [ruleFile] - Optional rule file path
   * @param {string} [conditionFile] - Optional condition file path
   * @param {Object} [options={}] - Additional options
   * @returns {Promise<ModTestFixture>}
   * @throws {Error} If action ID format is invalid or mod/action not found
   */
  static async forAction(modId, actionId, ruleFile, conditionFile, options = {}) {
    // Validate action ID format
    if (!actionId.includes(':')) {
      const suggestion = `${modId}:${actionId}`;
      throw new Error(
        `Invalid action ID format: '${actionId}'. ` +
        `Action IDs must be namespaced (e.g., 'mod:action-name'). ` +
        `Did you mean '${suggestion}'?`
      );
    }

    // Check mod exists
    const modPath = `data/mods/${modId}`;
    if (!fs.existsSync(modPath)) {
      const availableMods = fs.readdirSync('data/mods').filter(d => {
        try {
          return fs.statSync(`data/mods/${d}`).isDirectory();
        } catch {
          return false;
        }
      });
      const suggestions = findSimilar(modId, availableMods, {
        maxDistance: 3,
        maxSuggestions: 3,
      });
      throw new Error(
        `Mod '${modId}' not found at ${modPath}. ` +
        (suggestions.length
          ? `Did you mean: ${suggestions.join(', ')}?`
          : `Available mods: ${availableMods.slice(0, 5).join(', ')}${availableMods.length > 5 ? '...' : ''}`)
      );
    }

    // Check action file exists
    const actionFile = `data/mods/${modId}/actions/${actionId.split(':')[1]}.action.json`;
    if (!fs.existsSync(actionFile)) {
      const actionsDir = `data/mods/${modId}/actions`;
      let availableActions = [];
      if (fs.existsSync(actionsDir)) {
        availableActions = fs.readdirSync(actionsDir)
          .filter(f => f.endsWith('.action.json'))
          .map(f => `${modId}:${f.replace('.action.json', '')}`);
      }
      const suggestions = findSimilar(actionId, availableActions, {
        maxDistance: 5,
        maxSuggestions: 3,
      });
      throw new Error(
        `Action '${actionId}' not found at ${actionFile}. ` +
        (suggestions.length
          ? `Did you mean: ${suggestions.join(', ')}?`
          : availableActions.length
            ? `Available actions in '${modId}': ${availableActions.slice(0, 5).join(', ')}${availableActions.length > 5 ? '...' : ''}`
            : `No actions found in mod '${modId}'.`)
      );
    }

    // ... existing implementation continues ...
  }
}
```

### 2. Create test file

Create `tests/unit/common/mods/ModTestFixture.validation.test.js`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../../tests/common/mods/ModTestFixture.js';

describe('ModTestFixture.forAction() validation', () => {
  describe('action ID format validation', () => {
    it('should throw for non-namespaced action ID with suggestion', async () => {
      await expect(
        ModTestFixture.forAction('core', 'wait')
      ).rejects.toThrow(/Action IDs must be namespaced/);

      await expect(
        ModTestFixture.forAction('core', 'wait')
      ).rejects.toThrow(/Did you mean 'core:wait'/);
    });

    it('should accept valid namespaced action ID', async () => {
      // This should not throw for format validation
      // (may throw later if action doesn't exist)
      const fixture = await ModTestFixture.forAction('core', 'core:wait');
      expect(fixture).toBeDefined();
      fixture.cleanup();
    });
  });

  describe('mod existence validation', () => {
    it('should throw for non-existent mod with suggestions', async () => {
      await expect(
        ModTestFixture.forAction('nonexistent_mod', 'nonexistent_mod:action')
      ).rejects.toThrow(/Mod 'nonexistent_mod' not found/);
    });

    it('should suggest similar mod names', async () => {
      // 'cor' is close to 'core'
      await expect(
        ModTestFixture.forAction('cor', 'cor:wait')
      ).rejects.toThrow(/Did you mean.*core/);
    });
  });

  describe('action existence validation', () => {
    it('should throw for non-existent action with suggestions', async () => {
      await expect(
        ModTestFixture.forAction('core', 'core:nonexistent_action')
      ).rejects.toThrow(/Action 'core:nonexistent_action' not found/);
    });

    it('should suggest similar action names', async () => {
      // 'core:wai' is close to 'core:wait'
      await expect(
        ModTestFixture.forAction('core', 'core:wai')
      ).rejects.toThrow(/Did you mean.*core:wait/);
    });

    it('should list available actions when no close match', async () => {
      await expect(
        ModTestFixture.forAction('core', 'core:zzzzz')
      ).rejects.toThrow(/Available actions/);
    });
  });

  describe('valid inputs', () => {
    let fixture;

    afterEach(() => {
      fixture?.cleanup();
    });

    it('should pass validation for valid mod and action', async () => {
      fixture = await ModTestFixture.forAction('core', 'core:wait');
      expect(fixture).toBeDefined();
      expect(fixture.testEnv).toBeDefined();
    });

    it('should work with additional options', async () => {
      fixture = await ModTestFixture.forAction(
        'core',
        'core:wait',
        undefined,
        undefined,
        { enableDiagnostics: false }
      );
      expect(fixture).toBeDefined();
    });
  });
});
```

## Acceptance Criteria

### Tests that must pass

- `tests/unit/common/mods/ModTestFixture.validation.test.js`:
  - `should throw for non-namespaced action ID with suggestion`
  - `should accept valid namespaced action ID`
  - `should throw for non-existent mod with suggestions`
  - `should suggest similar mod names`
  - `should throw for non-existent action with suggestions`
  - `should suggest similar action names`
  - `should list available actions when no close match`
  - `should pass validation for valid inputs`

### Invariants

- All existing tests pass unchanged
- Valid inputs work exactly as before
- Error messages are actionable with suggestions
- No runtime overhead for valid inputs (validation is fail-fast)
- No changes to factory method signatures

## Verification

```bash
# Run new tests
npm run test:unit -- tests/unit/common/mods/ModTestFixture.validation.test.js

# Verify no regressions
npm run test:unit
npm run test:integration
```

## Notes

This ticket adds defensive validation that catches common mistakes early:
- Forgetting namespace prefix on action IDs
- Typos in mod names
- Typos in action names

The suggestions use the same Levenshtein distance algorithm as TESINFROB-001.
