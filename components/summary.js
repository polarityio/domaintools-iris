"use strict";

polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias("block.data.details.body.response"),

  riskTags: Ember.computed("details", function() {
    let riskTags = Ember.A();
    this.get("details.results").forEach(function(item) {
      if(item.domain_risk.risk_score !== null){
      riskTags.push("DomainTools Risk Score: " + item.domain_risk.risk_score);
    }
    });

    return riskTags;
  }),

  summaryTags: Ember.computed("details", function() {
    let summaryTags = Ember.A();
    this.get("details.results").forEach(function(item) {
      let googleValue = item.google_analytics.value;
      if(googleValue.length !== 0) {
        summaryTags.push(
        "Google Anayltics Score: " + googleValue
      );
    }
    });

    return summaryTags;
  })
});
