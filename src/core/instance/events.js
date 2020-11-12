/* @flow */

import {
  tip,
  toArray,
  hyphenate,
  handleError,
  formatComponentName
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'

// 初始化事件
export function initEvents (vm: Component) {
  // 这个events的结构是{key:[invoker,invoker,fn]},invoker是批量执行事件回调函数的函数（框架生成）,fn可能是用户注册的回调函数
  // 这个events是所有可执行事件，不是$listeners也就是options._parentListeners是父组件设置到子组件的事件
  vm._events = Object.create(null)
  vm._hasHookEvent = false
  // init parent attached events
  // 添加父组件给子组件设置的事件句柄，例如@click=‘test’
  const listeners = vm.$options._parentListeners
  if (listeners) {
    // 把父组件给子组件设置的事件句柄添加到子组件中
    updateComponentListeners(vm, listeners)
  }
}

let target: any

// 绑定新事件
function add (event, fn, once) {
  if (once) {
    target.$once(event, fn)
  } else {
    target.$on(event, fn)
  }
}

// 删除旧事件
function remove (event, fn) {
  target.$off(event, fn)
}

// 更新组件事件句柄
export function updateComponentListeners (
  vm: Component,
  listeners: Object,
  oldListeners: ?Object
) {
  target = vm
  updateListeners(listeners, oldListeners || {}, add, remove, vm)
  target = undefined
}

// 增加事件相关的操作函数
export function eventsMixin (Vue: Class<Component>) {
  const hookRE = /^hook:/
  // 注册事件
  Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component {
    const vm: Component = this
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        this.$on(event[i], fn)
      }
    } else {
      (vm._events[event] || (vm._events[event] = [])).push(fn)
      // optimize hook:event cost by using a boolean flag marked at registration
      // instead of a hash lookup
      // 用一个标记来代替对象哈希查找（就是通过vm._events[event]查找），2
      // 使用$on或者$once等在运行时注册的生命周期钩子函数
      if (hookRE.test(event)) {
        vm._hasHookEvent = true
      }
    }
    return vm
  }

  // 注册一次事件
  Vue.prototype.$once = function (event: string, fn: Function): Component {
    const vm: Component = this
    function on () {
      vm.$off(event, on)
      fn.apply(vm, arguments)
    }
    on.fn = fn
    vm.$on(event, on)
    return vm
  }

  Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
    const vm: Component = this
    // all
    // 移除所有
    if (!arguments.length) {
      vm._events = Object.create(null)
      return vm
    }
    // array of events
    // 逐个移除
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        this.$off(event[i], fn)
      }
      return vm
    }
    // specific event
    const cbs = vm._events[event]
    if (!cbs) {
      return vm
    }
    // 移除事件回调函数
    if (!fn) {
      vm._events[event] = null
      return vm
    }
    // 移除指定的事件回调函数
    if (fn) {
      // specific handler
      let cb
      let i = cbs.length
      while (i--) {
        cb = cbs[i]
        if (cb === fn || cb.fn === fn) {
          cbs.splice(i, 1)
          break
        }
      }
    }
    return vm
  }

	//依次调用数组中的cb
  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this
    if (process.env.NODE_ENV !== 'production') {
      const lowerCaseEvent = event.toLowerCase()
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(event)}" instead of "${event}".`
        )
      }
    }
    let cbs = vm._events[event]
    if (cbs) {
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      // 这里可以看出emit可以传递很多参数
      const args = toArray(arguments, 1)
      for (let i = 0, l = cbs.length; i < l; i++) {
        try {
          cbs[i].apply(vm, args)
        } catch (e) {
          handleError(e, vm, `event handler for "${event}"`)
        }
      }
    }
    return vm
  }
}
