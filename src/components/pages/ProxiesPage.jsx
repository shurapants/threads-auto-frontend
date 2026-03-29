import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Globe, Trash2, Edit2, CheckCircle, XCircle, Loader, Wifi } from 'lucide-react'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'

const PROXY_TYPES = ['http', 'https', 'socks4', 'socks5']

function ProxyModal({ proxy, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: proxy?.name || '',
    type: proxy?.type || 'http',
    host: proxy?.host || '',
    port: proxy?.port || '',
    username: proxy?.username || '',
    password: proxy?.password || '',
  })
  const [loading, setLoading] = useState(false)
  const isEdit = !!proxy

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (isEdit) {
        await api.put(`/proxies/${proxy.id}`, form)
        toast.success('プロキシを更新しました')
      } else {
        await api.post('/proxies', form)
        toast.success('プロキシを追加しました')
      }
      qc.invalidateQueries(['proxies'])
      onClose()
    } catch { toast.error('エラーが発生しました') } finally { setLoading(false) }
  }

  return (
    <Modal title={isEdit ? 'プロキシ編集' : 'プロキシ追加'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">名前</label>
            <input className="input" required placeholder="わかりやすい名前"
              value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">タイプ</label>
            <select className="input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
              {PROXY_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="label">ホスト</label>
            <input className="input" required placeholder="proxy.example.com または IP"
              value={form.host} onChange={e => setForm(p => ({ ...p, host: e.target.value }))} />
          </div>
          <div>
            <label className="label">ポート</label>
            <input className="input" required type="number" placeholder="8080"
              value={form.port} onChange={e => setForm(p => ({ ...p, port: e.target.value }))} />
          </div>
          <div>
            <label className="label">ユーザー名（任意）</label>
            <input className="input" placeholder="username"
              value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
          </div>
          <div>
            <label className="label">パスワード（任意）</label>
            <input className="input" type="password" placeholder="password"
              value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">キャンセル</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function ProxiesPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editProxy, setEditProxy] = useState(null)
  const [testResults, setTestResults] = useState({})
  const [testing, setTesting] = useState({})

  const { data: proxies = [], isLoading } = useQuery({
    queryKey: ['proxies'],
    queryFn: () => api.get('/proxies')
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/proxies/${id}`),
    onSuccess: () => { toast.success('削除しました'); qc.invalidateQueries(['proxies']) }
  })

  const testProxy = async (proxy) => {
    setTesting(p => ({ ...p, [proxy.id]: true }))
    try {
      const result = await api.post(`/proxies/${proxy.id}/test`)
      setTestResults(p => ({ ...p, [proxy.id]: result }))
      if (result.success) {
        toast.success(`接続成功 — IP: ${result.ip} (${result.latency}ms)`)
      } else {
        toast.error(`接続失敗: ${result.error}`)
      }
    } catch {
      setTestResults(p => ({ ...p, [proxy.id]: { success: false, error: 'テスト失敗' } }))
    } finally {
      setTesting(p => ({ ...p, [proxy.id]: false }))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">プロキシ管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">{proxies.length} 件のプロキシ</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={15} /> プロキシ追加
        </button>
      </div>

      {/* Info box */}
      <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl px-4 py-3 text-xs text-blue-400 space-y-1">
        <p className="font-semibold">プロキシ設定について</p>
        <p>• アカウントごと・スケジュールごとにプロキシを割り当て可能です</p>
        <p>• スケジュールのプロキシはアカウントのプロキシより優先されます</p>
        <p>• HTTP / HTTPS / SOCKS4 / SOCKS5 に対応しています</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : proxies.length === 0 ? (
        <div className="card p-12 flex flex-col items-center text-center">
          <Globe size={40} className="text-gray-700 mb-3" />
          <p className="text-gray-400 font-medium">プロキシが未登録です</p>
          <p className="text-sm text-gray-600 mt-1">「プロキシ追加」からプロキシサーバーを登録してください</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {proxies.map(proxy => {
            const result = testResults[proxy.id]
            const isTesting = testing[proxy.id]
            return (
              <div key={proxy.id} className="card p-4 flex items-center gap-4">
                {/* Icon */}
                <div className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0">
                  <Globe size={15} className="text-gray-400" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-medium text-gray-200">{proxy.name}</p>
                    <span className="badge-blue">{proxy.type.toUpperCase()}</span>
                    {result && (
                      result.success
                        ? <span className="badge-green flex items-center gap-1"><CheckCircle size={10} /> {result.ip} · {result.latency}ms</span>
                        : <span className="badge-red flex items-center gap-1"><XCircle size={10} /> 接続失敗</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 font-mono">
                    {proxy.host}:{proxy.port}
                    {proxy.username && ` · 認証あり`}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {proxy._count?.accounts || 0} アカウント · {proxy._count?.schedules || 0} スケジュール
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => testProxy(proxy)}
                    disabled={isTesting}
                    className="btn-ghost p-2"
                    title="接続テスト"
                  >
                    {isTesting ? <Loader size={13} className="animate-spin" /> : <Wifi size={13} />}
                  </button>
                  <button onClick={() => setEditProxy(proxy)} className="btn-ghost p-2">
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => { if(confirm('削除しますか？')) deleteMutation.mutate(proxy.id) }}
                    className="btn-ghost p-2 text-red-500"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(showAdd || editProxy) && (
        <ProxyModal proxy={editProxy} onClose={() => { setShowAdd(false); setEditProxy(null) }} />
      )}
    </div>
  )
}
