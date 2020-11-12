/* @flow */

import {
  warn,
  once,
  isDef,
  isUndef,
  isTrue,
  isObject,
  hasSymbol
} from 'core/util/index'

import { createEmptyVNode } from 'core/vdom/vnode'

// 确保返回构造函数，而非object
function ensureCtor (comp: any, base) {
  if (
    comp.__esModule ||
    (hasSymbol && comp[Symbol.toStringTag] === 'Module')
  ) {
    comp = comp.default
  }
  return isObject(comp)
    ? base.extend(comp)
    : comp
}

export function createAsyncPlaceholder (
  factory: Function,
  data: ?VNodeData,
  context: Component,
  children: ?Array<VNode>,
  tag: ?string
): VNode {
  const node = createEmptyVNode()
  node.asyncFactory = factory
  node.asyncMeta = { data, context, children, tag }
  return node
}

export function resolveAsyncComponent (
  factory: Function,
  baseCtor: Class<Component>,
  context: Component
): Class<Component> | void {
  // 返回错误组件
  if (isTrue(factory.error) && isDef(factory.errorComp)) {
    return factory.errorComp
  }

  // 返回用户指定的组件（factory由用户指定可以是异步加载，也可以是同步直接生成）
  if (isDef(factory.resolved)) {
    return factory.resolved
  }

  // 返回加载组件
  if (isTrue(factory.loading) && isDef(factory.loadingComp)) {
    return factory.loadingComp
  }

  if (isDef(factory.contexts)) {
    // already pending
    // 这个异步工厂状态无变更，先缓存vm之后通知刷新
    factory.contexts.push(context)
  } else {
    // 没有状态的factory，或者第一次会在这里初始化异步加载逻辑
    // 一个工厂函数可以关联多个vm实例
    const contexts = factory.contexts = [context]
    // 设置同步，设置同步的目的是防止factory内部不是一个异步获取的过程，是一个同步直接调用resolve()给与一个预先加载或者定义好的组件（如果返回一个promise就一定不是同步的，因为promise的then回调会被推入到microtask），那么就没必要强制刷新
    let sync = true

    // 刷新所有的vm实例回调函数
    const forceRender = () => {
      for (let i = 0, l = contexts.length; i < l; i++) {
        contexts[i].$forceUpdate()
      }
    }

    // 加载成功函数
    const resolve = once((res: Object | Class<Component>) => {
      // cache resolved
      // 确保获得构造函数
      factory.resolved = ensureCtor(res, baseCtor)
      // invoke callbacks only if this is not a synchronous resolve
      // (async resolves are shimmed as synchronous during SSR)
      // 异步才会强制刷新
      if (!sync) {
        forceRender()
      }
    })

    // 加载失败函数
    const reject = once(reason => {
      process.env.NODE_ENV !== 'production' && warn(
        `Failed to resolve async component: ${String(factory)}` +
        (reason ? `\nReason: ${reason}` : '')
      )
      if (isDef(factory.errorComp)) {
        factory.error = true
        forceRender()
      }
    })

    // 执行factory，不返回promise，直接内部处理，返回promise，接着处理
    // 加载组件的逻辑执行
    const res = factory(resolve, reject)

    if (isObject(res)) {
      // 返回一个promise，
      if (typeof res.then === 'function') {
        // () => Promise
        if (isUndef(factory.resolved)) {
          res.then(resolve, reject)
        }
      } else if (isDef(res.component) && typeof res.component.then === 'function') {
        // 返回一个 res有各种组件的普通对象，唯独 component是promise 用于加载远程组件
        /**
         * res:{
          component:'',
          error:'',
          errorComp:''
          loading:'',
          loadingComp:''
          delay:'',
          timeout:''
        }
         *  */ 
        res.component.then(resolve, reject)

        if (isDef(res.error)) {
          // 添加error组件
          factory.errorComp = ensureCtor(res.error, baseCtor)
        }

        if (isDef(res.loading)) {
          // 添加loading组件
          factory.loadingComp = ensureCtor(res.loading, baseCtor)
          if (res.delay === 0) {
            factory.loading = true
          } else {
            // 延迟执行
            setTimeout(() => {
              if (isUndef(factory.resolved) && isUndef(factory.error)) {
                factory.loading = true
                forceRender()
              }
            }, res.delay || 200)
          }
        }

        // 定义超时
        if (isDef(res.timeout)) {
          setTimeout(() => {
            // 到时间没有返回组件，就是超时返回失败
            if (isUndef(factory.resolved)) {
              reject(
                process.env.NODE_ENV !== 'production'
                  ? `timeout (${res.timeout}ms)`
                  : null
              )
            }
          }, res.timeout)
        }
      }
    }

    // 设置异步
    sync = false
    // return in case resolved synchronously
    // 返回的组件 可能undefined
    return factory.loading
      ? factory.loadingComp
      : factory.resolved
  }
}
