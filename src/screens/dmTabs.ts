// The DM's header tabs, in order.
export type DmTab = 'run' | 'characters' | 'history' | 'tables'

export const DM_TABS: { id: DmTab; label: string }[] = [
  { id: 'run', label: 'Run' },
  { id: 'characters', label: 'Characters' },
  { id: 'history', label: 'History' },
  { id: 'tables', label: 'Tables' },
]
