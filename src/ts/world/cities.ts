import citiesJson from '../../../shared/cities.json'

export type City = {
  id: string
  name: string
  N: number
  E: number
  keywords: string[]
}

export const cities: City[] = citiesJson as City[]

/** Convert flat cities to Earth route-style data (hub = first city). */
export function toEarthData(list: City[] = cities) {
  if (!list.length) return []
  const [hub, ...rest] = list
  return [
    {
      startArray: { name: hub.name, N: hub.N, E: hub.E },
      endArray: rest.map((c) => ({ name: c.name, N: c.N, E: c.E })),
    },
  ]
}

export default cities
