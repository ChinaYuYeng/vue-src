/* @flow */

let decoder

export default {
  decode (html: string): string {
    decoder = decoder || document.createElement('div')
    decoder.innerHTML = html
    // 返回div下的的文本节点的内容拼接
    return decoder.textContent
  }
}
