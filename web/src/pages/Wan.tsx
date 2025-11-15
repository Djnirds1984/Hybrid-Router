import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export default function Wan() {
  const [wan, setWan] = useState<any>(null)
  const load = async () => { try { const r = await api.get('/system/wan'); setWan(r.data) } catch {} }
  useEffect(() => { load() }, [])
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold">WAN</h2>
      <div className="mt-4 bg-secondary-800 p-4 rounded space-y-2">
        <div>Default Gateway: {wan?.default_gateway || '-'}</div>
        <div>Internet: {wan?.internet ? 'Online' : 'Offline'}</div>
        <button className="bg-secondary-700 px-3 py-1 rounded" onClick={load}>Recheck</button>
      </div>
    </div>
  )
}