import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Edit2, Link, Copy, ExternalLink } from 'lucide-react'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'

function UrlModal({ url, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    label: url?.label || '',
    url: url?.url || '',
    description: url?.description || ''
  })
  const [loading, setLoading] = useState(false)
  const isEdit = !!url

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (isEdit) {
        await api.put(`/urls/${url.id}`, form)
        toast.success('URLを更新しました')
      } else {
        await api.post('/urls', form)
        toast.success('URLを登録しました')
      }
      qc.invalidateQueries(['urls'])
      onClose()
    } catch { toast.error('エラーが発生しました') } finally { setLoading(false) }
  }

  return (
    <Modal title={isEdit ? 'URL編集' : 'URL登録'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">ラベル（表示名）<span className="text-red-400"> *</span></label>
          <input className="input" required placeholder="例: 公式サイト"
            value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} />
        </div>
        <div>
          <label className="label">URL <span className="text-red-400">*</span></label>
          <input className="input font-mono text-xs" required placeholder="https://example.com"
            value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} />
        </div>
        <div>
          <label className="label">メモ（任意）</label>
          <input className="input" placeholder="このURLの用途など"
            value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
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

export default function UrlsPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editUrl, setEditUrl] = useState(null)

  const { data: urls = [], isLoading } = useQuery({
    queryKey: ['urls'],
    queryFn: () => api.get('/urls')
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/urls/${id}`),
    onSuccess: () => { toast.success('削除しました'); qc.invalidateQueries(['urls']) }
  })

  const copyUrl = (url) => {
    navigator.clipboard.writeText(url)
    toast.success('コピーしました')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">URL管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            登録したURLはテンプレート編集時にワンクリックで挿入できます
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={15} /> URL登録
        </button>
      </div>

      {/* 説明 */}
      <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl px-4 py-3 text-xs text-blue-400 space-y-1">
        <p className="font-semibold">使い方</p>
        <p>テンプレート作成・編集画面のURLタブから、登録済みのURLをワンクリックで本文に挿入できます</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : urls.length === 0 ? (
        <div className="card p-12 flex flex-col items-center text-center">
          <Link size={40} className="text-gray-700 mb-3" />
          <p className="text-gray-400 font-medium">URLが未登録です</p>
          <p className="text-sm text-gray-600 mt-1">「URL登録」からよく使うURLを登録してください</p>
          <button onClick={() => setShowAdd(true)} className="btn-primary mt-4">
            <Plus size={14} /> URL登録
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {urls.map(u => (
            <div key={u.id} className="card p-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-xl bg-brand-600/10 flex items-center justify-center shrink-0">
                <Link size={15} className="text-brand-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-200">{u.label}</p>
                <p className="text-xs text-gray-500 font-mono truncate">{u.url}</p>
                {u.description && <p className="text-xs text-gray-600 mt-0.5">{u.description}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => copyUrl(u.url)} className="btn-ghost p-2" title="URLをコピー">
                  <Copy size={13} />
                </button>
                <a href={u.url} target="_blank" rel="noopener noreferrer" className="btn-ghost p-2" title="URLを開く">
                  <ExternalLink size={13} />
                </a>
                <button onClick={() => setEditUrl(u)} className="btn-ghost p-2">
                  <Edit2 size={13} />
                </button>
                <button
                  onClick={() => { if (confirm('削除しますか？')) deleteMutation.mutate(u.id) }}
                  className="btn-ghost p-2 text-red-500"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showAdd || editUrl) && (
        <UrlModal url={editUrl} onClose={() => { setShowAdd(false); setEditUrl(null) }} />
      )}
    </div>
  )
}
