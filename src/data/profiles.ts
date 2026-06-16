import { supabase } from '../lib/supabase'
import type { Profile } from './types'

// Both people's profiles are readable (to label "You" vs the other person).
export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Profile[]
}

export async function updateDisplayName(id: string, displayName: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', id)
  if (error) throw error
}
