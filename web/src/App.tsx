import { useEffect, useState } from 'react'
import axios from 'axios'

function App() {
  const [health, setHealth] = useState<any>(null)
  const [wsStatus, setWsStatus] = useState<'connecting'|'open'|'closed'>('connecting')
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    const apiBase = `${location.origin}`
    axios.get(`${apiBase}/api/health`).then(r => setHealth(r.data)).catch((err) => setHealth({ error: true, message: String(err) }))
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
      <h1 className="text-2xl font-semibold">Hybrid Router</h1>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-secondary-800 rounded p-4">
          <div className="text-sm text-secondary-300">API Health</div>
          <div className="mt-2 text-lg">{health ? 'healthy' in health ? 'Healthy' : 'Error' : 'Loading...'}</div>
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
    </div>
  )
}

export default App