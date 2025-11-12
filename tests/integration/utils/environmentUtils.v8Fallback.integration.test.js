const ENVIRONMENT_UTILS_PATH = '../../../src/utils/environmentUtils.js';
const originalNodeVersion = process.versions?.node;

describe('environmentUtils V8 fallback integration behavior', () => {
  afterEach(() => {
    jest.resetModules();
    if (originalNodeVersion !== undefined) {
      Object.defineProperty(process.versions, 'node', {
        configurable: true,
        value: originalNodeVersion,
      });
    }
  });

  it('falls back to heap totals when the V8 module cannot be loaded', async () => {
    jest.resetModules();
    jest.doMock('v8', () => {
      throw new Error('v8 module unavailable for test');
    });

    const envUtils = await import(ENVIRONMENT_UTILS_PATH);

    const detectSpy = jest
      .spyOn(envUtils, 'detectEnvironment')
      .mockReturnValue('node');
    const nodeEnvSpy = jest
      .spyOn(envUtils, 'isNodeEnvironment')
      .mockReturnValue(true);
    const memoryUsageSpy = jest
      .spyOn(process, 'memoryUsage')
      .mockImplementation(() => ({
        heapUsed: 48,
        heapTotal: 96,
        external: 8,
      }));

    const usage = envUtils.getMemoryUsage();
    expect(usage.heapUsed).toBe(48);
    expect(usage.heapTotal).toBe(96);
    expect(usage.heapLimit).toBe(96);
    expect(usage.external).toBe(8);

    detectSpy.mockRestore();
    nodeEnvSpy.mockRestore();
    memoryUsageSpy.mockRestore();
  });
});
