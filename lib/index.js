'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.api = undefined;

let api = exports.api = (() => {
  var _ref = _asyncToGenerator(function* (action, data) {
    let resp = yield _axios2.default.post(`/gworchest_160803A/gdc/${action}.php`, _querystring2.default.stringify(data));

    if (resp.data.status === 200) {
      console.log(`🍃 api ${action} 👍`);
      return resp.data;
    } else {
      console.log(`api ${action} 👎\r\n`, resp);
      throw new Error(resp.data.ErrorMessage);
    }
  });

  return function api(_x, _x2) {
    return _ref.apply(this, arguments);
  };
})();

var _crypto = require('crypto');

var _fp = require('lodash/fp');

var _fp2 = _interopRequireDefault(_fp);

var _axios = require('axios');

var _axios2 = _interopRequireDefault(_axios);

var _querystring = require('querystring');

var _querystring2 = _interopRequireDefault(_querystring);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

_axios2.default.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded';
_axios2.default.defaults.baseURL = 'https://gdcportalgw.its-mo.com';

process.on('unhandledRejection', r => console.log(r));

const initial_app_strings = 'geORNtsZe5I4lRGjG9GZiA';
const defaultRegionCode = 'NNA';
const lg = 'en-US';
const tz = 'America/Denver';

const tlog = t => _fp2.default.thru(d => {
  console.log(t, d);return d;
});

function sleep(ms = 0) {
  return new Promise(r => setTimeout(r, ms));
}

const blowpassword = _fp2.default.curry((key, plainpass) => {
  let cipher = (0, _crypto.createCipheriv)('bf-ecb', key, '');

  let encpass = cipher.update(plainpass, 'utf8', 'base64');
  encpass += cipher.final('base64');

  return encpass;
});

function getsessionid(profile) {
  return profile.VehicleInfoList.vehicleInfo[0].custom_sessionid;
}

function getvin(profile) {
  return profile.VehicleInfoList.vehicleInfo[0].vin;
}

function getregioncode(profile) {
  return profile.CustomerInfo.RegionCode;
}

const acompose = (fn, ...rest) => rest.length ? (() => {
  var _ref2 = _asyncToGenerator(function* (...args) {
    return fn((yield acompose(...rest)(...args)));
  });

  return function () {
    return _ref2.apply(this, arguments);
  };
})() : fn;

const challenge = acompose(r => r.baseprm, () => api('InitialApp', { initial_app_strings }));

// rawCredentials => apiCredentials
const genCredentials = (() => {
  var _ref3 = _asyncToGenerator(function* (UserId, password, RegionCode = defaultRegionCode) {
    return _fp2.default.compose(function (Password) {
      return { UserId, Password, RegionCode };
    }, blowpassword((yield challenge())))(password);
  });

  return function genCredentials(_x3, _x4) {
    return _ref3.apply(this, arguments);
  };
})();

// apiCredentials => profile
const userLogin = (() => {
  var _ref4 = _asyncToGenerator(function* (credentials) {
    return yield api('UserLoginRequest', Object.assign({
      initial_app_strings
    }, credentials));
  });

  return function userLogin(_x5) {
    return _ref4.apply(this, arguments);
  };
})();

// rawCredentials => profile
const authenticate = acompose(userLogin, genCredentials);

// rawCredentials => (apioperation => apiresults)
const loginSession = acompose(s => (() => {
  var _ref5 = _asyncToGenerator(function* (action) {
    return yield api(action, Object.assign({}, s));
  });

  return function (_x6) {
    return _ref5.apply(this, arguments);
  };
})(), p => ({ custom_sessionid: getsessionid(p), VIN: getvin(p), RegionCode: getregioncode(p) }), authenticate);

const pollresult = _fp2.default.curry((() => {
  var _ref6 = _asyncToGenerator(function* (session, action, resultKey) {
    let result;
    do {
      yield sleep(5000);
      result = yield session(action, { resultKey });
    } while (result.responseFlag !== '1');

    return result;
  });

  return function (_x7, _x8, _x9) {
    return _ref6.apply(this, arguments);
  };
})());

const longpollrequest = _fp2.default.curry((action, pollaction, session) => {
  return acompose(pollresult(session, pollaction), r => r.resultKey, () => session(action))();
});

const batteryrecords = session => session('BatteryStatusRecordsRequest');
const batterystatuscheckrequest = session => session('BatteryStatusCheckRequest');
const batterystatuscheck = session => longpollrequest('BatteryStatusCheckResultRequest', 'BatteryStatusCheckResultRequest', session);

const hvacon = session => session('ACRemoteRequest');
const hvacoff = session => session('ACRemoteOffRequest');
const hvacstatus = session => session('RemoteACRecordsRequest');

//Create the api session
exports.loginSession = loginSession;
exports.hvacOn = hvacon;
exports.hvacOff = hvacoff;
exports.hvacStatus = hvacstatus;
exports.batteryRecords = batteryrecords;
exports.batteryStatusCheckRequest = batterystatuscheckrequest;
exports.batteryStatusCheck = batterystatuscheck;