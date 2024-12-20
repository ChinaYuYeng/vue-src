/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

// 给原型添加初始化方法
export function initMixin (Vue: Class<Component>) {
  //vue和vuecomponent实例化都会调用init初始化
  //init的目的就是生成opations，初始化vm的属性
  Vue.prototype._init = function (options?: Object) { 
    const vm: Component = this
    // a uid
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    //是否vue实例
    vm._isVue = true
    // merge options
    //初始化合并选项
    if (options && options._isComponent) {
      // 在设置了_isComponent（这个在组件vnode创建vm的时候会使用）的时候会优化选项合并。
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      initInternalComponent(vm, options)
    } else {
      // 使用对应的策略合并各个vue选项
      // 这个else分支只是针对 new Vue()的情况，因此这里没有initInternalComponent里面设置的_parent等属性
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor), //收集构造方法上所有opations，合成最终的opations，包含extend方法扩展的opations
        options || {}, //实例化时传入的opations
        vm
      )
    }
    /* istanbul ignore else */
   //只在开发环境代理，代理has或者get方法
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    // 以下通过$opations中的值给vm设置或者初始化属性
    initLifecycle(vm)
    initEvents(vm)
    initRender(vm)
    //调用生命周期 beforeCreate
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data/props
    initState(vm) // 这里初始化了大部分常见的属性
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created') //创建好所有vm属性之后才调用created钩子

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    if (vm.$options.el) {
    // 如果设置了el会在初始化后就进行挂载
      vm.$mount(vm.$options.el)
    }
  }
}

//直接合并组件的选项，从父vnode的componentOptions里获取选项数据
// 这种情况一般是组件节点在创建vm的时候，对于vm选项合并的优化，因为合并太费时间。而组件节点创建vm是一个统一的过程，不需要特殊处理
// 这种基于原型链的方式合并选项更高效
export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode
  opts._parentElm = options._parentElm
  opts._refElm = options._refElm

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

//提取这个vm构造方法上所有的选项，为什么要这么干，因为全局mixin会改变父构造方法的选项，导致父级改变了
export function resolveConstructorOptions (Ctor: Class<Component>) {
  //方法本身是个对象
  let options = Ctor.options 
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super) //递归所有的父级选项
    const cachedSuperOptions = Ctor.superOptions
    //父构造函数选项有变化
    //判断是不是原来的对象
    if (superOptions !== cachedSuperOptions) { 
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)//进入extendOptions的选项会一直被保留
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        //options下的组件选项中有该vue实例的构造方法
        options.components[options.name] = Ctor 
      }
    }
  }
  return options
}
//获得新增的选项
function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options //当前构造方法的opations，比较的目的可能是生成之后被改过
  const extended = Ctor.extendOptions //生成构造函数时用户提供的opations
  const sealed = Ctor.sealedOptions //生成构造方法时缓存的最终的opations，可以看vue.extend方法的逻辑
  for (const key in latest) {
    //2个不是同一个对象，内部去重
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = dedupe(latest[key], extended[key], sealed[key])
    }
  }
  return modified
}

//去重
function dedupe (latest, extended, sealed) {
  // compare latest and sealed to ensure lifecycle hooks won't be duplicated
  // between merges
  if (Array.isArray(latest)) {
    const res = []
    sealed = Array.isArray(sealed) ? sealed : [sealed]
    extended = Array.isArray(extended) ? extended : [extended]
    for (let i = 0; i < latest.length; i++) {
      // push original options and not sealed options to exclude duplicated options
      if (extended.indexOf(latest[i]) >= 0 || sealed.indexOf(latest[i]) < 0) {
        res.push(latest[i])
      }
    }
    return res
  } else {
    return latest
  }
}
