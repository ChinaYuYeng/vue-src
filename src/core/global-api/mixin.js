/* @flow */

import { mergeOptions } from '../util/index'

export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
    // 全局mixin会直接改变vue构造方法上的opations
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
