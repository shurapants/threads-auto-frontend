import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Power, Send, UserCircle, Settings, RefreshCw, CheckCircle, AlertTriangle, XCircle, Loader } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'

function AddAccountModal({ onClose, proxies }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ accessToken: '', threadsUserId: '', username: '', displayName: '' })
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/accounts/add', form)
      toast.success('アカウントを追加しました')
      qc.invalidateQueries(['accounts'])
      onClose()
    } catch (err) {
      toast.error(err.error || 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="アカウント追加" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">アクセストークン <span className="text-red-400">*</span></label>
          <input className="input" placeholder="Threads Access Token" required
            value={form.accessToken} onChange={e => setForm(p => ({ ...p, accessToken: e.target.value }))} />
          <p className="text-xs text-gray-600 mt-1">Meta Developer AppからThreads APIのアクセストークンを取得</p>
        </div>
        <div>
          <label className="label">Threads User ID <span className="text-red-400">*</span></label>
          <input className="input" placeholder="数字のユーザーID" required
            value={form.threadsUserId} onChange={e => setForm(p => ({ ...p, threadsUserId: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">ユーザー名（任意）</label>
            <input className="input" placeholder="@username"
              value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
          </div>
          <div>
            <label className="label">表示名（任意）</label>
            <input className="input" placeholder="表示名"
              value={form.displayName} onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">キャンセル</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? '追加中...' : 'アカウントを追加'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function TestPostModal({ account, onClose }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post(`/accounts/${account.id}/test`, { content })
      toast.success('テスト投稿が完了しました！')
      onClose()
    } catch (err) {
      toast.error(err.error || '投稿に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title={`テスト投稿 — @${account.username}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">投稿内容</label>
          <textarea className="input resize-none" rows={4} required maxLength={500}
            placeholder="投稿するテキストを入力..."
            value={content} onChange={e => setContent(e.target.value)} />
          <p className="text-xs text-gray-600 mt-1 text-right">{content.length}/500</p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">キャンセル</button>
          <button type="submit" disabled={loading || !content} className="btn-primary">
            <Send size={14} /> {loading ? '投稿中...' : '投稿する'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function StatusBadge({ status }) {
  if (!status) return null
  if (status === 'checking') return (
    <span className="badge badge-yellow flex items-center gap-1">
      <Loader size={10} className="animate-spin" /> 確認中
    </span>
  )
  if (status === 'ok') return (
    <span className="badge badge-green flex items-center gap-1">
      <CheckCircle size={10} /> 正常
    </span>
  )
  if (status === 'suspended') return (
    <span className="badge badge-red flex items-center gap-1">
      <XCircle size={10} /> 凍結
    </span>
  )
  return (
    <span className="badge badge-red flex items-center gap-1">
      <AlertTriangle size={10} /> エラー
    </span>
  )
}

export default function AccountsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [showAdd, setShowAdd] = useState(false)
  const [testAccount, setTestAccount] = useState(null)
  const [statuses, setStatuses] = useState({})
  const [checkingAll, setCheckingAll] = useState(false)

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts')
  })

  const { data: proxies = [] } = useQuery({
    queryKey: ['proxies'],
    queryFn: () => api.get('/proxies')
  })

  const toggleMutation = useMutation({
    mutationFn: (id) => api.patch(`/accounts/${id}/toggle`),
    onSuccess: () => qc.invalidateQueries(['accounts'])
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/accounts/${id}`),
    onSuccess: () => {
      toast.success('アカウントを削除しました')
      qc.invalidateQueries(['accounts'])
    }
  })

  const proxyMutation = useMutation({
    mutationFn: ({ id, proxyId }) => api.patch(`/accounts/${id}/proxy`, { proxyId }),
    onSuccess: () => {
      toast.success('プロキシを更新しました')
      qc.invalidateQueries(['accounts'])
    }
  })

  const checkStatus = async (acc) => {
    setStatuses(p => ({ ...p, [acc.id]: 'checking' }))
    try {
      await api.get(`/accounts/${acc.id}/status`)
      setStatuses(p => ({ ...p, [acc.id]: 'ok' }))
    } catch (err) {
      const msg = JSON.stringify(err || '')
      if (msg.includes('suspend') || msg.includes('block') || msg.includes('凍結')) {
        setStatuses(p => ({ ...p, [acc.id]: 'suspended' }))
      } else {
        setStatuses(p => ({ ...p, [acc.id]: 'error' }))
      }
    }
  }

  const checkAllStatuses = async () => {
    setCheckingAll(true)
    await Promise.allSettled(accounts.map(acc => checkStatus(acc)))
    setCheckingAll(false)
    toast.success('全アカウントの状態確認が完了しました')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">アカウント管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">{accounts.length} 件のアカウント</p>
        </div>
        <div className="flex gap-2">
          {accounts.length > 0 && (
            <button onClick={checkAllStatuses} disabled={checkingAll} className="btn-secondary">
              <RefreshCw size={14} className={checkingAll ? 'animate-spin' : ''} />
              一斉状態確認
            </button>
          )}
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus size={15} /> アカウント追加
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="card p-12 flex flex-col items-center text-center">
          <UserCircle size={40} className="text-gray-700 mb-3" />
          <p className="text-gray-400 font-medium">アカウントが未登録です</p>
          <p className="text-sm text-gray-600 mt-1">「アカウント追加」からThreadsアカウントを連携してください</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {accounts.map(acc => (
            <div key={acc.id} className="card p-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {acc.avatar
                    ? <img src={acc.avatar} alt="" className="w-full h-full object-cover" />
                    : <span className="text-sm font-bold text-brand-400">{acc.displayName?.[0]?.toUpperCase()}</span>
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-200">{acc.displayName}</p>
                    <span className={acc.isActive ? 'badge-green' : 'badge-gray'}>
                      {acc.isActive ? 'アクティブ' : '停止中'}
                    </span>
                    <StatusBadge status={statuses[acc.id]} />
                  </div>
                  <p className="text-sm text-gray-500">@{acc.username}</p>
                </div>

                <select
                  className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300 w-36"
                  value={acc.proxyId || ''}
                  onChange={e => proxyMutation.mutate({ id: acc.id, proxyId: e.target.value || null })}
                >
                  <option value="">プロキシなし</option>
                  {proxies.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => navigate(`/accounts/${acc.id}/settings`)}
                    className="btn-primary px-3 py-1.5 text-xs"
                  >
                    <Settings size={13} /> 投稿設定
                  </button>
                  <button
                    onClick={() => checkStatus(acc)}
                    disabled={statuses[acc.id] === 'checking'}
                    className="btn-ghost p-2"
                    title="状態確認"
                  >
                    <RefreshCw size={13} className={statuses[acc.id] === 'checking' ? 'animate-spin' : ''} />
                  </button>
                  <button onClick={() => setTestAccount(acc)} className="btn-ghost p-2" title="テスト投稿">
                    <Send size={13} />
                  </button>
                  <button
                    onClick={() => toggleMutation.mutate(acc.id)}
                    className={`btn-ghost p-2 ${acc.isActive ? 'text-green-400' : 'text-gray-500'}`}
                  >
                    <Power size={13} />
                  </button>
                  <button
                    onClick={() => { if (confirm('このアカウントを削除しますか？')) deleteMutation.mutate(acc.id) }}
                    className="btn-ghost p-2 text-red-500 hover:text-red-400"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddAccountModal onClose={() => setShowAdd(false)} proxies={proxies} />}
      {testAccount && <TestPostModal account={testAccount} onClose={() => setTestAccount(null)} />}
    </div>
  )
}
