import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, Clock, Repeat, FileText, Globe, ChevronLeft, ChevronRight, X, Plus } from 'lucide-react'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns'
import { ja } from 'date-fns/locale'

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']
const TIMEZONES = ['Asia/Tokyo', 'Asia/Seoul', 'Asia/Shanghai', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'UTC']

// ─── Mini Calendar Picker ────────────────────────────────────────────────────
function CalendarPicker({ selectedDates, onToggle }) {
  const [viewDate, setViewDate] = useState(new Date())
  const [selectedTime, setSelectedTime] = useState({ hour: 9, minute: 0 })

  const days = eachDayOfInterval({ start: startOfMonth(viewDate), end: endOfMonth(viewDate) })
  const firstDow = startOfMonth(viewDate).getDay() // 0=Sun

  const handleDayClick = (day) => {
    const dt = new Date(day)
    dt.setHours(selectedTime.hour, selectedTime.minute, 0, 0)
    onToggle(dt)
  }

  const isDaySelected = (day) => selectedDates.some(d => isSameDay(new Date(d), day))

  return (
    <div className="bg-gray-800 rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => setViewDate(subMonths(viewDate, 1))} className="p-1 rounded-lg hover:bg-gray-700 text-gray-400">
          <ChevronLeft size={15} />
        </button>
        <span className="text-sm font-semibold text-gray-200">
          {format(viewDate, 'yyyy年M月', { locale: ja })}
        </span>
        <button onClick={() => setViewDate(addMonths(viewDate, 1))} className="p-1 rounded-lg hover:bg-gray-700 text-gray-400">
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Time picker */}
      <div className="flex items-center gap-2 bg-gray-900 rounded-xl px-3 py-2">
        <Clock size={13} className="text-gray-500" />
        <span className="text-xs text-gray-500">投稿時刻:</span>
        <select
          className="bg-transparent text-xs text-gray-300 outline-none"
          value={selectedTime.hour}
          onChange={e => setSelectedTime(p => ({ ...p, hour: parseInt(e.target.value) }))}
        >
          {Array.from({ length: 24 }, (_, i) => (
            <option key={i} value={i}>{String(i).padStart(2, '0')}時</option>
          ))}
        </select>
        <select
          className="bg-transparent text-xs text-gray-300 outline-none"
          value={selectedTime.minute}
          onChange={e => setSelectedTime(p => ({ ...p, minute: parseInt(e.target.value) }))}
        >
          {Array.from({ length: 60 }, (_, i) => (
            <option key={i} value={i}>{String(i).padStart(2, '0')}分</option>
          ))}
        </select>
      </div>

      {/* Day of week headers */}
      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAY_LABELS.map((d, i) => (
          <div key={d} className={`text-center text-xs py-1 font-medium ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'}`}>
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {/* Empty cells for offset */}
        {Array.from({ length: firstDow }, (_, i) => <div key={`e${i}`} />)}
        {days.map(day => {
          const sel = isDaySelected(day)
          const isToday = isSameDay(day, new Date())
          const dow = day.getDay()
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => handleDayClick(day)}
              className={`aspect-square rounded-lg text-xs font-medium transition-all
                ${sel ? 'bg-brand-600 text-white' : isToday ? 'bg-gray-700 text-brand-400' : 'hover:bg-gray-700'}
                ${!sel && dow === 0 ? 'text-red-400' : !sel && dow === 6 ? 'text-blue-400' : !sel ? 'text-gray-300' : ''}`}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>

      <p className="text-xs text-gray-600 text-center">
        {selectedDates.length > 0 ? `${selectedDates.length} 件選択中 — 日付をクリックして切り替え` : '日付をクリックして選択'}
      </p>
    </div>
  )
}

// ─── Main Form ────────────────────────────────────────────────────────────────
export default function ScheduleForm({ schedule, onClose }) {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: schedule?.name || '',
    accountId: schedule?.accountId || '',
    proxyId: schedule?.proxyId || '',
    scheduleType: schedule?.scheduleType || 'weekly',
    // weekly
    weekdays: schedule?.weekdays || [],
    timeHour: schedule?.timeHour ?? 9,
    timeMinute: schedule?.timeMinute ?? 0,
    // calendar
    calendarDates: schedule?.calendarDates?.map(d => new Date(d)) || [],
    // content
    postMode: schedule?.postMode || 'random',
    folderId: schedule?.folderId || '',
    templateId: schedule?.templateId || '',
    customContent: schedule?.customContent || '',
    // settings
    timezone: schedule?.timezone || 'Asia/Tokyo',
    isActive: schedule?.isActive ?? true,
  })

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => api.get('/accounts') })
  const { data: proxies = [] } = useQuery({ queryKey: ['proxies'], queryFn: () => api.get('/proxies') })
  const { data: folders = [] } = useQuery({ queryKey: ['folders'], queryFn: () => api.get('/folders') })
  const { data: templates = [] } = useQuery({
    queryKey: ['templates', form.folderId],
    queryFn: () => {
      const params = form.folderId ? `?folderId=${form.folderId}` : ''
      return api.get(`/templates${params}`)
    }
  })

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const toggleWeekday = (d) => {
    set('weekdays', form.weekdays.includes(d) ? form.weekdays.filter(x => x !== d) : [...form.weekdays, d])
  }

  const toggleCalendarDate = (date) => {
    const exists = form.calendarDates.findIndex(d => isSameDay(d, date))
    if (exists >= 0) {
      set('calendarDates', form.calendarDates.filter((_, i) => i !== exists))
    } else {
      set('calendarDates', [...form.calendarDates, date].sort((a, b) => a - b))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.scheduleType === 'weekly' && form.weekdays.length === 0) {
      toast.error('曜日を1つ以上選択してください')
      return
    }
    if (form.scheduleType === 'calendar' && form.calendarDates.length === 0) {
      toast.error('日付を1つ以上選択してください')
      return
    }
    if (!form.accountId) {
      toast.error('アカウントを選択してください')
      return
    }

    setLoading(true)
    try {
      const payload = {
        ...form,
        calendarDates: form.calendarDates.map(d => d.toISOString()),
        proxyId: form.proxyId || null,
        folderId: form.folderId || null,
        templateId: form.templateId || null,
      }
      if (schedule) {
        await api.put(`/schedules/${schedule.id}`, payload)
        toast.success('スケジュールを更新しました')
      } else {
        await api.post('/schedules', payload)
        toast.success('スケジュールを作成しました')
      }
      qc.invalidateQueries(['schedules'])
      onClose()
    } catch (err) {
      toast.error(err.error || 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">

      {/* Basic info */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">スケジュール名</label>
          <input className="input" required placeholder="例: 朝の投稿"
            value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div>
          <label className="label">アカウント <span className="text-red-400">*</span></label>
          <select className="input" required value={form.accountId} onChange={e => set('accountId', e.target.value)}>
            <option value="">選択してください</option>
            {accounts.filter(a => a.isActive).map(a => (
              <option key={a.id} value={a.id}>@{a.username} ({a.displayName})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">プロキシ（任意）</label>
          <select className="input" value={form.proxyId} onChange={e => set('proxyId', e.target.value)}>
            <option value="">プロキシなし / アカウント設定を使用</option>
            {proxies.map(p => <option key={p.id} value={p.id}>{p.name} ({p.host}:{p.port})</option>)}
          </select>
        </div>
      </div>

      {/* Schedule type */}
      <div>
        <label className="label">スケジュールタイプ</label>
        <div className="flex rounded-xl bg-gray-800 p-1 gap-1">
          {[
            { v: 'weekly', icon: Repeat, label: '曜日ごと' },
            { v: 'calendar', icon: Calendar, label: 'カレンダー指定' },
            { v: 'once', icon: Clock, label: '1回のみ' },
          ].map(({ v, icon: Icon, label }) => (
            <button
              key={v}
              type="button"
              onClick={() => set('scheduleType', v)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all
                ${form.scheduleType === v ? 'bg-gray-700 text-gray-100 shadow' : 'text-gray-400 hover:text-gray-200'}`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Priority note */}
        {form.scheduleType === 'weekly' && (
          <p className="text-xs text-yellow-500/80 mt-2 bg-yellow-500/10 rounded-lg px-3 py-2">
            ⚠ カレンダー指定と重複する日はカレンダーが優先されます
          </p>
        )}
      </div>

      {/* Weekly settings */}
      {form.scheduleType === 'weekly' && (
        <div className="space-y-3">
          <div>
            <label className="label">曜日を選択</label>
            <div className="flex gap-1.5">
              {WEEKDAY_LABELS.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleWeekday(i)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all
                    ${form.weekdays.includes(i) ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label flex items-center gap-2">
              <Clock size={13} /> 投稿時刻（1分刻み）
            </label>
            <div className="flex gap-3 items-center">
              <select
                className="input w-28"
                value={form.timeHour}
                onChange={e => set('timeHour', parseInt(e.target.value))}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{String(i).padStart(2, '0')} 時</option>
                ))}
              </select>
              <span className="text-gray-500">:</span>
              <select
                className="input w-28"
                value={form.timeMinute}
                onChange={e => set('timeMinute', parseInt(e.target.value))}
              >
                {Array.from({ length: 60 }, (_, i) => (
                  <option key={i} value={i}>{String(i).padStart(2, '0')} 分</option>
                ))}
              </select>
              <span className="text-xs text-gray-500">
                → {String(form.timeHour).padStart(2,'0')}:{String(form.timeMinute).padStart(2,'0')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Calendar settings */}
      {(form.scheduleType === 'calendar' || form.scheduleType === 'once') && (
        <div className="space-y-3">
          <label className="label flex items-center gap-2">
            <Calendar size={13} />
            {form.scheduleType === 'once' ? '投稿日時を選択' : '投稿日時を選択（複数可）'}
          </label>
          <CalendarPicker
            selectedDates={form.calendarDates}
            onToggle={toggleCalendarDate}
          />
          {/* Selected dates list */}
          {form.calendarDates.length > 0 && (
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {form.calendarDates.map((d, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-1.5">
                  <span className="text-xs text-gray-300 font-mono">
                    {format(d, 'yyyy/MM/dd(E) HH:mm', { locale: ja })}
                  </span>
                  <button type="button" onClick={() => toggleCalendarDate(d)} className="text-gray-500 hover:text-red-400">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Timezone */}
      <div>
        <label className="label">タイムゾーン</label>
        <select className="input" value={form.timezone} onChange={e => set('timezone', e.target.value)}>
          {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
        </select>
      </div>

      {/* Content settings */}
      <div className="border-t border-gray-800 pt-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <FileText size={14} /> 投稿内容
        </h3>

        <div>
          <label className="label">投稿モード</label>
          <div className="flex rounded-xl bg-gray-800 p-1 gap-1">
            {[
              { v: 'random', label: 'ランダム' },
              { v: 'sequential', label: '順番' },
              { v: 'fixed', label: '固定テキスト' },
            ].map(({ v, label }) => (
              <button
                key={v}
                type="button"
                onClick={() => set('postMode', v)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all
                  ${form.postMode === v ? 'bg-gray-700 text-gray-100 shadow' : 'text-gray-400 hover:text-gray-200'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {form.postMode !== 'fixed' && (
          <div>
            <label className="label">テンプレートフォルダ（ランダム/順番の場合）</label>
            <select className="input" value={form.folderId} onChange={e => { set('folderId', e.target.value); set('templateId', '') }}>
              <option value="">フォルダを選択</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name} ({f._count?.templates}件)</option>)}
            </select>
            {form.folderId && (
              <p className="text-xs text-gray-600 mt-1">フォルダ内のテンプレートから{form.postMode === 'random' ? 'ランダムに' : '順番に'}投稿されます</p>
            )}
          </div>
        )}

        {form.postMode !== 'fixed' && !form.folderId && (
          <div>
            <label className="label">特定のテンプレート（任意）</label>
            <select className="input" value={form.templateId} onChange={e => set('templateId', e.target.value)}>
              <option value="">テンプレートを選択</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="label">
            {form.postMode === 'fixed' ? '投稿テキスト（固定）' : 'フォールバックテキスト（テンプレートがない場合）'}
          </label>
          <textarea
            className="input resize-none font-mono text-xs"
            rows={4}
            placeholder={`投稿内容を入力...\n変数: {{date}} {{time}} {{year}} {{month}} {{day}}`}
            value={form.customContent}
            onChange={e => set('customContent', e.target.value)}
            required={form.postMode === 'fixed'}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center pt-2 border-t border-gray-800">
        <label className="flex items-center gap-2 cursor-pointer">
          <div
            onClick={() => set('isActive', !form.isActive)}
            className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer
              ${form.isActive ? 'bg-brand-600' : 'bg-gray-700'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform
              ${form.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-sm text-gray-400">{form.isActive ? '有効' : '無効'}</span>
        </label>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">キャンセル</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? '保存中...' : schedule ? '更新する' : '作成する'}
          </button>
        </div>
      </div>
    </form>
  )
}
