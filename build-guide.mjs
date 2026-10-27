// Converts the XMLTV file made by the collector into a small guide.js for the app.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const [src, out, ...extras] = process.argv.slice(2) // extras = optional collector files (vrtmax.json, vtmgo.json)
const xml = readFileSync(src, 'utf8')

const dec = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/&amp;/g, '&').trim()
const attr = (a, k) => (a.match(new RegExp(k + '="([^"]*)"')) || [])[1] || ''
const tag = (b, k) => { const m = b.match(new RegExp('<' + k + '[^>]*>([\\s\\S]*?)</' + k + '>')); return m ? dec(m[1]) : '' }
const epoch = v => {
  const m = v.match(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)\s*([+-]\d{4})?/)
  if (!m) return 0
  const off = m[7] ? (m[7][0] === '-' ? -1 : 1) * (+m[7].slice(1, 3) * 60 + +m[7].slice(3, 5)) : 0
  return Math.round(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000 - off * 60)
}

const channels = {}
for (const m of xml.matchAll(/<programme\s+([^>]*)>([\s\S]*?)<\/programme>/g)) {
  const id = attr(m[1], 'channel'), s = epoch(attr(m[1], 'start')), e = epoch(attr(m[1], 'stop'))
  if (!id || !s || !e) continue
  const p = { s, e, t: tag(m[2], 'title') }
  const st = tag(m[2], 'sub-title'); if (st) p.st = st
  const d = tag(m[2], 'desc'); if (d) p.d = d.slice(0, 160)
  const g = tag(m[2], 'category'); if (g) p.g = g
  // Programme images come as <image ...>URL</image> (preferring landscape), or as <icon src="URL"/>.
  const imgs = [...m[2].matchAll(/<image([^>]*)>([^<]+)<\/image>/g)]
  const img = imgs.find(x => /orient="L"/.test(x[1])) || imgs[0]
  const ic = img ? img[2] : (m[2].match(/<icon[^>]*src="([^"]+)"/) || [])[1]
  if (ic) p.i = dec(ic)
  const u = tag(m[2], 'url'); if (u) p.u = u
  ;(channels[id] ||= []).push(p)
}
for (const k in channels) channels[k].sort((a, b) => a.s - b.s)

// Second source for the VTM channels (Telenet): used when the first source gave nothing,
// and to fill in missing images.
for (const k of Object.keys(channels)) {
  if (!k.endsWith('.telenet')) continue
  const base = k.slice(0, -8), alt = channels[k]
  if (!channels[base] || !channels[base].length) { channels[base] = alt; console.log(`${base}: using the second source (${alt.length} programmes)`) }
  else for (const p of channels[base]) {
    if (p.i) continue
    const q = alt.find(x => Math.abs(x.s - p.s) <= 300 && x.i)
    if (q) p.i = q.i
  }
  delete channels[k]
}

// Prefer the dedicated collectors (VRT MAX, VTM GO) when they produced current data.
// Genre, description, subtitle and image are borrowed from the other source when they start at the same time.
for (const extra of extras) {
  if (!existsSync(extra)) continue
  try {
    const v = JSON.parse(readFileSync(extra, 'utf8')), now = Date.now() / 1000
    for (const [id, list] of Object.entries(v.channels || {})) {
      if (list.length < 5 || list[list.length - 1].e < now) { console.log(`${id}: ${extra} skipped (too little or out of date)`); continue }
      const old = channels[id] || []
      for (const p of list) {
        const q = old.find(x => Math.abs(x.s - p.s) <= 300)
        if (q) for (const k of ['g', 'd', 'st', 'i']) if (!p[k] && q[k]) p[k] = q[k]
      }
      channels[id] = list
      console.log(`${id}: using ${extra} (${list.length} programmes)`)
    }
  } catch (e) { console.log(`${extra} ignored: ${e.message}`) }
}

writeFileSync(out, 'window.BETV_GUIDE=' + JSON.stringify({ updated: new Date().toISOString(), channels }) + ';\n')
console.log(Object.entries(channels).map(([k, v]) => `${k}: ${v.length} programmes`).join('\n'))
