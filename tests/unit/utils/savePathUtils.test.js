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
      expect(MANUAL_SAVE_PATTERN.test('manual_save_adventure_01.sav')).toBe(
        true
      );
      expect(MANUAL_SAVE_PATTERN.test('manual_save_test-file.sav')).toBe(true);
      expect(MANUAL_SAVE_PATTERN.test('MANUAL_SAVE_EPIC_FINAL.SAV')).toBe(true);
      expect(MANUAL_SAVE_PATTERN.test('auto_save_adventure_01.sav')).toBe(
        false
      );
      expect(MANUAL_SAVE_PATTERN.test('manual_save_incomplete.txt')).toBe(
        false
      );
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

    it('should coerce non-string values without throwing', () => {
      expect(buildManualFileName(null)).toBe('manual_save_.sav');
      expect(buildManualFileName(42)).toBe('manual_save_42.sav');
      expect(buildManualFileName({ toString: () => 'custom' })).toBe(
        'manual_save_custom.sav'
      );
    });

    it('should trim leading and trailing whitespace before sanitizing', () => {
      expect(buildManualFileName('  Hero  ')).toBe('manual_save_Hero.sav');
      expect(buildManualFileName('\tChapter One\n')).toBe(
        'manual_save_Chapter_One.sav'
      );
    });

    it('should preserve unicode letters and symbols for readability', () => {
      expect(buildManualFileName('英雄の冒険 2024')).toBe(
        'manual_save_英雄の冒険_2024.sav'
      );
      expect(buildManualFileName('Star ⭐ Keeper')).toBe(
        'manual_save_Star_⭐_Keeper.sav'
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

    it('should strip directory segments from provided paths', () => {
      expect(
        extractSaveName('saves/manual_saves/manual_save_Adventure.sav')
      ).toBe('Adventure');
      expect(extractSaveName('C:/Games/Saves/manual_save_Epic_Final.sav')).toBe(
        'Epic_Final'
      );
      expect(
        extractSaveName('C:\\games\\manual_saves\\manual_save_Quest.sav')
      ).toBe('Quest');
    });

    it('should handle trailing separators and whitespace gracefully', () => {
      expect(extractSaveName('  manual_saves/manual_save_Name.sav  ')).toBe(
        'Name'
      );
      expect(extractSaveName('saves/manual_saves/')).toBe('');
      expect(extractSaveName('')).toBe('');
    });

    it('should return empty string when input contains only separators', () => {
      expect(extractSaveName('////')).toBe('');
      expect(extractSaveName('\\\\')).toBe('');
    });

    it('should skip blank segments and empty candidates while scanning', () => {
      expect(extractSaveName('manual_saves/   /manual_save_.sav')).toBe('');
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
