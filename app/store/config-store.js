// @flow
import { AsyncStorage, Alert, Platform } from 'react-native'
import {
  put,
  take,
  race,
  all,
  call,
  select,
  takeLatest,
  spawn,
} from 'redux-saga/effects'
import { IS_ALREADY_INSTALLED } from '../common'
import { hydrateApp } from '../store/hydration-store'
import { setItem, getItem, deleteItem } from '../services/secure-storage'
import { captureError } from '../services/error/error-handler'
import { lockEnable } from '../lock/lock-store'
import { PIN_STORAGE_KEY, TOUCHID_STORAGE_KEY } from '../lock/type-lock'
import {
  getErrorAlertsSwitchValue,
  getPushToken,
  getHydrationState,
  getConfig,
  getUserOneTimeInfo,
  getVcxInitializationState,
  getAgencyUrl,
  getCurrentScreen,
  getUseVcx,
} from '../store/store-selector'
import { enableTouchIdAction, disableTouchIdAction } from '../lock/lock-store'
import {
  SERVER_ENVIRONMENT,
  HYDRATED,
  APP_INSTALLED,
  ALREADY_INSTALLED_RESULT,
  SERVER_ENVIRONMENT_CHANGED,
  SWITCH_ERROR_ALERTS,
  TOGGLE_ERROR_ALERTS,
  SWITCH_ENVIRONMENT,
  STORAGE_KEY_SWITCHED_ENVIRONMENT_DETAIL,
  SAVE_SWITCH_ENVIRONMENT_DETAIL_FAIL,
  ERROR_SAVE_SWITCH_ENVIRONMENT,
  ERROR_HYDRATE_SWITCH_ENVIRONMENT,
  HYDRATE_SWITCH_ENVIRONMENT_DETAIL_FAIL,
  CHANGE_ENVIRONMENT_VIA_URL,
  schemaDownloadedEnvironmentDetails,
  MESSAGE_FAIL_ENVIRONMENT_SWITCH_TITLE,
  MESSAGE_FAIL_ENVIRONMENT_SWITCH_INVALID_DATA,
  MESSAGE_FAIL_ENVIRONMENT_SWITCH_ERROR,
  MESSAGE_SUCCESS_ENVIRONMENT_SWITCH_DESCRIPTION,
  MESSAGE_SUCCESS_ENVIRONMENT_SWITCH_TITLE,
  VCX_INIT_START,
  VCX_INIT_SUCCESS,
  VCX_INIT_FAIL,
  ERROR_VCX_INIT_FAIL,
  ERROR_VCX_PROVISION_FAIL,
  VCX_INIT_NOT_STARTED,
  USE_VCX,
  UNSAFE_SCREENS_TO_DOWNLOAD_SMS,
} from './type-config-store'
import type {
  ServerEnvironment,
  ConfigStore,
  ConfigAction,
  ServerEnvironmentChangedAction,
  SwitchEnvironmentAction,
  ChangeEnvironment,
  ChangeEnvironmentUrlAction,
} from './type-config-store'
import { appHydration, deleteStoredData } from './hydration-store'
import type { CustomError } from '../common/type-common'
import { downloadEnvironmentDetails } from '../api/api'
import schemaValidator from '../services/schema-validator'
import type { EnvironmentDetailUrlDownloaded } from '../api/type-api'
import {
  reset as resetNative,
  init,
  createOneTimeInfo,
} from '../bridge/react-native-cxs/RNCxs'
import { RESET } from '../common/type-common'
import { updatePushToken } from '../push-notification/push-notification-store'
import type { VcxProvisionResult } from '../bridge/react-native-cxs/type-cxs'
import type { UserOneTimeInfo } from './user/type-user-store'
import { connectRegisterCreateAgentDone } from './user/user-store'
import findKey from 'lodash.findkey'
import { SAFE_TO_DOWNLOAD_SMS_INVITATION } from '../sms-pending-invitation/type-sms-pending-invitation'
import { GENESIS_FILE_NAME } from '../api/api-constants'
import { USE_VCX_KEY } from '../common/secure-storage-constants'

/**
 * this file contains configuration which is changed only from user action
 * this store should not contain any configuration
 * which are not result of user action
 */

export const baseUrls = {
  [SERVER_ENVIRONMENT.DEVELOPMENT]: {
    agencyUrl: 'https://cagency.pdev.evernym.com',
    agencyDID: 'dTLdJqRZLwMuWSogcKfBT',
    agencyVerificationKey: 'LsPQTDHi294TexkFmZK9Q9vW4YGtQRuLV8wuyZi94yH',
    poolConfig:
      '{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node1","blskey":"4N8aUNHSgjQVgkpm8nhNEfDf6txHznoYREg9kirmJrkivgL4oSEimFF6nsQ6M41QvhM2Z33nves5vfSn9n1UwNFJBYtWVnHYMATn76vLuL3zU88KyeAYcHfsih3He6UHcXDxcaecHVz6jhCYz1P2UZn2bDVruL5wXpehgBfBaLKm3Ba","client_ip":"35.164.240.131","client_port":9702,"node_ip":"35.164.240.131","node_port":9701,"services":["VALIDATOR"]},"dest":"Gw6pDLhcBcoQesN72qfotTgFa7cbuqZpkX3Xo6pLhPhv"},"metadata":{"from":"Th7MpTaRZVRYnPiabds81Y"},"type":"0"},"txnMetadata":{"seqNo":1,"txnId":"fea82e10e894419fe2bea7d96296a6d46f50f93f9eeda954ec461b2ed2950b62"},"ver":"1"}\n{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node2","blskey":"37rAPpXVoxzKhz7d9gkUe52XuXryuLXoM6P6LbWDB7LSbG62Lsb33sfG7zqS8TK1MXwuCHj1FKNzVpsnafmqLG1vXN88rt38mNFs9TENzm4QHdBzsvCuoBnPH7rpYYDo9DZNJePaDvRvqJKByCabubJz3XXKbEeshzpz4Ma5QYpJqjk","client_ip":"35.164.240.131","client_port":9704,"node_ip":"35.164.240.131","node_port":9703,"services":["VALIDATOR"]},"dest":"8ECVSk179mjsjKRLWiQtssMLgp6EPhWXtaYyStWPSGAb"},"metadata":{"from":"EbP4aYNeTHL6q385GuVpRV"},"type":"0"},"txnMetadata":{"seqNo":2,"txnId":"1ac8aece2a18ced660fef8694b61aac3af08ba875ce3026a160acbc3a3af35fc"},"ver":"1"}\n{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node3","blskey":"3WFpdbg7C5cnLYZwFZevJqhubkFALBfCBBok15GdrKMUhUjGsk3jV6QKj6MZgEubF7oqCafxNdkm7eswgA4sdKTRc82tLGzZBd6vNqU8dupzup6uYUf32KTHTPQbuUM8Yk4QFXjEf2Usu2TJcNkdgpyeUSX42u5LqdDDpNSWUK5deC5","client_ip":"35.164.240.131","client_port":9706,"node_ip":"35.164.240.131","node_port":9705,"services":["VALIDATOR"]},"dest":"DKVxG2fXXTU8yT5N7hGEbXB3dfdAnYv1JczDUHpmDxya"},"metadata":{"from":"4cU41vWW82ArfxJxHkzXPG"},"type":"0"},"txnMetadata":{"seqNo":3,"txnId":"7e9f355dffa78ed24668f0e0e369fd8c224076571c51e2ea8be5f26479edebe4"},"ver":"1"}\n{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node4","blskey":"2zN3bHM1m4rLz54MJHYSwvqzPchYp8jkHswveCLAEJVcX6Mm1wHQD1SkPYMzUDTZvWvhuE6VNAkK3KxVeEmsanSmvjVkReDeBEMxeDaayjcZjFGPydyey1qxBHmTvAnBKoPydvuTAqx5f7YNNRAdeLmUi99gERUU7TD8KfAa6MpQ9bw","client_ip":"35.164.240.131","client_port":9708,"node_ip":"35.164.240.131","node_port":9707,"services":["VALIDATOR"]},"dest":"4PS3EDQ3dW1tci1Bp6543CfuuebjFrg36kLAUcskGfaA"},"metadata":{"from":"TWwCRQRZ2ZHMJFn9TzLp7W"},"type":"0"},"txnMetadata":{"seqNo":4,"txnId":"aa5e817d7cc626170eca175822029339a444eb0ee8f0bd20d3b0b76e566fb008"},"ver":"1"}',
  },
  [SERVER_ENVIRONMENT.SANDBOX]: {
    agencyUrl: 'https://agency-sandbox.evernym.com',
    agencyDID: 'Nv9oqGX57gy15kPSJzo2i4',
    agencyVerificationKey: 'CwpcjCc6MtVNdQgwoonNMFoR6dhzmRXHHaUCRSrjh8gj',
    poolConfig:
      '{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node1","blskey":"4N8aUNHSgjQVgkpm8nhNEfDf6txHznoYREg9kirmJrkivgL4oSEimFF6nsQ6M41QvhM2Z33nves5vfSn9n1UwNFJBYtWVnHYMATn76vLuL3zU88KyeAYcHfsih3He6UHcXDxcaecHVz6jhCYz1P2UZn2bDVruL5wXpehgBfBaLKm3Ba","client_ip":"35.164.240.131","client_port":9702,"node_ip":"35.164.240.131","node_port":9701,"services":["VALIDATOR"]},"dest":"Gw6pDLhcBcoQesN72qfotTgFa7cbuqZpkX3Xo6pLhPhv"},"metadata":{"from":"Th7MpTaRZVRYnPiabds81Y"},"type":"0"},"txnMetadata":{"seqNo":1,"txnId":"fea82e10e894419fe2bea7d96296a6d46f50f93f9eeda954ec461b2ed2950b62"},"ver":"1"}\n{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node2","blskey":"37rAPpXVoxzKhz7d9gkUe52XuXryuLXoM6P6LbWDB7LSbG62Lsb33sfG7zqS8TK1MXwuCHj1FKNzVpsnafmqLG1vXN88rt38mNFs9TENzm4QHdBzsvCuoBnPH7rpYYDo9DZNJePaDvRvqJKByCabubJz3XXKbEeshzpz4Ma5QYpJqjk","client_ip":"35.164.240.131","client_port":9704,"node_ip":"35.164.240.131","node_port":9703,"services":["VALIDATOR"]},"dest":"8ECVSk179mjsjKRLWiQtssMLgp6EPhWXtaYyStWPSGAb"},"metadata":{"from":"EbP4aYNeTHL6q385GuVpRV"},"type":"0"},"txnMetadata":{"seqNo":2,"txnId":"1ac8aece2a18ced660fef8694b61aac3af08ba875ce3026a160acbc3a3af35fc"},"ver":"1"}\n{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node3","blskey":"3WFpdbg7C5cnLYZwFZevJqhubkFALBfCBBok15GdrKMUhUjGsk3jV6QKj6MZgEubF7oqCafxNdkm7eswgA4sdKTRc82tLGzZBd6vNqU8dupzup6uYUf32KTHTPQbuUM8Yk4QFXjEf2Usu2TJcNkdgpyeUSX42u5LqdDDpNSWUK5deC5","client_ip":"35.164.240.131","client_port":9706,"node_ip":"35.164.240.131","node_port":9705,"services":["VALIDATOR"]},"dest":"DKVxG2fXXTU8yT5N7hGEbXB3dfdAnYv1JczDUHpmDxya"},"metadata":{"from":"4cU41vWW82ArfxJxHkzXPG"},"type":"0"},"txnMetadata":{"seqNo":3,"txnId":"7e9f355dffa78ed24668f0e0e369fd8c224076571c51e2ea8be5f26479edebe4"},"ver":"1"}\n{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node4","blskey":"2zN3bHM1m4rLz54MJHYSwvqzPchYp8jkHswveCLAEJVcX6Mm1wHQD1SkPYMzUDTZvWvhuE6VNAkK3KxVeEmsanSmvjVkReDeBEMxeDaayjcZjFGPydyey1qxBHmTvAnBKoPydvuTAqx5f7YNNRAdeLmUi99gERUU7TD8KfAa6MpQ9bw","client_ip":"35.164.240.131","client_port":9708,"node_ip":"35.164.240.131","node_port":9707,"services":["VALIDATOR"]},"dest":"4PS3EDQ3dW1tci1Bp6543CfuuebjFrg36kLAUcskGfaA"},"metadata":{"from":"TWwCRQRZ2ZHMJFn9TzLp7W"},"type":"0"},"txnMetadata":{"seqNo":4,"txnId":"aa5e817d7cc626170eca175822029339a444eb0ee8f0bd20d3b0b76e566fb008"},"ver":"1"}',
  },
  [SERVER_ENVIRONMENT.STAGING]: {
    agencyUrl: 'https://agency.pstg.evernym.com',
    agencyDID: 'LqnB96M6wBALqRZsrTTwda',
    agencyVerificationKey: 'BpDPZHLbJFu67sWujecoreojiWZbi2dgf4xnYemUzFvB',
    poolConfig:
      '{"data":{"alias":"australia","client_ip":"52.64.96.160","client_port":"9702","node_ip":"52.64.96.160","node_port":"9701","services":["VALIDATOR"]},"dest":"UZH61eLH3JokEwjMWQoCMwB3PMD6zRBvG6NCv5yVwXz","identifier":"3U8HUen8WcgpbnEz1etnai","txnId":"c585f1decb986f7ff19b8d03deba346ab8a0494cc1e4d69ad9b8acb0dfbeab6f","type":"0"}\n{"data":{"alias":"brazil","client_ip":"54.233.203.241","client_port":"9702","node_ip":"54.233.203.241","node_port":"9701","services":["VALIDATOR"]},"dest":"2MHGDD2XpRJohQzsXu4FAANcmdypfNdpcqRbqnhkQsCq","identifier":"G3knUCmDrWd1FJrRryuKTw","txnId":"5c8f52ca28966103ff0aad98160bc8e978c9ca0285a2043a521481d11ed17506","type":"0"}\n{"data":{"alias":"canada","client_ip":"52.60.207.225","client_port":"9702","node_ip":"52.60.207.225","node_port":"9701","services":["VALIDATOR"]},"dest":"8NZ6tbcPN2NVvf2fVhZWqU11XModNudhbe15JSctCXab","identifier":"22QmMyTEAbaF4VfL7LameE","txnId":"408c7c5887a0f3905767754f424989b0089c14ac502d7f851d11b31ea2d1baa6","type":"0"}\n{"data":{"alias":"england","client_ip":"52.56.191.9","client_port":"9702","node_ip":"52.56.191.9","node_port":"9701","services":["VALIDATOR"]},"dest":"DNuLANU7f1QvW1esN3Sv9Eap9j14QuLiPeYzf28Nub4W","identifier":"NYh3bcUeSsJJcxBE6TTmEr","txnId":"d56d0ff69b62792a00a361fbf6e02e2a634a7a8da1c3e49d59e71e0f19c27875","type":"0"}\n{"data":{"alias":"korea","client_ip":"52.79.115.223","client_port":"9702","node_ip":"52.79.115.223","node_port":"9701","services":["VALIDATOR"]},"dest":"HCNuqUoXuK9GXGd2EULPaiMso2pJnxR6fCZpmRYbc7vM","identifier":"U38UHML5A1BQ1mYh7tYXeu","txnId":"76201e78aca720dbaf516d86d9342ad5b5d46f5badecf828eb9edfee8ab48a50","type":"0"}\n{"data":{"alias":"singapore","client_ip":"13.228.62.7","client_port":"9702","node_ip":"13.228.62.7","node_port":"9701","services":["VALIDATOR"]},"dest":"Dh99uW8jSNRBiRQ4JEMpGmJYvzmF35E6ibnmAAf7tbk8","identifier":"HfXThVwhJB4o1Q1Fjr4yrC","txnId":"51e2a46721d104d9148d85b617833e7745fdbd6795cb0b502a5b6ea31d33378e","type":"0"}\n{"data":{"alias":"virginia","client_ip":"34.225.215.131","client_port":"9702","node_ip":"34.225.215.131","node_port":"9701","services":["VALIDATOR"]},"dest":"EoGRm7eRADtHJRThMCrBXMUM2FpPRML19tNxDAG8YTP8","identifier":"SPdfHq6rGcySFVjDX4iyCo","txnId":"0a4992ea442b53e3dca861deac09a8d4987004a8483079b12861080ea4aa1b52","type":"0"}',
  },
  [SERVER_ENVIRONMENT.DEMO]: {
    agencyUrl: 'https://agency.pps.evernym.com',
    agencyDID: '3mbwr7i85JNSL3LoNQecaW',
    agencyVerificationKey: '2WXxo6y1FJvXWgZnoYUP5BJej2mceFrqBDNPE3p6HDPf',
    poolConfig:
      '{"data":{"alias":"australia","client_ip":"52.64.96.160","client_port":"9702","node_ip":"52.64.96.160","node_port":"9701","services":["VALIDATOR"]},"dest":"UZH61eLH3JokEwjMWQoCMwB3PMD6zRBvG6NCv5yVwXz","identifier":"3U8HUen8WcgpbnEz1etnai","txnId":"c585f1decb986f7ff19b8d03deba346ab8a0494cc1e4d69ad9b8acb0dfbeab6f","type":"0"}\n{"data":{"alias":"brazil","client_ip":"54.233.203.241","client_port":"9702","node_ip":"54.233.203.241","node_port":"9701","services":["VALIDATOR"]},"dest":"2MHGDD2XpRJohQzsXu4FAANcmdypfNdpcqRbqnhkQsCq","identifier":"G3knUCmDrWd1FJrRryuKTw","txnId":"5c8f52ca28966103ff0aad98160bc8e978c9ca0285a2043a521481d11ed17506","type":"0"}\n{"data":{"alias":"canada","client_ip":"52.60.207.225","client_port":"9702","node_ip":"52.60.207.225","node_port":"9701","services":["VALIDATOR"]},"dest":"8NZ6tbcPN2NVvf2fVhZWqU11XModNudhbe15JSctCXab","identifier":"22QmMyTEAbaF4VfL7LameE","txnId":"408c7c5887a0f3905767754f424989b0089c14ac502d7f851d11b31ea2d1baa6","type":"0"}\n{"data":{"alias":"england","client_ip":"52.56.191.9","client_port":"9702","node_ip":"52.56.191.9","node_port":"9701","services":["VALIDATOR"]},"dest":"DNuLANU7f1QvW1esN3Sv9Eap9j14QuLiPeYzf28Nub4W","identifier":"NYh3bcUeSsJJcxBE6TTmEr","txnId":"d56d0ff69b62792a00a361fbf6e02e2a634a7a8da1c3e49d59e71e0f19c27875","type":"0"}\n{"data":{"alias":"korea","client_ip":"52.79.115.223","client_port":"9702","node_ip":"52.79.115.223","node_port":"9701","services":["VALIDATOR"]},"dest":"HCNuqUoXuK9GXGd2EULPaiMso2pJnxR6fCZpmRYbc7vM","identifier":"U38UHML5A1BQ1mYh7tYXeu","txnId":"76201e78aca720dbaf516d86d9342ad5b5d46f5badecf828eb9edfee8ab48a50","type":"0"}\n{"data":{"alias":"singapore","client_ip":"13.228.62.7","client_port":"9702","node_ip":"13.228.62.7","node_port":"9701","services":["VALIDATOR"]},"dest":"Dh99uW8jSNRBiRQ4JEMpGmJYvzmF35E6ibnmAAf7tbk8","identifier":"HfXThVwhJB4o1Q1Fjr4yrC","txnId":"51e2a46721d104d9148d85b617833e7745fdbd6795cb0b502a5b6ea31d33378e","type":"0"}\n{"data":{"alias":"virginia","client_ip":"34.225.215.131","client_port":"9702","node_ip":"34.225.215.131","node_port":"9701","services":["VALIDATOR"]},"dest":"EoGRm7eRADtHJRThMCrBXMUM2FpPRML19tNxDAG8YTP8","identifier":"SPdfHq6rGcySFVjDX4iyCo","txnId":"0a4992ea442b53e3dca861deac09a8d4987004a8483079b12861080ea4aa1b52","type":"0"}',
  },
}

// making defaults sane so that developers don't need to remember
// what settings should be in dev environment
const isDevEnvironment = __DEV__ && process.env.NODE_ENV !== 'test'
const defaultEnvironment = isDevEnvironment
  ? SERVER_ENVIRONMENT.DEVELOPMENT
  : SERVER_ENVIRONMENT.DEMO
const defaultUseVcx = isDevEnvironment ? true : false

const initialState: ConfigStore = {
  ...baseUrls[defaultEnvironment],
  isAlreadyInstalled: false,
  // this flag is used to identify if we got the already stored data
  // from the phone and loaded in app
  isHydrated: false,
  // configurable error alert messages
  showErrorAlerts: false,
  // used to track if vcx is initialized successfully
  // if vcx is not initialized, then we won't be able
  // to call bridge methods that deals claims, connections, proofs, etc.
  vcxInitializationState: VCX_INIT_NOT_STARTED,
  vcxInitializationError: null,
  useVcx: defaultUseVcx,
}

export const hydrated = () => ({
  type: HYDRATED,
})

export const alreadyInstalledAction = (isAlreadyInstalled: boolean) => ({
  type: ALREADY_INSTALLED_RESULT,
  isAlreadyInstalled,
})

export const appInstalledSuccess = () => ({
  type: APP_INSTALLED,
})

export const changeEnvironmentUrl = (url: string) => ({
  type: CHANGE_ENVIRONMENT_VIA_URL,
  url,
})

export function* resetStore(): Generator<*, *, *> {
  yield put({ type: RESET })
}

// had to specify type to any instead of generator
// due to redux-saga type definition failing for if with yield
export function* onChangeEnvironmentUrl(
  action: ChangeEnvironmentUrlAction
): Generator<*, *, *> {
  try {
    const { url } = action
    const environmentDetails: EnvironmentDetailUrlDownloaded = yield call(
      downloadEnvironmentDetails,
      url
    )
    if (
      !schemaValidator.validate(
        schemaDownloadedEnvironmentDetails,
        environmentDetails
      )
    ) {
      // TODO: We need to make a component which displays message
      // in whole app, something like toast in android
      // for now, we are using native alert to show error and messages
      Alert.alert(
        MESSAGE_FAIL_ENVIRONMENT_SWITCH_TITLE,
        MESSAGE_FAIL_ENVIRONMENT_SWITCH_INVALID_DATA(url)
      )

      return
    }

    yield* deleteStoredData()
    yield* resetStore()

    yield put(
      changeEnvironment(
        environmentDetails.agencyUrl,
        environmentDetails.agencyDID,
        environmentDetails.agencyVerificationKey,
        environmentDetails.poolConfig
      )
    )

    const pushToken: string = yield select(getPushToken)
    yield put(updatePushToken(pushToken))
    yield call(resetNative, environmentDetails.poolConfig)
    yield put(vcxInitReset())

    // if we did not get any exception till this point
    // that means environment is switched
    Alert.alert(
      MESSAGE_SUCCESS_ENVIRONMENT_SWITCH_TITLE,
      MESSAGE_SUCCESS_ENVIRONMENT_SWITCH_DESCRIPTION
    )
  } catch (e) {
    Alert.alert(
      MESSAGE_FAIL_ENVIRONMENT_SWITCH_TITLE,
      MESSAGE_FAIL_ENVIRONMENT_SWITCH_ERROR(e.message)
    )
  }
}

export function* watchChangeEnvironmentUrl(): any {
  yield takeLatest(CHANGE_ENVIRONMENT_VIA_URL, onChangeEnvironmentUrl)
}

export const changeEnvironment = (
  agencyUrl: string,
  agencyDID: string,
  agencyVerificationKey: string,
  poolConfig: string
) => {
  let updatedPoolConfig = poolConfig

  // We can get pool config from user that does not have \n
  // or it might contain \\n or it might contain just \n
  if (poolConfig) {
    if (poolConfig.indexOf('\\n') > -1) {
      updatedPoolConfig = poolConfig.split('\\n').join('\n')
    }

    // TODO: Raise error about invalid pool config
  }

  let updatedAgencyUrl = agencyUrl.trim()
  const endIndex = agencyUrl.length - 1

  if (updatedAgencyUrl[endIndex] === '/') {
    // if we got the agency url that ends to with '/'
    // then we save it after removing that slash
    updatedAgencyUrl = updatedAgencyUrl.slice(0, endIndex)
  }

  return {
    type: SWITCH_ENVIRONMENT,
    poolConfig: updatedPoolConfig,
    agencyDID,
    agencyVerificationKey,
    agencyUrl: updatedAgencyUrl,
  }
}

export const saveSwitchedEnvironmentDetailFail = (error: CustomError) => ({
  type: SAVE_SWITCH_ENVIRONMENT_DETAIL_FAIL,
  error,
})

export function* onEnvironmentSwitch(
  action: SwitchEnvironmentAction
): Generator<*, *, *> {
  const { type, ...switchedEnvironmentDetail } = action
  try {
    yield call(
      AsyncStorage.setItem,
      STORAGE_KEY_SWITCHED_ENVIRONMENT_DETAIL,
      JSON.stringify(switchedEnvironmentDetail)
    )
  } catch (e) {
    // we need to add some fallback if user storage is not available
    // or is full or if user deleted our data
    yield put(
      saveSwitchedEnvironmentDetailFail({
        code: ERROR_SAVE_SWITCH_ENVIRONMENT.code,
        message: `${ERROR_SAVE_SWITCH_ENVIRONMENT.message}${e.message}`,
      })
    )
  }
}

export function* watchSwitchEnvironment(): any {
  yield takeLatest(SWITCH_ENVIRONMENT, onEnvironmentSwitch)
}

export function* hydrateSwitchedEnvironmentDetails(): any {
  try {
    const switchedEnvironmentDetail = yield call(
      AsyncStorage.getItem,
      STORAGE_KEY_SWITCHED_ENVIRONMENT_DETAIL
    )
    if (switchedEnvironmentDetail) {
      const {
        agencyUrl,
        agencyDID,
        agencyVerificationKey,
        poolConfig,
      }: ChangeEnvironment = JSON.parse(switchedEnvironmentDetail)
      yield put(
        changeEnvironment(
          agencyUrl,
          agencyDID,
          agencyVerificationKey,
          poolConfig
        )
      )
    }
  } catch (e) {
    yield put(
      hydrateSwitchedEnvironmentDetailFail({
        code: ERROR_HYDRATE_SWITCH_ENVIRONMENT.code,
        message: `${ERROR_HYDRATE_SWITCH_ENVIRONMENT.message}${e.message}`,
      })
    )
  }
}

export const hydrateSwitchedEnvironmentDetailFail = (error: CustomError) => ({
  type: HYDRATE_SWITCH_ENVIRONMENT_DETAIL_FAIL,
  error,
})

export const changeServerEnvironment = (
  serverEnvironment: ServerEnvironment
): ServerEnvironmentChangedAction => ({
  type: SERVER_ENVIRONMENT_CHANGED,
  serverEnvironment,
})

export const switchErrorAlerts = () => ({
  type: SWITCH_ERROR_ALERTS,
})

export const toggleErrorAlerts = (isShowErrorAlert: boolean) => ({
  type: TOGGLE_ERROR_ALERTS,
  isShowErrorAlert,
})

export function* watchSwitchErrorAlerts(): any {
  while (true) {
    for (let i = 0; i < 4; i++) {
      yield take(SWITCH_ERROR_ALERTS)
    }

    const switchValue = yield select(getErrorAlertsSwitchValue)
    yield put(toggleErrorAlerts(!switchValue))
  }
}

export function* alreadyInstalledNotFound(): Generator<*, *, *> {
  yield put(alreadyInstalledAction(false))

  // clear security setup flag
  yield call(deleteItem, PIN_STORAGE_KEY)
  yield call(deleteItem, TOUCHID_STORAGE_KEY)
  yield put(lockEnable(false))

  // now save the key in user's default storage in phone
  try {
    yield call(AsyncStorage.setItem, IS_ALREADY_INSTALLED, 'true')
  } catch (e) {
    // somehow the storage failed, so we need to find someway to store
    // maybe we fallback to file based storage

    // Capture AsyncStorage failed
    captureError(e)
  }
}

export function* onUseVcx(): Generator<*, *, *> {
  yield call(AsyncStorage.setItem, USE_VCX_KEY, 'true')
}

export function* watchOnUseVcx(): any {
  yield takeLatest(USE_VCX, onUseVcx)
}

export function* hydrateOnUseVcx(): any {
  try {
    const useVcxFlag = yield call(AsyncStorage.getItem, USE_VCX_KEY)
    if (useVcxFlag) {
      yield put(useVcx())
    }
  } catch (e) {
    captureError(e)
  }
}

export function* hydrateConfig(): any {
  let isAlreadyInstalled = false
  try {
    isAlreadyInstalled = yield call(AsyncStorage.getItem, IS_ALREADY_INSTALLED)
    if (isAlreadyInstalled) {
      yield put(alreadyInstalledAction(true))
      try {
        // restore app lock settings
        const isLockEnabled = yield call(getItem, PIN_STORAGE_KEY)
        if (isLockEnabled) {
          yield put(lockEnable(true))
        }
        const isTouchIdEnabled = yield call(getItem, TOUCHID_STORAGE_KEY)
        if (isTouchIdEnabled === 'true') {
          yield put(enableTouchIdAction())
        } else {
          yield put(disableTouchIdAction())
        }
      } catch (e) {
        // somehow the secure storage failed, so we need to find someway to store
        // maybe we fallback to file based storage

        // Capture AsyncStorage failed
        captureError(e)
      }
    } else {
      // if the value we got for isAlreadyInstalled as null
      yield* alreadyInstalledNotFound()
    }
  } catch (e) {
    // if we did not find any value in user default storage
    // it means that user uninstalled the app and is now trying again
    // or this is a new installation
    yield* alreadyInstalledNotFound()
  }

  // hydrating connections and push token
  yield put(hydrateApp(isAlreadyInstalled))
  yield* appHydration({ isAlreadyInstalled })
  yield* hydrateSwitchedEnvironmentDetails()
  yield* hydrateOnUseVcx()
  yield put(hydrated())
}

export const vcxInitStart = () => ({
  type: VCX_INIT_START,
})

export const vcxInitSuccess = () => ({
  type: VCX_INIT_SUCCESS,
})

export const vcxInitFail = (error: CustomError) => ({
  type: VCX_INIT_FAIL,
  error,
})

export const vcxInitReset = () => ({
  type: VCX_INIT_NOT_STARTED,
})

export function* ensureAppHydrated(): Generator<*, *, *> {
  const isHydrated = yield select(getHydrationState)
  if (!isHydrated) {
    yield take(HYDRATED)
  }
}

export function* initVcx(): Generator<*, *, *> {
  yield* ensureAppHydrated()

  // Since we have added a feature flag, so we need to wait
  // to know that user is going to enable the feature flag or not
  // now problem is how do we know when to stop waiting
  // so we are assuming that whenever user goes past lock-selection
  // screen, that means now user can't enable feature flag
  // because there is no way to enable that flag now
  const currentScreen: string = yield select(getCurrentScreen)
  if (UNSAFE_SCREENS_TO_DOWNLOAD_SMS.indexOf(currentScreen) > -1) {
    // user is on screens where he has chance to change environment details
    // so we wait for event which tells that we are safe
    yield take(SAFE_TO_DOWNLOAD_SMS_INVITATION)
  }

  // check if we already have user one time info
  // if we already have one time info, that means we don't have to register
  // with agency again, and we can just raise success action for VCX_INIT
  let userOneTimeInfo: UserOneTimeInfo = yield select(getUserOneTimeInfo)
  const {
    agencyUrl,
    agencyDID,
    agencyVerificationKey,
    poolConfig,
  }: ConfigStore = yield select(getConfig)
  const agencyConfig = {
    agencyUrl,
    agencyDID,
    agencyVerificationKey,
    poolConfig,
  }

  if (!userOneTimeInfo) {
    // app is hydrated, but we haven't got user one time info
    // so now we go ahead and create user one time info
    try {
      userOneTimeInfo = yield call(createOneTimeInfo, agencyConfig)
      yield put(connectRegisterCreateAgentDone(userOneTimeInfo))
    } catch (e) {
      yield put(vcxInitFail(ERROR_VCX_PROVISION_FAIL(e.message)))

      return
    }
  }

  // once we reach here, we are sure that either user one time info is loaded from disk
  // or we provisioned one time agent for current user if not already available
  try {
    yield call(
      init,
      {
        ...userOneTimeInfo,
        ...agencyConfig,
      },
      getGenesisFileName(agencyUrl)
    )
    yield put(vcxInitSuccess())
  } catch (e) {
    yield put(vcxInitFail(ERROR_VCX_INIT_FAIL(e.message)))
  }
}

export const getGenesisFileName = (agencyUrl: string) => {
  return (
    GENESIS_FILE_NAME +
    '_' +
    findKey(baseUrls, environment => environment.agencyUrl === agencyUrl)
  )
}

export function* watchVcxInitStart(): any {
  yield takeLatest(VCX_INIT_START, initVcx)
}

export function* ensureVcxInitSuccess(): Generator<*, *, *> {
  // vcx init ensures that
  // -- app is hydrated
  // -- user one time info is available
  // -- vcx initialization was success

  const vcxInitializationState = yield select(getVcxInitializationState)
  if (vcxInitializationState === VCX_INIT_SUCCESS) {
    // if already initialized, no need to process further
    return
  }

  if ([VCX_INIT_NOT_STARTED, VCX_INIT_FAIL].includes(vcxInitializationState)) {
    // if vcx init not started or vcx init failed and we want to init again
    yield put(vcxInitStart())
  }

  // if we are here, that means we either started vcx init
  // or vcx init was already in progress and now we need to wait for success
  yield take(VCX_INIT_SUCCESS)

  // TODO we could put a logic to retry in case we get a fail event
  // so instead of above statement we can start a race b/w fail and success action
  // and then if we get fail, we can retry with exponential backoff
}

export function* watchConfig(): any {
  yield all([
    watchSwitchErrorAlerts(),
    watchSwitchEnvironment(),
    hydrateConfig(),
    watchChangeEnvironmentUrl(),
    watchOnUseVcx(),
    watchVcxInitStart(),
  ])
}

export const getEnvironmentName = (configStore: ConfigStore) => {
  const { agencyUrl } = configStore

  return findKey(baseUrls, environment => environment.agencyUrl === agencyUrl)
}

export const useVcx = () => ({
  type: USE_VCX,
})

export default function configReducer(
  state: ConfigStore = initialState,
  action: ConfigAction
) {
  switch (action.type) {
    case SERVER_ENVIRONMENT_CHANGED:
      const urls = baseUrls[action.serverEnvironment]
      return {
        ...state,
        ...urls,
      }
    case ALREADY_INSTALLED_RESULT:
      return {
        ...state,
        isAlreadyInstalled: action.isAlreadyInstalled,
      }
    case HYDRATED:
      return {
        ...state,
        isHydrated: true,
      }
    case APP_INSTALLED:
      return {
        ...state,
        isAlreadyInstalled: true,
      }
    case TOGGLE_ERROR_ALERTS:
      return {
        ...state,
        showErrorAlerts: action.isShowErrorAlert,
      }
    case SWITCH_ENVIRONMENT:
      return {
        ...state,
        poolConfig: action.poolConfig,
        agencyDID: action.agencyDID,
        agencyVerificationKey: action.agencyVerificationKey,
        agencyUrl: action.agencyUrl,
      }
    case VCX_INIT_NOT_STARTED:
      return {
        ...state,
        vcxInitializationState: VCX_INIT_NOT_STARTED,
        vcxInitializationError: null,
      }
    case VCX_INIT_START:
      return {
        ...state,
        vcxInitializationState: VCX_INIT_START,
        vcxInitializationError: null,
      }
    case VCX_INIT_SUCCESS:
      return {
        ...state,
        vcxInitializationState: VCX_INIT_SUCCESS,
      }
    case VCX_INIT_FAIL:
      return {
        ...state,
        vcxInitializationState: VCX_INIT_FAIL,
        vcxInitializationError: action.error,
      }
    case USE_VCX:
      return {
        ...state,
        useVcx: true,
      }
    default:
      return state
  }
}
