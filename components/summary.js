"use strict";

polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias("block.data.details.body.response"),


  riskTags: Ember.computed("details", function() {
    let severityTags = Ember.A();
    let severityLevel = Ember.A();
    this.get("details.results").forEach(function(item) {
      if(item.domain_risk.risk_score !== undefined && item.domain_risk.risk_score !== null){
      severityLevel.push(item.domain_risk.risk_score);
    }
        });
    let severity = [... new Set(severityLevel)];
    severityTags.push("Highest Risk Score: " + Math.max(... severity));
    return severityTags;
  }),

  summaryTags: Ember.computed("details", function() {
    let severityTags = Ember.A();
    let severityLevel = Ember.A();
    this.get("details.results").forEach(function(item) {
      if(item.google_analytics.value !== undefined && item.google_analytics.value !== null){
      severityLevel.push(item.google_analytics.value);
    }
        });
    let severity = [... new Set(severityLevel)];
    severityTags.push("Highest Google Analytics Score: " + Math.max(... severity));
    return severityTags;
  })
});
