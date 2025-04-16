// src/components/skillComponent.js

import Component from "./component.js";

export class SkillComponent extends Component {
    /** @param {{skills: Record<string, number>}} data */
    constructor(data) {
        super();
        if (!data || typeof data.skills !== 'object' || data.skills === null) {
            throw new Error("SkillComponent requires 'skills' object in data.");
        }
        // Ensure all skill values are non-negative integers
        this.skills = {};
        for (const skillId in data.skills) {
            const value = data.skills[skillId];
            if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
                this.skills[skillId] = value;
            } else {
                console.warn(`SkillComponent: Invalid value for skill '${skillId}' (${value}). Skipping.`);
            }
        }
    }
    // TODO: Add methods like getSkill(skillId), setSkill(skillId, value)
}
