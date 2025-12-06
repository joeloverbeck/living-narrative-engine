import { ModAccessError } from '../../../src/errors/modAccessError.js';

describe('ModAccessError', () => {
  const filePath = '/mods/example/mod.json';

  it('classifies file not found errors as recoverable and reports suggested fixes', () => {
    const error = new ModAccessError('ENOENT: file not found', filePath, {
      retryCount: 0,
      hasDefault: true,
      accessType: 'FILE_NOT_FOUND',
    });

    expect(error.name).toBe('ModAccessError');
    expect(error.filePath).toBe(filePath);
    expect(error.isRecoverable()).toBe(true);
    expect(error.context.accessType).toBe('FILE_NOT_FOUND');
    expect(error.context.canRetry).toBe(false);
    expect(error.context.alternativeActions).toEqual([
      'skip_file',
      'use_default',
      'use_default_value',
    ]);

    const report = error.generateAccessReport();
    expect(report).toEqual(
      expect.objectContaining({
        filePath,
        accessType: 'FILE_NOT_FOUND',
        recoverable: true,
        canRetry: false,
        alternativeActions: ['skip_file', 'use_default', 'use_default_value'],
        suggestedFixes: [
          'Verify file path is correct',
          'Check if file was deleted or moved',
          'Ensure mod is properly installed',
        ],
      })
    );
  });

  it('marks permission denied errors as non recoverable and offers permission fixes', () => {
    const error = new ModAccessError('EACCES: permission denied', filePath, {
      retryCount: 0,
      accessType: 'PERMISSION_DENIED',
    });

    expect(error.isRecoverable()).toBe(false);
    expect(error.context.accessType).toBe('PERMISSION_DENIED');
    expect(error.context.alternativeActions).toEqual([
      'request_permission',
      'skip_file',
    ]);
    expect(error._getSuggestedFixes()).toEqual([
      'Check file permissions',
      'Run with appropriate privileges',
      'Verify file ownership',
    ]);
  });

  it('allows retry for locked files until retry limit is reached', () => {
    const retryableError = new ModAccessError(
      'EBUSY: resource busy',
      filePath,
      {
        retryCount: 1,
        accessType: 'FILE_LOCKED',
      }
    );

    expect(retryableError.context.accessType).toBe('FILE_LOCKED');
    expect(retryableError.context.canRetry).toBe(true);
    expect(retryableError.context.alternativeActions).toEqual([
      'retry_with_delay',
      'skip_file',
    ]);
    expect(retryableError._getSuggestedFixes()).toEqual([
      'Close other programs using the file',
      'Wait and retry',
    ]);

    const exhaustedRetries = new ModAccessError(
      'EBUSY: resource busy',
      filePath,
      {
        retryCount: 3,
        accessType: 'FILE_LOCKED',
      }
    );

    expect(exhaustedRetries.context.canRetry).toBe(false);
  });

  it('suggests resource cleanup when too many open files are detected', () => {
    const error = new ModAccessError('EMFILE: too many open files', filePath, {
      retryCount: 0,
      accessType: 'TOO_MANY_OPEN_FILES',
    });

    expect(error.context.accessType).toBe('TOO_MANY_OPEN_FILES');
    expect(error.context.alternativeActions).toEqual([
      'close_unused_handles',
      'retry_with_delay',
    ]);
    expect(error._getSuggestedFixes()).toEqual([
      'Increase file descriptor limit',
      'Close unused file handles',
      'Process files in smaller batches',
    ]);
  });

  it('treats timeout errors as recoverable and retryable', () => {
    const error = new ModAccessError('ETIMEDOUT: network timeout', filePath, {
      retryCount: 1,
      accessType: 'TIMEOUT',
    });

    expect(error.isRecoverable()).toBe(true);
    expect(error.context.accessType).toBe('TIMEOUT');
    expect(error.context.canRetry).toBe(true);
    expect(error.context.alternativeActions).toEqual([
      'skip_file',
      'log_and_continue',
    ]);
  });

  it('falls back to context-provided type and recoverability for unknown errors', () => {
    const error = new ModAccessError('Unexpected failure occurred', filePath, {
      accessType: 'CUSTOM_ACCESS_TYPE',
      recoverable: false,
      hasDefault: true,
      retryCount: 0,
    });

    expect(error.getSeverity()).toBe('error');
    expect(error.isRecoverable()).toBe(false);
    expect(error.context.accessType).toBe('CUSTOM_ACCESS_TYPE');
    expect(error.context.alternativeActions).toEqual([
      'skip_file',
      'log_and_continue',
      'use_default_value',
    ]);
  });

  it('identifies directory errors and avoids retry after limit', () => {
    const firstAttempt = new ModAccessError(
      'EISDIR: is a directory',
      filePath,
      {
        retryCount: 2,
        accessType: 'IS_DIRECTORY',
      }
    );

    expect(firstAttempt.context.accessType).toBe('IS_DIRECTORY');
    expect(firstAttempt.context.canRetry).toBe(false);
    expect(firstAttempt.context.alternativeActions).toEqual([
      'skip_file',
      'log_and_continue',
    ]);
  });
});
