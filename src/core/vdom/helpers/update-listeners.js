/* @flow */

import { warn } from 'core/util/index'
import { cached, isUndef, isPlainObject } from 'shared/util'

// 解析vue在jsx下的事件名
const normalizeEvent = cached((name: string): {
  name: string,
  once: boolean,
  capture: boolean,
  passive: boolean,
  handler?: Function,
  params?: Array<any>
} => {
  // jsx写法中是否有passiv标识
  const passive = name.charAt(0) === '&' 
  name = passive ? name.slice(1) : name
  // 是否once
  const once = name.charAt(0) === '~' // Prefixed last, checked first
  name = once ? name.slice(1) : name
  // 是否捕获阶段
  const capture = name.charAt(0) === '!'
  name = capture ? name.slice(1) : name
  return {
    name,
    once,
    capture,
    passive
  }
})

// 组织如何执行同一个事件的多个句柄
export function createFnInvoker (fns: Function | Array<Function>): Function {
  // 句柄执行函数
  function invoker () {
    const fns = invoker.fns
    if (Array.isArray(fns)) {
      const cloned = fns.slice()
      for (let i = 0; i < cloned.length; i++) {
        cloned[i].apply(null, arguments)
      }
    } else {
      // return handler return value for single handlers
      return fns.apply(null, arguments)
    }
  }
  // 句柄数组存储在这
  invoker.fns = fns
  return invoker
}
// 更新组件事件句柄
export function updateListeners (
  // 新事件句柄
  on: Object, 
  // 旧事件句柄
  oldOn: Object,
  // 更新时的增加方法
  add: Function,
  // 更新时的删除方法
  remove: Function,
  vm: Component
) {
  let name, def, cur, old, event
  for (name in on) {
    def = cur = on[name]
    old = oldOn[name]
    event = normalizeEvent(name)
    /* istanbul ignore if */
    if (__WEEX__ && isPlainObject(def)) {
      cur = def.handler
      event.params = def.params
    }
    if (isUndef(cur)) {
      process.env.NODE_ENV !== 'production' && warn(
        `Invalid handler for event "${event.name}": got ` + String(cur),
        vm
      )
    } else if (isUndef(old)) {
      if (isUndef(cur.fns)) {
        // 创建invoker，批量执行回调
        cur = on[name] = createFnInvoker(cur)
      }
      // 用$on()注册这个invoker
      add(event.name, cur, event.once, event.capture, event.passive, event.params)
    } else if (cur !== old) {
      // old一定是invoker方法
      // 更新invoker方法持有的回调函数
      old.fns = cur
      on[name] = old
    }
  }
  // 删除废弃的
  for (name in oldOn) {
    if (isUndef(on[name])) {
      event = normalizeEvent(name)
      remove(event.name, oldOn[name], event.capture)
    }
  }
}
