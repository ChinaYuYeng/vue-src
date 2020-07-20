/* @flow */

import { baseOptions } from './options'
import { createCompiler } from 'compiler/index'

// web环境下的编译器
const { compile, compileToFunctions } = createCompiler(baseOptions)

export { compile, compileToFunctions }
