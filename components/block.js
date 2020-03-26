'use strict';
polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  result: Ember.computed.alias('details.result'),

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

  elementColor: Ember.computed('details', function() {
    return this._getThreatColor(this.result.domain_risk.risk_score);
  }),

  elementStrokeOffset: Ember.computed('details', 'elementCircumference', function() {
    return this._getStrokeOffset(this.result.domain_risk.risk_score, this.elementCircumference);
  }),

  threatCircumference: Ember.computed('threatRadius', function() {
    return 2 * Math.PI * this.get('threatRadius');
  }),

  elementCircumference: Ember.computed('elementCircumference', function() {
    return 2 * Math.PI * this.get('elementRadius');
  }),
  actions: {
    subtract(a, b) {
      return a - b;
    },
  },
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
