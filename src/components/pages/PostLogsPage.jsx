import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle, XCircle, Clock, Filter, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '../../utils/api'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

export default function PostLogsPage() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [accountId, setAccountId] = useState('')
  const limit = 50

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts')
  })

  const { data, isLoading } = useQuery({
    queryKey: ['logs', page, status, accountId],
    queryFn: () => {
      const params = new URLSearchParams({ page, limit })
      if (status) params.set('status', status)
      if (accountId) params.set('accountId', accountId)
      return api.get(`/posts?${params}`)
    }
  })

  const logs = data?.logs || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / limit)

  const statusIcon = (s) => {
    if (s === 'success') return <CheckCircle size={13} className="text-green-400" />
    if (s === 'failed') return <XCircle size={13} className="text-red-400" />
    return <Clock size={13} className="text-yellow-400" />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">投稿ログ</h1>
          <p className="text-sm text-gray-500 mt-0.5">合計 {total} 件</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2">
          <Filter size={13} className="text-gray-500" />
          <select
            className="bg-transparent text-sm text-gray-300 outline-none"
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1) }}
          >
            <option value="">すべてのステータス</option>
            <option value="success">成功</option>
            <option value="failed">失敗</option>
            <option value="pending">保留中</option>
          </select>
        </div>
        <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2">
          <select
            className="bg-transparent text-sm text-gray-300 outline-none"
            value={accountId}
            onChange={e => { setAccountId(e.target.value); setPage(1) }}
          >
            <option value="">すべてのアカウント</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>@{a.username}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">ステータス</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">アカウント</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">内容</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">スケジュール</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">投稿日時</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">プロキシ</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-600">ログがありません</td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {statusIcon(log.status)}
                        <span className={`text-xs ${log.status === 'success' ? 'text-green-400' : log.status === 'failed' ? 'text-red-400' : 'text-yellow-400'}`}>
                          {log.status === 'success' ? '成功' : log.status === 'failed' ? '失敗' : '保留'}
                        </span>
                      </div>
                      {log.errorMsg && (
                        <p className="text-xs text-red-500/70 mt-0.5 max-w-[120px] truncate" title={log.errorMsg}>
                          {log.errorMsg}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-300 text-xs">@{log.account?.username}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-400 text-xs max-w-xs truncate">{log.content}</p>
                      {log.threadId && (
                        <a
                          href={`https://www.threads.net/t/${log.threadId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-brand-400 hover:underline"
                          onClick={e => e.stopPropagation()}
                        >
                          Threadsで表示 ↗
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {log.schedule?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">
                      {format(new Date(log.postedAt), 'M/d HH:mm:ss', { locale: ja })}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 font-mono">
                      {log.proxyUsed || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <p className="text-xs text-gray-500">{(page - 1) * limit + 1}〜{Math.min(page * limit, total)} 件 / {total} 件</p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost p-2 disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-gray-500 px-2 py-2">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-ghost p-2 disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
