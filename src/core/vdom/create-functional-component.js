/* @flow */

import VNode, { cloneVNode } from './vnode'
import { createElement } from './create-element'
import { resolveInject } from '../instance/inject'
import { normalizeChildren } from '../vdom/helpers/normalize-children'
import { resolveSlots } from '../instance/render-helpers/resolve-slots'
import { installRenderHelpers } from '../instance/render-helpers/index'

import {
  isDef,
  isTrue,
  hasOwn,
  camelize,
  emptyObject,
  validateProp
} from '../util/index'

// 创建函数式组件的上下文
export function FunctionalRenderContext (
  data: VNodeData,
  props: Object,
  children: ?Array<VNode>,
  // 这个parent是持有函数式组件的vm
  parent: Component,
  // 函数式组件的构造函数
  Ctor: Class<Component>
) {
  const options = Ctor.options
  // ensure the createElement function in functional components
  // gets a unique context - this is necessary for correct named slot check
  let contextVm
  if (hasOwn(parent, '_uid')) {
    // uid是vm的特征属性
    contextVm = Object.create(parent)
    // $flow-disable-line
    contextVm._original = parent
  } else {
    // the context vm passed in is a functional context as well.
    // in this case we want to make sure we are able to get a hold to the
    // real context instance.
    // 函数式组件套函数式组件，他们的contentvm都是同一个
    contextVm = parent
    // $flow-disable-line
    parent = parent._original
  }
  const isCompiled = isTrue(options._compiled)
  const needNormalization = !isCompiled

  this.data = data
  this.props = props
  this.children = children
  this.parent = parent
  this.listeners = data.on || emptyObject
  this.injections = resolveInject(options.inject, parent)
  this.slots = () => resolveSlots(children, parent)

  // support for compiled functional template
  if (isCompiled) {
    // exposing $options for renderStatic()
    this.$options = options
    // pre-resolve slots for renderSlot()
    this.$slots = this.slots()
    this.$scopedSlots = data.scopedSlots || emptyObject
  }

  if (options._scopeId) {
    this._c = (a, b, c, d) => {
      const vnode = createElement(contextVm, a, b, c, d, needNormalization)
      if (vnode && !Array.isArray(vnode)) {
        vnode.fnScopeId = options._scopeId
        vnode.fnContext = parent
      }
      return vnode
    }
  } else {
    this._c = (a, b, c, d) => createElement(contextVm, a, b, c, d, needNormalization)
  }
}

installRenderHelpers(FunctionalRenderContext.prototype)

// 创建函数化组件返回vnode，或者vnode数组（返回的都是clone节点）
export function createFunctionalComponent (
  Ctor: Class<Component>,
  propsData: ?Object,
  data: VNodeData,
  contextVm: Component,
  children: ?Array<VNode>
): VNode | Array<VNode> | void {
  const options = Ctor.options
  const props = {}
  // 组件定义的props
  const propOptions = options.props
  if (isDef(propOptions)) {
    for (const key in propOptions) {
      // 获得props这个属性对应的值，不是props设定的校验，名称有点迷惑人
      props[key] = validateProp(key, propOptions, propsData || emptyObject)
    }
  } else {
    // 组件没有定义props，直接copy
    // 在 2.3.0 之前的版本中，如果一个函数式组件想要接受 props，则 props 选项是必须的。在 2.3.0 或以上的版本中，你可以省略 props 选项，所有组件上的特性都会被自动解析为 props。
    if (isDef(data.attrs)) mergeProps(props, data.attrs)
    if (isDef(data.props)) mergeProps(props, data.props)
  }

  // 函数式组件的渲染上下文
  const renderContext = new FunctionalRenderContext(
    data,
    props,
    children,
    contextVm,
    // 创建函数式组件的构造函数
    Ctor
  )

  // 调用函数组件的渲染方法
  // render内部没有this，只有renderContext上下文
  const vnode = options.render.call(null, renderContext._c, renderContext)

  if (vnode instanceof VNode) {
    return cloneAndMarkFunctionalResult(vnode, data, renderContext.parent, options)
  } else if (Array.isArray(vnode)) {
    const vnodes = normalizeChildren(vnode) || []
    const res = new Array(vnodes.length)
    for (let i = 0; i < vnodes.length; i++) {
      res[i] = cloneAndMarkFunctionalResult(vnodes[i], data, renderContext.parent, options)
    }
    return res
  }
}

// 复制节点设置上下文，还有选项
function cloneAndMarkFunctionalResult (vnode, data, contextVm, options) {
  // #7817 clone node before setting fnContext, otherwise if the node is reused
  // (e.g. it was from a cached normal slot) the fnContext causes named slots
  // that should not be matched to match.
  const clone = cloneVNode(vnode)
  clone.fnContext = contextVm
  clone.fnOptions = options
  if (data.slot) {
    (clone.data || (clone.data = {})).slot = data.slot
  }
  return clone
}

function mergeProps (to, from) {
  for (const key in from) {
    to[camelize(key)] = from[key]
  }
}
