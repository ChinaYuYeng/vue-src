/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
// 科里化创建Compiler，好处是可以延迟传递参数，因为这里的参数不同的平台而不同
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
  // 这个options是finaloptions
  const ast = parse(template.trim(), options)
  if (options.optimize !== false) {
    // 优化ast树，主要是标记静态节点
    optimize(ast, options)
  }
  // 生成render渲染函数字符串
  const code = generate(ast, options)
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
