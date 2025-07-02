import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { reportMissingActorId } from '../../../../../src/utils/errorReportingUtils.js';
import { safeDispatchError } from '../../../../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../../../../src/utils/safeDispatchErrorUtils.js');

describe('errorReportingUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('reportMissingActorId dispatches and logs warning', () => {
    const dispatcher = { dispatch: jest.fn() };
    const logger = { warn: jest.fn() };

    reportMissingActorId(dispatcher, logger, undefined, 'fb');

    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      expect.any(String),
      { providedActorId: null, fallbackActorId: 'fb' },
      logger
    );
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('fb'));
  });
});
