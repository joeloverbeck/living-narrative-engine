/**
 * @file Integration tests for lung slot generation in humanoid anatomy
 * @see tickets/OXYDROSYS-007.md
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { AnatomyGenerationService } from '../../../src/anatomy/anatomyGenerationService.js';
import { ANATOMY_BODY_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('Lung Slot Integration - OXYDROSYS-007', () => {
  /** @type {AnatomyIntegrationTestBed} */
  let testBed;
  /** @type {AnatomyGenerationService} */
  let anatomyService;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.loadAnatomyModData();
    anatomyService = new AnatomyGenerationService({
      entityManager: testBed.entityManager,
      dataRegistry: testBed.registry,
      logger: testBed.logger,
      bodyBlueprintFactory: testBed.bodyBlueprintFactory,
      anatomyDescriptionService: testBed.anatomyDescriptionService,
      bodyGraphService: testBed.bodyGraphService,
    });
  });

  /**
   * Creates actor and generates anatomy
   * @param {string} recipeId
   * @returns {Promise<{id: string, bodyComponent: object}>}
   */
  async function createActorWithAnatomy(recipeId) {
    const actor = await testBed.createActor({ recipeId });
    await anatomyService.generateAnatomyIfNeeded(actor.id);
    const bodyComponent = testBed.entityManager.getComponentData(
      actor.id,
      ANATOMY_BODY_COMPONENT_ID
    );
    return { id: actor.id, bodyComponent };
  }

  /**
   * Gets lung parts from body component
   * @param {object} bodyComponent
   * @returns {{left: string|undefined, right: string|undefined}}
   */
  function getLungPartIds(bodyComponent) {
    const parts = bodyComponent.body.parts;
    let leftLungId, rightLungId;

    for (const [slotName, partId] of Object.entries(parts)) {
      const partEntity = testBed.entityManager.getEntityInstance(partId);
      if (!partEntity) continue;

      const partComponent = partEntity.getComponentData('anatomy:part');
      if (partComponent && partComponent.subType === 'lung') {
        if (partComponent.orientation === 'left' || slotName === 'left_lung') {
          leftLungId = partId;
        } else if (
          partComponent.orientation === 'right' ||
          slotName === 'right_lung'
        ) {
          rightLungId = partId;
        }
      }
    }

    return { left: leftLungId, right: rightLungId };
  }

  describe('Human Male Anatomy', () => {
    it('should generate anatomy with left lung', async () => {
      const { bodyComponent } = await createActorWithAnatomy(
        'anatomy:human_male'
      );

      expect(bodyComponent.body).toBeDefined();
      expect(bodyComponent.body.parts).toBeDefined();

      const lungIds = getLungPartIds(bodyComponent);
      expect(lungIds.left).toBeDefined();
    });

    it('should generate anatomy with right lung', async () => {
      const { bodyComponent } = await createActorWithAnatomy(
        'anatomy:human_male'
      );

      const lungIds = getLungPartIds(bodyComponent);
      expect(lungIds.right).toBeDefined();
    });

    it('should have lungs with correct anatomy:part subType', async () => {
      const { bodyComponent } = await createActorWithAnatomy(
        'anatomy:human_male'
      );

      const lungIds = getLungPartIds(bodyComponent);

      // Verify left lung has correct subType
      const leftLungEntity = testBed.entityManager.getEntityInstance(
        lungIds.left
      );
      const leftPartComponent = leftLungEntity.getComponentData('anatomy:part');
      expect(leftPartComponent.subType).toBe('lung');
      expect(leftPartComponent.orientation).toBe('left');

      // Verify right lung has correct subType
      const rightLungEntity = testBed.entityManager.getEntityInstance(
        lungIds.right
      );
      const rightPartComponent =
        rightLungEntity.getComponentData('anatomy:part');
      expect(rightPartComponent.subType).toBe('lung');
      expect(rightPartComponent.orientation).toBe('right');
    });
  });

  describe('Human Female Anatomy', () => {
    it('should generate anatomy with both lungs', async () => {
      const { bodyComponent } = await createActorWithAnatomy(
        'anatomy:human_female'
      );

      expect(bodyComponent.body).toBeDefined();
      expect(bodyComponent.body.parts).toBeDefined();

      const lungIds = getLungPartIds(bodyComponent);
      expect(lungIds.left).toBeDefined();
      expect(lungIds.right).toBeDefined();
    });
  });

  describe('Human Futa Anatomy', () => {
    it('should generate anatomy with both lungs', async () => {
      const { bodyComponent } = await createActorWithAnatomy(
        'anatomy:human_futa'
      );

      expect(bodyComponent.body).toBeDefined();
      expect(bodyComponent.body.parts).toBeDefined();

      const lungIds = getLungPartIds(bodyComponent);
      expect(lungIds.left).toBeDefined();
      expect(lungIds.right).toBeDefined();
    });
  });

  describe('Lung Entity Components', () => {
    it('should have respiratory organ component on lungs', async () => {
      const { bodyComponent } = await createActorWithAnatomy(
        'anatomy:human_male'
      );

      const lungIds = getLungPartIds(bodyComponent);

      // Verify left lung has respiratory organ component
      const leftLungEntity = testBed.entityManager.getEntityInstance(
        lungIds.left
      );
      const leftRespiratoryComponent = leftLungEntity.getComponentData(
        'breathing-states:respiratory_organ'
      );
      expect(leftRespiratoryComponent).toBeDefined();
      expect(leftRespiratoryComponent.respirationType).toBe('pulmonary');

      // Verify right lung has respiratory organ component
      const rightLungEntity = testBed.entityManager.getEntityInstance(
        lungIds.right
      );
      const rightRespiratoryComponent = rightLungEntity.getComponentData(
        'breathing-states:respiratory_organ'
      );
      expect(rightRespiratoryComponent).toBeDefined();
      expect(rightRespiratoryComponent.respirationType).toBe('pulmonary');
    });
  });

  describe('Invariants', () => {
    it('should have lung parts in all human anatomies', async () => {
      const { bodyComponent: maleBody } = await createActorWithAnatomy(
        'anatomy:human_male'
      );
      const { bodyComponent: femaleBody } = await createActorWithAnatomy(
        'anatomy:human_female'
      );
      const { bodyComponent: futaBody } = await createActorWithAnatomy(
        'anatomy:human_futa'
      );

      // All three should have lung parts
      const maleLungs = getLungPartIds(maleBody);
      const femaleLungs = getLungPartIds(femaleBody);
      const futaLungs = getLungPartIds(futaBody);

      // All should have both lungs
      expect(maleLungs.left).toBeDefined();
      expect(maleLungs.right).toBeDefined();
      expect(femaleLungs.left).toBeDefined();
      expect(femaleLungs.right).toBeDefined();
      expect(futaLungs.left).toBeDefined();
      expect(futaLungs.right).toBeDefined();
    });
  });
});
