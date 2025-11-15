import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Nat from './pages/Nat'
import Wan from './pages/Wan'
import DhcpAp from './pages/DhcpAp'
import Firewall from './pages/Firewall'
import Settings from './pages/Settings'

function App() {
  const token = useAuthStore(s => s.token)
  return (
    <BrowserRouter>
      <div className="bg-secondary-900 text-white min-h-screen">
        {token && (
          <nav className="bg-secondary-800 px-4 py-2 flex gap-4">
            <Link to="/" className="hover:underline">Dashboard</Link>
            <Link to="/nat" className="hover:underline">NAT</Link>
            <Link to="/wan" className="hover:underline">WAN</Link>
            <Link to="/dhcp" className="hover:underline">DHCP/AP</Link>
            <Link to="/firewall" className="hover:underline">Firewall</Link>
            <Link to="/settings" className="hover:underline">Settings</Link>
          </nav>
        )}
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={token ? <Dashboard /> : <Navigate to="/login" replace />} />
          <Route path="/nat" element={token ? <Nat /> : <Navigate to="/login" replace />} />
          <Route path="/wan" element={token ? <Wan /> : <Navigate to="/login" replace />} />
          <Route path="/dhcp" element={token ? <DhcpAp /> : <Navigate to="/login" replace />} />
          <Route path="/firewall" element={token ? <Firewall /> : <Navigate to="/login" replace />} />
          <Route path="/settings" element={token ? <Settings /> : <Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to={token ? '/' : '/login'} replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App