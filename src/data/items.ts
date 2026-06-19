import { supabase } from '../lib/supabase'
import type { Item, ItemKind } from './types'

// Read-access is "all users" (both lists are visible); the Today screen groups
// these by owner_id. RLS still restricts writes to each row's owner.

export async function fetchItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Item[]
}

export async function addItem(input: {
  ownerId: string
  title: string
  kind: ItemKind
  sortOrder: number
  shared?: boolean
}): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .insert({
      owner_id: input.ownerId,
      title: input.title,
      kind: input.kind,
      shared: input.shared ?? false,
      sort_order: input.sortOrder,
    })
    .select()
    .single()
  if (error) throw error
  return data as Item
}

type ItemPatch = Partial<Pick<Item, 'title' | 'kind' | 'active' | 'sort_order'>>

export async function updateItem(id: string, patch: ItemPatch): Promise<void> {
  const { error } = await supabase.from('items').update(patch).eq('id', id)
  if (error) throw error
}

/** Soft-delete: keep history/completions intact but stop showing the item. */
export async function archiveItem(id: string): Promise<void> {
  await updateItem(id, { active: false })
}

/** Hard-delete: removes the item and (via ON DELETE CASCADE) its completions. */
export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) throw error
}
