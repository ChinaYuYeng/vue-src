/* @flow */

import config from '../config'
import { warn } from './debug'
import { inBrowser, inWeex } from './env'

// 这个方法会配合try...catch...代码块分散到组件的各个细节中去，一旦catch到错误就会调用该方法，沿着组件往上报告
export function handleError (err: Error, vm: any, info: string) {
  if (vm) {
    let cur = vm
    // while是逐级寻找父级，并且调用父级的errorCaptured（如果有的话），如果父级的errorCaptured返回true的话，会阻止进一步的往上传递
    while ((cur = cur.$parent)) {
      const hooks = cur.$options.errorCaptured
      if (hooks) {
        for (let i = 0; i < hooks.length; i++) {
          try {
            const capture = hooks[i].call(cur, err, vm, info) === false
            if (capture) return
          } catch (e) {
            globalHandleError(e, cur, 'errorCaptured hook')
          }
        }
      }
    }
  }
  globalHandleError(err, vm, info)
}

function globalHandleError (err, vm, info) {
  if (config.errorHandler) {
    try {
      return config.errorHandler.call(null, err, vm, info)
    } catch (e) {
      logError(e, null, 'config.errorHandler')
    }
  }
  logError(err, vm, info)
}

function logError (err, vm, info) {
  if (process.env.NODE_ENV !== 'production') {
    warn(`Error in ${info}: "${err.toString()}"`, vm)
  }
  /* istanbul ignore else */
  if ((inBrowser || inWeex) && typeof console !== 'undefined') {
    console.error(err)
  } else {
    throw err
  }
}
