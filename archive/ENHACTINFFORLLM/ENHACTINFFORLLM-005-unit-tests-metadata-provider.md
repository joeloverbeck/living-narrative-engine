# ENHACTINFFORLLM-005: Unit Tests for ModActionMetadataProvider

## Status: COMPLETED ✅

## Summary
Create comprehensive unit tests for the ModActionMetadataProvider service.

## Prerequisites
- ENHACTINFFORLLM-002 must be completed (service implementation) ✅

## Files to Touch
- `tests/unit/prompting/modActionMetadataProvider.test.js` (NEW FILE)

> **Note**: The original ticket incorrectly specified `tests/unit/prompting/services/` but the service is at `src/prompting/modActionMetadataProvider.js` (not in a `services/` subfolder). Test file location updated to mirror the source structure.

## Out of Scope
- DO NOT modify the service implementation
- DO NOT modify any other test files
- DO NOT create integration tests (that's ENHACTINFFORLLM-007)

## Implementation Details

### Directory Structure
Tests go in: `tests/unit/prompting/` (mirroring source location)

### Test File Structure

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ModActionMetadataProvider } from '../../../src/prompting/modActionMetadataProvider.js';

describe('ModActionMetadataProvider', () => {
  let provider;
  let mockDataRegistry;
  let mockLogger;

  beforeEach(() => {
    mockDataRegistry = {
      get: jest.fn(),
    };
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    provider = new ModActionMetadataProvider({
      dataRegistry: mockDataRegistry,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should throw when dataRegistry is missing', () => {
      expect(() => new ModActionMetadataProvider({
        dataRegistry: null,
        logger: mockLogger,
      })).toThrow();
    });

    it('should throw when logger is missing', () => {
      expect(() => new ModActionMetadataProvider({
        dataRegistry: mockDataRegistry,
        logger: null,
      })).toThrow();
    });
  });

  describe('getMetadataForMod', () => {
    it('should return metadata when manifest exists with both properties', () => {
      const manifest = {
        id: 'positioning',
        actionPurpose: 'Change body position and spatial relationships.',
        actionConsiderWhen: 'Getting closer or farther from someone.',
      };
      mockDataRegistry.get.mockReturnValue(manifest);

      const result = provider.getMetadataForMod('positioning');

      expect(result).toEqual({
        modId: 'positioning',
        actionPurpose: manifest.actionPurpose,
        actionConsiderWhen: manifest.actionConsiderWhen,
      });
      expect(mockDataRegistry.get).toHaveBeenCalledWith('mod_manifests', 'positioning');
    });

    it('should return metadata with only actionPurpose', () => {
      const manifest = {
        id: 'items',
        actionPurpose: 'Interact with objects.',
      };
      mockDataRegistry.get.mockReturnValue(manifest);

      const result = provider.getMetadataForMod('items');

      expect(result).toEqual({
        modId: 'items',
        actionPurpose: manifest.actionPurpose,
        actionConsiderWhen: undefined,
      });
    });

    it('should return metadata with only actionConsiderWhen', () => {
      const manifest = {
        id: 'affection',
        actionConsiderWhen: 'Showing tenderness.',
      };
      mockDataRegistry.get.mockReturnValue(manifest);

      const result = provider.getMetadataForMod('affection');

      expect(result).toEqual({
        modId: 'affection',
        actionPurpose: undefined,
        actionConsiderWhen: manifest.actionConsiderWhen,
      });
    });

    it('should return null when manifest not found', () => {
      mockDataRegistry.get.mockReturnValue(undefined);

      const result = provider.getMetadataForMod('nonexistent');

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should handle null modId gracefully', () => {
      const result = provider.getMetadataForMod(null);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockDataRegistry.get).not.toHaveBeenCalled();
    });

    it('should handle empty string modId gracefully', () => {
      const result = provider.getMetadataForMod('');

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle number modId gracefully', () => {
      const result = provider.getMetadataForMod(123);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should normalize modId to lowercase for lookup', () => {
      const manifest = { id: 'positioning', actionPurpose: 'Test' };
      mockDataRegistry.get.mockReturnValue(manifest);

      provider.getMetadataForMod('POSITIONING');

      expect(mockDataRegistry.get).toHaveBeenCalledWith('mod_manifests', 'positioning');
    });

    it('should cache results correctly (same result on repeated calls)', () => {
      const manifest = { id: 'items', actionPurpose: 'Test' };
      mockDataRegistry.get.mockReturnValue(manifest);

      const result1 = provider.getMetadataForMod('items');
      const result2 = provider.getMetadataForMod('items');

      expect(result1).toBe(result2); // Same reference
      expect(mockDataRegistry.get).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should cache null results for missing manifests', () => {
      mockDataRegistry.get.mockReturnValue(undefined);

      provider.getMetadataForMod('missing');
      provider.getMetadataForMod('missing');

      expect(mockDataRegistry.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearCache', () => {
    it('should clear cached results', () => {
      const manifest = { id: 'positioning', actionPurpose: 'Test' };
      mockDataRegistry.get.mockReturnValue(manifest);

      provider.getMetadataForMod('positioning');
      provider.clearCache();
      provider.getMetadataForMod('positioning');

      expect(mockDataRegistry.get).toHaveBeenCalledTimes(2);
    });

    it('should log when cache is cleared', () => {
      provider.clearCache();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Cache cleared')
      );
    });
  });
});
```

## Acceptance Criteria

### Tests That Must Pass
- `npm run test:unit -- tests/unit/prompting/modActionMetadataProvider.test.js` passes ✅
- All 14 test cases pass ✅
- Coverage > 90% for the service file ✅ (100% achieved)

### Invariants That Must Remain True
1. Tests use `@jest/globals` imports consistently ✅
2. Tests follow AAA pattern (Arrange, Act, Assert) ✅
3. Mock objects created fresh in `beforeEach` ✅
4. Tests are independent and can run in any order ✅
5. Test file location mirrors source location ✅

## Verification Steps
1. Run `npm run test:unit -- tests/unit/prompting/modActionMetadataProvider.test.js --verbose` ✅
2. Run `npm run test:unit -- tests/unit/prompting/modActionMetadataProvider.test.js --coverage` ✅
3. Verify all test names are descriptive and follow "should..." convention ✅

---

## Outcome

### What was changed vs originally planned

**Originally Planned:**
- Create test file at `tests/unit/prompting/services/modActionMetadataProvider.test.js`
- Import from `../../../../src/prompting/services/modActionMetadataProvider.js`
- 15 test cases

**Actually Implemented:**
- Created test file at `tests/unit/prompting/modActionMetadataProvider.test.js` (corrected path - no `services/` subfolder since the source file is at `src/prompting/modActionMetadataProvider.js`)
- Import from `../../../src/prompting/modActionMetadataProvider.js`
- 14 test cases (original had a minor count error)

**Discrepancies Corrected in Ticket:**
1. File path updated to match actual source location (no `services/` folder)
2. Import path corrected accordingly
3. Test count corrected to 14 (actual)

**Results:**
- All 14 tests pass
- 100% code coverage on `src/prompting/modActionMetadataProvider.js`
- No ESLint errors
