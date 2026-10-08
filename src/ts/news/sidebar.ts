import { cities, City } from '../world/cities'
import { fetchNews, NewsItem, NewsPayload } from './api'

export type CitySelectHandler = (selectedId: string | null) => void

const noopSelect: CitySelectHandler = () => undefined

export class NewsSidebar {
  private root: HTMLElement
  private titleEl: HTMLElement
  private metaEl: HTMLElement
  private tabsEl: HTMLElement
  private listEl: HTMLElement
  private emptyEl: HTMLElement
  private payload: NewsPayload | null = null
  private selectedCityId: string | null = null
  private onSelect: CitySelectHandler
  private pollTimer: number | null = null

  constructor(onSelect: CitySelectHandler = noopSelect) {
    this.onSelect = onSelect
    this.root = document.getElementById('news-sidebar') as HTMLElement
    this.titleEl = document.getElementById('news-title') as HTMLElement
    this.metaEl = document.getElementById('news-meta') as HTMLElement
    this.tabsEl = document.getElementById('news-tabs') as HTMLElement
    this.listEl = document.getElementById('news-list') as HTMLElement
    this.emptyEl = document.getElementById('news-empty') as HTMLElement

    this.bindChrome()
    this.renderTabs()
    this.render()
  }

  private bindChrome() {
    const closeBtn = document.getElementById('news-close')
    closeBtn?.addEventListener('click', () => this.selectCity(null))

    const refreshBtn = document.getElementById('news-refresh')
    refreshBtn?.addEventListener('click', () => {
      void this.refresh()
    })
  }

  startPolling(intervalMs = 45000) {
    void this.refresh()
    if (this.pollTimer) window.clearInterval(this.pollTimer)
    this.pollTimer = window.setInterval(() => {
      void this.refresh()
    }, intervalMs)
  }

  async refresh() {
    try {
      this.metaEl.textContent = '刷新中…'
      this.payload = await fetchNews()
      this.render()
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载失败'
      this.metaEl.textContent = msg
      if (!this.payload) {
        this.listEl.innerHTML = ''
        this.emptyEl.style.display = 'block'
        this.emptyEl.textContent = `无法获取快讯：${msg}`
      }
    }
  }

  getPayload() {
    return this.payload
  }

  getSelectedCityId() {
    return this.selectedCityId
  }

  selectCity(cityId: string | null) {
    this.selectedCityId = cityId
    this.onSelect(cityId)
    this.renderTabs()
    this.render()
  }

  private findCity(id: string | null): City | undefined {
    if (!id) return undefined
    return cities.find((c) => c.id === id)
  }

  private currentItems(): NewsItem[] {
    if (!this.payload) return []
    if (!this.selectedCityId) return this.payload.items
    return this.payload.byCity[this.selectedCityId] || []
  }

  private renderTabs() {
    const tabs = [
      { id: null as string | null, label: '全部' },
      ...cities.map((c) => ({ id: c.id as string | null, label: c.name })),
    ]
    this.tabsEl.innerHTML = tabs
      .map((t) => {
        const active =
          (t.id === null && this.selectedCityId === null) ||
          t.id === this.selectedCityId
        const count =
          t.id === null
            ? this.payload?.items.length ?? 0
            : this.payload?.byCity[t.id as string]?.length ?? 0
        return `<button type="button" class="news-tab${active ? ' active' : ''}" data-city="${t.id ?? ''}">${t.label}<span>${count}</span></button>`
      })
      .join('')

    this.tabsEl.querySelectorAll('.news-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.city || null
        this.selectCity(id)
      })
    })
  }

  private render() {
    const city = this.findCity(this.selectedCityId)
    this.titleEl.textContent = city ? `${city.name} · 财经快讯` : '全球财经快讯'
    if (this.payload?.updatedAt) {
      const t = new Date(this.payload.updatedAt)
      const stale = this.payload.stale ? '（缓存）' : ''
      this.metaEl.textContent = `更新于 ${t.toLocaleTimeString()}${stale}`
    } else {
      this.metaEl.textContent = '等待数据…'
    }

    this.renderTabs()

    const items = this.currentItems()
    this.listEl.innerHTML = ''
    if (!items.length) {
      this.emptyEl.style.display = 'block'
      this.emptyEl.textContent = city
        ? `暂无与「${city.name}」相关的快讯`
        : '暂无快讯'
      return
    }

    this.emptyEl.style.display = 'none'
    const frag = document.createDocumentFragment()
    for (const item of items) {
      const li = document.createElement('li')
      li.className = 'news-item'
      const cityNames = item.cities
        .map((id) => cities.find((c) => c.id === id)?.name)
        .filter(Boolean)
        .join(' · ')
      li.innerHTML = `
        <div class="news-item-time">${item.time}${cityNames ? ` · ${cityNames}` : ''}</div>
        <div class="news-item-text">${escapeHtml(item.text)}</div>
      `
      if (item.docurl) {
        li.style.cursor = 'pointer'
        li.addEventListener('click', () => window.open(item.docurl, '_blank'))
      }
      frag.appendChild(li)
    }
    this.listEl.appendChild(frag)
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
