/**
 * @file Unit tests for savePathUtils helpers
 */

import { describe, it, expect } from '@jest/globals';
import {
  BASE_SAVE_DIRECTORY,
  MANUAL_SAVES_SUBDIRECTORY,
  FULL_MANUAL_SAVE_DIRECTORY_PATH,
  MANUAL_SAVE_PATTERN,
  buildManualFileName,
  extractSaveName,
  manualSavePath,
  getManualSavePath,
} from '../../../src/utils/savePathUtils.js';

describe('savePathUtils', () => {
  describe('constants', () => {
    it('should expose expected directory constants', () => {
      expect(BASE_SAVE_DIRECTORY).toBe('saves');
      expect(MANUAL_SAVES_SUBDIRECTORY).toBe('manual_saves');
      expect(FULL_MANUAL_SAVE_DIRECTORY_PATH).toBe('saves/manual_saves');
    });

    it('should provide a regex that matches manual save files only', () => {
      expect(MANUAL_SAVE_PATTERN.test('manual_save_adventure_01.sav')).toBe(true);
      expect(MANUAL_SAVE_PATTERN.test('manual_save_test-file.sav')).toBe(true);
      expect(MANUAL_SAVE_PATTERN.test('MANUAL_SAVE_EPIC_FINAL.SAV')).toBe(true);
      expect(MANUAL_SAVE_PATTERN.test('auto_save_adventure_01.sav')).toBe(false);
      expect(MANUAL_SAVE_PATTERN.test('manual_save_incomplete.txt')).toBe(false);
    });
  });

  describe('buildManualFileName', () => {
    it('should sanitize disallowed characters while preserving allowed ones', () => {
      const fileName = buildManualFileName('The Final Quest: Part #1!');
      expect(fileName).toBe('manual_save_The_Final_Quest__Part__1_.sav');
      expect(fileName).toMatch(MANUAL_SAVE_PATTERN);
    });

    it('should leave safe characters untouched', () => {
      expect(buildManualFileName('alpha-123_Beta')).toBe(
        'manual_save_alpha-123_Beta.sav'
      );
    });
  });

  describe('extractSaveName', () => {
    it('should remove manual prefix and extension', () => {
      expect(extractSaveName('manual_save_alpha-123.sav')).toBe('alpha-123');
    });

    it('should return original name when prefix or suffix missing', () => {
      expect(extractSaveName('not_manual.sav')).toBe('not_manual');
      expect(extractSaveName('manual_save_custom')).toBe('custom');
    });

    it('should remove prefix and extension regardless of casing', () => {
      expect(extractSaveName('MANUAL_SAVE_Final_Mission.SAV')).toBe(
        'Final_Mission'
      );
    });
  });

  describe('manualSavePath', () => {
    it('should build full path for a provided filename', () => {
      expect(manualSavePath('manual_save_slot-1.sav')).toBe(
        'saves/manual_saves/manual_save_slot-1.sav'
      );
    });
  });

  describe('getManualSavePath', () => {
    it('should compose builder and path helpers to produce sanitized path', () => {
      const path = getManualSavePath('My Awesome Save!!');
      expect(path).toBe('saves/manual_saves/manual_save_My_Awesome_Save__.sav');
    });

    it('should be reversible with extractSaveName', () => {
      const original = 'Hero_01';
      const path = getManualSavePath(original);
      const extracted = extractSaveName(path.split('/').pop());
      expect(extracted).toBe('Hero_01');
    });
  });
});
