// Computes language + summary stats from the GitHub API and writes a dark SVG
// card, committed to this repo so it always loads (no rate-limited service).
import { writeFileSync, mkdirSync } from 'node:fs'

const USER = process.env.USERNAME || 'aakashshahani'
const TOKEN = process.env.GITHUB_TOKEN
const H = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': USER,
}
const gh = async (url) => {
  const r = await fetch(url, { headers: H })
  if (!r.ok) throw new Error(`${url} -> ${r.status}`)
  return r.json()
}

const user = await gh(`https://api.github.com/users/${USER}`)
let repos = []
for (let page = 1; ; page++) {
  const r = await gh(`https://api.github.com/users/${USER}/repos?per_page=100&page=${page}&type=owner`)
  repos = repos.concat(r)
  if (r.length < 100) break
}
repos = repos.filter((r) => !r.fork)
const stars = repos.reduce((a, r) => a + r.stargazers_count, 0)

const totals = {}
for (const r of repos) {
  try {
    const langs = await gh(r.languages_url)
    for (const [k, v] of Object.entries(langs)) totals[k] = (totals[k] || 0) + v
  } catch {}
}
const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1
const top = Object.entries(totals)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8)
  .map(([name, bytes]) => ({ name, pct: (bytes / sum) * 100 }))

const COLORS = {
  Python: '#3572A5', TypeScript: '#3178c6', JavaScript: '#f1e05a', Go: '#00ADD8',
  'C++': '#f34b7d', C: '#555555', Java: '#b07219', 'Jupyter Notebook': '#DA5B0B',
  HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051', Dockerfile: '#384d54',
  Makefile: '#427819', Rust: '#dea584', TeX: '#3D6117', SCSS: '#c6538c', Ruby: '#701516',
}
const colorOf = (n) => COLORS[n] || '#8b949e'
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const W = 460
const bg = '#0d1117', border = '#30363d', fg = '#c9d1d9', muted = '#8b949e', accent = '#e8c37a'

// stacked bar
let x = 25, barW = W - 50
const barSegs = top
  .map((l) => {
    const w = (l.pct / 100) * barW
    const seg = `<rect x="${x.toFixed(1)}" y="96" width="${w.toFixed(1)}" height="9" fill="${colorOf(l.name)}"/>`
    x += w
    return seg
  })
  .join('')

// two-column legend
const rows = top
  .map((l, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const lx = 25 + col * (barW / 2)
    const ly = 132 + row * 24
    return `
      <circle cx="${lx + 5}" cy="${ly - 4}" r="5" fill="${colorOf(l.name)}"/>
      <text x="${lx + 16}" y="${ly}" fill="${fg}" font-size="13" font-family="Segoe UI, Arial">${esc(l.name)}</text>
      <text x="${lx + barW / 2 - 12}" y="${ly}" fill="${muted}" font-size="12" text-anchor="end" font-family="Segoe UI, Arial">${l.pct.toFixed(1)}%</text>`
  })
  .join('')
const legendRows = Math.ceil(top.length / 2)
const H_ = 150 + legendRows * 24

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H_}" viewBox="0 0 ${W} ${H_}" role="img">
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H_ - 1}" rx="10" fill="${bg}" stroke="${border}"/>
  <text x="25" y="36" fill="${accent}" font-size="17" font-weight="700" font-family="Segoe UI, Arial">GitHub stats</text>
  <text x="25" y="66" fill="${muted}" font-size="13" font-family="Segoe UI, Arial">
    <tspan fill="${fg}" font-weight="600">${user.public_repos}</tspan> repos
    &#160;&#160;·&#160;&#160; <tspan fill="${fg}" font-weight="600">${stars}</tspan> stars
    &#160;&#160;·&#160;&#160; <tspan fill="${fg}" font-weight="600">${user.followers}</tspan> followers
  </text>
  <text x="25" y="88" fill="${muted}" font-size="12" font-weight="600" font-family="Segoe UI, Arial" letter-spacing="1">MOST USED LANGUAGES</text>
  <rect x="25" y="96" width="${barW}" height="9" rx="4.5" fill="#161b22"/>
  <clipPath id="r"><rect x="25" y="96" width="${barW}" height="9" rx="4.5"/></clipPath>
  <g clip-path="url(#r)">${barSegs}</g>
  ${rows}
</svg>`

mkdirSync('stats', { recursive: true })
writeFileSync('stats/github-stats-dark.svg', svg)
console.log('wrote stats/github-stats-dark.svg;', top.length, 'languages,', stars, 'stars')
