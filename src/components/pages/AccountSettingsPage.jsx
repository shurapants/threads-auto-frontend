import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Plus, Trash2, Save, Clock, Calendar, Repeat,
  ChevronLeft, ChevronRight, X, RefreshCw
} from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, addMonths, subMonths
} from 'date-fns'
import { ja } from 'date-fns/locale'
import api from '../../utils/api'
import toast from 'react-hot-toast'

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']
const WEEKDAY_FULL = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日']

// ── 開運カレンダーデータ ─────────────────────────────────────
const MOON_PHASES = {
  // 新月 🌑
  new: new Set([
    '2025-01-29','2025-02-28','2025-03-29','2025-04-28','2025-05-27',
    '2025-06-26','2025-07-25','2025-08-24','2025-09-22','2025-10-22',
    '2025-11-20','2025-12-20',
    '2026-01-18','2026-02-17','2026-03-19','2026-04-17','2026-05-17',
    '2026-06-15','2026-07-15','2026-08-13','2026-09-12','2026-10-11',
    '2026-11-10','2026-12-09',
  ]),
  // 満月 🌕
  full: new Set([
    '2025-01-14','2025-02-13','2025-03-14','2025-04-13','2025-05-12',
    '2025-06-11','2025-07-11','2025-08-09','2025-09-08','2025-10-07',
    '2025-11-06','2025-12-05',
    '2026-01-04','2026-02-02','2026-03-04','2026-04-02','2026-05-02',
    '2026-05-31','2026-06-30','2026-07-29','2026-08-28','2026-09-26',
    '2026-10-26','2026-11-25','2026-12-24',
  ]),
}

// 一粒万倍日 🌾
const ICHIRYUMAN = new Set([
  '2025-01-13','2025-01-25','2025-02-06','2025-02-12','2025-03-17',
  '2025-04-01','2025-04-19','2025-05-24','2025-05-25','2025-06-06',
  '2025-06-18','2025-07-24','2025-07-27','2025-08-17','2025-08-29',
  '2025-09-13','2025-09-22','2025-10-04','2025-10-22','2025-11-09',
  '2025-11-21','2025-12-21','2025-12-27',
  '2026-01-08','2026-01-20','2026-02-01','2026-02-07','2026-03-12',
  '2026-04-14','2026-04-26','2026-05-19','2026-05-20','2026-06-01',
  '2026-06-13','2026-07-19','2026-07-22','2026-08-12','2026-08-24',
  '2026-09-08','2026-09-17','2026-10-17','2026-10-29','2026-11-04',
  '2026-11-16','2026-12-16','2026-12-22',
])

function getDayInfo(dateStr) {
  const isNew = MOON_PHASES.new.has(dateStr)
  const isFull = MOON_PHASES.full.has(dateStr)
  const isIchiryuman = ICHIRYUMAN.has(dateStr)
  const holiday = HOLIDAYS[dateStr] || null
  return { isNew, isFull, isIchiryuman, holiday }
}

// ── 時間グリッド ─────────────────────────────────────────────
const TIME_SLOTS = []
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 5) {
    TIME_SLOTS.push({ label: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`, hour: h, minute: m })
  }
}

function TimeGrid({ onSelect }) {
  return (
    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1">
      {TIME_SLOTS.map(slot => (
        <button key={slot.label} type="button" onClick={() => onSelect(slot)}
          className="px-2 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-400 hover:bg-brand-600 hover:text-white transition-all">
          {slot.label}
        </button>
      ))}
    </div>
  )
}

function SlotRow({ slot, folders, templates, onUpdate, onRemove }) {
  return (
    <div className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-2">
      <span className="text-sm font-mono font-semibold text-brand-400 w-14 shrink-0">{slot.label}</span>
      <select
        className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300 outline-none"
        value={slot.folderId ? `folder:${slot.folderId}` : slot.templateId ? `template:${slot.templateId}` : ''}
        onChange={e => {
          const val = e.target.value
          if (val.startsWith('folder:')) onUpdate({ ...slot, folderId: val.replace('folder:', ''), templateId: '' })
          else if (val.startsWith('template:')) onUpdate({ ...slot, folderId: '', templateId: val.replace('template:', '') })
          else onUpdate({ ...slot, folderId: '', templateId: '' })
        }}
      >
        <option value="">テンプレートを選択（任意）</option>
        {folders.length > 0 && (
          <optgroup label="── フォルダ（ランダム）">
            {folders.map(f => <option key={f.id} value={`folder:${f.id}`}>📁 {f.name}</option>)}
          </optgroup>
        )}
        {templates.length > 0 && (
          <optgroup label="── テンプレート（固定）">
            {templates.map(t => <option key={t.id} value={`template:${t.id}`}>📄 {t.title}</option>)}
          </optgroup>
        )}
      </select>
      <button type="button" onClick={onRemove} className="text-gray-600 hover:text-red-400 transition-colors shrink-0">
        <X size={14} />
      </button>
    </div>
  )
}

function MiniCalendar({ markedDates, onSelectDate }) {
  const [viewDate, setViewDate] = useState(new Date())
  const days = eachDayOfInterval({ start: startOfMonth(viewDate), end: endOfMonth(viewDate) })
  const firstDow = startOfMonth(viewDate).getDay()

  return (
    <div className="bg-gray-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setViewDate(subMonths(viewDate, 1))}
          className="p-1 rounded-lg hover:bg-gray-700 text-gray-400"><ChevronLeft size={15} /></button>
        <span className="text-sm font-semibold text-gray-200">{format(viewDate, 'yyyy年M月', { locale: ja })}</span>
        <button type="button" onClick={() => setViewDate(addMonths(viewDate, 1))}
          className="p-1 rounded-lg hover:bg-gray-700 text-gray-400"><ChevronRight size={15} /></button>
      </div>

      {/* 凡例 */}
      <div className="flex gap-3 flex-wrap text-xs text-gray-500">
        <span>🎌 祝日</span>
        <span>🌑 新月</span>
        <span>🌕 満月</span>
        <span>🌾 一粒万倍日</span>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAY_LABELS.map((d, i) => (
          <div key={d} className={`text-center text-xs py-1 font-medium ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstDow }, (_, i) => <div key={`e${i}`} />)}
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const isMarked = markedDates.includes(dateStr)
          const isToday = isSameDay(day, new Date())
          const dow = day.getDay()
          const { isNew, isFull, isIchiryuman, holiday } = getDayInfo(dateStr)
          const isHoliday = !!holiday

          return (
            <button key={dateStr} type="button" onClick={() => onSelectDate(dateStr)}
              title={[holiday, isNew && '新月', isFull && '満月', isIchiryuman && '一粒万倍日'].filter(Boolean).join(' / ')}
              className={`relative rounded-lg text-xs font-medium transition-all py-1
                ${isMarked ? 'bg-brand-600 text-white' : isToday ? 'bg-gray-700 text-brand-400' : 'hover:bg-gray-700'}
                ${!isMarked && (dow === 0 || isHoliday) ? 'text-red-400' : !isMarked && dow === 6 ? 'text-blue-400' : !isMarked ? 'text-gray-300' : ''}`}
            >
              <div className="text-center leading-tight">{format(day, 'd')}</div>
              {/* アイコン表示 */}
              {(isNew || isFull || isIchiryuman || isHoliday) && (
                <div className="flex justify-center gap-0.5 mt-0.5 leading-none">
                  {isHoliday && <span className="text-[8px]">🎌</span>}
                  {isNew && <span className="text-[8px]">🌑</span>}
                  {isFull && <span className="text-[8px]">🌕</span>}
                  {isIchiryuman && <span className="text-[8px]">🌾</span>}
                </div>
              )}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-gray-600 text-center">日付をクリックしてスケジュールを設定</p>
    </div>
  )
}

export default function AccountSettingsPage() {
  const { accountId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [mode, setMode] = useState('daily')
  const [saving, setSaving] = useState(false)

  const [dailySlots, setDailySlots] = useState([])
  const [showDailyGrid, setShowDailyGrid] = useState(false)

  const [weeklySlots, setWeeklySlots] = useState({ 0:[], 1:[], 2:[], 3:[], 4:[], 5:[], 6:[] })
  const [activeWeekday, setActiveWeekday] = useState(1)
  const [showWeeklyGrid, setShowWeeklyGrid] = useState(false)

  const [calendarSlots, setCalendarSlots] = useState({})
  const [selectedDate, setSelectedDate] = useState(null)
  const [showCalendarGrid, setShowCalendarGrid] = useState(false)

  const [scheduleName, setScheduleName] = useState('')

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => api.get('/accounts') })
  const account = accounts.find(a => a.id === accountId)

  const { data: folders = [] } = useQuery({ queryKey: ['folders'], queryFn: () => api.get('/folders') })
  const { data: templates = [] } = useQuery({ queryKey: ['templates'], queryFn: () => api.get('/templates') })

  const { data: existingSchedules = [], refetch: refetchSchedules } = useQuery({
    queryKey: ['schedules', accountId],
    queryFn: () => api.get('/schedules').then(list => list.filter(s => s.accountId === accountId))
  })

  const addSlot = (slot, target, setTarget) => {
    if (target.some(s => s.label === slot.label)) { toast.error('その時間はすでに追加されています'); return }
    setTarget([...target, { ...slot, folderId: '', templateId: '' }].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute)))
  }

  const handleSelectDate = (dateStr) => {
    setSelectedDate(dateStr)
    if (!calendarSlots[dateStr]) setCalendarSlots(p => ({ ...p, [dateStr]: [] }))
    setShowCalendarGrid(false)
  }

  const addCalendarSlot = (slot) => {
    const cur = calendarSlots[selectedDate] || []
    if (cur.some(s => s.label === slot.label)) { toast.error('その時間はすでに追加されています'); return }
    const updated = [...cur, { ...slot, folderId: '', templateId: '' }].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
    setCalendarSlots(p => ({ ...p, [selectedDate]: updated }))
    setShowCalendarGrid(false)
  }

  const handleSave = async () => {
    const name = scheduleName || `${account?.displayName}`
    setSaving(true)
    try {
      let count = 0
      if (mode === 'daily') {
        if (dailySlots.length === 0) { toast.error('時間を1つ以上追加してください'); setSaving(false); return }
        for (const slot of dailySlots) {
          await api.post('/schedules', {
            name: `${name} 毎日 ${slot.label}`, accountId,
            scheduleType: 'weekly', weekdays: [0,1,2,3,4,5,6],
            timeHour: slot.hour, timeMinute: slot.minute,
            postMode: slot.folderId ? 'random' : slot.templateId ? 'fixed' : 'random',
            folderId: slot.folderId || null, templateId: slot.templateId || null,
            timezone: 'Asia/Tokyo', isActive: true
          })
          count++
        }
      } else if (mode === 'weekly') {
        for (const [dayStr, slots] of Object.entries(weeklySlots)) {
          for (const slot of slots) {
            await api.post('/schedules', {
              name: `${name} ${WEEKDAY_FULL[parseInt(dayStr)]} ${slot.label}`, accountId,
              scheduleType: 'weekly', weekdays: [parseInt(dayStr)],
              timeHour: slot.hour, timeMinute: slot.minute,
              postMode: slot.folderId ? 'random' : 'fixed',
              folderId: slot.folderId || null, templateId: slot.templateId || null,
              timezone: 'Asia/Tokyo', isActive: true
            })
            count++
          }
        }
        if (count === 0) { toast.error('曜日・時間を設定してください'); setSaving(false); return }
      } else if (mode === 'calendar') {
        for (const [dateStr, slots] of Object.entries(calendarSlots)) {
          for (const slot of slots) {
            const dt = new Date(`${dateStr}T${slot.label}:00`)
            await api.post('/schedules', {
              name: `${name} ${dateStr} ${slot.label}`, accountId,
              scheduleType: 'calendar', calendarDates: [dt.toISOString()],
              postMode: slot.folderId ? 'random' : 'fixed',
              folderId: slot.folderId || null, templateId: slot.templateId || null,
              timezone: 'Asia/Tokyo', isActive: true
            })
            count++
          }
        }
        if (count === 0) { toast.error('日付・時間を設定してください'); setSaving(false); return }
      }
      toast.success(`${count}件のスケジュールを保存しました`)
      qc.invalidateQueries(['schedules'])
      refetchSchedules()
      setDailySlots([])
      setWeeklySlots({ 0:[], 1:[], 2:[], 3:[], 4:[], 5:[], 6:[] })
      setCalendarSlots({})
      setScheduleName('')
    } catch (err) {
      toast.error(err.error || 'エラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  const deleteSchedule = async (id) => {
    if (!confirm('削除しますか？')) return
    await api.delete(`/schedules/${id}`)
    toast.success('削除しました')
    refetchSchedules()
  }

  const updateScheduleTemplate = async (schedule, folderId, templateId) => {
    try {
      await api.put(`/schedules/${schedule.id}`, {
        ...schedule,
        folderId: folderId || null,
        templateId: templateId || null,
        postMode: folderId ? 'random' : templateId ? 'fixed' : schedule.postMode,
        calendarDates: schedule.calendarDates?.map(d => new Date(d).toISOString()) || [],
      })
      toast.success('テンプレートを更新しました')
      refetchSchedules()
    } catch {
      toast.error('更新に失敗しました')
    }
  }

  const toggleSchedule = async (schedule) => {
    try {
      await api.patch(`/schedules/${schedule.id}/toggle`)
      refetchSchedules()
    } catch {
      toast.error('更新に失敗しました')
    }
  }

  const totalSlots = mode === 'daily' ? dailySlots.length
    : mode === 'weekly' ? Object.values(weeklySlots).reduce((a, b) => a + b.length, 0)
    : Object.values(calendarSlots).reduce((a, b) => a + b.length, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/accounts')} className="btn-ghost p-2"><ArrowLeft size={16} /></button>
        <div className="flex items-center gap-3">
          {account?.avatar && <img src={account.avatar} alt="" className="w-8 h-8 rounded-full" />}
          <div>
            <h1 className="text-xl font-bold text-gray-100">{account?.displayName}</h1>
            <p className="text-sm text-gray-500">@{account?.username} の投稿設定</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5 space-y-5">
            <div>
              <label className="label">スケジュール名（任意）</label>
              <input className="input" placeholder="例: 朝の投稿" value={scheduleName} onChange={e => setScheduleName(e.target.value)} />
            </div>

            <div>
              <label className="label">スケジュールタイプ</label>
              <div className="flex rounded-xl bg-gray-800 p-1 gap-1">
                {[
                  { v: 'daily', icon: RefreshCw, label: '毎日繰り返し' },
                  { v: 'weekly', icon: Repeat, label: '曜日ごと' },
                  { v: 'calendar', icon: Calendar, label: 'カレンダー指定' },
                ].map(({ v, icon: Icon, label }) => (
                  <button key={v} type="button" onClick={() => setMode(v)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all
                      ${mode === v ? 'bg-gray-700 text-gray-100 shadow' : 'text-gray-400 hover:text-gray-200'}`}>
                    <Icon size={13} /> {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 毎日 */}
            {mode === 'daily' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="label mb-0 flex items-center gap-2"><Clock size={13} /> 投稿時間を追加</label>
                  <button type="button" onClick={() => setShowDailyGrid(p => !p)} className="btn-secondary text-xs py-1.5">
                    <Plus size={13} /> 時間を追加
                  </button>
                </div>
                {showDailyGrid && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">時間をクリックして追加</p>
                    <TimeGrid onSelect={slot => { addSlot(slot, dailySlots, setDailySlots); setShowDailyGrid(false) }} />
                  </div>
                )}
                {dailySlots.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center py-4">時間が未設定です</p>
                ) : (
                  <div className="space-y-2">
                    {dailySlots.map((slot, i) => (
                      <SlotRow key={i} slot={slot} folders={folders} templates={templates}
                        onUpdate={updated => setDailySlots(dailySlots.map((s, idx) => idx === i ? updated : s))}
                        onRemove={() => setDailySlots(dailySlots.filter((_, idx) => idx !== i))} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 曜日ごと */}
            {mode === 'weekly' && (
              <div className="space-y-3">
                <div className="flex gap-1">
                  {WEEKDAY_LABELS.map((d, i) => (
                    <button key={i} type="button" onClick={() => { setActiveWeekday(i); setShowWeeklyGrid(false) }}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all relative
                        ${activeWeekday === i ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                      {d}
                      {weeklySlots[i]?.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 text-white text-xs rounded-full flex items-center justify-center">
                          {weeklySlots[i].length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="bg-gray-800/50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-300">{WEEKDAY_FULL[activeWeekday]}の設定</p>
                    <button type="button" onClick={() => setShowWeeklyGrid(p => !p)} className="btn-secondary text-xs py-1">
                      <Plus size={12} /> 時間を追加
                    </button>
                  </div>
                  {showWeeklyGrid && (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">時間をクリックして追加</p>
                      <TimeGrid onSelect={slot => {
                        const cur = weeklySlots[activeWeekday]
                        if (cur.some(s => s.label === slot.label)) { toast.error('その時間はすでに追加されています'); return }
                        const updated = [...cur, { ...slot, folderId: '', templateId: '' }].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
                        setWeeklySlots(p => ({ ...p, [activeWeekday]: updated }))
                        setShowWeeklyGrid(false)
                      }} />
                    </div>
                  )}
                  {weeklySlots[activeWeekday].length === 0 ? (
                    <p className="text-xs text-gray-600 text-center py-3">時間が未設定です</p>
                  ) : (
                    <div className="space-y-2">
                      {weeklySlots[activeWeekday].map((slot, i) => (
                        <SlotRow key={i} slot={slot} folders={folders} templates={templates}
                          onUpdate={updated => setWeeklySlots(p => ({ ...p, [activeWeekday]: p[activeWeekday].map((s, idx) => idx === i ? up
