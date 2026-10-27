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

// The guide's field names are read tolerantly: the first match wins.
const urlOf = v => {
  if (!v) return ''
  if (typeof v === 'string') return /^https?:/.test(v) ? v : ''
  if (Array.isArray(v)) { for (const x of v) { const u = urlOf(x); if (u) return u } return '' }
  return typeof v === 'object' ? urlOf(v.url || v.src || v.href || v.imageUrl || v.large || v.medium || v.default) : ''
}
const nameOf = v => typeof v === 'string' ? v : (v && (v.name || v.title || v.label)) || ''
const shape = (v, d = 0) => v === null ? 'null' : Array.isArray(v) ? (v.length ? [shape(v[0], d + 1)] : []) : typeof v === 'object' ? (d > 2 ? 'object' : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x, d + 1)]))) : typeof v

function toProgramme (b) {
  const s = Math.floor(Number(b.from) / 1000), e = Math.floor(Number(b.to) / 1000)
  if (!b.title || b.title === 'Geen uitzending' || !(s > 0) || !(e > s)) return null
  const p = { s, e, t: String(b.title) }
  if (b.synopsis) p.d = String(b.synopsis).slice(0, 160)
  const st = b.episodeTitle || b.subtitle || b.subTitle || b.episodeName; if (typeof st === 'string' && st) p.st = st
  const g = nameOf(b.subGenres && b.subGenres[0]) || nameOf(b.genre) || nameOf(b.genres && b.genres[0]) || nameOf(b.category); if (g) p.g = String(g)
  const i = urlOf(b.imageUrl) || urlOf(b.image) || urlOf(b.images) || urlOf(b.thumbnail) || urlOf(b.poster) || urlOf(b.imageUrls); if (i) p.i = i
  return p
}

try {
  const dates = [-1, 0, 1, 2].map(o => brusselsDate(Date.now() + o * 86400000))
  const channels = Object.fromEntries(OURS.map(id => [id, []]))
  const seen = new Set()
  let probed = false
  for (const date of dates) {
    try {
      const list = await getDay(date)
      for (const c of list) seen.add(`${c.seoKey}`)
      if (!probed) {
        const c0 = list.find(c => OURS.includes(norm(c.seoKey)) && (c.broadcasts || []).length)
        if (c0) { probed = true; console.log('channel fields: ' + Object.keys(c0).join(', ')); console.log('broadcast fields: ' + JSON.stringify(shape(c0.broadcasts.find(b => b.title !== 'Geen uitzending') || c0.broadcasts[0])).slice(0, 900)) }
      }
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
    console.log(`${id}: ${channels[id].length} programmes, ${channels[id].filter(p => p.i).length} with image, ${channels[id].filter(p => p.g).length} with genre` + (f ? `, first "${f.t}" at ${new Date(f.s * 1000).toISOString()}` : ''))
  }
  const total = OURS.reduce((n, id) => n + channels[id].length, 0)
  if (!total) throw new Error('no programmes found; channels in the guide: ' + [...seen].join(', ').slice(0, 300))
  writeFileSync(out, JSON.stringify({ fetched: new Date().toISOString(), channels }))
  console.log('VTM: saved ' + total + ' programmes')
} catch (e) {
  console.error('VTM collector failed: ' + e.message)
  process.exit(1)
}
