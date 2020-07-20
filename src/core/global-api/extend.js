/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { defineComputed, proxy } from '../instance/state'
import { extend, mergeOptions, validateComponentName } from '../util/index'

export function initExtend (Vue: GlobalAPI) {
  /**
   * Each instance constructor, including Vue, has a unique
   * cid. This enables us to create wrapped "child
   * constructors" for prototypal inheritance and cache them.
   * 构造函数唯一标识
   */
  Vue.cid = 0
  let cid = 1

  /**
   * Class inheritance
   * 这里可以理解成子构造函数不断的扩展vue根构造函数，扩展的是用户输入的选项
   * 这里主要做的就是创建一个继承了vue根方法的子方法，合并用户提供的opations后并缓存
   */
  Vue.extend = function (extendOptions: Object): Function {
    extendOptions = extendOptions || {}
    //这个this指向的是这个构造函数对象，函数本身也是一个object，可以有自己的属性，extend由构造函数这个对象调用，this指向的是构造方法对象，这里的构造方法除了vue也可以是任何extend获得的构造方法
    const Super = this 
    const SuperId = Super.cid
    // 缓存的构造函数
    // 设置这个可以达到同一个选项对象在同一个构造方法对象下extend得到的子构造方法是一样的，换一个构造方法extend，因为cid不同，缓存就失效了。或者换了一个选项对象，在相同的构造函数下extend，缓存也是失效的，因为不存在缓存
    // 防止反复生成
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }

    const name = extendOptions.name || Super.options.name
    if (process.env.NODE_ENV !== 'production' && name) {
      validateComponentName(name)
    }

    //VueComponent 和 vue 构造方法几乎是一样的，所以vue实例和组件实例很相似
    const Sub = function VueComponent (options) {
            //实例化时的opations
      this._init(options)
    }
    Sub.prototype = Object.create(Super.prototype) // 使用了vue构造方法的原型
    Sub.prototype.constructor = Sub
    Sub.cid = cid++
        //生成sub的opations
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    )
    Sub['super'] = Super //组件特有的属性

    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.
    // 防止每次实例化都要重新初始化props和computed
    if (Sub.options.props) {
      initProps(Sub)
    }
    if (Sub.options.computed) {
      initComputed(Sub)
    }

    // allow further extension/mixin/plugin usage
        //sub几乎拥有和vue同样的能力和初始化过程
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // create asset registers, so extended classes
    // can have their private assets too.
     // 复制vue.component vue.filter vue.directive
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })
    // enable recursive self-lookup
    if (name) {
      Sub.options.components[name] = Sub
    }

    // keep a reference to the super options at extension time.
    // later at instantiation we can check if Super's options have
    // been updated.
    Sub.superOptions = Super.options//父构造函数最终的opations
    Sub.extendOptions = extendOptions//生成构造函数时用户传入的opatins
    Sub.sealedOptions = extend({}, Sub.options) //当前构造函数最终的opations的缓存

    // cache constructor
    cachedCtors[SuperId] = Sub
    return Sub
  }
}

// 和instance中的initProps的方法名一样，但完全不同，这里只是把访问vm.xxx代理到_props,定义在原型上，以便每个实例不需要带代理一遍
function initProps (Comp) {
  const props = Comp.options.props
  for (const key in props) {
    proxy(Comp.prototype, `_props`, key)
  }
}

// 初始化计算方法，静态定义，避免每个实例都生成一次
function initComputed (Comp) {
  const computed = Comp.options.computed
  for (const key in computed) {
    defineComputed(Comp.prototype, key, computed[key])
  }
}
