import { createCipheriv } from 'crypto';
import _ from 'lodash/fp';
import axios from 'axios';
import querystring from 'querystring';

axios.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded';
axios.defaults.baseURL = 'https://gdcportalgw.its-mo.com';

process.on('unhandledRejection', r => console.log(r));

const initial_app_strings = 'geORNtsZe5I4lRGjG9GZiA';
const defaultRegionCode = 'NNA';
const lg = 'en-US';
const tz = 'America/Denver';

const tlog = t => _.thru(d => { console.log(t, d); return d; });

function sleep(ms = 0) {
  return new Promise(r => setTimeout(r, ms));
}

export async function api(action, data) {
  let resp = await axios.post(`/gworchest_160803EC/gdc/${action}.php`, querystring.stringify(data));

  if(resp.data.status === 200) {
    console.log(`🍃 api ${action} 👍`);
    return resp.data;
  } else {
    console.log(`api ${action} 👎\r\n`, resp);
    throw new Error(resp.data.ErrorMessage);
  }
}

const blowpassword = _.curry((key, plainpass) => {
  let cipher = createCipheriv('bf-ecb', key, '');

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

const acompose = (fn, ...rest) =>
  rest.length
    ? async (...args) =>
        fn(await acompose(...rest)(...args))
    : fn;

const challenge = acompose(
  r => r.baseprm,
  () => api('InitialApp', { initial_app_strings }),
);



// rawCredentials => apiCredentials
const genCredentials = async (UserId, password, RegionCode = defaultRegionCode) => {
  return _.compose(
    Password => ({ UserId, Password, RegionCode }),
    blowpassword(await challenge()),
  )(password);
};

// apiCredentials => profile
const userLogin = async (credentials) => {
  return await api('UserLoginRequest', {
	  initial_app_strings,
    ...credentials
  });
};

// rawCredentials => profile
const authenticate = acompose(userLogin, genCredentials);

// rawCredentials => (apioperation => apiresults)
const loginSession = acompose(
  s => async (action) => await api(action, { ...s }),
  p => ({ custom_sessionid: getsessionid(p), VIN: getvin(p), RegionCode: getregioncode(p) }),
  authenticate,
);

const pollresult = _.curry(async (session, action, resultKey) => {
  let result;
  do {
    await sleep(5000);
    result = await session(action, { resultKey });
  } while(result.responseFlag !== '1');

  return result;
});

const longpollrequest = _.curry((action, pollaction, session) => {
  return acompose(
    pollresult(session, pollaction),
    r => r.resultKey,
    () => session(action),
  )();
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
