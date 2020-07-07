'use strict';
polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  result: Ember.computed.alias('details.result'),
  hasRegistrationDetails: Ember.computed(
    'result.registrant_org.value',
    'result.registrar.value',
    'result.registrant_contact',
    function () {
      if (
        this.get('result.registrant_org.value') ||
        this.get('result.registrar.value') ||
        this.get('result.registrant_contact.name.value') ||
        this.get('result.registrant_contact.org.value') ||
        this.get('result.registrant_contact.org.value') ||
        this.get('result.registrant_contact.city.value') ||
        this.get('result.registrant_contact.country.value')
      ) {
        return true;
      }
      return false;
    }
  ),
  redThreat: '#fa5843',
  greenThreat: '#7dd21b',
  yellowThreat: '#ffc15d',
  /**
   * Radius of the ticScore circle
   */
  threatRadius: 15,
  /**
   * StrokeWidth of the ticScore circle
   */
  threatStrokeWidth: 2,
  elementRadius: 20,
  elementStrokeWidth: 4,

  elementColor: Ember.computed('result.domain_risk.risk_score', function () {
    return this._getThreatColor(this.result.domain_risk.risk_score);
  }),

  elementStrokeOffset: Ember.computed('result.domain_risk.risk_score', 'elementCircumference', function () {
    return this._getStrokeOffset(this.result.domain_risk.risk_score, this.elementCircumference);
  }),

  threatCircumference: Ember.computed('threatRadius', function () {
    return 2 * Math.PI * this.get('threatRadius');
  }),

  elementCircumference: Ember.computed('elementRadius', function () {
    return 2 * Math.PI * this.get('elementRadius');
  }),
  _getStrokeOffset(ticScore, circumference) {
    let progress = ticScore / 100;
    return circumference * (1 - progress);
  },
  _getThreatColor(ticScore) {
    if (ticScore >= 75) {
      return this.get('redThreat');
    } else if (ticScore >= 50) {
      return this.get('yellowThreat');
    } else {
      return this.get('greenThreat');
    }
  }
});
