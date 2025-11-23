/**
 * @file Integration test for tortoise_person recipe validation
 * Tests recipe structure, references, patterns, and constraints
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Tortoise Person Recipe Validation', () => {
  const recipe = JSON.parse(
    readFileSync(
      join(process.cwd(), 'data/mods/anatomy/recipes/tortoise_person.recipe.json'),
      'utf-8'
    )
  );

  describe('Recipe metadata', () => {
    it('should have correct schema reference', () => {
      expect(recipe.$schema).toBe('schema://living-narrative-engine/anatomy.recipe.schema.json');
    });

    it('should have correct recipe ID', () => {
      expect(recipe.recipeId).toBe('anatomy:tortoise_person');
    });

    it('should reference correct blueprint', () => {
      expect(recipe.blueprintId).toBe('anatomy:tortoise_person');
    });

    it('should verify blueprint exists and has correct structure', () => {
      const blueprint = JSON.parse(
        readFileSync(
          join(process.cwd(), 'data/mods/anatomy/blueprints/tortoise_person.blueprint.json'),
          'utf-8'
        )
      );

      expect(blueprint.id).toBe('anatomy:tortoise_person');
      expect(blueprint.schemaVersion).toBe('2.0');
      expect(blueprint.structureTemplate).toBe('anatomy:structure_tortoise_biped');
    });
  });

  describe('Body descriptors', () => {
    it('should have all 6 body descriptors defined', () => {
      expect(recipe.bodyDescriptors).toBeDefined();
      expect(Object.keys(recipe.bodyDescriptors).length).toBe(6);
    });

    it('should use valid enumerated value for height', () => {
      const validHeights = [
        'microscopic', 'minuscule', 'tiny', 'petite', 'short', 'average',
        'tall', 'very-tall', 'gigantic', 'colossal', 'titanic'
      ];
      expect(validHeights).toContain(recipe.bodyDescriptors.height);
      expect(recipe.bodyDescriptors.height).toBe('short');
    });

    it('should use valid enumerated value for build', () => {
      const validBuilds = [
        'skinny', 'slim', 'lissom', 'toned', 'athletic', 'shapely', 'hourglass',
        'thick', 'muscular', 'hulking', 'stocky', 'frail', 'gaunt', 'skeletal',
        'atrophied', 'cadaverous', 'massive', 'willowy', 'barrel-chested', 'lanky'
      ];
      expect(validBuilds).toContain(recipe.bodyDescriptors.build);
      expect(recipe.bodyDescriptors.build).toBe('stocky');
    });

    it('should use valid enumerated value for composition', () => {
      const validCompositions = [
        'underweight', 'lean', 'average', 'soft', 'chubby', 'overweight', 'obese',
        'atrophied', 'emaciated', 'skeletal', 'malnourished', 'dehydrated',
        'wasted', 'desiccated', 'bloated', 'rotting'
      ];
      expect(validCompositions).toContain(recipe.bodyDescriptors.composition);
      expect(recipe.bodyDescriptors.composition).toBe('average');
    });

    it('should use valid enumerated value for hairDensity', () => {
      const validHairDensities = [
        'hairless', 'sparse', 'light', 'moderate', 'hairy', 'very-hairy', 'furred'
      ];
      expect(validHairDensities).toContain(recipe.bodyDescriptors.hairDensity);
      expect(recipe.bodyDescriptors.hairDensity).toBe('hairless');
    });

    it('should use free-form string for skinColor', () => {
      expect(typeof recipe.bodyDescriptors.skinColor).toBe('string');
      expect(recipe.bodyDescriptors.skinColor).toBe('olive-green');
    });

    it('should use free-form string for smell', () => {
      expect(typeof recipe.bodyDescriptors.smell).toBe('string');
      expect(recipe.bodyDescriptors.smell).toBe('earthy');
    });
  });

  describe('Slot definitions', () => {
    it('should have 4 slot definitions', () => {
      expect(recipe.slots).toBeDefined();
      expect(Object.keys(recipe.slots).length).toBe(4);
    });

    it('should define shell_upper slot with correct properties', () => {
      const slot = recipe.slots.shell_upper;
      expect(slot).toBeDefined();
      expect(slot.partType).toBe('shell_carapace');
      expect(slot.preferId).toBe('anatomy:tortoise_carapace');
      expect(slot.properties).toBeDefined();
      expect(slot.properties['descriptors:texture']).toEqual({ texture: 'scaled' });
      expect(slot.properties['descriptors:pattern']).toEqual({ pattern: 'hexagonal-scutes' });
      expect(slot.properties['descriptors:color_extended']).toEqual({ color: 'bronze' });
    });

    it('should define shell_lower slot with correct properties', () => {
      const slot = recipe.slots.shell_lower;
      expect(slot).toBeDefined();
      expect(slot.partType).toBe('shell_plastron');
      expect(slot.preferId).toBe('anatomy:tortoise_plastron');
      expect(slot.properties).toBeDefined();
      expect(slot.properties['descriptors:texture']).toEqual({ texture: 'smooth' });
      expect(slot.properties['descriptors:color_extended']).toEqual({ color: 'cream' });
    });

    it('should define head slot', () => {
      const slot = recipe.slots.head;
      expect(slot).toBeDefined();
      expect(slot.partType).toBe('tortoise_head');
      expect(slot.preferId).toBe('anatomy:tortoise_head');
    });

    it('should define tail slot', () => {
      const slot = recipe.slots.tail;
      expect(slot).toBeDefined();
      expect(slot.partType).toBe('tortoise_tail');
      expect(slot.preferId).toBe('anatomy:tortoise_tail');
    });

    it('should verify all slot entity definitions exist', () => {
      const slotIds = [
        'anatomy:tortoise_carapace',
        'anatomy:tortoise_plastron',
        'anatomy:tortoise_head',
        'anatomy:tortoise_tail'
      ];

      slotIds.forEach(entityId => {
        const fileName = entityId.split(':')[1] + '.entity.json';
        const entityPath = join(
          process.cwd(),
          'data/mods/anatomy/entities/definitions',
          fileName
        );
        
        expect(() => {
          const entity = JSON.parse(readFileSync(entityPath, 'utf-8'));
          expect(entity.id).toBe(entityId);
        }).not.toThrow();
      });
    });
  });

  describe('Pattern definitions', () => {
    it('should have 5 patterns defined', () => {
      expect(recipe.patterns).toBeDefined();
      expect(recipe.patterns.length).toBe(5);
    });

    it('should have arm pattern using matchesGroup', () => {
      const armPattern = recipe.patterns.find(p => p.matchesGroup === 'limbSet:arm');
      expect(armPattern).toBeDefined();
      expect(armPattern.partType).toBe('tortoise_arm');
      expect(armPattern.preferId).toBe('anatomy:tortoise_arm');
      expect(armPattern.properties['descriptors:texture']).toEqual({ texture: 'scaled' });
    });

    it('should have leg pattern using matchesGroup', () => {
      const legPattern = recipe.patterns.find(p => p.matchesGroup === 'limbSet:leg');
      expect(legPattern).toBeDefined();
      expect(legPattern.partType).toBe('tortoise_leg');
      expect(legPattern.preferId).toBe('anatomy:tortoise_leg');
      expect(legPattern.properties['descriptors:texture']).toEqual({ texture: 'scaled' });
      expect(legPattern.properties['descriptors:build']).toEqual({ build: 'stocky' });
    });

    it('should have hand pattern using matches array', () => {
      const handPattern = recipe.patterns.find(p => 
        p.matches && p.matches.includes('left_hand') && p.matches.includes('right_hand')
      );
      expect(handPattern).toBeDefined();
      expect(handPattern.matches).toEqual(['left_hand', 'right_hand']);
      expect(handPattern.partType).toBe('tortoise_hand');
      expect(handPattern.preferId).toBe('anatomy:tortoise_hand');
      expect(handPattern.properties['descriptors:digit_count']).toEqual({ count: '3' });
      expect(handPattern.properties['descriptors:projection']).toEqual({ projection: 'clawed' });
    });

    it('should have foot pattern using matches array', () => {
      const footPattern = recipe.patterns.find(p => 
        p.matches && p.matches.includes('left_foot') && p.matches.includes('right_foot')
      );
      expect(footPattern).toBeDefined();
      expect(footPattern.matches).toEqual(['left_foot', 'right_foot']);
      expect(footPattern.partType).toBe('tortoise_foot');
      expect(footPattern.preferId).toBe('anatomy:tortoise_foot');
      expect(footPattern.properties['descriptors:digit_count']).toEqual({ count: '3' });
      expect(footPattern.properties['descriptors:projection']).toEqual({ projection: 'clawed' });
    });

    it('should have eye pattern using matches array', () => {
      const eyePattern = recipe.patterns.find(p => 
        p.matches && p.matches.includes('left_eye') && p.matches.includes('right_eye')
      );
      expect(eyePattern).toBeDefined();
      expect(eyePattern.matches).toEqual(['left_eye', 'right_eye']);
      expect(eyePattern.partType).toBe('tortoise_eye');
      expect(eyePattern.preferId).toBe('anatomy:tortoise_eye');
      expect(eyePattern.properties['descriptors:color_extended']).toEqual({ color: 'amber' });
    });

    it('should verify all pattern entity definitions exist', () => {
      const patternIds = [
        'anatomy:tortoise_arm',
        'anatomy:tortoise_leg',
        'anatomy:tortoise_hand',
        'anatomy:tortoise_foot',
        'anatomy:tortoise_eye'
      ];

      patternIds.forEach(entityId => {
        const fileName = entityId.split(':')[1] + '.entity.json';
        const entityPath = join(
          process.cwd(),
          'data/mods/anatomy/entities/definitions',
          fileName
        );
        
        expect(() => {
          const entity = JSON.parse(readFileSync(entityPath, 'utf-8'));
          expect(entity.id).toBe(entityId);
        }).not.toThrow();
      });
    });

    it('should verify matchesGroup references valid limbSets', () => {
      const structureTemplate = JSON.parse(
        readFileSync(
          join(process.cwd(), 'data/mods/anatomy/structure-templates/structure_tortoise_biped.structure-template.json'),
          'utf-8'
        )
      );

      const limbSetTypes = structureTemplate.topology.limbSets.map(ls => ls.type);
      
      const armPattern = recipe.patterns.find(p => p.matchesGroup === 'limbSet:arm');
      const legPattern = recipe.patterns.find(p => p.matchesGroup === 'limbSet:leg');

      expect(limbSetTypes).toContain('arm');
      expect(limbSetTypes).toContain('leg');
      expect(armPattern).toBeDefined();
      expect(legPattern).toBeDefined();
    });
  });

  describe('Constraints', () => {
    it('should have constraints defined', () => {
      expect(recipe.constraints).toBeDefined();
      expect(recipe.constraints.requires).toBeDefined();
    });

    it('should have 3 co-presence requirements', () => {
      expect(recipe.constraints.requires.length).toBe(3);
    });

    it('should require shell parts co-presence', () => {
      const shellConstraint = recipe.constraints.requires.find(c => 
        c.partTypes && 
        c.partTypes.includes('shell_carapace') && 
        c.partTypes.includes('shell_plastron')
      );
      expect(shellConstraint).toBeDefined();
      expect(shellConstraint.partTypes).toEqual(['shell_carapace', 'shell_plastron']);
    });

    it('should require tortoise_beak', () => {
      const beakConstraint = recipe.constraints.requires.find(c => 
        c.partTypes && c.partTypes.includes('tortoise_beak')
      );
      expect(beakConstraint).toBeDefined();
      expect(beakConstraint.partTypes).toEqual(['tortoise_beak']);
    });

    it('should require tortoise_eye', () => {
      const eyeConstraint = recipe.constraints.requires.find(c => 
        c.partTypes && c.partTypes.includes('tortoise_eye')
      );
      expect(eyeConstraint).toBeDefined();
      expect(eyeConstraint.partTypes).toEqual(['tortoise_eye']);
    });

    it('should verify all constraint partTypes match entity subTypes', () => {
      const allPartTypes = [
        ...recipe.constraints.requires.flatMap(c => c.partTypes || [])
      ];

      const entityFiles = [
        'tortoise_carapace.entity.json',
        'tortoise_plastron.entity.json',
        'tortoise_beak.entity.json',
        'tortoise_eye.entity.json'
      ];

      entityFiles.forEach(fileName => {
        const entityPath = join(
          process.cwd(),
          'data/mods/anatomy/entities/definitions',
          fileName
        );
        const entity = JSON.parse(readFileSync(entityPath, 'utf-8'));
        const subType = entity.components['anatomy:part'].subType;
        
        expect(allPartTypes).toContain(subType);
      });
    });
  });

  describe('Property format validation', () => {
    it('should use namespaced component IDs in all property overrides', () => {
      const allProperties = [
        ...Object.values(recipe.slots).filter(s => s.properties).map(s => s.properties),
        ...recipe.patterns.filter(p => p.properties).map(p => p.properties)
      ];

      allProperties.forEach(propObj => {
        const keys = Object.keys(propObj);
        keys.forEach(key => {
          // All property keys should be namespaced (contain ':')
          expect(key).toMatch(/^[a-z]+:[a-z_]+$/);
        });
      });
    });

    it('should verify pattern properties match component schemas', () => {
      // Sample check: texture property should be an object with 'texture' field
      const armPattern = recipe.patterns.find(p => p.matchesGroup === 'limbSet:arm');
      expect(armPattern.properties['descriptors:texture']).toBeDefined();
      expect(armPattern.properties['descriptors:texture']).toHaveProperty('texture');
      expect(typeof armPattern.properties['descriptors:texture'].texture).toBe('string');
    });
  });

  describe('Socket compatibility', () => {
    it('should verify head has beak_mount socket for tortoise_beak', () => {
      const headEntity = JSON.parse(
        readFileSync(
          join(process.cwd(), 'data/mods/anatomy/entities/definitions/tortoise_head.entity.json'),
          'utf-8'
        )
      );

      const beakSocket = headEntity.components['anatomy:sockets'].sockets.find(
        s => s.id === 'beak_mount'
      );

      expect(beakSocket).toBeDefined();
      expect(beakSocket.allowedTypes).toContain('tortoise_beak');
    });

    it('should verify head has eye sockets for tortoise_eye', () => {
      const headEntity = JSON.parse(
        readFileSync(
          join(process.cwd(), 'data/mods/anatomy/entities/definitions/tortoise_head.entity.json'),
          'utf-8'
        )
      );

      const leftEyeSocket = headEntity.components['anatomy:sockets'].sockets.find(
        s => s.id === 'left_eye'
      );
      const rightEyeSocket = headEntity.components['anatomy:sockets'].sockets.find(
        s => s.id === 'right_eye'
      );

      expect(leftEyeSocket).toBeDefined();
      expect(rightEyeSocket).toBeDefined();
      expect(leftEyeSocket.allowedTypes).toContain('tortoise_eye');
      expect(rightEyeSocket.allowedTypes).toContain('tortoise_eye');
    });

    it('should verify arm has hand socket for tortoise_hand', () => {
      const armEntity = JSON.parse(
        readFileSync(
          join(process.cwd(), 'data/mods/anatomy/entities/definitions/tortoise_arm.entity.json'),
          'utf-8'
        )
      );

      const handSocket = armEntity.components['anatomy:sockets'].sockets.find(
        s => s.id === 'hand'
      );

      expect(handSocket).toBeDefined();
      expect(handSocket.allowedTypes).toContain('tortoise_hand');
    });

    it('should verify leg has foot socket for tortoise_foot', () => {
      const legEntity = JSON.parse(
        readFileSync(
          join(process.cwd(), 'data/mods/anatomy/entities/definitions/tortoise_leg.entity.json'),
          'utf-8'
        )
      );

      const footSocket = legEntity.components['anatomy:sockets'].sockets.find(
        s => s.id === 'foot'
      );

      expect(footSocket).toBeDefined();
      expect(footSocket.allowedTypes).toContain('tortoise_foot');
    });
  });

  describe('Blueprint integration', () => {
    it('should verify blueprint defines additionalSlots for shell parts', () => {
      const blueprint = JSON.parse(
        readFileSync(
          join(process.cwd(), 'data/mods/anatomy/blueprints/tortoise_person.blueprint.json'),
          'utf-8'
        )
      );

      expect(blueprint.additionalSlots).toBeDefined();
      expect(blueprint.additionalSlots.shell_upper).toBeDefined();
      expect(blueprint.additionalSlots.shell_lower).toBeDefined();

      expect(blueprint.additionalSlots.shell_upper.socket).toBe('carapace_mount');
      expect(blueprint.additionalSlots.shell_lower.socket).toBe('plastron_mount');

      expect(blueprint.additionalSlots.shell_upper.requirements.partType).toBe('shell_carapace');
      expect(blueprint.additionalSlots.shell_lower.requirements.partType).toBe('shell_plastron');
    });

    it('should verify blueprint schemaVersion supports matchesGroup', () => {
      const blueprint = JSON.parse(
        readFileSync(
          join(process.cwd(), 'data/mods/anatomy/blueprints/tortoise_person.blueprint.json'),
          'utf-8'
        )
      );

      expect(blueprint.schemaVersion).toBe('2.0');
      expect(blueprint.structureTemplate).toBe('anatomy:structure_tortoise_biped');
    });
  });
});
