import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Completion, Item, ItemKind, Profile } from './types'
import { fetchProfiles } from './profiles'
import {
  fetchItems,
  addItem as apiAddItem,
  updateItem as apiUpdateItem,
  archiveItem as apiArchiveItem,
  deleteItem as apiDeleteItem,
} from './items'
import { fetchCompletions, setCompleted, clearCompleted, setNote as apiSetNote } from './completions'
import { useRealtime } from './useRealtime'
import { lastNDates, todayISO } from './dates'
import { useAuth } from '../auth/AuthProvider'

const HISTORY_DAYS = 7

interface DataContextValue {
  loading: boolean
  error: string | null
  today: string
  profiles: Profile[]
  items: Item[]
  completions: Completion[]
  reload: () => void
  toggleToday: (item: Item, done: boolean) => Promise<void>
  setNote: (item: Item, note: string) => Promise<void>
  addItem: (input: { title: string; kind: ItemKind; shared?: boolean; sortOrder: number }) => Promise<void>
  renameItem: (id: string, title: string) => Promise<void>
  removeItem: (id: string) => Promise<void>
  reorderItems: (updates: { id: string; sort_order: number }[]) => Promise<void>
}

const DataContext = createContext<DataContextValue | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const today = todayISO()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const windowStart = lastNDates(HISTORY_DAYS, today)[0]
      const [p, it, comp] = await Promise.all([
        fetchProfiles(),
        fetchItems(),
        fetchCompletions(windowStart, today),
      ])
      setProfiles(p)
      setItems(it)
      setCompletions(comp)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => {
    void reload()
  }, [reload])

  // Re-fetch whenever either person changes an item or completion.
  useRealtime(['items', 'completions'], reload)

  // Check / uncheck one of the current user's items for today. Optimistic so the
  // tap feels instant; a failure resyncs from the server.
  const toggleToday = useCallback(
    async (item: Item, done: boolean) => {
      if (!user) return
      if (done) {
        const optimistic: Completion = {
          id: `optimistic-${item.id}`,
          item_id: item.id,
          owner_id: user.id,
          for_date: today,
          completed_at: new Date().toISOString(),
          note: null,
        }
        setCompletions((prev) => [...prev, optimistic])
        // Completing a one-off removes it from the active list for good.
        if (item.kind === 'oneoff') {
          setItems((prev) => prev.filter((i) => i.id !== item.id))
        }
      } else {
        // Owner-scoped so unchecking a together item clears only YOUR sign-off.
        setCompletions((prev) =>
          prev.filter(
            (c) => !(c.item_id === item.id && c.for_date === today && c.owner_id === user.id),
          ),
        )
      }

      try {
        if (done) {
          await setCompleted(item.id, user.id, today)
          if (item.kind === 'oneoff') await apiArchiveItem(item.id)
        } else {
          await clearCompleted(item.id, today, user.id)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Update failed')
        void reload()
      }
    },
    [user, today, reload],
  )

  // Add/edit the note on the current user's completion of an item for today. Optimistic;
  // a failure resyncs. Updates by (item, owner, date), so it works even before the
  // optimistic completion's real id has arrived from the server.
  const setNote = useCallback(
    async (item: Item, note: string) => {
      if (!user) return
      const value = note.trim() === '' ? null : note.trim()
      setCompletions((prev) =>
        prev.map((c) =>
          c.item_id === item.id && c.for_date === today && c.owner_id === user.id
            ? { ...c, note: value }
            : c,
        ),
      )
      try {
        await apiSetNote(item.id, user.id, today, note)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Note update failed')
        void reload()
      }
    },
    [user, today, reload],
  )

  const addItem = useCallback(
    async (input: { title: string; kind: ItemKind; shared?: boolean; sortOrder: number }) => {
      if (!user) return
      await apiAddItem({ ownerId: user.id, ...input })
      await reload()
    },
    [user, reload],
  )

  const renameItem = useCallback(
    async (id: string, title: string) => {
      await apiUpdateItem(id, { title })
      await reload()
    },
    [reload],
  )

  const removeItem = useCallback(
    async (id: string) => {
      await apiDeleteItem(id)
      await reload()
    },
    [reload],
  )

  const reorderItems = useCallback(
    async (updates: { id: string; sort_order: number }[]) => {
      await Promise.all(updates.map((u) => apiUpdateItem(u.id, { sort_order: u.sort_order })))
      await reload()
    },
    [reload],
  )

  return (
    <DataContext.Provider
      value={{
        loading,
        error,
        today,
        profiles,
        items,
        completions,
        reload,
        toggleToday,
        setNote,
        addItem,
        renameItem,
        removeItem,
        reorderItems,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within a DataProvider')
  return ctx
}
