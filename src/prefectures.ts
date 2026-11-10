import { geoCentroid, geoDistance } from 'd3-geo'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import topo from './data/japan-prefectures.topo.json'

const topology = topo as unknown as Topology<{
  japan: GeometryCollection<{ id: number; nam: string; nam_ja: string }>
}>

export const prefectures = feature(topology, topology.objects.japan)

const names = new Map(prefectures.features.map((p) => [p.properties.id, p.properties]))

const OSAKA = 27
const centroids = new Map(prefectures.features.map((p) => [p.properties.id, geoCentroid(p)]))

export function byDistanceFromOsaka(ids: number[]): number[] {
  const osaka = centroids.get(OSAKA)!
  const distance = (id: number) => geoDistance(osaka, centroids.get(id)!)
  return ids.toSorted((a, b) => distance(a) - distance(b))
}

export function prefectureNames(id: number) {
  const p = names.get(id)
  return { ja: p?.nam_ja ?? `#${id}`, en: p?.nam ?? `#${id}` }
}

export function prefectureName(id: number) {
  const { ja, en } = prefectureNames(id)
  return `${ja} (${en})`
}
