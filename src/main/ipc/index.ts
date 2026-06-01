import { registerJobHandlers } from './jobHandlers'
import { registerVersionHandlers } from './versionHandlers'
import { registerLibraryHandlers } from './libraryHandlers'
import { registerModuleHandlers } from './moduleHandlers'

export function registerAllHandlers(): void {
  registerJobHandlers()
  registerVersionHandlers()
  registerLibraryHandlers()
  registerModuleHandlers()
}

export {
  registerJobHandlers,
  registerVersionHandlers,
  registerLibraryHandlers,
  registerModuleHandlers
}
