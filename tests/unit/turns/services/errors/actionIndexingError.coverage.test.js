import { ActionIndexingError } from '../../../../../src/turns/services/errors/actionIndexingError.js';

describe('ActionIndexingError coverage', () => {
  let originalCaptureStackTrace;

  beforeEach(() => {
    originalCaptureStackTrace = Error.captureStackTrace;
  });

  afterEach(() => {
    if (originalCaptureStackTrace) {
      Error.captureStackTrace = originalCaptureStackTrace;
    } else {
      delete Error.captureStackTrace;
    }
    jest.restoreAllMocks();
  });

  it('captures stack details when the runtime supports Error.captureStackTrace', () => {
    const captureSpy = jest.fn();
    Error.captureStackTrace = captureSpy;

    const error = new ActionIndexingError('failed to index', 'actor-42', 7);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ActionIndexingError');
    expect(error.message).toBe('failed to index');
    expect(error.actorId).toBe('actor-42');
    expect(error.index).toBe(7);
    expect(captureSpy).toHaveBeenCalledTimes(1);
    expect(captureSpy).toHaveBeenCalledWith(error, ActionIndexingError);
  });

  it('omits stack capture gracefully when Error.captureStackTrace is unavailable', () => {
    delete Error.captureStackTrace;

    const error = new ActionIndexingError('missing capture support', 'actor-7');

    expect(error.actorId).toBe('actor-7');
    expect(error.index).toBeNull();
    expect(error.name).toBe('ActionIndexingError');
  });
});
