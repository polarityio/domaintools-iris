'use strict';
polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details.body.response'),

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
    let riskScores = Ember.A();
    this.get('details.results').forEach(function(item) {
      riskScores.push(item.domain_risk.risk_score);
    });
    return this._getThreatColor(riskScores[0]);
  }),

  elementStrokeOffset: Ember.computed('details', 'elementCircumference', function() {
    let riskScores = Ember.A();
    this.get('details.results').forEach(function(item) {
      riskScores.push(item.domain_risk.risk_score);
    });
    return this._getStrokeOffset(riskScores[0], this.get('elementCircumference'));
  }),

  threatCircumference: Ember.computed('threatRadius', function() {
    return 2 * Math.PI * this.get('threatRadius');
  }),

  elementCircumference: Ember.computed('elementCircumference', function() {
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
