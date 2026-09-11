import { readFile } from 'node:fs/promises'
import type { WishlistItem } from '@shared/types'
import type { WishlistRepository } from '../../domain/repositories/WishlistRepository'

interface WishlistExportFile {
  version: string
  data: Array<{
    gameid: [string, string]
    title: string
    url: string
    added_date: string
    release_date: string
    note: string | null
    price: string | null
    discount: number
    reviews: { count: number; percPositive: number }
  }>
}

/**
 * Lê o arquivo wishlist.json exportado (formato do extension "Wishlist" da
 * comunidade Steam/gg.deals-like export: { version, data: [...] }).
 * gameid vem como ["steam", "app/<appid>"].
 */
export class WishlistJsonRepositoryImpl implements WishlistRepository {
  async importFromFile(filePath: string): Promise<WishlistItem[]> {
    const raw = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as WishlistExportFile

    return parsed.data
      .map((entry): WishlistItem | null => {
        const appIdMatch = entry.gameid[1]?.match(/app\/(\d+)/)
        if (!appIdMatch) return null

        return {
          appId: Number(appIdMatch[1]),
          title: entry.title,
          storeUrl: entry.url,
          addedDate: entry.added_date,
          releaseDate: entry.release_date,
          currentPrice: entry.price,
          discountPercent: entry.discount,
          reviewCount: entry.reviews?.count ?? 0,
          reviewPositivePercent: entry.reviews?.percPositive ?? 0
        }
      })
      .filter((item): item is WishlistItem => item !== null)
  }
}
