/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype
//根据数组原型，创建一个对象，避免污染原型方法，需要监听的数组，让他的原型指向这个对象
export const arrayMethods = Object.create(arrayProto)

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 * 拦截原生数组方法
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]
  //依次个这个对象添加自定义方法
  def(arrayMethods, method, function mutator (...args) {
  	//不忘调用原来的方法
    const result = original.apply(this, args)
    //经过observer内部必有一个ob对象
    const ob = this.__ob__
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    //对新插入的值进行监听
    if (inserted) ob.observeArray(inserted)
    // notify change
    //这里是通知watcher，这里的依赖通过ob.dep.depend 收集(在getter方法里，childob) 和对象属性有点区别
    ob.dep.notify()
    return result
  })
})
