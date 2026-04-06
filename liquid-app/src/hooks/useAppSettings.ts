import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '../lib/supabase'
import { MIN_ORDER_USDT, MAX_ORDER_USDT } from '../lib/constants'

type UseAppSettingsResult = {
  buyRate: number
  sellRate: number
  exchangeOpen: boolean
  exchangeMessage: string
  minOrderUsdt: number
  maxOrderUsdt: number
  announcement: string
  allocStable: number
  allocBtc: number
  allocEth: number
  loading: boolean
}

type AppSettingsValues = Omit<UseAppSettingsResult, 'loading'>

type AppSettingsRow = Record<string, unknown> | null

function toNumber(val: unknown, fallback: number): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : fallback
  if (typeof val === 'string') {
    const n = Number(val)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

function toBoolean(val: unknown, fallback: boolean): boolean {
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') return val === 'true' || val === '1' || val === 'yes'
  if (typeof val === 'number') return val !== 0
  return fallback
}

function toStringVal(val: unknown, fallback: string): string {
  if (typeof val === 'string') return val
  if (val === null || val === undefined) return fallback
  return String(val)
}

function mapRow(row: AppSettingsRow): AppSettingsValues {
  if (!row) {
    return {
      buyRate: 0,
      sellRate: 0,
      // Default UX should be OPEN unless admin explicitly closes it.
      exchangeOpen: true,
      exchangeMessage: 'Exchange is currently closed. Check back soon.',
      minOrderUsdt: MIN_ORDER_USDT,
      maxOrderUsdt: MAX_ORDER_USDT,
      announcement: '',
      allocStable: 0,
      allocBtc: 0,
      allocEth: 0,
    }
  }

  return {
    buyRate: toNumber(row.buyRate ?? row.buy_rate, 0),
    sellRate: toNumber(row.sellRate ?? row.sell_rate, 0),
    exchangeOpen: toBoolean(row.exchangeOpen ?? row.exchange_open, false),
    exchangeMessage: toStringVal(row.exchangeMessage ?? row.exchange_message, ''),
    minOrderUsdt: toNumber(row.minOrderUsdt ?? row.min_order_usdt, MIN_ORDER_USDT),
    maxOrderUsdt: toNumber(row.maxOrderUsdt ?? row.max_order_usdt, MAX_ORDER_USDT),
    announcement: toStringVal(row.announcement, ''),
    allocStable: toNumber(row.allocStable ?? row.alloc_stable, 0),
    allocBtc: toNumber(row.allocBtc ?? row.alloc_btc, 0),
    allocEth: toNumber(row.allocEth ?? row.alloc_eth, 0),
  }
}

export function useAppSettings(): UseAppSettingsResult {
  const queryClient = useQueryClient()
  const { data, isPending } = useQuery({
    queryKey: ['app_settings'],
    queryFn: async () => {
      // Support both schemas:
      // A) single-row app_settings with columns (exchange_open, buy_rate, etc.)
      // B) key/value app_settings rows per build guide (key='exchange_open', value='true', etc.)
      const [singleRes, kvRes] = await Promise.all([
        supabase.from('app_settings').select('*').single(),
        supabase.from('app_settings').select('key,value'),
      ])

      if (!singleRes.error && singleRes.data) {
        return singleRes.data as AppSettingsRow
      }

      if (!kvRes.error && Array.isArray(kvRes.data) && kvRes.data.length > 0) {
        const mapped: Record<string, unknown> = {}
        for (const row of kvRes.data as any[]) {
          const k = row?.key as string | undefined
          const v = row?.value as unknown
          if (!k) continue
          mapped[k] = v
        }
        // normalize common keys from the guide into the fields mapRow reads
        return {
          buy_rate: mapped.buy_rate,
          sell_rate: mapped.sell_rate,
          exchange_open: mapped.exchange_open,
          exchange_message: mapped.exchange_message,
          min_order_usdt: mapped.min_order_usdt,
          max_order_usdt: mapped.max_order_usdt,
          announcement: mapped.announcement,
          alloc_stable: mapped.alloc_stable,
          alloc_btc: mapped.alloc_btc,
          alloc_eth: mapped.alloc_eth,
        } as AppSettingsRow
      }

      // Keep the app usable if settings fetch fails temporarily.
      const msg = singleRes.error?.message || kvRes.error?.message || 'Unknown error'
      console.error('Failed to load app_settings:', msg)
      return null
    },
    refetchInterval: 30_000,
    staleTime: 30_000,
  })

  useEffect(() => {
    const channel = supabase
      .channel('app_settings_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['app_settings'] }).catch(() => undefined)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])

  const values = mapRow((data as AppSettingsRow) ?? null)
  return {
    ...values,
    loading: isPending,
  }
}
