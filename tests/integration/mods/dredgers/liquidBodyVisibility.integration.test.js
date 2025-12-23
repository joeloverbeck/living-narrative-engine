/**
 * @file Integration tests for dredgers liquid body visibility property
 * @description Verifies that all dredgers liquid body entities have the required
 * visibility property set correctly after RISTOSURACT-002 migration.
 */

import { describe, it, expect } from '@jest/globals';
import floodedApproachLiquidBody from '../../../../data/mods/dredgers/entities/definitions/flooded_approach_liquid_body.entity.json';
import canalRunSegmentALiquidBody from '../../../../data/mods/dredgers/entities/definitions/canal_run_segment_a_liquid_body.entity.json';
import canalRunSegmentBLiquidBody from '../../../../data/mods/dredgers/entities/definitions/canal_run_segment_b_liquid_body.entity.json';
import canalRunSegmentCLiquidBody from '../../../../data/mods/dredgers/entities/definitions/canal_run_segment_c_liquid_body.entity.json';

describe('dredgers liquid body visibility (RISTOSURACT-002)', () => {
  const VALID_VISIBILITY_VALUES = ['pristine', 'clear', 'murky', 'opaque'];

  describe('all liquid body definitions have visibility property', () => {
    it('flooded_approach_liquid_body has visibility set to opaque', () => {
      const component =
        floodedApproachLiquidBody.components['liquids:liquid_body'];
      expect(component).toBeDefined();
      expect(component.visibility).toBe('opaque');
      expect(VALID_VISIBILITY_VALUES).toContain(component.visibility);
    });

    it('canal_run_segment_a_liquid_body has visibility set to opaque', () => {
      const component =
        canalRunSegmentALiquidBody.components['liquids:liquid_body'];
      expect(component).toBeDefined();
      expect(component.visibility).toBe('opaque');
      expect(VALID_VISIBILITY_VALUES).toContain(component.visibility);
    });

    it('canal_run_segment_b_liquid_body has visibility set to opaque', () => {
      const component =
        canalRunSegmentBLiquidBody.components['liquids:liquid_body'];
      expect(component).toBeDefined();
      expect(component.visibility).toBe('opaque');
      expect(VALID_VISIBILITY_VALUES).toContain(component.visibility);
    });

    it('canal_run_segment_c_liquid_body has visibility set to opaque', () => {
      const component =
        canalRunSegmentCLiquidBody.components['liquids:liquid_body'];
      expect(component).toBeDefined();
      expect(component.visibility).toBe('opaque');
      expect(VALID_VISIBILITY_VALUES).toContain(component.visibility);
    });
  });

  describe('connected_liquid_body_ids preserved after visibility addition', () => {
    it('flooded_approach has correct connection to segment_c', () => {
      const component =
        floodedApproachLiquidBody.components['liquids:liquid_body'];
      expect(component.connected_liquid_body_ids).toEqual([
        'dredgers:canal_run_segment_c_liquid_body_instance',
      ]);
    });

    it('segment_a has correct connection to segment_b', () => {
      const component =
        canalRunSegmentALiquidBody.components['liquids:liquid_body'];
      expect(component.connected_liquid_body_ids).toEqual([
        'dredgers:canal_run_segment_b_liquid_body_instance',
      ]);
    });

    it('segment_b has correct bidirectional connections', () => {
      const component =
        canalRunSegmentBLiquidBody.components['liquids:liquid_body'];
      expect(component.connected_liquid_body_ids).toEqual([
        'dredgers:canal_run_segment_c_liquid_body_instance',
        'dredgers:canal_run_segment_a_liquid_body_instance',
      ]);
    });

    it('segment_c has correct bidirectional connections', () => {
      const component =
        canalRunSegmentCLiquidBody.components['liquids:liquid_body'];
      expect(component.connected_liquid_body_ids).toEqual([
        'dredgers:flooded_approach_liquid_body_instance',
        'dredgers:canal_run_segment_b_liquid_body_instance',
      ]);
    });
  });

  describe('entity metadata unchanged', () => {
    it('all entities retain their original IDs', () => {
      expect(floodedApproachLiquidBody.id).toBe(
        'dredgers:flooded_approach_liquid_body'
      );
      expect(canalRunSegmentALiquidBody.id).toBe(
        'dredgers:canal_run_segment_a_liquid_body'
      );
      expect(canalRunSegmentBLiquidBody.id).toBe(
        'dredgers:canal_run_segment_b_liquid_body'
      );
      expect(canalRunSegmentCLiquidBody.id).toBe(
        'dredgers:canal_run_segment_c_liquid_body'
      );
    });

    it('all entities retain core:name component', () => {
      expect(floodedApproachLiquidBody.components['core:name'].text).toBe(
        'flooded approach water'
      );
      expect(canalRunSegmentALiquidBody.components['core:name'].text).toBe(
        'canal run (segment A)'
      );
      expect(canalRunSegmentBLiquidBody.components['core:name'].text).toBe(
        'canal run (segment B)'
      );
      expect(canalRunSegmentCLiquidBody.components['core:name'].text).toBe(
        'canal run (segment C)'
      );
    });

    it('all entities retain core:description component', () => {
      expect(
        floodedApproachLiquidBody.components['core:description'].text
      ).toContain('flooded approach');
      expect(
        canalRunSegmentALiquidBody.components['core:description'].text
      ).toContain('segment A');
      expect(
        canalRunSegmentBLiquidBody.components['core:description'].text
      ).toContain('segment B');
      expect(
        canalRunSegmentCLiquidBody.components['core:description'].text
      ).toContain('segment C');
    });
  });
});
