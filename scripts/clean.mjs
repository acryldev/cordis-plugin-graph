import { rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

rmSync(resolve(dirname(dirname(fileURLToPath(import.meta.url))), 'lib'), { force: true, recursive: true })
