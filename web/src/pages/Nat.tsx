import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export default function Nat() {
  const [status, setStatus] = useState<any>(null)
  const [wan, setWan] = useState('eth0')
  const [lan, setLan] = useState('wlan0')
  const [method, setMethod] = useState<'nftables'|'iptables'>('nftables')
  const [msg, setMsg] = useState<string | null>(null)

  const load = async () => {
    try { const r = await api.get('/network/nat/status'); setStatus(r.data) } catch {}
  }

  useEffect(() => { load() }, [])

  const enable = async () => {
    setMsg(null)
    try { await api.post('/network/nat/enable', { method, wan, lan }); setMsg('Enabled'); load() } catch { setMsg('Failed') }
  }
  const disable = async () => {
    setMsg(null)
    try { await api.post('/network/nat/disable', { method }); setMsg('Disabled'); load() } catch { setMsg('Failed') }
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold">NAT</h2>
      <div className="mt-4 bg-secondary-800 p-4 rounded space-y-3">
        <div>Status: {status ? JSON.stringify(status) : '...'}</div>
        <div className="flex gap-2">
          <select value={method} onChange={e=>setMethod(e.target.value as any)} className="bg-secondary-700 p-2 rounded">
            <option value="nftables">nftables</option>
            <option value="iptables">iptables</option>
          </select>
          <input value={wan} onChange={e=>setWan(e.target.value)} className="bg-secondary-700 p-2 rounded" placeholder="WAN iface" />
          <input value={lan} onChange={e=>setLan(e.target.value)} className="bg-secondary-700 p-2 rounded" placeholder="LAN iface" />
        </div>
        <div className="flex gap-2">
          <button onClick={enable} className="bg-primary-600 px-3 py-1 rounded">Enable</button>
          <button onClick={disable} className="bg-secondary-700 px-3 py-1 rounded">Disable</button>
        </div>
        {msg && <div className="text-sm text-secondary-300">{msg}</div>}
      </div>
    </div>
  )
}