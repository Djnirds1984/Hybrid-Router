import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuthStore } from '../store/auth'

export default function Dashboard() {
  const [health, setHealth] = useState<any>(null)
  const [wsStatus, setWsStatus] = useState<'connecting'|'open'|'closed'>('connecting')
  const [stats, setStats] = useState<any>(null)
  const [resources, setResources] = useState<any>(null)
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)

  useEffect(() => {
    api.get('/health').then(r => setHealth(r.data)).catch(() => setHealth({ error: true }))
    api.get('/system/resources').then(r => setResources(r.data)).catch(()=>{})
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`)
    ws.onopen = () => setWsStatus('open')
    ws.onclose = () => setWsStatus('closed')
    ws.onmessage = ev => {
      try {
        const data = JSON.parse(ev.data)
        if (data.type === 'system_stats') setStats(data.data)
      } catch {}
    }
    return () => ws.close()
  }, [])

  return (
    <div className="min-h-screen bg-secondary-900 text-white p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Hybrid Router</h1>
        <div className="text-sm">{user?.username}<button className="ml-3 bg-secondary-700 px-3 py-1 rounded" onClick={logout}>Logout</button></div>
      </div>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-secondary-800 rounded p-4">
          <div className="text-sm text-secondary-300">API Health</div>
          <div className="mt-2 text-lg">{health ? (health.status === 'healthy' ? 'Healthy' : 'Error') : 'Loading...'}</div>
        </div>
        <div className="bg-secondary-800 rounded p-4">
          <div className="text-sm text-secondary-300">WebSocket</div>
          <div className="mt-2 text-lg">{wsStatus}</div>
        </div>
        <div className="bg-secondary-800 rounded p-4">
          <div className="text-sm text-secondary-300">CPU</div>
          <div className="mt-2 text-lg">{stats ? `${stats.cpu.toFixed(1)}%` : '-'}</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-secondary-800 rounded p-4">
          <div className="text-sm text-secondary-300">Temperature</div>
          <div className="mt-2 text-lg">{resources?.temperature_c ? `${resources.temperature_c.toFixed(1)} °C` : '-'}</div>
        </div>
        <div className="bg-secondary-800 rounded p-4">
          <div className="text-sm text-secondary-300">RAM</div>
          <div className="mt-2 text-lg">{resources?.memory ? `${(resources.memory.used/1e9).toFixed(2)} / ${(resources.memory.total/1e9).toFixed(2)} GB (${resources.memory.percent}% )` : '-'}</div>
        </div>
        <div className="bg-secondary-800 rounded p-4">
          <div className="text-sm text-secondary-300">Storage</div>
          <div className="mt-2 text-lg">{resources?.disk ? `${(resources.disk.used/1e9).toFixed(2)} / ${(resources.disk.total/1e9).toFixed(2)} GB (${resources.disk.percent}% )` : '-'}</div>
        </div>
      </div>
    </div>
  )
}