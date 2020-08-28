/* @flow */

import { baseOptions } from './options'
import { createCompiler } from 'compiler/index'

// 提供web环境下的编译选项,生成编译器
const { compile, compileToFunctions } = createCompiler(baseOptions)

export { compile, compileToFunctions }
