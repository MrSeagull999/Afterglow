import type { Version } from './types'

function toSortableTimestamp(v: Version): number | null {
  if (typeof v.startedAt === 'number' && Number.isFinite(v.startedAt)) return v.startedAt
  const t = Date.parse(v.createdAt)
  if (Number.isFinite(t)) return t
  return null
}

export function orderVersionsOldestFirst(versions: Version[]): Version[] {
  return versions
    .map((v, idx) => ({ v, idx, t: toSortableTimestamp(v) }))
    .sort((a, b) => {
      const at = a.t
      const bt = b.t
      if (at === null && bt === null) return a.idx - b.idx
      if (at === null) return 1
      if (bt === null) return -1
      if (at !== bt) return at - bt
      return a.idx - b.idx
    })
    .map((x) => x.v)
}
