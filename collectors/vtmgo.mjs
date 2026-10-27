// Collects the VTM channel schedules from VTM's own public TV guide. No account or login is needed.
// Usage: node collectors/vtmgo.mjs vtmgo.json
// It only reads programme information (titles, times, descriptions, genres, images), never video streams.
import { writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const BASE = process.env.VTM_WWW || 'https://vtm.be'
const UA = 'belgian-tv-guide/1.0 (personal use)'
const out = process.argv[2] || 'vtmgo.json'
const OURS = ['vtm', 'vtm2', 'vtm3', 'vtm4', 'vtmgold', 'vtmxmas']
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const brusselsDate = ts => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels' }).format(new Date(ts))
const authId = randomUUID()

async function getDay (date) {
  const res = await fetch(`${BASE}/tv-gids/api/v2/broadcasts/${date}`, {
    headers: { accept: 'application/json', 'user-agent': UA, cookie: 'authId=' + authId }
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = await res.json().catch(() => null)
  if (!j || !Array.isArray(j.channels)) throw new Error('unexpected response (no channel list)')
  return j.channels
}

function toProgramme (b) {
  const s = Math.floor(Number(b.from) / 1000), e = Math.floor(Number(b.to) / 1000)
  if (!b.title || b.title === 'Geen uitzending' || !(s > 0) || !(e > s)) return null
  const p = { s, e, t: String(b.title) }
  if (b.synopsis) p.d = String(b.synopsis).slice(0, 160)
  const g = (b.subGenres && b.subGenres[0]) || b.genre; if (g) p.g = String(g)
  if (b.imageUrl) p.i = String(b.imageUrl)
  return p
}

try {
  const dates = [-1, 0, 1, 2].map(o => brusselsDate(Date.now() + o * 86400000))
  const channels = Object.fromEntries(OURS.map(id => [id, []]))
  const seen = new Set()
  for (const date of dates) {
    try {
      const list = await getDay(date)
      for (const c of list) seen.add(`${c.seoKey}`)
      let n = 0
      for (const c of list) {
        const id = OURS.find(x => x === norm(c.seoKey) || x === norm(c.name))
        if (!id) continue
        for (const b of c.broadcasts || []) { const p = toProgramme(b); if (p) { channels[id].push(p); n++ } }
      }
      console.log(`${date}: ${list.length} channels in the guide, ${n} programmes for ours`)
    } catch (e) { console.log(`${date}: ${e.message}`) }
  }
  for (const id of OURS) {
    const a = channels[id]
    a.sort((x, y) => x.s - y.s)
    channels[id] = a.filter((p, k) => k === 0 || p.s !== a[k - 1].s)
    const f = channels[id][0]
    console.log(`${id}: ${channels[id].length} programmes` + (f ? `, first "${f.t}" at ${new Date(f.s * 1000).toISOString()}, image: ${f.i ? 'yes' : 'no'}` : ''))
  }
  const total = OURS.reduce((n, id) => n + channels[id].length, 0)
  if (!total) throw new Error('no programmes found; channels in the guide: ' + [...seen].join(', ').slice(0, 300))
  writeFileSync(out, JSON.stringify({ fetched: new Date().toISOString(), channels }))
  console.log('VTM: saved ' + total + ' programmes')
} catch (e) {
  console.error('VTM collector failed: ' + e.message)
  process.exit(1)
}
