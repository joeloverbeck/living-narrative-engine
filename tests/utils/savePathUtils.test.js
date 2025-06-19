import { describe, it, expect } from '@jest/globals';
import {
  buildManualFileName,
  manualSavePath,
  getManualSavePath,
} from '../../src/utils/savePathUtils.js';

describe('getManualSavePath', () => {
  it('combines file name generation and path correctly', () => {
    const name = 'My Save';
    const fileName = buildManualFileName(name);
    const expected = manualSavePath(fileName);
    expect(getManualSavePath(name)).toBe(expected);
  });

  it('sanitizes save name before building path', () => {
    const name = 'Bad*Name';
    const expectedFileName = buildManualFileName(name);
    expect(expectedFileName).toBe('manual_save_Bad_Name.sav');
    expect(getManualSavePath(name)).toBe(manualSavePath(expectedFileName));
  });
});
