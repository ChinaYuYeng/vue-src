/* @flow */

import config from '../config'
import { warn } from './debug'
import { inBrowser, inWeex } from './env'

// 这个方法会配合try...catch...代码块分散到组件的各个细节中去，一旦catch到错误就会调用该方法，沿着组件往上报告
export function handleError (err: Error, vm: any, info: string) {
  if (vm) {
    let cur = vm
    // while是逐级寻找父级，并且调用父级的errorCaptured（如果有的话），如果父级的errorCaptured返回false的话，会阻止进一步的往上传递
    // 选项 errorCaptured 是父组件处理子组件的错误
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

// 调用全局配置的errorhandle，如果没有就往控制台抛
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

// 往控制台抛错误，会显示2种类型的错误，一种是vue自有的风格。另一个是浏览器的风格
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
