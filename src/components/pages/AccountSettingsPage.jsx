import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, Save, Clock, Calendar, Repeat, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns'
import { ja } from 'date-fns/locale'
import api from '../../utils/api'
import toast from 'react-hot-toast'

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

// 5分刻みの時間一覧を生成
const TIME_SLOTS = []
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 5) {
    TIME_SLOTS.push({
      label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      hour: h,
      minute: m
    })
  }
}

function TimeGrid({ selectedTimes, onToggle }) {
  return (
    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1">
      {TIME_SLOTS.map(slot => {
        const isSelected = selectedTimes.some(t => t.hour === slot.hour && t.minute === slot.minute)
        return (
          <button
            key={slot.label}
            type="button"
            onClick={() => onToggle(slot)}
            className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all
              ${isSelected
                ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
          >
            {slot.label}
          </button>
        )
      })}
    </div>
  )
}

function CalendarPicker({ selectedDates, onToggle }) {
  const [viewDate, setViewDate] = useState(new Date())
  const [timeHour, setTimeHour] = useState(9)
  const [timeMinute, setTimeMinute] = useState(0)

  const days = eachDayOfInterval({ start: startOfMonth(viewDate), end: endOfMonth(viewDate) })
  const firstDow = startOfMonth(viewDate).getDay()

  const handleDayClick = (day) => {
    const dt = new Date(day)
    dt.setHours(timeHour, timeMinute, 0, 0)
    onToggle(dt)
  }

  const isDaySelected = (day) => selectedDates.some(d => isSameDay(new Date(d), day))

  return (
    <div className="bg-gray-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setViewDate(subMonths(viewDate, 1))} className="p-1 rounded-lg hover:bg-gray-700 text-gray-400">
          <ChevronLeft size={15} />
        </button>
        <span className="text-sm font-semibold text-gray-200">
          {format(viewDate, 'yyyy年M月', { locale: ja })}
        </span>
        <button type="button" onClick={() => setViewDate(addMonths(viewDate, 1))} className="p-1 rounded-lg hover:bg-gray-700 text-gray-400">
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="flex items-center gap-2 bg-gray-900 rounded-xl px-3 py-2">
        <Clock size={13} className="text-gray-500" />
        <span className="text-xs text-gray-500">時刻:</span>
        <select className="bg-transparent text-xs text-gray-300 outline-none" value={timeHour} onChange={e => setTimeHour(parseInt(e.target.value))}>
          {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}時</option>)}
        </select>
        <select className="bg-transparent text-xs text-gray-300 outline-none" value={timeMinute} onChange={e => setTimeMinute(parseInt(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => <option key={i} value={i * 5}>{String(i * 5).padStart(2, '0')}分</option>)}
        </select>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAY_LABELS.map((d, i) => (
          <div key={d} className={`text-center text-xs py-1 font-medium ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstDow }, (_, i) => <div key={`e${i}`} />)}
        {days.map(day => {
          const sel = isDaySelected(day)
          const isToday = isSameDay(day, new Date())
          const dow = day.getDay()
          return (
            <button key={day.toISOString()} type="button" onClick={() => handleDayClick(day)}
              className={`aspect-square rounded-lg text-xs font-medium transition-all
                ${sel ? 'bg-brand-600 text-white' : isToday ? 'bg-gray-700 text-brand-400' : 'hover:bg-gray-700'}
                ${!sel && dow === 0 ? 'text-red-400' : !sel && dow === 6 ? 'text-blue-400' : !sel ? 'text-gray-300' : ''}`}>
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function AccountSettingsPage() {
  const { accountId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [scheduleType, setScheduleType] = useState('weekly')
  const [weekdays, setWeekdays] = useState([1, 2, 3, 4, 5]) // Mon-Fri default
  const [selectedTimes, setSelectedTimes] = useState([]) // [{ hour, minute, label }]
  const [calendarDates, setCalendarDates] = useState([])
  const [postMode, setPostMode] = useState('random')
  const [folderId, setFolderId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [customContent, setCustomContent] = useState('')
  const [timezone, setTimezone] = useState('Asia/Tokyo')
  const [scheduleName, setScheduleName] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: account } = useQuery({
    queryKey: ['account', accountId],
    queryFn: () => api.get(`/accounts`).then(list => list.find(a => a.id === accountId))
  })

  const { data: folders = [] } = useQuery({ queryKey: ['folders'], queryFn: () => api.get('/folders') })
  const { data: templates = [] } = useQuery({
    queryKey: ['templates', folderId],
    queryFn: () => api.get(folderId ? `/templates?folderId=${folderId}` : '/templates')
  })

  const { data: existingSchedules = [] } = useQuery({
    queryKey: ['schedules', accountId],
    queryFn: () => api.get('/schedules').then(list => list.filter(s => s.accountId === accountId))
  })

  const toggleWeekday = (d) => setWeekdays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d])

  const toggleTime = (slot) => {
    setSelectedTimes(p => {
      const exists = p.findIndex(t => t.hour === slot.hour && t.minute === slot.minute)
      if (exists >= 0) return p.filter((_, i) => i !== exists)
      return [...p, slot].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
    })
  }

  const toggleCalendarDate = (date) => {
    setCalendarDates(p => {
      const exists = p.findIndex(d => isSameDay(new Date(d), date))
      if (exists >= 0) return p.filter((_, i) => i !== exists)
      return [...p, date].sort((a, b) => new Date(a) - new Date(b))
    })
  }

  const deleteSchedule = async (id) => {
    if (!confirm('このスケジュールを削除しますか？')) return
    await api.delete(`/schedules/${id}`)
    toast.success('削除しました')
    qc.invalidateQueries(['schedules', accountId])
  }

  // 時間ごとにスケジュールを一括作成
  const handleSave = async () => {
    if (scheduleType === 'weekly' && selectedTimes.length === 0) {
      toast.error('時間を1つ以上選択してください')
      return
    }
    if (scheduleType === 'weekly' && weekdays.length === 0) {
      toast.error('曜日を1つ以上選択してください')
      return
    }
    if (scheduleType === 'calendar' && calendarDates.length === 0) {
      toast.error('日付を1つ以上選択してください')
      return
    }

    setSaving(true)
    try {
      if (scheduleType === 'weekly') {
        // 選択した時間ごとにスケジュールを作成
        for (const slot of selectedTimes) {
          await api.post('/schedules', {
            name: scheduleName || `${account?.displayName} ${slot.label}`,
            accountId,
            scheduleType: 'weekly',
            weekdays,
            timeHour: slot.hour,
            timeMinute: slot.minute,
            postMode,
            folderId: folderId || null,
            templateId: templateId || null,
            customContent,
            timezone,
            isActive: true
          })
        }
        toast.success(`${selectedTimes.length}件のスケジュールを作成しました`)
      } else {
        await api.post('/schedules', {
          name: scheduleName || `${account?.displayName} カレンダー`,
          accountId,
          scheduleType: 'calendar',
          calendarDates: calendarDates.map(d => new Date(d).toISOString()),
          postMode,
          folderId: folderId || null,
          templateId: templateId || null,
          customContent,
          timezone,
          isActive: true
        })
        toast.success('スケジュールを作成しました')
      }
      qc.invalidateQueries(['schedules', accountId])
      qc.invalidateQueries(['schedules'])
      setSelectedTimes([])
      setCalendarDates([])
      setScheduleName('')
    } catch (err) {
      toast.error(err.error || 'エラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/accounts')} className="btn-ghost p-2">
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-3">
          {account?.avatar && (
            <img src={account.avatar} alt="" className="w-8 h-8 rounded-full" />
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-100">{account?.displayName}</h1>
            <p className="text-sm text-gray-500">@{account?.username} の投稿設定</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Schedule form */}
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-5 space-y-5">
            <h2 className="font-semibold text-gray-200 flex items-center gap-2">
              <Clock size={15} /> 新規スケジュール追加
            </h2>

            {/* Schedule name */}
            <div>
              <label className="label">スケジュール名（任意）</label>
              <input className="input" placeholder="例: 朝の投稿" value={scheduleName} onChange={e => setScheduleName(e.target.value)} />
            </div>

            {/* Type selector */}
            <div>
              <label className="label">スケジュールタイプ</label>
              <div className="flex rounded-xl bg-gray-800 p-1 gap-1">
                {[
                  { v: 'weekly', icon: Repeat, label: '曜日ごと' },
                  { v: 'calendar', icon: Calendar, label: 'カレンダー指定' },
                ].map(({ v, icon: Icon, label }) => (
                  <button key={v} type="button" onClick={() => setScheduleType(v)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all
                      ${scheduleType === v ? 'bg-gray-700 text-gray-100 shadow' : 'text-gray-400 hover:text-gray-200'}`}>
                    <Icon size={13} /> {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Weekly: weekday selector */}
            {scheduleType === 'weekly' && (
              <>
                <div>
                  <label className="label">曜日</label>
                  <div className="flex gap-1.5">
                    {WEEKDAY_LABELS.map((d, i) => (
                      <button key={i} type="button" onClick={() => toggleWeekday(i)}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all
                          ${weekdays.includes(i) ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label flex items-center gap-2">
                    <Clock size={13} /> 投稿時間（5分刻み・複数選択可）
                    {selectedTimes.length > 0 && (
                      <span className="badge-blue ml-1">{selectedTimes.length}件選択中</span>
                    )}
                  </label>
                  <TimeGrid selectedTimes={selectedTimes} onToggle={toggleTime} />
                  {selectedTimes.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-2">
                      {selectedTimes.map(t => (
                        <span key={t.label} className="badge-blue flex items-center gap-1">
                          {t.label}
                          <button type="button" onClick={() => toggleTime(t)}>
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Calendar */}
            {scheduleType === 'calendar' && (
              <div className="space-y-3">
                <label className="label">投稿日時を選択（複数可）</label>
                <CalendarPicker selectedDates={calendarDates} onToggle={toggleCalendarDate} />
                {calendarDates.length > 0 && (
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {calendarDates.map((d, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-1.5">
                        <span className="text-xs text-gray-300 font-mono">
                          {format(new Date(d), 'yyyy/MM/dd(E) HH:mm', { locale: ja })}
                        </span>
                        <button type="button" onClick={() => toggleCalendarDate(new Date(d))} className="text-gray-500 hover:text-red-400">
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Content settings */}
            <div className="border-t border-gray-800 pt-4 space-y-3">
              <label className="label">投稿モード</label>
              <div className="flex rounded-xl bg-gray-800 p-1 gap-1">
                {[
                  { v: 'random', label: 'ランダム' },
                  { v: 'sequential', label: '順番' },
                  { v: 'fixed', label: '固定テキスト' },
                ].map(({ v, label }) => (
                  <button key={v} type="button" onClick={() => setPostMode(v)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all
                      ${postMode === v ? 'bg-gray-700 text-gray-100 shadow' : 'text-gray-400 hover:text-gray-200'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {postMode !== 'fixed' && (
                <div>
                  <label className="label">テンプレートフォルダ</label>
                  <select className="input" value={folderId} onChange={e => { setFolderId(e.target.value); setTemplateId('') }}>
                    <option value="">フォルダを選択</option>
                    {folders.map(f => <option key={f.id} value={f.id}>{f.name} ({f._count?.templates}件)</option>)}
                  </select>
                </div>
              )}

              {postMode !== 'fixed' && !folderId && (
                <div>
                  <label className="label">特定テンプレート（任意）</label>
                  <select className="input" value={templateId} onChange={e => setTemplateId(e.target.value)}>
                    <option value="">テンプレートを選択</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="label">{postMode === 'fixed' ? '固定テキスト' : 'フォールバックテキスト'}</label>
                <textarea className="input resize-none font-mono text-xs" rows={3}
                  placeholder="投稿内容... {{date}} {{time}} などの変数が使えます"
                  value={customContent} onChange={e => setCustomContent(e.target.value)}
                  required={postMode === 'fixed'} />
              </div>
            </div>

            <button onClick={handleSave} disabled={saving} className="btn-primary w-full justify-center py-2.5">
              <Save size={15} /> {saving ? '保存中...' : 'スケジュールを保存'}
            </button>
          </div>
        </div>

        {/* Right: Existing schedules */}
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-300 text-sm flex items-center gap-2">
            <Calendar size={14} /> 登録済みスケジュール
            <span className="badge-blue">{existingSchedules.length}件</span>
          </h2>

          {existingSchedules.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-sm text-gray-600">スケジュールなし</p>
            </div>
          ) : (
            <div className="space-y-2">
              {existingSchedules.map(s => (
                <div key={s.id} className="card p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-300 truncate">{s.name}</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {s.scheduleType === 'weekly'
                        ? `${s.weekdays.map(d => WEEKDAY_LABELS[d]).join('・')} ${String(s.timeHour).padStart(2,'0')}:${String(s.timeMinute).padStart(2,'0')}`
                        : `カレンダー ${s.calendarDates?.length}件`
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={s.isActive ? 'badge-green' : 'badge-gray'}>
                      {s.isActive ? 'ON' : 'OFF'}
                    </span>
                    <button onClick={() => deleteSchedule(s.id)} className="btn-ghost p-1.5 text-red-500">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
