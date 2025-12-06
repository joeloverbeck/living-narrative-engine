/**
 * @file Tests fallback flows when the enhanced error handler fails to initialize.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

let ClichesGeneratorControllerTestBed;

describe('ClichesGeneratorController without error handler', () => {
  beforeAll(async () => {
    jest.unstable_mockModule(
      '../../../../src/characterBuilder/services/clicheErrorHandler.js',
      () => ({
        ClicheErrorHandler: class {
          constructor() {
            throw new Error('Intentional initialization failure');
          }
        },
      })
    );

    ({ ClichesGeneratorControllerTestBed } = await import(
      '../../../common/clichesGeneratorControllerTestBed.js'
    ));
  });

  let testBed;

  beforeEach(async () => {
    testBed = new ClichesGeneratorControllerTestBed();
    testBed.setupSuccessfulDirectionLoad();
    await testBed.setup();
  });

  afterEach(async () => {
    await testBed?.cleanup();
  });

  afterAll(() => {
    jest.resetModules();
  });

  it('falls back to basic messaging and clears the selection for not found errors', async () => {
    const loadSpy = jest
      .spyOn(testBed.controller, '_showLoading')
      .mockImplementation(() => {
        throw new Error('Direction not found during load');
      });

    await testBed.controller._testDirectionSelection('dir-1');
    await testBed.waitForAsyncOperations();

    const messages = testBed.getStatusMessages().textContent;
    expect(messages).toContain(
      'An unexpected error occurred. Please refresh the page and try again.'
    );
    expect(
      testBed.controller._testGetCurrentState().selectedDirectionId
    ).toBeNull();

    loadSpy.mockRestore();
  });

  it('preserves selection and shows fallback warnings when recoverable errors occur', async () => {
    const loadSpy = jest
      .spyOn(testBed.controller, '_showLoading')
      .mockImplementation(() => {
        throw new Error('Temporary service disruption');
      });

    await testBed.controller._testDirectionSelection('dir-1');
    await testBed.waitForAsyncOperations();

    const messages = testBed.getStatusMessages().textContent;
    expect(messages).toContain(
      'An unexpected error occurred. Please refresh the page and try again.'
    );
    expect(messages).toContain(
      'Could not load existing clichés. You can generate new ones.'
    );

    loadSpy.mockRestore();
  });
});
