/* @flow */

// 处理v-bind=‘{}’的情况，不是v-bind:name='{}'，有区别
export default function bind (el: ASTElement, dir: ASTDirective) {
  // 在vnode的data生成字符串的基础上再包装一个_b函数（这个函数是提取v-bind的数据到当前vnode的data中）
  el.wrapData = (code: string) => {
    return `_b(${code},'${el.tag}',${dir.value},${
      dir.modifiers && dir.modifiers.prop ? 'true' : 'false'
    }${
      dir.modifiers && dir.modifiers.sync ? ',true' : ''
    })`
  }
}
