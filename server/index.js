const path = require('path')
const express = require('express')
const cities = require('./cities')

const PORT = process.env.PORT || 3001
const SINA_URL =
  'https://zhibo.sina.com.cn/api/zhibo/feed?page=1&page_size=50&zhibo_id=152&tag_id=0'
const CACHE_MS = 15 * 1000

const app = express()
let cache = { at: 0, payload: null }

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

function matchCities(text) {
  const hit = []
  for (const city of cities) {
    if (city.keywords.some((kw) => text.includes(kw))) {
      hit.push(city.id)
    }
  }
  return hit
}

async function fetchSinaFeed() {
  const res = await fetch(SINA_URL, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Referer: 'https://finance.sina.com.cn/',
      Accept: 'application/json,text/plain,*/*',
    },
  })
  if (!res.ok) {
    throw new Error(`Sina feed HTTP ${res.status}`)
  }
  const data = await res.json()
  const list = data?.result?.data?.feed?.list || []
  const items = []
  const byCity = {}
  for (const city of cities) {
    byCity[city.id] = []
  }
  const uncategorized = []

  for (const row of list) {
    const text = stripHtml(row.rich_text)
    if (!text) continue
    const cityIds = matchCities(text)
    const item = {
      id: String(row.id),
      time: row.create_time || row.update_time || '',
      text,
      cities: cityIds,
      docurl: row.docurl || '',
    }
    items.push(item)
    if (cityIds.length === 0) {
      uncategorized.push(item)
    } else {
      for (const id of cityIds) {
        byCity[id].push(item)
      }
    }
  }

  return {
    updatedAt: new Date().toISOString(),
    cities: cities.map(({ id, name, N, E }) => ({ id, name, N, E })),
    items,
    byCity,
    uncategorized,
  }
}

app.get('/api/news', async (_req, res) => {
  try {
    const now = Date.now()
    if (cache.payload && now - cache.at < CACHE_MS) {
      return res.json(cache.payload)
    }
    const payload = await fetchSinaFeed()
    cache = { at: now, payload }
    res.json(payload)
  } catch (err) {
    console.error('[api/news]', err.message)
    if (cache.payload) {
      return res.json({ ...cache.payload, stale: true, error: err.message })
    }
    res.status(502).json({ error: err.message || 'Failed to fetch news' })
  }
})

app.get('/api/cities', (_req, res) => {
  res.json(cities)
})

const dist = path.join(__dirname, '../dist')
app.use(express.static(dist))
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next()
  const index = path.join(dist, 'index.html')
  res.sendFile(index, (err) => {
    if (err) next()
  })
})

app.listen(PORT, () => {
  console.log(`Finance Earth server on http://localhost:${PORT}`)
})
