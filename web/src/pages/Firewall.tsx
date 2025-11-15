import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export default function Firewall() {
  const [rules, setRules] = useState<any[]>([])
  const [form, setForm] = useState<any>({ chain: 'INPUT', action: 'ACCEPT', protocol: 'tcp' })
  const load = async () => { try { const r = await api.get('/network/firewall-rules'); setRules(Array.isArray(r.data)?r.data:[]) } catch {} }
  useEffect(()=>{ load() },[])
  const add = async () => { await api.post('/network/firewall-rules', form); setForm({ chain: 'INPUT', action: 'ACCEPT', protocol: 'tcp' }); load() }
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold">Firewall</h2>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-secondary-800 p-4 rounded">
          <div className="text-sm mb-2 text-secondary-300">Add Rule</div>
          <div className="grid grid-cols-2 gap-2">
            <select value={form.chain} onChange={e=>setForm({ ...form, chain: e.target.value })} className="bg-secondary-700 p-2 rounded">
              <option>INPUT</option><option>FORWARD</option><option>OUTPUT</option>
            </select>
            <select value={form.action} onChange={e=>setForm({ ...form, action: e.target.value })} className="bg-secondary-700 p-2 rounded">
              <option>ACCEPT</option><option>DROP</option><option>REJECT</option>
            </select>
            <input placeholder="src IP" value={form.source_ip||''} onChange={e=>setForm({ ...form, source_ip: e.target.value })} className="bg-secondary-700 p-2 rounded" />
            <input placeholder="dst IP" value={form.dest_ip||''} onChange={e=>setForm({ ...form, dest_ip: e.target.value })} className="bg-secondary-700 p-2 rounded" />
            <input placeholder="src port" value={form.source_port||''} onChange={e=>setForm({ ...form, source_port: e.target.value })} className="bg-secondary-700 p-2 rounded" />
            <input placeholder="dst port" value={form.dest_port||''} onChange={e=>setForm({ ...form, dest_port: e.target.value })} className="bg-secondary-700 p-2 rounded" />
          </div>
          <button onClick={add} className="mt-3 bg-primary-600 px-3 py-1 rounded">Add</button>
        </div>
        <div className="bg-secondary-800 p-4 rounded">
          <div className="text-sm mb-2 text-secondary-300">Rules</div>
          <div className="space-y-1 text-sm">
            {rules.length ? rules.map((x,i)=>(<div key={i} className="flex justify-between"><span>{x.chain}</span><span>{x.rule||x.action}</span></div>)) : 'No rules'}
          </div>
        </div>
      </div>
    </div>
  )
}