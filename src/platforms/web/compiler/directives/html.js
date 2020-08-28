/* @flow */

import { addProp } from 'compiler/helpers'

// 处理v-html指令,其实就是设置dom属性innerHtml
export default function html (el: ASTElement, dir: ASTDirective) {
  if (dir.value) {
    addProp(el, 'innerHTML', `_s(${dir.value})`)
  }
}
