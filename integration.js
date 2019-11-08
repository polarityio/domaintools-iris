'use strict';

const request = require('request');
const _ = require('lodash');
const async = require('async');
const config = require('./config/config');
const fs = require('fs');

let Logger;
let requestWithDefaults;
let previousDomainRegexAsString = '';
let domainBlacklistRegex = null;

const BASE_URI = 'https://api.domaintools.com/v1/iris-investigate';
const MAX_DOMAIN_LABEL_LENGTH = 63;
const MAX_ENTITY_LENGTH = 100;
const MAX_ENTITIES_TO_BULK_LOOKUP = 30;
const WEB_EXTERNAL_URI = 'https://research.domaintools.com/iris/search/?q=';

function _setupRegexBlacklists(options) {
  if (options.domainBlacklistRegex !== previousDomainRegexAsString && options.domainBlacklistRegex.length === 0) {
    Logger.debug('Removing Domain Blacklist Regex Filtering');
    previousDomainRegexAsString = '';
    domainBlacklistRegex = null;
  } else {
    if (options.domainBlacklistRegex !== previousDomainRegexAsString) {
      previousDomainRegexAsString = options.domainBlacklistRegex;
      Logger.debug({ domainBlacklistRegex: previousDomainRegexAsString }, 'Modifying Domain Blacklist Regex');
      domainBlacklistRegex = new RegExp(options.domainBlacklistRegex, 'i');
    }
  }
}

function chunk(arr, chunkSize) {
  const R = [];
  for (let i = 0, len = arr.length; i < len; i += chunkSize) {
    R.push(arr.slice(i, i + chunkSize));
  }
  return R;
}

function doLookup(entities, options, cb) {
  let lookupResults = [];
  let entityLookup = {};
  let entityLists = [];

  _setupRegexBlacklists(options);

  entities.forEach((entityObj) => {
    if (_isInvalidEntity(entityObj) || _isEntityBlacklisted(entityObj, options)) {
      return;
    }

    entityLookup[entityObj.value.toLowerCase()] = entityObj;
    entityLists.push(entityObj.value.toLowerCase());
  });

  entityLists = chunk(entityLists, MAX_ENTITIES_TO_BULK_LOOKUP);
  Logger.debug({ entityLists }, 'Entity Lists');

  async.each(
    entityLists,
    (entityList, next) => {
      _lookupEntityInvestigate(entityList, entityLookup, options, function(err, results) {
        if (err) {
          next(err);
        } else {
          lookupResults = lookupResults.concat(results);
          next(null);
        }
      });
    },
    function(err) {
      cb(err, lookupResults);
    }
  );
}

function _isInvalidEntity(entityObj) {
  // DomaintTools API does not accept entities over 100 characters long so if we get any of those we don't look them up
  if (entityObj.value.length > MAX_ENTITY_LENGTH) {
    return true;
  }

  // Domain labels (the parts in between the periods, must be 63 characters or less
  if (entityObj.isDomain) {
    const invalidLabel = entityObj.value.split('.').find((label) => {
      return label.length > MAX_DOMAIN_LABEL_LENGTH;
    });

    if (typeof invalidLabel !== 'undefined') {
      return true;
    }
  }

  return false;
}

function _isEntityBlacklisted(entityObj, options) {
  const blacklist = options.blacklist;

  Logger.trace({ blacklist: blacklist }, 'checking to see what blacklist looks like');

  if (_.includes(blacklist, entityObj.value.toLowerCase())) {
    return true;
  }

  if (entityObj.isDomain) {
    if (domainBlacklistRegex !== null) {
      if (domainBlacklistRegex.test(entityObj.value)) {
        Logger.debug({ domain: entityObj.value }, 'Blocked BlackListed Domain Lookup');
        return true;
      }
    }
  }

  return false;
}

function _getRequestOptions(entityList, options) {
  let requestOptions = {
    uri: BASE_URI,
    qs: {
      api_username: options.apiName,
      api_key: options.apiKey,
      domain: entityList.join(',')
    },
    method: 'POST',
    json: true
  };

  return requestOptions;
}

function _lookupEntityInvestigate(entityList, entityLookup, options, cb) {
  const lookupResults = [];
  const requestOptions = _getRequestOptions(entityList, options);

  Logger.debug({ requestOptions }, 'Request Options');

  requestWithDefaults(requestOptions, function(err, response, body) {
    const errorObject = _isApiError(err, response, body, entityList);
    if (errorObject) {
      return cb(errorObject);
    }

    if (_isLookupMiss(response, body)) {
      entityList.forEach((entity) => {
        lookupResults.push({
          entity: entityLookup[entity],
          data: null
        });
      });

      return cb(null, lookupResults);
    }

    if (body.response.limit_exceeded === true) {
      return cb('API Limit Exceeded');
    }

    if (_.isNull(body) || _.isEmpty(body.response) || body.response.results_count === 0) {
      entityList.forEach((entity) => {
        lookupResults.push({
          entity: entityLookup[entity],
          data: null
        });
      });

      Logger.debug('Body is null');
      return cb(null, lookupResults);
    }

    body.response.results.forEach((result) => {
      let lookupEntity = _getEntityObjFromResult(entityLookup, result);
      if (lookupEntity) {
        if (result.domain_risk.risk_score < options.minScore) {
          lookupResults.push({
            entity: lookupEntity,
            data: null
          });
        } else {
          lookupResults.push({
            entity: lookupEntity,
            data: {
              summary: [],
              details: {
                result,
                uri: WEB_EXTERNAL_URI + result.domain
              }
            }
          });
        }
      }
    });

    // Any domains that didn't have a hit will be listed in the `missing_domains` array property
    body.response.missing_domains.forEach((missingDomain) => {
      let lookupEntity = entityLookup[missingDomain];
      if (lookupEntity) {
        lookupResults.push({
          entity: lookupEntity,
          data: null
        });
      }
    });

    cb(null, lookupResults);
  });
}

/**
 * In general we can match up the result domain with our entity object by using the result.domain field.
 * However, in cases where the domain is internationalized (tld is prepended with `xn--`), the result.domain
 * field will have the unicode representatino of the domain which will not match our lookup entity.  In this
 * case we need to parse the `whois_url` which will have the form of:
 *
 * "https://whois.domaintools.com/<domain-in-plain-text-format>"
 *
 * We can grab the domain in plain text format here and then match it up in our entityLookup to get the
 * entity object that the result maps to.
 *
 * @param entityLookup
 * @param result
 * @returns {*}
 * @private
 */
function _getEntityObjFromResult(entityLookup, result) {
  let entity = entityLookup[result.domain];
  if (entity) {
    return entity;
  }
  let tokens = result.whois_url.split('/');
  return entityLookup[tokens[tokens.length - 1]];
}

function _isLookupMiss(response, body) {
  return (
    response.statusCode === 404 ||
    response.statusCode === 500 ||
    response.statusCode === 400 ||
    response.statusCode === 503 ||
    typeof body === 'undefined'
  );
}

function _isApiError(err, response, body, entityLookupList) {
  if (err) {
    return {
      detail: 'Error executing HTTP request',
      error: err
    };
  }

  // Any code that is not 200 and not 404 (missed response) or 400, we treat as an error
  if (response.statusCode !== 200 && response.statusCode !== 404 && response.statusCode !== 400) {
    return _createJsonErrorPayload(
      'Unexpected HTTP Status Code',
      null,
      response.statusCode,
      '1',
      'Unexpected HTTP Status Code',
      {
        err: err,
        body: body,
        entityValue: entityLookupList
      }
    );
  }

  return null;
}

function validateOptions(userOptions, cb) {
  let errors = [];
  if (
    typeof userOptions.apiKey.value !== 'string' ||
    (typeof userOptions.apiKey.value === 'string' && userOptions.apiKey.value.length === 0)
  ) {
    errors.push({
      key: 'apiKey',
      message: 'You must provide a DomainTools API key'
    });
  }

  if (typeof userOptions.domainBlacklistRegex.value === 'string' && userOptions.domainBlacklistRegex.value.length > 0) {
    try {
      new RegExp(userOptions.domainBlacklistRegex.value);
    } catch (error) {
      errors.push({
        key: 'domainBlacklistRegex',
        message: error.toString()
      });
    }
  }

  if (typeof userOptions.ipBlacklistRegex.value === 'string' && userOptions.ipBlacklistRegex.value.length > 0) {
    try {
      new RegExp(userOptions.ipBlacklistRegex.value);
    } catch (e) {
      errors.push({
        key: 'ipBlacklistRegex',
        message: error.toString()
      });
    }
  }

  cb(null, errors);
}

// function that takes the ErrorObject and passes the error message to the notification window
function _createJsonErrorPayload(msg, pointer, httpCode, code, title, meta) {
  return {
    errors: [_createJsonErrorObject(msg, pointer, httpCode, code, title, meta)]
  };
}

// function that creates the Json object to be passed to the payload
function _createJsonErrorObject(msg, pointer, httpCode, code, title, meta) {
  let error = {
    detail: msg,
    status: httpCode.toString(),
    title: title,
    code: 'IRIS_' + code.toString()
  };

  if (pointer) {
    error.source = {
      pointer: pointer
    };
  }

  if (meta) {
    error.meta = meta;
  }

  return error;
}

function startup(logger) {
  Logger = logger;
  let defaults = {};

  if (typeof config.request.cert === 'string' && config.request.cert.length > 0) {
    defaults.cert = fs.readFileSync(config.request.cert);
  }

  if (typeof config.request.key === 'string' && config.request.key.length > 0) {
    defaults.key = fs.readFileSync(config.request.key);
  }

  if (typeof config.request.passphrase === 'string' && config.request.passphrase.length > 0) {
    defaults.passphrase = config.request.passphrase;
  }

  if (typeof config.request.ca === 'string' && config.request.ca.length > 0) {
    defaults.ca = fs.readFileSync(config.request.ca);
  }

  if (typeof config.request.proxy === 'string' && config.request.proxy.length > 0) {
    defaults.proxy = config.request.proxy;
  }

  if (typeof config.request.rejectUnauthorized === 'boolean') {
    defaults.rejectUnauthorized = config.request.rejectUnauthorized;
  }

  requestWithDefaults = request.defaults(defaults);
}

module.exports = {
  doLookup: doLookup,
  startup: startup,
  validateOptions: validateOptions
};
