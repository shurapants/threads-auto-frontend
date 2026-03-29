import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Folder, FileText, Trash2, Edit2, Search, FolderPlus, MoreVertical, Move } from 'lucide-react'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'

const FOLDER_COLORS = ['#6272f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899']

function FolderModal({ folder, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: folder?.name || '', color: folder?.color || '#6272f1' })
  const [loading, setLoading] = useState(false)
  const isEdit = !!folder

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (isEdit) {
        await api.put(`/folders/${folder.id}`, form)
        toast.success('フォルダを更新しました')
      } else {
        await api.post('/folders', form)
        toast.success('フォルダを作成しました')
      }
      qc.invalidateQueries(['folders'])
      onClose()
    } catch { toast.error('エラーが発生しました') } finally { setLoading(false) }
  }

  return (
    <Modal title={isEdit ? 'フォルダ編集' : '新規フォルダ'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">フォルダ名</label>
          <input className="input" required placeholder="フォルダ名を入力"
            value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div>
          <label className="label">カラー</label>
          <div className="flex gap-2 flex-wrap">
            {FOLDER_COLORS.map(c => (
              <button key={c} type="button"
                className={`w-7 h-7 rounded-lg transition-all ${form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setForm(p => ({ ...p, color: c }))}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">キャンセル</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function TemplateModal({ template, folderId, folders, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    title: template?.title || '',
    content: template?.content || '',
    folderId: template?.folderId || folderId || '',
    tags: template?.tags?.join(', ') || ''
  })
  const [loading, setLoading] = useState(false)
  const isEdit = !!template

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    const payload = {
      ...form,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : []
    }
    try {
      if (isEdit) {
        await api.put(`/templates/${template.id}`, payload)
        toast.success('テンプレートを更新しました')
      } else {
        await api.post('/templates', payload)
        toast.success('テンプレートを作成しました')
      }
      qc.invalidateQueries(['templates'])
      onClose()
    } catch { toast.error('エラーが発生しました') } finally { setLoading(false) }
  }

  return (
    <Modal title={isEdit ? 'テンプレート編集' : '新規テンプレート'} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">タイトル</label>
          <input className="input" required placeholder="テンプレート名"
            value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
        </div>
        <div>
          <label className="label">
            内容
            <span className="text-gray-600 ml-2 text-xs font-normal">
              変数: {'{{date}}'} {'{{time}}'} {'{{year}}'} {'{{month}}'} {'{{day}}'}
            </span>
          </label>
          <textarea className="input resize-none font-mono text-xs" rows={8} required
            placeholder="投稿内容を入力... &#10;例: 今日は{{date}}です！"
            value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} />
          <p className="text-xs text-gray-600 mt-1 text-right">{form.content.length}/500文字</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">フォルダ</label>
            <select className="input" value={form.folderId}
              onChange={e => setForm(p => ({ ...p, folderId: e.target.value }))}>
              <option value="">未分類</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">タグ（カンマ区切り）</label>
            <input className="input" placeholder="タグ1, タグ2"
              value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">キャンセル</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function TemplatesPage() {
  const qc = useQueryClient()
  const [selectedFolder, setSelectedFolder] = useState(null) // null = all
  const [search, setSearch] = useState('')
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [editFolder, setEditFolder] = useState(null)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editTemplate, setEditTemplate] = useState(null)
  const [selected, setSelected] = useState([])

  const { data: folders = [] } = useQuery({ queryKey: ['folders'], queryFn: () => api.get('/folders') })
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates', selectedFolder, search],
    queryFn: () => {
      const params = new URLSearchParams()
      if (selectedFolder) params.set('folderId', selectedFolder)
      if (search) params.set('search', search)
      return api.get(`/templates?${params}`)
    }
  })

  const deleteTemplate = useMutation({
    mutationFn: (id) => api.delete(`/templates/${id}`),
    onSuccess: () => { toast.success('削除しました'); qc.invalidateQueries(['templates']) }
  })

  const deleteFolder = useMutation({
    mutationFn: (id) => api.delete(`/folders/${id}`),
    onSuccess: () => { toast.success('フォルダを削除しました'); qc.invalidateQueries(['folders', 'templates']) }
  })

  const bulkDelete = async () => {
    if (!selected.length) return
    if (!confirm(`${selected.length}件を削除しますか？`)) return
    await api.post('/templates/bulk-delete', { ids: selected })
    toast.success('削除しました')
    setSelected([])
    qc.invalidateQueries(['templates'])
  }

  const toggleSelect = (id) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const allTemplateCount = folders.reduce((a, f) => a + (f._count?.templates || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">テンプレート管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">{templates.length} 件</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFolderModal(true)} className="btn-secondary">
            <FolderPlus size={15} /> フォルダ作成
          </button>
          <button onClick={() => setShowTemplateModal(true)} className="btn-primary">
            <Plus size={15} /> テンプレート作成
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Sidebar: folders */}
        <div className="w-52 shrink-0 space-y-1">
          <button
            onClick={() => setSelectedFolder(null)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all
              ${selectedFolder === null ? 'bg-brand-600/20 text-brand-400' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
          >
            <FileText size={14} />
            <span className="flex-1 text-left">すべて</span>
          </button>
          {folders.map(f => (
            <div key={f.id} className="group relative">
              <button
                onClick={() => setSelectedFolder(f.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all
                  ${selectedFolder === f.id ? 'bg-brand-600/20 text-brand-400' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
              >
                <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: f.color }} />
                <span className="flex-1 text-left truncate">{f.name}</span>
                <span className="text-xs opacity-60">{f._count?.templates || 0}</span>
              </button>
              <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-0.5">
                <button onClick={() => setEditFolder(f)} className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300">
                  <Edit2 size={11} />
                </button>
                <button onClick={() => { if(confirm('フォルダを削除しますか？（テンプレートは未分類に移動）')) deleteFolder.mutate(f.id) }}
                  className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-red-400">
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Main: templates */}
        <div className="flex-1 space-y-3">
          {/* Search + bulk actions */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input className="input pl-8" placeholder="テンプレートを検索..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {selected.length > 0 && (
              <button onClick={bulkDelete} className="btn-danger">
                <Trash2 size={14} /> {selected.length}件削除
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : templates.length === 0 ? (
            <div className="card p-12 flex flex-col items-center text-center">
              <FileText size={36} className="text-gray-700 mb-3" />
              <p className="text-gray-400 font-medium">テンプレートがありません</p>
              <p className="text-sm text-gray-600 mt-1">「テンプレート作成」から追加してください</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {templates.map(t => (
                <div
                  key={t.id}
                  className={`card p-4 flex items-start gap-3 cursor-pointer hover:border-gray-700 transition-colors
                    ${selected.includes(t.id) ? 'border-brand-600/50 bg-brand-600/5' : ''}`}
                  onClick={() => toggleSelect(t.id)}
                >
                  <input type="checkbox" checked={selected.includes(t.id)} readOnly
                    className="mt-0.5 rounded accent-brand-500" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-gray-200 text-sm">{t.title}</p>
                      {t.folder && (
                        <span className="text-xs px-2 py-0.5 rounded-md" style={{ backgroundColor: t.folder.color + '22', color: t.folder.color }}>
                          {t.folder.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">{t.content}</p>
                    {t.tags?.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {t.tags.map(tag => <span key={tag} className="badge-gray text-xs">{tag}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button onClick={e => { e.stopPropagation(); setEditTemplate(t) }} className="btn-ghost p-1.5">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); if(confirm('削除しますか？')) deleteTemplate.mutate(t.id) }} className="btn-ghost p-1.5 text-red-500">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {(showFolderModal || editFolder) && (
        <FolderModal folder={editFolder} onClose={() => { setShowFolderModal(false); setEditFolder(null) }} />
      )}
      {(showTemplateModal || editTemplate) && (
        <TemplateModal
          template={editTemplate}
          folderId={selectedFolder}
          folders={folders}
          onClose={() => { setShowTemplateModal(false); setEditTemplate(null) }}
        />
      )}
    </div>
  )
}
