# E2E Prompting Tests File Deletion Analysis

**Date**: 2025-01-18  
**Issue**: Production configuration files being deleted during test execution  
**Severity**: Critical  
**Status**: Analysis Complete, Fix Pending

## Executive Summary

The E2E prompting tests in `tests/e2e/prompting/` are inadvertently deleting production configuration files (`config/llm-configs.json` and `data/prompts/corePromptText.json`) during test execution. This occurs because the test bed copies test configuration files to production locations and then removes them during cleanup, effectively deleting the original production files.

## Root Cause Analysis

### Primary Issue Location
**File**: `/tests/e2e/prompting/common/promptGenerationTestBed.js`  
**Methods**: `initialize()` and `cleanup()`

### Problem Pattern
1. **Test Initialization** (Lines 89-102):
   ```javascript
   // Copy test files to expected locations
   console.log('Copying test config from', path.join(this.configDir, 'llm-configs.json'), 'to', path.join(expectedConfigDir, 'llm-configs.json'));
   await fs.copyFile(
     path.join(this.configDir, 'llm-configs.json'),
     path.join(expectedConfigDir, 'llm-configs.json')
   );
   await fs.copyFile(
     path.join(this.configDir, 'test_api_key.txt'),
     path.join(expectedConfigDir, 'test_api_key.txt')
   );
   await fs.copyFile(
     path.join(this.promptsDir, 'corePromptText.json'),
     path.join(expectedPromptsDir, 'corePromptText.json')
   );
   ```

2. **Test Cleanup** (Lines 161-164):
   ```javascript
   // Clean up copied files
   if (this.filesToCleanup) {
     for (const file of this.filesToCleanup) {
       await fs.rm(file, { force: true }).catch(() => {});
     }
   }
   ```

### Affected Files
- `config/llm-configs.json` - Production LLM configuration (482 lines)
- `data/prompts/corePromptText.json` - Production prompt templates (6 lines)

## Impact Assessment

### Current Production Files
**config/llm-configs.json**:
- Contains 4 production LLM configurations
- Includes OpenRouter API settings for Claude Sonnet 4, Qwen3, and Valkyrie models
- Critical for AI functionality in the application

**data/prompts/corePromptText.json**:
- Contains NC-21 content policy and character portrayal guidelines
- Includes task definitions and final instruction templates
- Essential for AI prompt generation pipeline

### What Happens During Test Execution
1. Tests start and create temporary test configuration files
2. Test files are copied over production files (overwriting them)
3. Tests run using the temporary test configuration
4. During cleanup, `fs.rm()` is called on the production file paths
5. **Production files are permanently deleted**

## Test Files Involved

### Test Suite Structure
```
tests/e2e/prompting/
├── PromptBuilderComponents.e2e.test.js
├── PromptComponentsIntegration.e2e.test.js
├── PromptGenerationPipeline.e2e.test.js
└── common/
    └── promptGenerationTestBed.js  ← PROBLEMATIC FILE
```

### Test Configuration Generated
The test bed creates minimal test configurations:
- Test LLM configs for 'test-llm-toolcalling' and 'test-llm-jsonschema'
- Simplified prompt templates for testing
- Mock API keys and endpoints

## Recommended Solutions

### Option 1: Backup and Restore (Recommended)
**Approach**: Backup production files before overwriting, restore after tests

**Implementation**:
```javascript
// In initialize() - before copying test files
async backupProductionFiles() {
  this.backupFiles = [];
  for (const prodFile of this.filesToCleanup) {
    if (await fs.access(prodFile).then(() => true).catch(() => false)) {
      const backupPath = prodFile + '.backup.' + Date.now();
      await fs.copyFile(prodFile, backupPath);
      this.backupFiles.push({ original: prodFile, backup: backupPath });
    }
  }
}

// In cleanup() - replace fs.rm() with restore
async restoreProductionFiles() {
  for (const { original, backup } of this.backupFiles) {
    await fs.copyFile(backup, original);
    await fs.rm(backup, { force: true });
  }
}
```

### Option 2: Environment Variable Override
**Approach**: Use environment variables to redirect config paths during tests

**Implementation**:
- Set `TEST_CONFIG_DIR` and `TEST_PROMPTS_DIR` environment variables
- Modify config loading services to check for test environment
- Keep production files untouched

### Option 3: Test-Specific Config Directory
**Approach**: Create entirely separate test configuration directories

**Implementation**:
- Modify container configuration to use test-specific paths
- Create isolated test environment without touching production
- Requires more changes to dependency injection setup

## Implementation Priority

### Immediate Action Required
- **Risk Level**: Critical
- **Urgency**: High
- **Effort**: Medium (Option 1: 2-3 hours, Option 2: 4-6 hours)

### Recommended Approach
**Option 1 (Backup and Restore)** is recommended because:
1. Minimal code changes required
2. Preserves existing test functionality
3. Provides immediate protection for production files
4. Maintains test isolation
5. Easy to implement and verify

## Code Locations to Modify

### Primary Changes
**File**: `/tests/e2e/prompting/common/promptGenerationTestBed.js`
- **Lines 89-102**: Add backup logic before file copying
- **Lines 161-164**: Replace `fs.rm()` with restore operations
- **Add methods**: `backupProductionFiles()`, `restoreProductionFiles()`

### Testing the Fix
After implementation:
1. Run the E2E prompting tests
2. Verify production files still exist and are unchanged
3. Confirm test functionality remains intact
4. Test cleanup occurs properly in both success and failure scenarios

## Conclusion

The production file deletion issue is a critical bug that can cause immediate application failures. The root cause is well-understood and located in the test bed's file management logic. Implementation of the backup and restore solution should be prioritized to prevent further production file loss.

The fix is straightforward and low-risk, involving the addition of backup/restore logic to the existing test cleanup process. This will ensure test isolation while preserving production configuration integrity.