/* @flow */

import { extend } from 'shared/util'
import { detectErrors } from './error-detector'
import { createCompileToFunctionFn } from './to-function'

// 这个方法只返回一个闭包引用参数，没有其他逻辑
export function createCompilerCreator (baseCompile: Function): Function {
  // 生成compile和compileToFunctions（这个由createCompileToFunctionFn生成）
  // 这个方法也是返回2个闭包引用参数，没有其他逻辑
  return function createCompiler (baseOptions: CompilerOptions) {
    /**
     * 1、合并基础配置选项与传入的编译选项，生成 finalOptions。
        2、收集编译过程中的错误。
        3、调用基础编译函数 baseCompile。
     * @param {*} template 
     * @param {*} options 
     * 返回编译结果（方法字符串）
     */
    function compile (
      template: string,
      options?: CompilerOptions
    ): CompiledResult {
      const finalOptions = Object.create(baseOptions)
      const errors = []
      const tips = []
      // 收集警告信息
      finalOptions.warn = (msg, tip) => {
        (tip ? tips : errors).push(msg)
      }

      // 合并编译选项
      if (options) {
        // merge custom modules
        // 数组合并
        if (options.modules) {
          finalOptions.modules =
            (baseOptions.modules || []).concat(options.modules)
        }
        // merge custom directives
        // 原型链合并
        if (options.directives) {
          finalOptions.directives = extend(
            Object.create(baseOptions.directives || null),
            options.directives
          )
        }
        // copy other options
        // 其它属性拷贝
        for (const key in options) {
          if (key !== 'modules' && key !== 'directives') {
            finalOptions[key] = options[key]
          }
        }
      }

      // 执行基础编译方法得到结果
      const compiled = baseCompile(template, finalOptions)
      if (process.env.NODE_ENV !== 'production') {
        errors.push.apply(errors, detectErrors(compiled.ast))
      }
      // 结果带上警告错误消息
      compiled.errors = errors
      compiled.tips = tips
      /**
       * compiled结果
       * {
            ast,
            render: code.render,
            staticRenderFns: code.staticRenderFns
          }
       */
      return compiled
    }

    return {
      compile,
      compileToFunctions: createCompileToFunctionFn(compile)
    }
  }
}
