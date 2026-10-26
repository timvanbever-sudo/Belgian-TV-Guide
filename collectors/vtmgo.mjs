// Collects the VRT 1, Canvas and Ketnet schedules from VRT MAX using your own free VRT account.
// Usage: VRT_EMAIL=... VRT_PASSWORD=... node collectors/vrtmax.mjs vrtmax.json
// It only reads programme information (titles, times, descriptions, images). It never touches video streams.
// Output is printed as a short, safe summary: no passwords, tokens or cookies are ever logged.
import { writeFileSync } from 'node:fs'

const WWW = process.env.VRT_WWW || 'https://www.vrt.be'
const LOGIN = process.env.VRT_LOGIN || 'https://login.vrt.be'
const UA = 'belgian-tv-guide/1.0 (personal use)'
const CHANNELS = { vrt1: 'vrt1', canvas: 'vrt-canvas', ketnet: 'ketnet' } // our id -> VRT slug
const out = process.argv[2] || 'vrtmax.json'

// ---- cookies and redirects -------------------------------------------------
const jar = new Map()
const absorb = res => {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const pair = c.split(';')[0], i = pair.indexOf('=')
    const name = pair.slice(0, i).trim(), val = pair.slice(i + 1).trim()
    if (!name) continue
    if (!val || val === 'deleted' || /max-age=0/i.test(c)) jar.delete(name); else jar.set(name, val)
  }
}
const hop = async (url, o = {}) => {
  const res = await fetch(url, { redirect: 'manual', ...o, headers: { 'user-agent': UA, ...o.headers } })
  absorb(res)
  return res
}
const follow = async (url, headers = {}, max = 8) => {
  let res = await hop(url, { headers })
  for (let i = 0; i < max && res.status >= 300 && res.status < 400 && res.headers.get('location'); i++) {
    url = new URL(res.headers.get('location'), url).href
    res = await hop(url, { headers })
  }
  return res
}

// ---- sign in (same steps the VRT MAX website takes) ------------------------
async function signIn () {
  const email = process.env.VRT_EMAIL, password = process.env.VRT_PASSWORD
  if (!email || !password) throw new Error('VRT_EMAIL and VRT_PASSWORD are not set')
  await follow(WWW + '/vrtnu/sso/login?scope=openid,mid')
  const xsrf = jar.get('OIDCXSRF'), session = jar.get('SESSION')
  if (!xsrf || !session) throw new Error('sign-in start: expected cookies missing (saw: ' + [...jar.keys()].join(', ') + ')')
  const res = await hop(LOGIN + '/perform_login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', OIDCXSRF: xsrf, cookie: 'SESSION=' + session + '; OIDCXSRF=' + xsrf },
    body: JSON.stringify({ clientId: 'vrtnu-site', loginID: email, password })
  })
  const info = await res.json().catch(() => ({}))
  if (info.errorCode !== 0) throw new Error('sign-in refused: ' + (info.errorDetails || 'HTTP ' + res.status))
  const h = { cookie: 'SESSION=' + (jar.get('SESSION') || session) + '; oidcstate=' + (jar.get('oidcstate') || '') }
  let r = await hop(info.redirectUrl, { headers: h })
  const next = r.headers.get('location')
  if (!next) throw new Error('sign-in finish: no redirect after the credentials were accepted (HTTP ' + r.status + ')')
  await hop(new URL(next, info.redirectUrl).href, { headers: h })
  const token = jar.get('vrtnu-site_profile_at')
  if (!token) throw new Error('sign-in finish: no access token received (saw: ' + [...jar.keys()].join(', ') + ')')
  return token
}

// ---- guide queries ---------------------------------------------------------
const TILE = `fragment T on Tile {
  ... on ITile { title tileType componentId image { alt templateUrl } action { ... on LinkAction { link } } statusMeta { type value shortValue } status { text { small default } } }
  ... on EpisodeTile { description available progress { durationInSeconds progressInSeconds } }
  ... on LivestreamTile { description progress { durationInSeconds progressInSeconds } }
}`
const LIST = `fragment L on PaginatedTileList { listId paginatedItems(first: $lazyItemCount, after: $after, before: $before) { edges { cursor node { ...T } } pageInfo { endCursor hasNextPage } } }`
const PAGE_Q = `query Page($pageId: ID!, $lazyItemCount: Int = 100, $after: ID, $before: ID) {
  page(id: $pageId) { ... on ElectronicProgramGuidePage { current { ... on StandaloneTile { tile { ...T } } } previous { ...L } next { ...L } } }
} ${LIST} ${TILE}`
const LIST_Q = `query TileList($listId: ID!, $lazyItemCount: Int = 20, $after: ID, $before: ID) {
  list(listId: $listId) { ... on PaginatedTileList { ...L } }
} ${LIST} ${TILE}`

async function gql (token, operationName, query, variables) {
  const res = await fetch(WWW + '/vrtnu-api/graphql/v1', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', authorization: 'Bearer ' + token, 'x-vrt-client-name': 'WEB', 'x-vrt-client-version': '1.5.15', 'user-agent': UA },
    body: JSON.stringify({ operationName, query, variables })
  })
  const j = await res.json().catch(() => null)
  if (!res.ok || !j) throw new Error(operationName + ': HTTP ' + res.status)
  if (j.errors?.length) throw new Error(operationName + ': ' + j.errors.slice(0, 3).map(e => e.message).join(' | ').slice(0, 300))
  return j.data
}

async function dayTiles (token, slug, date) {
  const d = await gql(token, 'Page', PAGE_Q, { pageId: `/vrtmax/tv-gids/${slug}/${date}/`, lazyItemCount: 50, after: '' })
  const page = d?.page || {}, tiles = []
  if (page.current?.tile) tiles.push(page.current.tile)
  for (const side of [page.previous, page.next]) {
    if (!side) continue
    let pi = side.paginatedItems
    for (const e of pi?.edges || []) if (e.node) tiles.push(e.node)
    for (let guard = 0; pi?.pageInfo?.hasNextPage && side.listId && guard < 20; guard++) {
      const l = await gql(token, 'TileList', LIST_Q, { listId: side.listId, lazyItemCount: 50, after: pi.pageInfo.endCursor })
      pi = l?.list?.paginatedItems
      for (const e of pi?.edges || []) if (e.node) tiles.push(e.node)
    }
  }
  return tiles
}

// ---- tiles to programmes ---------------------------------------------------
const tzOffsetMin = ts => {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ts))
  const g = k => +p.find(x => x.type === k).value
  return (Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second')) - ts) / 60000
}
const brussels = (date, hh, mm) => {
  const guess = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), hh, mm)
  return Math.floor((guess - tzOffsetMin(guess) * 60000) / 1000)
}
const startOf = (t, date) => {
  if (t.tileType === 'livestream') {
    const m = (t.status?.text?.small || '').match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/)
    if (m) { const s = brussels(date, +m[1], +m[2]); let e = brussels(date, +m[3], +m[4]); if (e <= s) e += 86400; return { s, e } }
  }
  try {
    const dec = Buffer.from((t.componentId || '').replace(/^#/, ''), 'base64').toString('utf8')
    const ms = dec.split('#10')[2]?.split('#13')[1]
    if (ms && /^\d{10,}/.test(ms)) return { s: Math.floor(parseInt(ms, 10) / 1000) }
  } catch {}
  return null
}
const durationOf = t => {
  if (t.progress?.durationInSeconds) return t.progress.durationInSeconds
  const n = (t.statusMeta?.[0]?.value || '').trim().split(/\s+/)[0]
  return /^\d+$/.test(n) ? +n * 60 : 0
}
const imageOf = t => {
  const u = t.image?.templateUrl
  return u ? u.replace(/\{width\}/g, '480').replace(/\{height\}/g, '270').split('?')[0] : ''
}
function toProgrammes (tiles, date) {
  const seen = new Set(), list = []
  for (const t of tiles) {
    const st = startOf(t, date)
    if (!st || !t.title) continue
    const key = st.s + '|' + t.title
    if (seen.has(key)) continue
    seen.add(key)
    const p = { s: st.s, e: st.e || st.s + (durationOf(t) || 0), t: t.title }
    if (t.description) p.d = String(t.description).slice(0, 160)
    const i = imageOf(t); if (i) p.i = i
    const link = t.action?.link; if (t.available && link) p.u = link.startsWith('http') ? link : WWW + link
    list.push(p)
  }
  return list
}
function tidy (list) {
  list.sort((a, b) => a.s - b.s)
  const res = []
  for (const p of list) { if (res.length && res[res.length - 1].s === p.s) continue; res.push(p) }
  res.forEach((p, k) => {
    const next = res[k + 1]
    if (next && next.s - p.s < 8 * 3600) p.e = next.s
    if (!(p.e > p.s)) p.e = p.s + 1800
  })
  return res
}

// ---- main ------------------------------------------------------------------
const brusselsDate = ts => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels' }).format(new Date(ts))
try {
  const token = await signIn()
  console.log('VRT sign-in: ok')
  const dates = [-1, 0, 1].map(o => brusselsDate(Date.now() + o * 86400000))
  const channels = {}
  for (const [id, slug] of Object.entries(CHANNELS)) {
    let all = []
    for (const date of dates) {
      try {
        const tiles = await dayTiles(token, slug, date)
        const progs = toProgrammes(tiles, date)
        console.log(`${id} ${date}: ${tiles.length} tiles, ${progs.length} programmes`)
        all = all.concat(progs)
      } catch (e) { console.log(`${id} ${date}: ${e.message}`) }
    }
    channels[id] = tidy(all)
    const f = channels[id][0]
    if (f) console.log(`${id}: ${channels[id].length} programmes, first "${f.t}" at ${new Date(f.s * 1000).toISOString()}, image pattern: ${f.i ? f.i.replace(/[0-9a-f-]{8,}/gi, '…') : 'none'}`)
  }
  const total = Object.values(channels).reduce((n, a) => n + a.length, 0)
  if (!total) throw new Error('signed in, but no programmes could be read')
  writeFileSync(out, JSON.stringify({ fetched: new Date().toISOString(), channels }))
  console.log('VRT MAX: saved ' + total + ' programmes')
} catch (e) {
  console.error('VRT MAX collector failed: ' + e.message)
  process.exit(1)
}
