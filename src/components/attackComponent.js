// src/components/attackComponent.js

import Component from "./component.js";

export class AttackComponent extends Component {
    /** @param {{damage: number}} data */
    constructor(data) {
        super();
        if (!data || typeof data.damage !== 'number' || data.damage < 0) {
            throw new Error("AttackComponent requires non-negative 'damage' number in data.");
        }
        this.damage = data.damage;
    }
}