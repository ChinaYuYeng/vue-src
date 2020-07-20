/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

export function initGlobalAPI (Vue: GlobalAPI) {
  // config
  // 全局配置文件
  const configDef = {}
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  Object.defineProperty(Vue, 'config', configDef)

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  // 内部工具方法
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  // 全局方法
  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 初始化基础选项
  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  // 基础构造函数引用
  Vue.options._base = Vue

  // 添加内部组件keep-alive
  extend(Vue.options.components, builtInComponents)

  // 给vue构造函数对象添加函数,也可是理解为静态方法
  // vue.use
  initUse(Vue)
  // vue.mixin
  initMixin(Vue)
  // vue.extend
  initExtend(Vue)
  // vue.component vue.filter vue.directive
  initAssetRegisters(Vue)
}
