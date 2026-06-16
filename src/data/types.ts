// Domain types — these mirror the Postgres tables in supabase/schema.sql.
// Dates are ISO strings as Postgres/Supabase return them.

export type ItemKind = 'daily' | 'oneoff'

export interface Profile {
  id: string
  display_name: string
  created_at: string
}

export interface Item {
  id: string
  owner_id: string
  title: string
  kind: ItemKind
  active: boolean
  sort_order: number
  created_at: string
}

export interface Completion {
  id: string
  item_id: string
  owner_id: string
  for_date: string // YYYY-MM-DD (the local day this check-off counts for)
  completed_at: string
}
