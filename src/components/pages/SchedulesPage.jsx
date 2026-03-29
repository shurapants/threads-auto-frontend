import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Calendar, Clock, Power, Trash2, Edit2, ChevronRight, Repeat } from 'lucide-react'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'
import ScheduleForm from '../ui/ScheduleForm'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

export default function SchedulesPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editSchedule, setEditSchedule] = useState(null)

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => api.get('/schedules')
  })

  const toggleMutation = useMutation({
    mutationFn: (id) => api.patch(`/schedules/${id}/toggle`),
    onSuccess: () => qc.invalidateQueries(['schedules'])
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/schedules/${id}`),
    onSuccess: () => { toast.success('削除しました'); qc.invalidateQueries(['schedules']) }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">スケジュール管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">{schedules.length} 件のスケジュール</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus size={15} /> 新規スケジュール
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : schedules.length === 0 ? (
        <div className="card p-12 flex flex-col items-center text-center">
          <Calendar size={40} className="text-gray-700 mb-3" />
          <p className="text-gray-400 font-medium">スケジュールがありません</p>
          <p className="text-sm text-gray-600 mt-1">「新規スケジュール」から自動投稿を設定してください</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {schedules.map(s => (
            <div key={s.id} className="card p-4">
              <div className="flex items-start gap-3">
                {/* Account avatar */}
                <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0 text-sm font-bold text-brand-400">
                  {s.account?.displayName?.[0]?.toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-gray-200">{s.name}</p>
                    <span className={s.isActive ? 'badge-green' : 'badge-gray'}>
                      {s.isActive ? '稼働中' : '停止中'}
                    </span>
                    <span className="badge-blue">
                      {s.scheduleType === 'weekly' ? '週次' : s.scheduleType === 'calendar' ? 'カレンダー' : '一回'}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 mb-2">@{s.account?.username}</p>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {s.scheduleType === 'weekly' && (
                      <>
                        <span className="flex items-center gap-1">
                          <Repeat size={11} />
                          {s.weekdays.map(d => WEEKDAY_LABELS[d]).join('・')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {String(s.timeHour).padStart(2,'0')}:{String(s.timeMinute).padStart(2,'0')}
                        </span>
                      </>
                    )}
                    {s.scheduleType === 'calendar' && (
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        {s.calendarDates?.length} 件の予約
                      </span>
                    )}
                    {s.nextRunAt && (
                      <span className="flex items-center gap-1 text-brand-400">
                        <ChevronRight size={11} />
                        次回: {format(new Date(s.nextRunAt), 'M/d(E) HH:mm', { locale: ja })}
                      </span>
                    )}
                    <span>{s._count?.logs || 0} 件投稿済み</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 ml-2 shrink-0">
                  <button onClick={() => setEditSchedule(s)} className="btn-ghost p-2">
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => toggleMutation.mutate(s.id)}
                    className={`btn-ghost p-2 ${s.isActive ? 'text-green-400' : 'text-gray-500'}`}
                  >
                    <Power size={13} />
                  </button>
                  <button
                    onClick={() => { if(confirm('削除しますか？')) deleteMutation.mutate(s.id) }}
                    className="btn-ghost p-2 text-red-500"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showForm || editSchedule) && (
        <Modal title={editSchedule ? 'スケジュール編集' : '新規スケジュール'} onClose={() => { setShowForm(false); setEditSchedule(null) }} wide>
          <ScheduleForm
            schedule={editSchedule}
            onClose={() => { setShowForm(false); setEditSchedule(null) }}
          />
        </Modal>
      )}
    </div>
  )
}
