import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export default function Settings() {
  const [settings, setSettings] = useState<any>({})
  const [msg, setMsg] = useState<string | null>(null)
  const load = async () => { try { const r = await api.get('/config/settings'); setSettings(r.data) } catch {} }
  useEffect(()=>{ load() },[])
  const update = async (k: string, v: string) => { setMsg(null); await api.put(`/config/settings/${k}`, { value: v }); setMsg('Updated'); load() }
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold">Settings</h2>
      <div className="mt-4 bg-secondary-800 p-4 rounded space-y-2">
        {Object.keys(settings).length ? Object.entries(settings).map(([k, obj]: any)=> (
          <div key={k} className="flex items-center gap-2">
            <div className="w-40 text-sm">{k}</div>
            <input defaultValue={obj.value} onBlur={e=>update(k, e.target.value)} className="bg-secondary-700 p-2 rounded flex-1" />
          </div>
        )) : 'No settings'}
        {msg && <div className="text-sm text-secondary-300">{msg}</div>}
      </div>
    </div>
  )
}