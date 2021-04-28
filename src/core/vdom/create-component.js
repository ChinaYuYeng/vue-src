/* @flow */

import VNode from './vnode'
import { resolveConstructorOptions } from 'core/instance/init'
import { queueActivatedComponent } from 'core/observer/scheduler'
import { createFunctionalComponent } from './create-functional-component'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isObject
} from '../util/index'

import {
  resolveAsyncComponent,
  createAsyncPlaceholder,
  extractPropsFromVNodeData
} from './helpers/index'

import {
  callHook,
  activeInstance,
  updateChildComponent,
  activateChildComponent,
  deactivateChildComponent
} from '../instance/lifecycle'

import {
  isRecyclableComponent,
  renderRecyclableComponentTemplate
} from 'weex/runtime/recycle-list/render-component-template'

// inline hooks to be invoked on component VNodes during patch
// 组件vnode生命周期钩子
//整个页面在第一个vue实例后，有右边的交替创建的过程来构建整个程序 vm —— vm.$mounted —— renderwatcher -- vnode -- patch -- vnodecomponent（init钩子）--vm -- vm.$mounted .....
const componentVNodeHooks = {
  // 创建vm，并且挂载
  init (
    vnode: VNodeWithData,
    hydrating: boolean,
    parentElm: ?Node,
    refElm: ?Node
  ): ?boolean {
    if (
      vnode.componentInstance &&
      !vnode.componentInstance._isDestroyed &&
      vnode.data.keepAlive
    ) {
      // 如果是keepalvie节点，那么直接更新持有的vm
      // kept-alive components, treat as a patch
      const mountedNode: any = vnode // work around flow
      componentVNodeHooks.prepatch(mountedNode, mountedNode)
    } else {
      // 这个child不知道是什么时候赋值给vnode的
      const child = vnode.componentInstance = createComponentInstanceForVnode(
        // 这个vnode是vm的parentvnode,也是_vnode的parent
        vnode,
        // 当前激活的vm，是新创建vm的父vm
        activeInstance,
        parentElm,
        refElm
      )
      // 第一次￥mount时hydrating是false，因为真实dom还不知道（子节点的dom还没创建）,在该vm的渲染方法结束，并且patch之后￥el才会被赋值成patch的返回结果。
      // 换句话说这里不是￥mount完成挂载，而是由patch完成的挂载
      // ￥el和elm是一回事
      child.$mount(hydrating ? vnode.elm : undefined, hydrating)
    }
  },

  // 更新组件节点内部对应的vm
  prepatch (oldVnode: MountedComponentVNode, vnode: MountedComponentVNode) {
    const options = vnode.componentOptions
    // 这个component vnode对应的vm。也等同于vnode下的child属性
    // 新建的vnode的componentInstance,在有旧节点的情况下有别于上面的init方法（直接创建），这里是把旧节点的vm赋值给新节点，同时更新vm的属性
    const child = vnode.componentInstance = oldVnode.componentInstance
    // 新的vnode去更新老的vm
    updateChildComponent(
      child,
      options.propsData, // updated props
      options.listeners, // updated listeners
      vnode, // new parent vnode
      options.children // new children
    )
  },

  // 组件mounted或者Activated
  insert (vnode: MountedComponentVNode) {
    const { context, componentInstance } = vnode
    if (!componentInstance._isMounted) {
      componentInstance._isMounted = true
      callHook(componentInstance, 'mounted')
    }
    if (vnode.data.keepAlive) {
      if (context._isMounted) {
        // vue-router#1212
        // During updates, a kept-alive component's child components may
        // change, so directly walking the tree here may call activated hooks
        // on incorrect children. Instead we push them into a queue which will
        // be processed after the whole patch process ended.
        queueActivatedComponent(componentInstance)
      } else {
        activateChildComponent(componentInstance, true /* direct */)
      }
    }
  },

  // 组件vnode destroy钩子 主要操作vm销毁，或者keepalive模式下的非激活
  destroy (vnode: MountedComponentVNode) {
    const { componentInstance } = vnode
    if (!componentInstance._isDestroyed) {
      if (!vnode.data.keepAlive) {
        componentInstance.$destroy()
      } else {
        deactivateChildComponent(componentInstance, true /* direct */)
      }
    }
  }
}

const hooksToMerge = Object.keys(componentVNodeHooks)

// 创建自定义组件vnode，不创建组件内节点。当patch后发现是个组件节点，才会进一步创建vm，重新开启一个vm创建过程
export function createComponent (
  Ctor: Class<Component> | Function | Object | void,
  data: ?VNodeData,
  context: Component,
  // 组件vnode的子元素都是slot的形式
  children: ?Array<VNode>,
  tag?: string
): VNode | Array<VNode> | void {
  if (isUndef(Ctor)) {
    return
  }

  // 这个是function Vue(){}本身
  const baseCtor = context.$options._base

  // plain options object: turn it into a constructor
  if (isObject(Ctor)) {
    // ctor是object，不是构造方法，这里的extend就是vue.extend(obj)
    // 生成一个组件构造方法
    Ctor = baseCtor.extend(Ctor)
  }

  // if at this stage it's not a constructor or an async component factory,
  // reject.
  if (typeof Ctor !== 'function') {
    if (process.env.NODE_ENV !== 'production') {
      warn(`Invalid Component definition: ${String(Ctor)}`, context)
    }
    return
  }

  // async component
  // 异步获得组件构造函数，或者组件定义选项
  let asyncFactory
  if (isUndef(Ctor.cid)) {
    // Ctor在这里可能是返回一个组件的方法，可能是异步或者同步的返回
    asyncFactory = Ctor
    // 根据异步函数获得组件构造方法，如果没有任何构造方法返回，就创建一个异步组件的vnode占位
    // vue-router是使用异步组件的典型案例，但不是用了vue的异步组件逻辑，但是类似，为了控制路由重写了
    Ctor = resolveAsyncComponent(asyncFactory, baseCtor, context)
    if (Ctor === undefined) {
      // return a placeholder node for async component, which is rendered
      // as a comment node but preserves all the raw information for the node.
      // the information will be used for async server-rendering and hydration.
      // 创建占位node
      return createAsyncPlaceholder(
        asyncFactory,
        data,
        context,
        children,
        tag
      )
    }
  }

  data = data || {}

  // resolve constructor options in case global mixins are applied after
  // component constructor creation
  // 重新获取下这个构造方法下的选项，在全局mix下父构造函数有可能被修改选项
  resolveConstructorOptions(Ctor)

  // transform component v-model data into props & events
  // 转换v-model，组件vnode有效
  // 这个选项在官网jsx示例中并没有说明，可以在jsx中v-model可以这样配置
  if (isDef(data.model)) {
    transformModel(Ctor.options, data)
  }

  // extract props
  // 根据组件定义的props，提取给定的值
  // 组件vnode特有，非组件vnode有也是忽略的
  const propsData = extractPropsFromVNodeData(data, Ctor, tag)

  // functional component
  // 返回函数式组件
  if (isTrue(Ctor.options.functional)) {
    return createFunctionalComponent(Ctor, propsData, data, context, children)
  }

  // extract listeners, since these needs to be treated as
  // child component listeners instead of DOM listeners
  // listeners是组件特有的，在vm初始化的时候用于建立vue自己的事件体系
  const listeners = data.on
  // replace with listeners with .native modifier
  // so it gets processed during parent component patch.
  // 在更新组件和非组件的dom事件时统一用的是on的内容定义，nativeon（组件vnode才有的属性，非组件有这个属性也是被忽略的）只是临时工，这个逻辑参看patch，invokeCreateHooks方法
  data.on = data.nativeOn

  if (isTrue(Ctor.options.abstract)) {
    // abstract components do not keep anything
    // other than props & listeners & slot

    // work around flow
    // 抽象组件会丢弃data中的所有数据除了slot
    const slot = data.slot
    data = {}
    if (slot) {
      data.slot = slot
    }
  }

  // install component management hooks onto the placeholder node
  // 只有创建componentvnode才有这些钩子
  // 这些钩子会在特定的时候被调用
  installComponentHooks(data)

  // return a placeholder vnode
  const name = Ctor.options.name || tag
  // 创建一个组件vnode
  // 组件elm在vnode创建时不赋值
  // 和非组件vnode的创建方式，区别非常明显
  /**
   *  vnode = new VNode(
        tag, data, children,
        undefined, undefined, context
      )
      显然 { Ctor, propsData, listeners, tag, children },是组件vnode特有的目的是为了构造vm
      tag，children的位置区别
      data没有区别，data几乎是创建vnode的数据仓库，data参与vnode的整个生命过程
   */

  //  组件vnode的tag会重新命名，真实的tag会存入componentOptions
  const vnode = new VNode(
    `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
    data, undefined, undefined, undefined, context,
    { Ctor, propsData, listeners, tag, children },
    asyncFactory
  )

  // Weex specific: invoke recycle-list optimized @render function for
  // extracting cell-slot template.
  // https://github.com/Hanks10100/weex-native-directive/tree/master/component
  /* istanbul ignore if */
  if (__WEEX__ && isRecyclableComponent(vnode)) {
    return renderRecyclableComponentTemplate(vnode)
  }

  return vnode
}

// 从vnode生成vm
export function createComponentInstanceForVnode (
  vnode: any, // we know it's MountedComponentVNode but flow doesn't
  parent: any, // activeInstance in lifecycle state
  parentElm?: ?Node,
  refElm?: ?Node
): Component {
  // 内部给与组件特有的属性
  const options: InternalComponentOptions = {
    _isComponent: true,
    parent,
    _parentVnode: vnode,
    _parentElm: parentElm || null,
    _refElm: refElm || null
  }
  // check inline-template render functions
  const inlineTemplate = vnode.data.inlineTemplate
  if (isDef(inlineTemplate)) {
    options.render = inlineTemplate.render
    options.staticRenderFns = inlineTemplate.staticRenderFns
  }
  // new component的构造方法
  // componentOptions会在vm的init中合并到options中
  return new vnode.componentOptions.Ctor(options)
}

// 安装（复制）vnode钩子
function installComponentHooks (data: VNodeData) {
  const hooks = data.hook || (data.hook = {})
  for (let i = 0; i < hooksToMerge.length; i++) {
    const key = hooksToMerge[i]
    hooks[key] = componentVNodeHooks[key]
  }
}

// transform component v-model info (value and callback) into
// prop and event handler respectively.
// 分拆v-mode分别给props赋值，还有添加事件
// 一般用于组件
function transformModel (options, data: any) {
  // model选项配置 默认是value和input
  const prop = (options.model && options.model.prop) || 'value'
  const event = (options.model && options.model.event) || 'input'
  ;(data.props || (data.props = {}))[prop] = data.model.value
  const on = data.on || (data.on = {})
  if (isDef(on[event])) {
    on[event] = [data.model.callback].concat(on[event])
  } else {
    on[event] = data.model.callback
  }
}
