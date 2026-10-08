export type NewsItem = {
  id: string
  time: string
  text: string
  cities: string[]
  docurl?: string
}

export type NewsPayload = {
  updatedAt: string
  cities: { id: string; name: string; N: number; E: number }[]
  items: NewsItem[]
  byCity: Record<string, NewsItem[]>
  uncategorized: NewsItem[]
  stale?: boolean
  error?: string
}

export async function fetchNews(): Promise<NewsPayload> {
  const res = await fetch('/api/news')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}
