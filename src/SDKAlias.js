
/**
 * 
 * @param {type} options
 * @return {Function}
 */
module.exports = function(options) {
  return function() {
    console.log('Using cfn-lambda SDKAlias to define an operation');
    var argLength = arguments.length;
    switch (argLength) {
      // Create
      case 2:
        console.log('Aliasing method %s as CREATE operation.', options.method);
        SimpleAlias(options, null, arguments[0], arguments[1]);
        break;
      // Delete
      case 3:
        console.log('Aliasing method %s as DELETE or NOOPUPDATE operation.', options.method);
        SimpleAlias(options, arguments[0], arguments[1], arguments[2]);
        break;
      // Update
      case 4:
        console.log('Aliasing method %s as UPDATE operation.', options.method);
        SimpleAlias(options, arguments[0], arguments[1], arguments[3]);
        break;
      default:
        throw new Error('Could not determine cfn-lambda ' +
          'SDKAlias method signature at runtime.'); 
    }
  };
};

/**
 * 
 * @param {type} options
 * @param {type} physicalId
 * @param {type} params
 * @param {type} reply
 * @return {undefined}
 */
function SimpleAlias(options, physicalId, params, reply) {
  if (params) {
    delete params.ServiceToken;
  }
  var usedParams = usableParams(params, options, physicalId);
  var physicalIdFunction = 'function' === typeof options.returnPhysicalId
    ? options.returnPhysicalId
    : 'string' === typeof options.returnPhysicalId
      ? accessFunction(options.returnPhysicalId)
      : noop;
  options.api[options.method](usedParams, function(err, data) {
    if (!err || isIgnorable(options.ignoreErrorCodes, err)) {
      console.log('Aliased method succeeded: %j', data);
      return reply(null, physicalIdFunction(data, params),
        attrsFrom(options, data));
    }
    console.log('Aliased method had error: %j', err);
    reply(err.message);
  });
}

/**
 * 
 * @param {type} options
 * @param {type} data
 * @return {unresolved}
 */
function attrsFrom(options, data) {
  var attrFunction = Array.isArray(options.returnAttrs) && options.returnAttrs.every(isString)
    ? keyFilter.bind(null, options.returnAttrs)
    : (
        'function' === typeof options.returnAttrs
          ? options.returnAttrs
          : noop
      );
  return attrFunction(data);
}

/**
 * 
 * @param {type} params
 * @param {type} options
 * @param {type} physicalId
 * @return {usableParams.usedParams|usableParams.withMappedKeys|addAliasedPhysicalId.clone|nm$_SDKAlias.usableParams.paramObject|usableParams.paramObject|usableParams.withPhysicalId|usableParams.filteredParams}
 */
function usableParams(params, options, physicalId) {
  var paramObject = params || {};
  if (Array.isArray(options.forceBools) && options.forceBools.every(isString)) {
    forceBoolean(paramObject, options.forceBools);
  }
  if (Array.isArray(options.forceNums) && options.forceNums.every(isString)) {
    forceNum(paramObject, options.forceNums);
  }
  var withPhysicalId = isString(options.physicalIdAs)
    ? addAliasedPhysicalId(paramObject, options.physicalIdAs, physicalId)
    : paramObject;
  var filteredParams = Array.isArray(options.keys) && options.keys.every(isString)
    ? keyFilter(options.keys, withPhysicalId)
    : withPhysicalId;
  var withMappedKeys = Object(options.mapKeys) === options.mapKeys
    ? mapKeys(filteredParams, options.mapKeys)
    : filteredParams;
  var usedParams = options.downcase
    ? downcaseKeys(withMappedKeys)
    : withMappedKeys;
  console.log('Calling aliased method %s with params: %j',
    options.method, usedParams);
  return usedParams;
}

/**
 * 
 * @param {type} params
 * @param {type} physcialIdAlias
 * @param {type} physicalId
 * @return {addAliasedPhysicalId.clone}
 */
function addAliasedPhysicalId(params, physcialIdAlias, physicalId) {
  var clone = shallowClone(params);
  clone[physcialIdAlias] = physicalId;
  return clone;
}

/**
 * 
 * @param {type} hash
 * @return {unresolved}
 */
function downcaseKeys(hash) {
  return Object.keys(hash).reduce(function(dced, key) {
    dced[key[0].toLowerCase() + key.slice(1, key.length)] = hash[key];
    return dced;
  }, {});
}

/**
 * 
 * @param {type} hash
 * @return {unresolved}
 */
function shallowClone(hash) {
  return Object.keys(hash).reduce(function(clone, key) {
    clone[key] = hash[key];
    return clone;
  }, {});
}

/**
 * 
 * @param {type} obj
 * @return {Boolean}
 */
function isString(obj) {
  return 'string' === typeof obj;
}

/**
 * 
 * @param {type} ignorableErrorCodes
 * @param {type} errObject
 * @return {Boolean}
 */
function isIgnorable(ignorableErrorCodes, errObject) {
  return Array.isArray(ignorableErrorCodes) &&
    !!~ignorableErrorCodes.indexOf(errObject.statusCode);
}

/**
 * 
 * @param {type} key
 * @return {Function}
 */
function accessFunction(key) {
  return function(data) {
    return data === null
      ? undefined
      : data[key];
  };
}

/**
 * 
 * @param {type} params
 * @param {type} pathSet
 * @param {type} translator
 * @return {undefined}
 */
function forcePaths(params, pathSet, translator) {
  pathSet.forEach(function(path) {
    var pathTokens = path.split('.');
    var lastToken = pathTokens.pop();
    var intermediate = pathTokens.reduce(function(obj, key) {
      return obj === null 
        ? undefined
        : obj[key];
    }, params);
    if (intermediate) {
      if (lastToken === '*') {
        if (Array.isArray(intermediate)) {
          intermediate.forEach(function(value, index) {
            intermediate[index] = translator(value);
          });
        } else {
          Object.keys(intermediate).forEach(function(key) {
            intermediate[key] = translator(intermediate[key]);
          });
        }
      } else if (intermediate[lastToken] !== undefined) {
        intermediate[lastToken] = translator(intermediate[lastToken]);
      }
    }
  });
}

/**
 * 
 * @param {type} params
 * @param {type} pathSet
 * @return {undefined}
 */
function forceNum(params, pathSet) {
  forcePaths(params, pathSet, function(value) {
    return +value;
  });
}

/**
 * 
 * @param {type} params
 * @param {type} pathSet
 * @return {undefined}
 */
function forceBoolean(params, pathSet) {
  var translations = {
    '0': false,
    'false': false,
    '': false,
    'null': false,
    'undefined': false,
    '1': true,
    'true': true
  };
  forcePaths(params, pathSet, function(value) {
    return translations[value];
  });
}

/**
 * 
 * @param {type} params
 * @param {type} keyMap
 * @return {unresolved}
 */
function mapKeys(params, keyMap) {
  return Object.keys(params).reduce(function(mapped, key) {
    mapped[keyMap[key] ? keyMap[key] : key] = params[key];
    return mapped;
  }, {});
}

/**
 * 
 * @return {undefined}
 */
function noop() {

}

/**
 * 
 * @param {type} includedKeySet
 * @param {type} hash
 * @return {unresolved}
 */
function keyFilter(includedKeySet, hash) {
  return includedKeySet.reduce(function(fHash, key) {
    fHash[key] = hash[key];
    return fHash;
  }, {});
}
