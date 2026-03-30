import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Trash2, Power, Send, UserCircle, Settings,
  RefreshCw, CheckCircle, AlertTriangle, XCircle, Loader,
  Key, ChevronDown, ChevronUp, Eye, EyeOff, Copy, ArrowRight
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'

// ── トークン生成ツール ─────────────────────────────────────────
function TokenGenerator({ onTokenReady }) {
  const [open, setOpen] = useState(false)
  const [appId, setAppId] = useState(() => localStorage.getItem('threads_app_id') || '')
  const [appSecret, setAppSecret] = useState(() => localStorage.getItem('threads_app_secret') || '')
  const [showSecret, setShowSecret] = useState(false)
  const [code, setCode] = useState('')
  const [redirectUri, setRedirectUri] = useState(() => localStorage.getItem('threads_redirect_uri') || window.location.origin)
  const [step, setStep] = useState(1) // 1: 設定, 2: コード入力, 3: 完了
  const [longToken, setLongToken] = useState('')
  const [loading, setLoading] = useState(false)

  const saveSettings = () => {
    localStorage.setItem('threads_app_id', appId)
    localStorage.setItem('threads_app_secret', appSecret)
    localStorage.setItem('threads_redirect_uri', redirectUri)
    toast.success('設定を保存しました')
    setStep(2)
  }

  const authUrl = `https://www.threads.net/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=threads_basic,threads_content_publish&response_type=code`

  const convertToken = async () => {
    if (!code.trim()) { toast.error('コードを入力してください'); return }
    if (!appId || !appSecret) { toast.error('アプリIDとシークレットを設定してください'); setStep(1); return }

    // codeから#_を除去
    const cleanCode = code.trim().replace(/#.*$/, '').replace(/\s/g, '')
    setLoading(true)

    try {
      // Step1: 短期トークン取得
      const shortRes = await fetch(
        `https://graph.threads.net/oauth/access_token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: appId,
            client_secret: appSecret,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
            code: cleanCode
          })
        }
      )
      const shortData = await shortRes.json()
      if (shortData.error_message || shortData.error) {
        throw new Error(shortData.error_message || shortData.error?.message || '短期トークンの取得に失敗しました')
      }

      const shortToken = shortData.access_token

      // Step2: 長期トークンに変換
      const longRes = await fetch(
        `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_id=${appId}&client_secret=${appSecret}&access_token=${shortToken}`
      )
      const longData = await longRes.json()
      if (longData.error) {
        throw new Error(longData.error?.message || '長期トークンの変換に失敗しました')
      }

      setLongToken(longData.access_token)
      setStep(3)
      toast.success('長期トークンの取得に成功しました！')
    } catch (err) {
      toast.error(err.message || 'トークン取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const copyToken = () => {
    navigator.clipboard.writeText(longToken)
    toast.success('コピーしました')
  }

  const useToken = () => {
    onTokenReady(longToken)
    setCode('')
    setLongToken('')
    setStep(1)
    setOpen(false)
  }

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-brand-600/20 flex items-center justify-center">
            <Key size={15} className="text-brand-400" />
          </div>
          <div className="text-left">
            <p className="font-medium text-gray-200 text-sm">アクセストークン取得ツール</p>
            <p className="text-xs text-gray-500">コードを貼るだけで長期トークンに自動変換</p>
          </div>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="border-t border-gray-800 p-5 space-y-4">
          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                  ${step >= s ? 'bg-brand-600 text-white' : 'bg-gray-700 text-gray-500'}`}>
                  {s}
                </div>
                <span className={`text-xs ${step >= s ? 'text-gray-300' : 'text-gray-600'}`}>
                  {s === 1 ? 'アプリ設定' : s === 2 ? '認証コード入力' : '完了'}
                </span>
                {s < 3 && <ArrowRight size={12} className="text-gray-600" />}
              </div>
            ))}
          </div>

          {/* Step 1: App settings */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">アプリID</label>
                  <input className="input" placeholder="1234567890"
                    value={appId} onChange={e => setAppId(e.target.value)} />
                </div>
                <div>
                  <label className="label">アプリシークレット</label>
                  <div className="relative">
                    <input
                      className="input pr-10"
                      type={showSecret ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      value={appSecret}
                      onChange={e => setAppSecret(e.target.value)}
                    />
                    <button type="button" onClick={() => setShowSecret(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                      {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="label">リダイレクトURI（Metaのアプリ設定と一致させる）</label>
                <input className="input font-mono text-xs" value={redirectUri} onChange={e => setRedirectUri(e.target.value)} />
              </div>
              <div className="flex justify-end">
                <button onClick={saveSettings} disabled={!appId || !appSecret} className="btn-primary">
                  保存して次へ →
                </button>
              </div>
              {appId && <p className="text-xs text-green-500">✓ 設定済み（ブラウザに保存されています）</p>}
            </div>
          )}

          {/* Step 2: Code input */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl px-4 py-3 space-y-2">
                <p className="text-xs font-semibold text-blue-400">① まず認証URLを開いてください</p>
                <a href={authUrl} target="_blank" rel="noopener noreferrer"
                  className="btn-primary text-xs inline-flex">
                  Threads認証ページを開く ↗
                </a>
                <p className="text-xs text-blue-300/70">認証後にURLに表示される <code className="bg-blue-900/40 px-1 rounded">code=XXXXX</code> の値をコピー</p>
              </div>

              <div>
                <label className="label">② 認証コードを貼り付け</label>
                <textarea className="input font-mono text-xs resize-none" rows={3}
                  placeholder="AQDJlqWJ24dYAVfhS45C_MSiS..."
                  value={code} onChange={e => setCode(e.target.value)} />
                <p className="text-xs text-gray-600 mt-1">末尾の <code>#_</code> は含めても自動で除去されます</p>
              </div>

              <div className="flex justify-between">
                <button onClick={() => setStep(1)} className="btn-ghost text-xs">← 設定に戻る</button>
                <button onClick={convertToken} disabled={loading || !code}
                  className="btn-primary">
                  {loading ? (
                    <><Loader size={14} className="animate-spin" /> 変換中...</>
                  ) : (
                    <>長期トークンに変換</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Done */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="bg-green-900/20 border border-green-800/30 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-green-400 mb-2">✓ 長期トークンの取得に成功しました！</p>
                <div className="relative">
                  <input className="input font-mono text-xs pr-24" value={longToken} readOnly />
                  <button onClick={copyToken}
                    className="absolute right-2 top-1/2 -translate-y-1/2 btn-secondary text-xs py-1 px-2">
                    <Copy size={11} /> コピー
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">有効期限：約60日（更新可能）</p>
              </div>

              <div className="flex justify-between">
                <button onClick={() => { setStep(2); setCode('') }} className="btn-ghost text-xs">← 別のコードで再取得</button>
                <button onClick={useToken} className="btn-primary">
                  このトークンでアカウント追加 →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── アカウント追加モーダル ───────────────────────────────────────
function AddAccountModal({ onClose, proxies, initialToken = '' }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    accessToken: initialToken,
    threadsUserId: '',
    username: '',
    displayName: ''
  })
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
          <textarea className="input font-mono text-xs resize-none" rows={3} required
            placeholder="Threads長期アクセストークン"
            value={form.accessToken} onChange={e => setForm(p => ({ ...p, accessToken: e.target.value }))} />
          <p className="text-xs text-gray-600 mt-1">上のトークン取得ツールから自動入力できます</p>
        </div>
        <div>
          <label className="label">Threads User ID <span className="text-red-400">*</span></label>
          <input className="input" placeholder="数字のユーザーID（user_idの値）" required
            value={form.threadsUserId} onChange={e => setForm(p => ({ ...p, threadsUserId: e.target.value }))} />
          <p className="text-xs text-gray-600 mt-1">短期トークン取得時のレスポンスに含まれる <code className="bg-gray-800 px-1 rounded">user_id</code> の値</p>
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
    e.preventDefault(); setLoading(true)
    try {
      await api.post(`/accounts/${account.id}/test`, { content })
      toast.success('テスト投稿が完了しました！'); onClose()
    } catch (err) { toast.error(err.error || '投稿に失敗しました') } finally { setLoading(false) }
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
  if (status === 'checking') return <span className="badge badge-yellow flex items-center gap-1"><Loader size={10} className="animate-spin" /> 確認中</span>
  if (status === 'ok') return <span className="badge badge-green flex items-center gap-1"><CheckCircle size={10} /> 正常</span>
  if (status === 'suspended') return <span className="badge badge-red flex items-center gap-1"><XCircle size={10} /> 凍結</span>
  return <span className="badge badge-red flex items-center gap-1"><AlertTriangle size={10} /> エラー</span>
}

// ── メインページ ────────────────────────────────────────────────
export default function AccountsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [showAdd, setShowAdd] = useState(false)
  const [initialToken, setInitialToken] = useState('')
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
    onSuccess: () => { toast.success('削除しました'); qc.invalidateQueries(['accounts']) }
  })
  const proxyMutation = useMutation({
    mutationFn: ({ id, proxyId }) => api.patch(`/accounts/${id}/proxy`, { proxyId }),
    onSuccess: () => { toast.success('プロキシを更新しました'); qc.invalidateQueries(['accounts']) }
  })

  const checkStatus = async (acc) => {
    setStatuses(p => ({ ...p, [acc.id]: 'checking' }))
    try {
      await api.get(`/accounts/${acc.id}/status`)
      setStatuses(p => ({ ...p, [acc.id]: 'ok' }))
    } catch (err) {
      const msg = JSON.stringify(err || '')
      setStatuses(p => ({ ...p, [acc.id]: msg.includes('suspend') || msg.includes('凍結') ? 'suspended' : 'error' }))
    }
  }

  const checkAllStatuses = async () => {
    setCheckingAll(true)
    await Promise.allSettled(accounts.map(acc => checkStatus(acc)))
    setCheckingAll(false)
    toast.success('全アカウントの状態確認が完了しました')
  }

  const handleTokenReady = (token) => {
    setInitialToken(token)
    setShowAdd(true)
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
              <RefreshCw size={14} className={checkingAll ? 'animate-spin' : ''} /> 一斉状態確認
            </button>
          )}
          <button onClick={() => { setInitialToken(''); setShowAdd(true) }} className="btn-primary">
            <Plus size={15} /> アカウント追加
          </button>
        </div>
      </div>

      {/* Token generator */}
      <TokenGenerator onTokenReady={handleTokenReady} />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="card p-12 flex flex-col items-center text-center">
          <UserCircle size={40} className="text-gray-700 mb-3" />
          <p className="text-gray-400 font-medium">アカウントが未登録です</p>
          <p className="text-sm text-gray-600 mt-1">上のツールでトークンを取得してからアカウントを追加してください</p>
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
    
      href={`https://www.threads.net/@${acc.username}`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-gray-200 hover:text-brand-400 transition-colors"
      onClick={e => e.stopPropagation()}
    >
      {acc.displayName}
    </a>
    <span className={acc.isActive ? 'badge-green' : 'badge-gray'}>{acc.isActive ? 'アクティブ' : '停止中'}</span>
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
                  {proxies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <div className="flex items-center gap-1">
                  <button onClick={() => navigate(`/accounts/${acc.id}/settings`)} className="btn-primary px-3 py-1.5 text-xs">
                    <Settings size={13} /> 投稿設定
                  </button>
                  <button onClick={() => checkStatus(acc)} disabled={statuses[acc.id] === 'checking'} className="btn-ghost p-2" title="状態確認">
                    <RefreshCw size={13} className={statuses[acc.id] === 'checking' ? 'animate-spin' : ''} />
                  </button>
                  <button onClick={() => setTestAccount(acc)} className="btn-ghost p-2" title="テスト投稿">
                    <Send size={13} />
                  </button>
                  <button onClick={() => toggleMutation.mutate(acc.id)} className={`btn-ghost p-2 ${acc.isActive ? 'text-green-400' : 'text-gray-500'}`}>
                    <Power size={13} />
                  </button>
                  <button onClick={() => { if (confirm('削除しますか？')) deleteMutation.mutate(acc.id) }} className="btn-ghost p-2 text-red-500">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddAccountModal onClose={() => { setShowAdd(false); setInitialToken('') }} proxies={proxies} initialToken={initialToken} />}
      {testAccount && <TestPostModal account={testAccount} onClose={() => setTestAccount(null)} />}
    </div>
  )
}
