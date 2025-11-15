import { useState } from 'react'
import { api } from '../lib/api'
import { useAuthStore } from '../store/auth'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin')
  const [error, setError] = useState<string | null>(null)
  const login = useAuthStore(s => s.login)
  const navigate = useNavigate()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const r = await api.post('/auth/login', { username, password })
      login(r.data.token, r.data.user)
      navigate('/')
    } catch (err: any) {
      setError('Invalid credentials')
    }
  }

  return (
    <div className="min-h-screen bg-secondary-900 text-white flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-secondary-800 p-6 rounded space-y-4">
        <h1 className="text-xl font-semibold">Login</h1>
        <input value={username} onChange={e=>setUsername(e.target.value)} className="w-full rounded p-2 bg-secondary-700" placeholder="Username" />
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full rounded p-2 bg-secondary-700" placeholder="Password" />
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <button type="submit" className="w-full rounded p-2 bg-primary-600">Login</button>
      </form>
    </div>
  )
}