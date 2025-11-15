import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export default function Nat() {
  const [status, setStatus] = useState<any>(null)
  const [wan, setWan] = useState('eth0')
  const [lan, setLan] = useState('wlan0')
  const [method, setMethod] = useState<'nftables'|'iptables'>('nftables')
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ifaces, setIfaces] = useState<string[]>([])

  const load = async () => {
    try { const r = await api.get('/network/nat/status'); setStatus(r.data) } catch {}
    try { const ii = await api.get('/network/interfaces'); const names = Object.keys(ii.data||{}); setIfaces(names); if (names.includes('eth0')) setWan('eth0'); if (names.includes('wlan0')) setLan('wlan0') } catch {}
  }

  useEffect(() => { load() }, [])

  const enable = async () => {
    setMsg(null); setLoading(true)
    try { await api.post('/network/nat/enable', { method, wan, lan }); setMsg('Enabled'); await load() } catch (e:any) { setMsg(`Failed: ${e?.response?.data?.error||'error'}`) } finally { setLoading(false) }
  }
  const disable = async () => {
    setMsg(null); setLoading(true)
    try { await api.post('/network/nat/disable', { method }); setMsg('Disabled'); await load() } catch (e:any) { setMsg(`Failed: ${e?.response?.data?.error||'error'}`) } finally { setLoading(false) }
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
          <select value={wan} onChange={e=>setWan(e.target.value)} className="bg-secondary-700 p-2 rounded">
            {[wan, ...ifaces.filter(i=>i!==wan)].map(i=> (<option key={i} value={i}>{i}</option>))}
          </select>
          <select value={lan} onChange={e=>setLan(e.target.value)} className="bg-secondary-700 p-2 rounded">
            {[lan, ...ifaces.filter(i=>i!==lan)].map(i=> (<option key={i} value={i}>{i}</option>))}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={enable} disabled={loading} className="bg-primary-600 px-3 py-1 rounded disabled:opacity-50">Enable</button>
          <button onClick={disable} disabled={loading} className="bg-secondary-700 px-3 py-1 rounded disabled:opacity-50">Disable</button>
        </div>
        {msg && <div className="text-sm text-secondary-300">{msg}</div>}
      </div>
    </div>
  )
}