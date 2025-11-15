import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export default function DhcpAp() {
  const [services, setServices] = useState<any>(null)
  const [leases, setLeases] = useState<any[]>([])
  const load = async () => {
    try { const s = await api.get('/system/services'); setServices(s.data) } catch {}
    try { const l = await api.get('/network/dhcp-leases'); setLeases(Array.isArray(l.data)?l.data:[]) } catch {}
  }
  useEffect(()=>{ load() },[])
  const control = async (service: string, action: string) => { await api.post(`/system/services/${service}/${action}`); load() }
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold">DHCP & AP</h2>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-secondary-800 p-4 rounded">
          <div className="text-sm text-secondary-300 mb-2">Services</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between"><span>dnsmasq</span><span>{services?.dnsmasq? 'active':'inactive'}</span><div className="flex gap-2"><button onClick={()=>control('dnsmasq','restart')} className="bg-primary-600 px-3 py-1 rounded">Restart</button><button onClick={()=>control('dnsmasq','stop')} className="bg-secondary-700 px-3 py-1 rounded">Stop</button></div></div>
            <div className="flex items-center justify-between"><span>hostapd</span><span>{services?.hostapd? 'active':'inactive'}</span><div className="flex gap-2"><button onClick={()=>control('hostapd','restart')} className="bg-primary-600 px-3 py-1 rounded">Restart</button><button onClick={()=>control('hostapd','stop')} className="bg-secondary-700 px-3 py-1 rounded">Stop</button></div></div>
          </div>
        </div>
        <div className="bg-secondary-800 p-4 rounded">
          <div className="text-sm text-secondary-300 mb-2">DHCP Leases</div>
          <div className="space-y-1 text-sm">
            {leases.length ? leases.map((x,i)=>(<div key={i} className="flex justify-between"><span>{x.hostname||x.mac_address||'-'}</span><span>{x.ip_address}</span></div>)) : 'No leases'}
          </div>
        </div>
      </div>
    </div>
  )
}