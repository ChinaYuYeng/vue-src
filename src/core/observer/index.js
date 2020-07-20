/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 * 是否打开创建观察者
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that has this object as root $data

  constructor (value: any) {//进来的值必须是对象，因此被监听的对象或者数组（包括子对象或子数组）都有一个ob对象
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0
    def(value, '__ob__', this)
    if (Array.isArray(value)) {
    	//监听数组，更换poto
      const augment = hasProto
        ? protoAugment
        : copyAugment
      augment(value, arrayMethods, arrayKeys)
      this.observeArray(value)
    } else {
    	//遍历对象监听数据
      this.walk(value)
    }
  }

  /**
   * Walk through each property and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   * 只有对象类型才执行，遍历对象监听属性
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   * 遍历数组每个元素，每个元素又从头开始
   */
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment an target Object or Array by intercepting
 * the prototype chain using __proto__
 * 使用poto方式监听数组
 */
function protoAugment (target, src: Object, keys: any) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment an target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 * 给对象创建观察者，或者直接返回已有的
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  //必须是object或者array，同时不是vnode
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    // 是否开启创建观察者
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.

 * 定义对象的每个属性的getter和setter

 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean //是否浅劫持属性
) {
  const dep = new Dep() //每个array，obj都持有这个

  const property = Object.getOwnPropertyDescriptor(obj, key) //看看是不是原先就有属性定义，这个属性定义有可能是已经被劫持过的对象（多数情况），除非你自己设置的get，set，当时会极大的干扰框架处理
  if (property && property.configurable === false) {
    //从这里看，我可以设置不可配置属性来阻止属性响应式
    return
  }

  // cater for pre-defined getter/setters
  const getter = property && property.get
  //如果getter没有，并且只有2个参数，val就去obj获取
  if (!getter && arguments.length === 2) {
    val = obj[key]
  }
  const setter = property && property.set

	//递归子对象
  let childOb = !shallow && observe(val)
  
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      //getter获得的值，这里不在进一步收集，处理。这个getter可能是之前已经劫持 了，也有可能用户自定义了getter
      const value = getter ? getter.call(obj) : val
      if (Dep.target) {
        dep.depend() //这里的这个属性，这个属性的子属性都是在这里和渲染watch绑定了关系
        if (childOb) {
        	//这里收集的是数组或者对象的依赖，在数组的方法中会触发相应的notify，
        	//如果是对象的话，在set（line：213）方法里被notify，比如给对象增加了一个新属性
          childOb.dep.depend()
          if (Array.isArray(value)) {
          	//这里是收集数组元素的依赖
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      // 前后值相同是不会赋值触发dep的
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        //自定义setter
        customSetter()
      }
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      //新进的对象，增加监听
      childOb = !shallow && observe(newVal)
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  //如果是数组
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)//为什么不用target[key]？因为splice会notify通知watcher
    return val
  }
  //如果已经有了,就直接触发已建立的监听关系
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  //vm实例，$data对象是不行的，建议直接在data里声明，isvue是vue实例，ob是observe对象，
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  //非劫持对象，直接赋值
  if (!ob) {
    target[key] = val
    return val
  }
  //劫持对象,监听新属性
  defineReactive(ob.value, key, val)
  //在这对象的ob的dep被触发,不是数组
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 * 和set方法相对
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  //如果是数组，直接使用splice触发监听
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  //自身没有这个属性
  if (!hasOwn(target, key)) {
    return
  }
  //删除属性
  delete target[key]
  if (!ob) {
    return
  }
  //只有对象的_ob_被触发，不是数组
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 * 收集数组每个元素的依赖，如果他有的话
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()//收集array或者object的依赖
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
