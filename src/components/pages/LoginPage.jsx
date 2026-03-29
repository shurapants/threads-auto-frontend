import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import api from '../../utils/api'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '', name: '' })
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register'
      const data = await api.post(endpoint, form)
      setAuth(data.token, data.user)
      toast.success(mode === 'login' ? 'ログインしました' : 'アカウントを作成しました')
      navigate('/')
    } catch (err) {
      toast.error(err.error || 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center mb-4 shadow-lg shadow-brand-600/30">
            <Zap size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-100">ThreadsAuto</h1>
          <p className="text-gray-500 text-sm mt-1">Threads自動投稿管理ツール</p>
        </div>

        {/* Form */}
        <div className="card p-6">
          <div className="flex rounded-xl bg-gray-800 p-1 mb-6">
            {['login', 'register'].map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all
                  ${mode === m ? 'bg-gray-700 text-gray-100 shadow-sm' : 'text-gray-400 hover:text-gray-300'}`}
              >
                {m === 'login' ? 'ログイン' : '新規登録'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="label">名前</label>
                <input
                  className="input"
                  placeholder="山田 太郎"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
            )}
            <div>
              <label className="label">メールアドレス</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">パスワード</label>
              <input
                type="password"
                className="input"
                placeholder="8文字以上"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                required
                minLength={8}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 mt-2"
            >
              {loading ? '処理中...' : mode === 'login' ? 'ログイン' : '登録する'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
