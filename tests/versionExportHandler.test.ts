import test from 'node:test'
import assert from 'node:assert/strict'

import { exportVersion } from '../src/main/export/exportVersion'

// We avoid touching real Electron/dialog/fs by injecting deps.

test('Export handler requests save path and writes bytes', async () => {
  const writes: Array<{ path: string; bytes: Buffer }> = []

  const res = await exportVersion({
    jobId: 'j',
    versionId: 'v',
    suggestedName: 'Afterglow_Test',
    deps: {
      showSaveDialog: async (opts) => {
        assert.ok(opts.defaultPath.includes('Afterglow_Test'))
        return { canceled: false, filePath: '/tmp/out.png' }
      },
      getVersion: async (jobId, versionId) => {
        assert.equal(jobId, 'j')
        assert.equal(versionId, 'v')
        return { outputPath: '/tmp/in.png' }
      },
      readFile: async (p) => {
        assert.equal(p, '/tmp/in.png')
        return Buffer.from([1, 2, 3])
      },
      writeFile: async (p, bytes) => {
        writes.push({ path: p, bytes })
      }
    }
  })

  assert.deepEqual(res, { savedPath: '/tmp/out.png' })
  assert.equal(writes.length, 1)
  assert.equal(writes[0].path, '/tmp/out.png')
  assert.deepEqual([...writes[0].bytes], [1, 2, 3])
})

test('Export returns null when version has no outputPath', async () => {
  const res = await exportVersion({
    jobId: 'j',
    versionId: 'v',
    deps: {
      showSaveDialog: async () => ({ canceled: false, filePath: '/tmp/out.png' }),
      getVersion: async () => ({ outputPath: undefined }),
      readFile: async () => Buffer.from([]),
      writeFile: async () => {}
    }
  })

  assert.equal(res, null)
})
