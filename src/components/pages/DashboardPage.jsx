import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Users, FileText, Calendar, Zap, TrendingUp, Clock, CheckCircle, XCircle } from 'lucide-react'
import api from '../../utils/api'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'

function StatCard({ icon: Icon, label, value, sub, color = 'brand' }) {
  const colors = {
    brand: 'text-brand-400 bg-brand-600/10',
    green: 'text-green-400 bg-green-600/10',
    red: 'text-red-400 bg-red-600/10',
    yellow: 'text-yellow-400 bg-yellow-600/10',
  }
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-100">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon size={17} />
        </div>
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs">
      <p className="text-gray-400 mb-0.5">{label}</p>
      <p className="text-brand-400 font-semibold">{payload[0].value} 件</p>
    </div>
  )
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard/stats'),
    refetchInterval: 60000
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const d = data || {}
  const chartData = (d.postsPerDay || []).map(p => ({
    ...p,
    date: format(parseISO(p.date), 'M/d', { locale: ja })
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-100">ダッシュボード</h1>
        <p className="text-sm text-gray-500 mt-0.5">ThreadsAutoの概要</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="連携アカウント" value={d.accounts?.total || 0}
          sub={`${d.accounts?.active || 0} アクティブ`} />
        <StatCard icon={FileText} label="テンプレート" value={d.templates?.total || 0}
          sub={`${d.templates?.folders || 0} フォルダ`} color="yellow" />
        <StatCard icon={Calendar} label="スケジュール" value={d.schedules?.total || 0}
          sub={`${d.schedules?.active || 0} 稼働中`} color="green" />
        <StatCard icon={TrendingUp} label="総投稿数" value={d.posts?.total || 0}
          sub={`過去7日: ${d.posts?.last7 || 0} 件`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">投稿数推移（14日間）</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barSize={8}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={24} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,114,241,0.06)' }} />
              <Bar dataKey="count" fill="#6272f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Post stats */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">投稿ステータス</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-green-400">
                <CheckCircle size={14} /> <span>成功</span>
              </div>
              <span className="text-sm font-semibold text-gray-200">{d.posts?.success || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-red-400">
                <XCircle size={14} /> <span>失敗</span>
              </div>
              <span className="text-sm font-semibold text-gray-200">{d.posts?.failed || 0}</span>
            </div>
            {d.posts?.total > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-800">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>成功率</span>
                  <span>{Math.round((d.posts.success / d.posts.total) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${Math.round((d.posts.success / d.posts.total) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming schedules */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Clock size={14} /> 次回投稿予定
          </h2>
          {d.upcomingSchedules?.length ? (
            <div className="space-y-3">
              {d.upcomingSchedules.map(s => (
                <div key={s.id} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-brand-400">
                    {s.account?.displayName?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{s.name}</p>
                    <p className="text-xs text-gray-500">{s.account?.username}</p>
                  </div>
                  <p className="text-xs text-brand-400 font-mono whitespace-nowrap">
                    {s.nextRunAt ? format(new Date(s.nextRunAt), 'M/d HH:mm') : '-'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">予定なし</p>
          )}
        </div>

        {/* Recent posts */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Zap size={14} /> 最近の投稿
          </h2>
          {d.recentPosts?.length ? (
            <div className="space-y-3">
              {d.recentPosts.slice(0, 5).map(p => (
                <div key={p.id} className="flex items-start gap-3">
                  <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${p.status === 'success' ? 'bg-green-400' : 'bg-red-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 truncate">{p.content?.slice(0, 50)}...</p>
                    <p className="text-xs text-gray-600">{p.account?.username} · {format(new Date(p.postedAt), 'M/d HH:mm')}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">投稿なし</p>
          )}
        </div>
      </div>
    </div>
  )
}
