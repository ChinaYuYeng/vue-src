/* @flow */

import { addProp } from 'compiler/helpers'

// 处理v-text指令,为什么不用innertext,因为这个性能更好
export default function text (el: ASTElement, dir: ASTDirective) {
  if (dir.value) {
    addProp(el, 'textContent', `_s(${dir.value})`)
  }
}
