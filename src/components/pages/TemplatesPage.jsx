import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, FileText, Trash2, Edit2, Search, FolderPlus, X, GitBranch, FolderInput, Check, Upload, Download, ArrowUpDown, ArrowUp, ArrowDown, Smile, Link } from 'lucide-react'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'

// 11原色 × 7明度 = 77色（2段階選択）
const COLOR_PALETTE = [
  { name: 'インディゴ', base: '#6272f1', shades: ['#08115d','#0c1a8c','#1125c4','#1e35ea','#5163ef','#808df3','#afb7f7'] },
  { name: 'グリーン',   base: '#10b981', shades: ['#085d41','#0c8c62','#11c589','#1deba7','#51efbb','#80f4cd','#aff8df'] },
  { name: 'イエロー',   base: '#f59e0b', shades: ['#613f04','#925e06','#cd8408','#f5a113','#f7b649','#f9ca7a','#fbddab'] },
  { name: 'レッド',     base: '#ef4444', shades: ['#5d0808','#8c0c0c','#c51010','#eb1d1d','#f05151','#f48080','#f8afaf'] },
  { name: 'パープル',   base: '#8b5cf6', shades: ['#210560','#310890','#450bca','#5917f2','#7f4cf5','#a27cf7','#c4acfa'] },
  { name: 'シアン',     base: '#06b6d4', shades: ['#025563','#047f94','#05b2d0','#10d6f8','#47dff9','#79e8fb','#aaf0fc'] },
  { name: 'オレンジ',   base: '#f97316', shades: ['#632a02','#953f03','#d05805','#f86f10','#fa9047','#fbae78','#fcccaa'] },
  { name: 'ピンク',     base: '#ec4899', shades: ['#5c0932','#8a0e4b','#c2146a','#e72183','#ed549f','#f282b9','#f6b0d3'] },
  { name: 'グレー',     base: '#6b7280', shades: ['#2e3137','#454a53','#616774','#79808f','#989da9','#b3b8c0','#cfd2d7'] },
  { name: 'ライム',     base: '#84cc16', shades: ['#3b5c09','#598a0e','#7dc114','#99e722','#b0ec54','#c5f182','#daf6b0'] },
  { name: 'フクシャ',   base: '#d946ef', shades: ['#52085d','#7c0c8c','#ad11c5','#d01deb','#db51ef','#e480f4','#eeaff8'] },
]
const FOLDER_COLORS = COLOR_PALETTE.flatMap(p => p.shades)

// ── CSVインポートモーダル ──────────────────────────────────────
function CsvImportModal({ folders, onClose }) {
  const qc = useQueryClient()
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState([]) // [{ title, content }]
  const [folderId, setFolderId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // CSVの1行をカラム配列にパース（クォート・改行対応）
  const parseCSVLine = (line) => {
    const cols = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ } // エスケープ ""
        else { inQuote = !inQuote }
      } else if (ch === ',' && !inQuote) {
        cols.push(cur.replace(/\\n/g, '\n')); cur = ''
      } else {
        cur += ch
      }
    }
    cols.push(cur.replace(/\\n/g, '\n'))
    return cols
  }

  const parseCSV = (text) => {
    // クォート内の改行を保持しつつ行分割
    const rows = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (ch === '"') {
        if (inQuote && text[i + 1] === '"') { cur += '""'; i++ }
        else { inQuote = !inQuote; cur += ch }
      } else if ((ch === '\n' || ch === '\r') && !inQuote) {
        if (ch === '\r' && text[i + 1] === '\n') i++
        if (cur.trim()) rows.push(cur)
        cur = ''
      } else {
        cur += ch
      }
    }
    if (cur.trim()) rows.push(cur)

    if (rows.length < 2) { setError('データが少なすぎます（ヘッダー行＋1行以上必要）'); return }

    const header = parseCSVLine(rows[0]).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
    const titleIdx = header.findIndex(h => ['テンプレート名','title','タイトル'].includes(h))
    const contentIdx = header.findIndex(h => ['本文','content','内容'].includes(h))
    const tree2Idx = header.findIndex(h => ['ツリー2','tree2'].includes(h))
    const tree3Idx = header.findIndex(h => ['ツリー3','tree3'].includes(h))
    const tree4Idx = header.findIndex(h => ['ツリー4','tree4'].includes(h))
    const tree5Idx = header.findIndex(h => ['ツリー5','tree5'].includes(h))

    if (titleIdx === -1 || contentIdx === -1) {
      setError('ヘッダー行に「テンプレート名」と「本文」が必要です')
      return
    }

    const parsed = []
    for (let i = 1; i < rows.length; i++) {
      const cols = parseCSVLine(rows[i])
      const title = (cols[titleIdx] || '').trim()
      const content = (cols[contentIdx] || '').trim()
      if (!content) continue
      parsed.push({
        title: title || '無題',
        content,
        tree2: tree2Idx >= 0 ? (cols[tree2Idx] || '').trim() : '',
        tree3: tree3Idx >= 0 ? (cols[tree3Idx] || '').trim() : '',
        tree4: tree4Idx >= 0 ? (cols[tree4Idx] || '').trim() : '',
        tree5: tree5Idx >= 0 ? (cols[tree5Idx] || '').trim() : '',
      })
    }

    if (parsed.length === 0) { setError('有効なデータが見つかりませんでした'); return }
    setError('')
    setPreview(parsed)
  }

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreview([])
    setError('')
    const reader = new FileReader()
    reader.onload = (ev) => parseCSV(ev.target.result)
    reader.readAsText(f, 'UTF-8')
  }

  const handleImport = async () => {
    if (!preview.length) return
    setLoading(true)
    try {
      const res = await api.post('/templates/bulk-import', {
        templates: preview,
        folderId: folderId || null
      })
      toast.success(`${res.count}件のテンプレートをインポートしました`)
      qc.invalidateQueries(['templates'])
      qc.invalidateQueries(['folders'])
      onClose()
    } catch (err) {
      toast.error(err.error || 'インポートに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="CSVからテンプレートを一括登録" onClose={onClose} wide>
      <div className="space-y-4">
        {/* スプレッドシートの説明 */}
        <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl px-4 py-3 space-y-1.5">
          <p className="text-xs font-semibold text-blue-400">Googleスプレッドシートの準備</p>
          <p className="text-xs text-blue-300/80">1行目（ヘッダー）に以下の列名を入力してください：</p>
          <div className="font-mono text-xs bg-blue-900/30 rounded-lg px-3 py-2 text-blue-200 space-y-0.5">
            <p>テンプレート名 , 本文 , ツリー2 , ツリー3 , ツリー4 , ツリー5</p>
          </div>
          <p className="text-xs text-blue-300/80">ツリー2〜5は任意。空欄なら通常投稿として登録されます。</p>
          <p className="text-xs text-blue-300/80">セル内改行もそのまま反映されます。</p>
          <p className="text-xs text-blue-300/80">入力後 → 「ファイル」→「ダウンロード」→「CSV」</p>
        </div>

        {/* ファイル選択 */}
        <div>
          <label className="label">CSVファイルを選択</label>
          <label className="flex items-center justify-center gap-2 w-full h-24 border-2 border-dashed border-gray-700 rounded-xl cursor-pointer hover:border-brand-500 hover:bg-brand-600/5 transition-all">
            <Upload size={18} className="text-gray-500" />
            <span className="text-sm text-gray-500">{file ? file.name : 'クリックまたはドラッグ＆ドロップ'}</span>
            <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </label>
        </div>

        {/* エラー */}
        {error && (
          <div className="bg-red-900/20 border border-red-800/30 rounded-xl px-4 py-3">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* プレビュー */}
        {preview.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="label mb-0">プレビュー（{preview.length}件）</label>
              <div>
                <label className="label mb-0 inline mr-2">インポート先フォルダ</label>
                <select className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300 outline-none"
                  value={folderId} onChange={e => setFolderId(e.target.value)}>
                  <option value="">未分類</option>
                  {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {preview.map((t, i) => {
                const treeCount = [t.content, t.tree2, t.tree3, t.tree4, t.tree5].filter(Boolean).length
                return (
                  <div key={i} className="bg-gray-800 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-gray-200">{t.title}</p>
                      {treeCount > 1 && (
                        <span className="badge-blue text-xs">ツリー {treeCount}件</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">{t.content}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* アクション */}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
          <button onClick={onClose} className="btn-secondary">キャンセル</button>
          <button onClick={handleImport} disabled={loading || !preview.length} className="btn-primary">
            <Upload size={14} />
            {loading ? 'インポート中...' : `${preview.length}件をインポート`}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── 絵文字データ ──────────────────────────────────────────────
const EMOJI_CATEGORIES = [
  {
    label: '😀 よく使う',
    emojis: ['😀','😂','🥹','😊','😍','🥰','😎','🤩','🥳','😭','😅','🙏','👍','❤️','🔥','✨','🎉','💯','👏','🫶','💪','🤔','😤','🙄','😏','🤭','😮','😱','🥺','😴']
  },
  {
    label: '❤️ ハート',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💕','💞','💓','💗','💖','💝','💘','💟','❣️','♥️','🫀','💔','❤️‍🔥','❤️‍🩹']
  },
  {
    label: '👋 人物',
    emojis: ['👋','🤚','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👁️','👅','👄','🫦']
  },
  {
    label: '🐶 動物',
    emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐟','🐠','🐬','🐳','🐋','🦈','🦭','🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦏','🦛','🦒','🦘','🦬','🐃','🐂','🐄','🦙','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🕊️','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿️','🦔']
  },
  {
    label: '🌸 自然',
    emojis: ['🌸','🌺','🌻','🌹','🥀','🌷','💐','🌼','🪷','🪸','🌿','🍀','🍁','🍂','🍃','🌱','🌲','🌳','🌴','🪵','🌵','🎋','🎄','🌾','🪨','🌊','💧','💦','🌈','☀️','🌤️','⛅','🌥️','☁️','🌦️','🌧️','⛈️','🌩️','🌨️','❄️','☃️','⛄','🌬️','💨','🌪️','🌫️','🌊','🌀','🌈','🌂','☂️','☔','⛱️','⚡','🔥','💥','🌟','⭐','🌙','🌛','🌜','🌚','🌕','🌖','🌗','🌘','🌑','🌒','🌓','🌔','🌙','🌍','🌎','🌏','🪐','💫','⭐','🌟','✨','🌠','🌌','☄️']
  },
  {
    label: '🍕 食べ物',
    emojis: ['🍕','🍔','🌮','🌯','🥙','🧆','🥚','🍳','🧇','🥞','🧈','🍞','🥖','🥨','🧀','🥗','🥘','🍲','🫕','🥣','🫙','🧂','🥫','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡','🦀','🦞','🦐','🦑','🦪','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍑','🥭','🍍','🥥','🥝','🍅','🫒','🥑','🍆','🥔','🥕','🌽','🌶️','🫑','🥒','🥬','🧅','🧄','🥜','🫘','🌰','🍄','🧆','🥗']
  },
  {
    label: '⚽ スポーツ',
    emojis: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🥅','⛳','🪃','🏹','🎣','🤿','🎽','🎿','🛷','🥌','🎯','🪁','🎮','🕹️','🎲','♟️','🧩','🧸','🪅','🪆','🎭','🎨','🖼️','🎰','🚂','🚃','🚄','🚅','🚆','🚇','🚈','🚉','🚊','🚝','🚞','🚋','🚌','🚍','🚎','🚐','🚑','🚒','🚓','🚔','🚕','🚖','🚗','🚘','🚙','🛻','🚚','🚛','🚜','🏎️','🏍️','🛵','🛺','🚲','🛴','🛹','🛼','🚏','🛣️','🛤️']
  },
  {
    label: '💼 仕事',
    emojis: ['💼','📁','📂','🗂️','📋','📊','📈','📉','📝','✏️','🖊️','🖋️','📌','📍','📎','🖇️','📏','📐','✂️','🗃️','🗄️','🗑️','🔒','🔓','🔑','🗝️','🔨','🪓','⛏️','⚒️','🛠️','🗡️','⚔️','🛡️','🔧','🔩','⚙️','🗜️','🔗','⛓️','🪝','🧲','🔫','💡','🔦','🕯️','🪔','🧯','🛢️','💰','💴','💵','💶','💷','💸','💳','🪙','💹','✉️','📧','📨','📩','📤','📥','📦','📫','📪','📬','📭','📮','🗳️','📯','📣','📢','🔔','🔕','🎵','🎶','📻','📺','📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠']
  },
  {
    label: '🎊 記号',
    emojis: ['✅','❌','⭕','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔶','🔷','🔸','🔹','🔺','🔻','💠','🔘','🔲','🔳','▪️','▫️','◾','◽','◼️','◻️','⬛','⬜','🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜','🔈','🔉','🔊','📢','📣','🔔','🔕','🎵','🎶','💤','🔅','🔆','📶','🛜','📳','📴','📵','📱','📲','☎️','📞','📟','📠','♻️','🔱','📛','🔰','⭕','✅','❎','🌐','💠','Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🛗','🈳','🈹','🈵','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','〽️','⚠️','🚸','🔱','⚜️','🔰','♻️','✅','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💟','🆓','🆙','🆒','🆕','🆖','🎦','🈁','🆗','🅰️','🅱️','🆎','🆑','🅾️','🆘','🔛','🔙','🔚','🔝','🔜','⏩','⏪','⏫','⏬','⬅️','➡️','⬆️','⬇️','↗️','↘️','↙️','↖️','↕️','↔️','↩️','↪️','⤴️','⤵️','🔀','🔁','🔂','▶️','⏸️','⏹️','⏺️','⏭️','⏮️','⏯️','🔼','🔽','➕','➖','➗','✖️','💲','❗','❓','〰️','©️','®️','™️']
  },
]

// ── 絵文字ピッカーコンポーネント ──────────────────────────────
function EmojiPicker({ onSelect, onClose }) {
  const [activeCategory, setActiveCategory] = useState(0)
  const [search, setSearch] = useState('')

  const filteredEmojis = search
    ? EMOJI_CATEGORIES.flatMap(c => c.emojis).filter(e => e.includes(search))
    : EMOJI_CATEGORIES[activeCategory].emojis

  return (
    <div className="absolute z-50 right-0 top-full mt-1 w-72 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
      {/* 検索 */}
      <div className="p-2 border-b border-gray-800">
        <input
          className="w-full bg-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-300 outline-none placeholder-gray-600"
          placeholder="絵文字を検索..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      {/* カテゴリタブ */}
      {!search && (
        <div className="flex overflow-x-auto border-b border-gray-800 bg-gray-900">
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={i}
              onClick={() => setActiveCategory(i)}
              className={`shrink-0 px-2 py-1.5 text-sm transition-colors
                ${activeCategory === i ? 'bg-gray-800 text-gray-100' : 'text-gray-500 hover:text-gray-300'}`}
              title={cat.label}
            >
              {cat.emojis[0]}
            </button>
          ))}
        </div>
      )}

      {/* 絵文字グリッド */}
      <div className="grid grid-cols-8 gap-0.5 p-2 max-h-48 overflow-y-auto">
        {filteredEmojis.map((emoji, i) => (
          <button
            key={i}
            onClick={() => onSelect(emoji)}
            className="text-xl hover:bg-gray-800 rounded-lg p-1 transition-colors leading-none"
            title={emoji}
          >
            {emoji}
          </button>
        ))}
        {filteredEmojis.length === 0 && (
          <p className="col-span-8 text-xs text-gray-600 text-center py-4">見つかりません</p>
        )}
      </div>

      <div className="px-3 py-2 border-t border-gray-800 text-right">
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300">閉じる</button>
      </div>
    </div>
  )
}

// ── URLピッカーコンポーネント ──────────────────────────────────
function UrlPicker({ onSelect, onClose }) {
  const { data: urls = [] } = useQuery({
    queryKey: ['urls'],
    queryFn: () => api.get('/urls')
  })

  return (
    <div className="absolute z-50 right-0 top-full mt-1 w-72 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
      <div className="px-3 py-2.5 border-b border-gray-800">
        <p className="text-xs font-medium text-gray-400">登録済みURL</p>
      </div>
      <div className="max-h-56 overflow-y-auto">
        {urls.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-gray-600">URLが未登録です</p>
            <p className="text-xs text-gray-700 mt-1">「URL管理」ページから登録してください</p>
          </div>
        ) : (
          urls.map(u => (
            <button
              key={u.id}
              onClick={() => onSelect(u.url)}
              className="w-full flex flex-col items-start px-3 py-2.5 hover:bg-gray-800 transition-colors text-left border-b border-gray-800/50 last:border-0"
            >
              <span className="text-sm font-medium text-gray-200">{u.label}</span>
              <span className="text-xs text-brand-400 font-mono truncate w-full">{u.url}</span>
              {u.description && <span className="text-xs text-gray-600">{u.description}</span>}
            </button>
          ))
        )}
      </div>
      <div className="px-3 py-2 border-t border-gray-800 text-right">
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300">閉じる</button>
      </div>
    </div>
  )
}

// ── フォルダ作成・編集モーダル ──────────────────────────────────
function FolderModal({ folder, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: folder?.name || '', color: folder?.color || '#6272f1' })
  const [loading, setLoading] = useState(false)
  const isEdit = !!folder

  // 現在選択中の色がどの原色グループに属するか
  const findBaseGroup = (color) => COLOR_PALETTE.find(p => p.shades.includes(color)) || COLOR_PALETTE[0]
  const [selectedBase, setSelectedBase] = useState(() => findBaseGroup(folder?.color || '#6272f1'))
  const submit = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      isEdit ? await api.put(`/folders/${folder.id}`, form) : await api.post('/folders', form)
      toast.success(isEdit ? 'フォルダを更新しました' : 'フォルダを作成しました')
      qc.invalidateQueries(['folders']); onClose()
    } catch { toast.error('エラーが発生しました') } finally { setLoading(false) }
  }
  return (
    <Modal title={isEdit ? 'フォルダ編集' : '新規フォルダ'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">フォルダ名</label>
          <input className="input" required placeholder="フォルダ名" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div className="space-y-3">
          <label className="label">カラー</label>

          {/* Step1: 原色を選ぶ */}
          <div>
            <p className="text-xs text-gray-500 mb-1.5">① 色を選ぶ</p>
            <div className="flex flex-wrap gap-2">
              {COLOR_PALETTE.map(p => (
                <button key={p.name} type="button"
                  onClick={() => {
                    setSelectedBase(p)
                    setForm(prev => ({ ...prev, color: p.shades[3] }))
                  }}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all
                    ${selectedBase.name === p.name ? 'bg-gray-700 ring-2 ring-white/30' : 'hover:bg-gray-800'}`}
                >
                  <div className="w-7 h-7 rounded-lg" style={{ backgroundColor: p.base }} />
                  <span className="text-xs text-gray-400 leading-none">{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Step2: 明度を選ぶ */}
          <div>
            <p className="text-xs text-gray-500 mb-1.5">② 明るさを選ぶ（暗 → 明）</p>
            <div className="flex gap-2">
              {selectedBase.shades.map((shade, i) => (
                <button key={shade} type="button"
                  onClick={() => setForm(p => ({ ...p, color: shade }))}
                  className={`flex-1 h-9 rounded-xl transition-all
                    ${form.color === shade ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900 scale-105' : 'hover:scale-105'}`}
                  style={{ backgroundColor: shade }}
                  title={`明度 ${i + 1}/7`}
                />
              ))}
            </div>
          </div>

          {/* プレビュー */}
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md flex-shrink-0" style={{ backgroundColor: form.color }} />
            <span className="text-xs font-mono text-gray-400">{form.color}</span>
            <span className="text-xs text-gray-600">— {selectedBase.name}</span>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">キャンセル</button>
          <button type="submit" disabled={loading} className="btn-primary">{loading ? '保存中...' : '保存'}</button>
        </div>
      </form>
    </Modal>
  )
}

// ── フォルダにテンプレートを追加するモーダル ──────────────────
function AddToFolderModal({ folder, onClose }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState([])
  const [loading, setLoading] = useState(false)

  // フォルダに入っていないテンプレートを取得
  const { data: allTemplates = [] } = useQuery({
    queryKey: ['templates', 'all'],
    queryFn: () => api.get('/templates')
  })

  // このフォルダに既に入っているIDを除外
  const available = allTemplates.filter(t =>
    t.folderId !== folder.id &&
    (search === '' ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.content?.toLowerCase().includes(search.toLowerCase()))
  )

  const alreadyInFolder = allTemplates.filter(t => t.folderId === folder.id)

  const toggleSelect = (id) => {
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  }

  const selectAll = () => {
    setSelected(available.map(t => t.id))
  }

  const clearAll = () => setSelected([])

  const handleAdd = async () => {
    if (!selected.length) { toast.error('テンプレートを選択してください'); return }
    setLoading(true)
    try {
      await api.post('/templates/move', { ids: selected, folderId: folder.id })
      toast.success(`${selected.length}件をフォルダに追加しました`)
      qc.invalidateQueries(['templates'])
      qc.invalidateQueries(['folders'])
      onClose()
    } catch { toast.error('エラーが発生しました') } finally { setLoading(false) }
  }

  const isTree = (t) => { try { return Array.isArray(JSON.parse(t.content)) } catch { return false } }
  const treeCount = (t) => { try { const p = JSON.parse(t.content); return Array.isArray(p) ? p.length : 1 } catch { return 1 } }
  const preview = (t) => { try { const p = JSON.parse(t.content); if (Array.isArray(p)) return p[0] } catch {}; return t.content }

  return (
    <Modal title={`「${folder.name}」にテンプレートを追加`} onClose={onClose} wide>
      <div className="space-y-4">
        {/* 既存の件数 */}
        {alreadyInFolder.length > 0 && (
          <div className="bg-gray-800/50 rounded-xl px-3 py-2 text-xs text-gray-500">
            このフォルダには既に <span className="text-gray-300 font-medium">{alreadyInFolder.length}件</span> のテンプレートが入っています
          </div>
        )}

        {/* 検索 */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input className="input pl-8" placeholder="テンプレートを検索..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* 全選択・解除 */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {available.length}件中 <span className="text-gray-300 font-medium">{selected.length}件</span> 選択中
          </p>
          <div className="flex gap-2">
            <button onClick={selectAll} className="btn-ghost text-xs py-1 px-2">すべて選択</button>
            {selected.length > 0 && <button onClick={clearAll} className="btn-ghost text-xs py-1 px-2">解除</button>}
          </div>
        </div>

        {/* テンプレート一覧 */}
        <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
          {available.length === 0 ? (
            <div className="text-center py-8 text-gray-600 text-sm">
              {search ? '検索結果なし' : '追加できるテンプレートがありません'}
            </div>
          ) : (
            available.map(t => {
              const sel = selected.includes(t.id)
              return (
                <div
                  key={t.id}
                  onClick={() => toggleSelect(t.id)}
                  className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border
                    ${sel
                      ? 'bg-brand-600/10 border-brand-600/40'
                      : 'bg-gray-800/50 border-transparent hover:bg-gray-800 hover:border-gray-700'
                    }`}
                >
                  {/* チェックボックス */}
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-all
                    ${sel ? 'bg-brand-600' : 'bg-gray-700'}`}>
                    {sel && <Check size={12} className="text-white" />}
                  </div>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="text-sm font-medium text-gray-200">{t.title}</p>
                      {isTree(t) && (
                        <span className="badge-blue flex items-center gap-1 text-xs">
                          <GitBranch size={9} /> ツリー {treeCount(t)}件
                        </span>
                      )}
                      {t.folder && (
                        <span className="text-xs px-1.5 py-0.5 rounded-md"
                          style={{ backgroundColor: t.folder.color + '22', color: t.folder.color }}>
                          {t.folder.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-1">{preview(t)}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* アクション */}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
          <button onClick={onClose} className="btn-secondary">キャンセル</button>
          <button onClick={handleAdd} disabled={loading || !selected.length} className="btn-primary">
            <FolderInput size={14} />
            {loading ? '追加中...' : `${selected.length}件をフォルダに追加`}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── テンプレート作成・編集モーダル ──────────────────────────────
function TemplateModal({ template, folderId, folders, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ title: template?.title || '', folderId: template?.folderId || folderId || '', tags: template?.tags?.join(', ') || '' })
  const parseContents = () => {
    if (!template?.content) return ['']
    try { const p = JSON.parse(template.content); if (Array.isArray(p)) return p } catch {}
    return [template.content]
  }
  const [treeContents, setTreeContents] = useState(parseContents)
  const [loading, setLoading] = useState(false)
  const [showEmojiFor, setShowEmojiFor] = useState(null) // index of textarea showing picker
  const [showUrlFor, setShowUrlFor] = useState(null) // index of textarea showing URL picker
  const isEdit = !!template

  const insertEmoji = (emoji, idx) => {
    updateTree(idx, treeContents[idx] + emoji)
  }

  const insertUrl = (url, idx) => {
    updateTree(idx, treeContents[idx] + url)
  }

  const addTree = () => { if (treeContents.length >= 5) { toast.error('最大5件まで'); return }; setTreeContents(p => [...p, '']) }
  const removeTree = (i) => { if (treeContents.length <= 1) return; setTreeContents(p => p.filter((_, idx) => idx !== i)) }
  const updateTree = (i, val) => setTreeContents(p => p.map((v, idx) => idx === i ? val : v))

  const submit = async (e) => {
    e.preventDefault(); setLoading(true)
    const content = treeContents.length === 1 ? treeContents[0] : JSON.stringify(treeContents)
    const payload = { ...form, content, tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [] }
    try {
      isEdit ? await api.put(`/templates/${template.id}`, payload) : await api.post('/templates', payload)
      toast.success(isEdit ? '更新しました' : '作成しました')
      qc.invalidateQueries(['templates']); onClose()
    } catch { toast.error('エラーが発生しました') } finally { setLoading(false) }
  }

  return (
    <Modal title={isEdit ? 'テンプレート編集' : '新規テンプレート'} onClose={onClose} full>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">タイトル</label>
          <input className="input" required placeholder="テンプレート名" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="label mb-0">
              投稿内容
              <span className="text-gray-600 ml-2 text-xs font-normal">{'{{date}} {{time}} {{year}} {{month}} {{day}}'}</span>
            </label>
            {treeContents.length > 1 && <span className="badge-blue flex items-center gap-1"><GitBranch size={10} /> ツリー {treeContents.length}件</span>}
          </div>

          {treeContents.map((content, i) => (
            <div key={i} className={i > 0 ? 'pl-5 border-l-2 border-gray-700 ml-3' : ''}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-500 font-medium">{i === 0 ? '1投稿目（メイン）' : `${i + 1}投稿目（ツリー）`}</span>
                {i > 0 && <button type="button" onClick={() => removeTree(i)} className="text-gray-600 hover:text-red-400"><X size={13} /></button>}
              </div>
              <div className="relative">
                <textarea className="input resize-none font-mono text-xs pr-16" rows={i === 0 ? 5 : 3} required={i === 0}
                  placeholder={i === 0 ? '1投稿目の内容...' : `${i + 1}投稿目の内容（ツリー）...`}
                  value={content} maxLength={500} onChange={e => updateTree(i, e.target.value)} />
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => { setShowUrlFor(showUrlFor === i ? null : i); setShowEmojiFor(null) }}
                    className="text-gray-500 hover:text-brand-400 transition-colors"
                    title="URLを挿入"
                  >
                    <Link size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowEmojiFor(showEmojiFor === i ? null : i); setShowUrlFor(null) }}
                    className="text-gray-500 hover:text-yellow-400 transition-colors"
                    title="絵文字を挿入"
                  >
                    <Smile size={15} />
                  </button>
                </div>
                {showEmojiFor === i && (
                  <EmojiPicker
                    onSelect={emoji => { insertEmoji(emoji, i); setShowEmojiFor(null) }}
                    onClose={() => setShowEmojiFor(null)}
                  />
                )}
                {showUrlFor === i && (
                  <UrlPicker
                    onSelect={url => { insertUrl(url, i); setShowUrlFor(null) }}
                    onClose={() => setShowUrlFor(null)}
                  />
                )}
              </div>
              <p className="text-xs text-gray-600 text-right mt-0.5">{content.length}/500</p>
            </div>
          ))}

          {treeContents.length < 5 && (
            <button type="button" onClick={addTree}
              className="btn-ghost w-full justify-center border border-dashed border-gray-700 py-2 text-xs">
              <Plus size={13} /> ツリー投稿を追加（{treeContents.length}/5）
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">フォルダ</label>
            <select className="input" value={form.folderId} onChange={e => setForm(p => ({ ...p, folderId: e.target.value }))}>
              <option value="">未分類</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">タグ</label>
            <input className="input" placeholder="タグ1, タグ2" value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">キャンセル</button>
          <button type="submit" disabled={loading} className="btn-primary">{loading ? '保存中...' : '保存'}</button>
        </div>
      </form>
    </Modal>
  )
}

// ── メインページ ────────────────────────────────────────────────
export default function TemplatesPage() {
  const qc = useQueryClient()
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [search, setSearch] = useState('')
  const [showCsvImport, setShowCsvImport] = useState(false)
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [sortKey, setSortKey] = useState('updatedAt') // 'updatedAt' | 'createdAt' | 'title'
  const [sortDir, setSortDir] = useState('desc') // 'asc' | 'desc'
  const [editFolder, setEditFolder] = useState(null)
  const [addToFolder, setAddToFolder] = useState(null) // フォルダへ追加モーダル用
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editTemplate, setEditTemplate] = useState(null)
  const [selected, setSelected] = useState([])

  const { data: folders = [] } = useQuery({ queryKey: ['folders'], queryFn: () => api.get('/folders') })
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates', selectedFolder, search],
    queryFn: () => { const p = new URLSearchParams(); if (selectedFolder) p.set('folderId', selectedFolder); if (search) p.set('search', search); return api.get(`/templates?${p}`) }
  })

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sortedTemplates = [...templates].sort((a, b) => {
    let va, vb
    if (sortKey === 'title') { va = a.title?.toLowerCase() || ''; vb = b.title?.toLowerCase() || '' }
    else { va = new Date(a[sortKey] || 0); vb = new Date(b[sortKey] || 0) }
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ? 1 : -1
    return 0
  })

    const deleteTemplate = useMutation({ mutationFn: (id) => api.delete(`/templates/${id}`), onSuccess: () => { toast.success('削除しました'); qc.invalidateQueries(['templates']) } })
  const deleteFolder = useMutation({ mutationFn: (id) => api.delete(`/folders/${id}`), onSuccess: () => { toast.success('削除しました'); qc.invalidateQueries(['folders', 'templates']) } })

  const bulkDelete = async () => {
    if (!selected.length || !confirm(`${selected.length}件を削除しますか？`)) return
    await api.post('/templates/bulk-delete', { ids: selected }); toast.success('削除しました'); setSelected([]); qc.invalidateQueries(['templates'])
  }

  const isTree = (t) => { try { return Array.isArray(JSON.parse(t.content)) } catch { return false } }
  const treeCount = (t) => { try { const p = JSON.parse(t.content); return Array.isArray(p) ? p.length : 1 } catch { return 1 } }
  const preview = (t) => { try { const p = JSON.parse(t.content); if (Array.isArray(p)) return p[0] } catch {}; return t.content }

  const selectedFolderObj = folders.find(f => f.id === selectedFolder)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-gray-100">テンプレート管理</h1><p className="text-sm text-gray-500 mt-0.5">{templates.length} 件</p></div>
        <div className="flex gap-2">
          <button onClick={() => setShowCsvImport(true)} className="btn-secondary"><Upload size={15} /> CSVインポート</button>
          <button onClick={() => setShowFolderModal(true)} className="btn-secondary"><FolderPlus size={15} /> フォルダ作成</button>
          <button onClick={() => setShowTemplateModal(true)} className="btn-primary"><Plus size={15} /> テンプレート作成</button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* サイドバー */}
        <div className="w-52 shrink-0 space-y-1">
          <button onClick={() => setSelectedFolder(null)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${selectedFolder === null ? 'bg-brand-600/20 text-brand-400' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}>
            <FileText size={14} /><span className="flex-1 text-left">すべて</span>
          </button>

          {folders.map(f => (
            <div key={f.id} className="group relative">
              <button onClick={() => setSelectedFolder(f.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${selectedFolder === f.id ? 'bg-brand-600/20 text-brand-400' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}>
                <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: f.color }} />
                <span className="flex-1 text-left truncate">{f.name}</span>
                <span className="text-xs opacity-60">{f._count?.templates || 0}</span>
              </button>
              <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-0.5">
                <button onClick={e => { e.stopPropagation(); setAddToFolder(f) }}
                  className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-brand-400" title="テンプレートを追加">
                  <FolderInput size={11} />
                </button>
                <button onClick={e => { e.stopPropagation(); setEditFolder(f) }} className="p-1 rounded hover:bg-gray-700 text-gray-500">
                  <Edit2 size={11} />
                </button>
                <button onClick={e => { e.stopPropagation(); if(confirm('削除しますか？')) deleteFolder.mutate(f.id) }}
                  className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-red-400">
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* メイン */}
        <div className="flex-1 space-y-3">
          {/* 検索・アクション */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input className="input pl-8" placeholder="検索..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {/* ソート */}
            <div className="flex rounded-xl bg-gray-800 border border-gray-700 overflow-hidden shrink-0">
              {[
                { key: 'updatedAt', label: '更新日' },
                { key: 'createdAt', label: '追加日' },
                { key: 'title',     label: '名前' },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => toggleSort(key)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-all border-r border-gray-700 last:border-0
                    ${sortKey === key ? 'bg-brand-600/20 text-brand-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'}`}>
                  {label}
                  {sortKey === key
                    ? sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                    : <ArrowUpDown size={11} className="opacity-40" />
                  }
                </button>
              ))}
            </div>
            {/* フォルダ選択中：テンプレート追加ボタン */}
            {selectedFolder && selectedFolderObj && (
              <button onClick={() => setAddToFolder(selectedFolderObj)} className="btn-secondary whitespace-nowrap">
                <FolderInput size={14} /> このフォルダに追加
              </button>
            )}
            {selected.length > 0 && (
              <button onClick={bulkDelete} className="btn-danger whitespace-nowrap">
                <Trash2 size={14} /> {selected.length}件削除
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : templates.length === 0 ? (
            <div className="card p-12 flex flex-col items-center text-center">
              <FileText size={36} className="text-gray-700 mb-3" />
              <p className="text-gray-400 font-medium">テンプレートがありません</p>
              {selectedFolder && (
                <button onClick={() => setAddToFolder(selectedFolderObj)} className="btn-primary mt-4 text-sm">
                  <FolderInput size={14} /> テンプレートを追加する
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-2">
              {sortedTemplates.map(t => (
                <div key={t.id}
                  className={`card p-4 flex items-start gap-3 cursor-pointer hover:border-gray-700 transition-colors ${selected.includes(t.id) ? 'border-brand-600/50 bg-brand-600/5' : ''}`}
                  onClick={() => setSelected(p => p.includes(t.id) ? p.filter(x => x !== t.id) : [...p, t.id])}>
                  <input type="checkbox" checked={selected.includes(t.id)} readOnly className="mt-0.5 rounded accent-brand-500" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-medium text-gray-200 text-sm">{t.title}</p>
                      {t.folder && <span className="text-xs px-2 py-0.5 rounded-md" style={{ backgroundColor: t.folder.color + '22', color: t.folder.color }}>{t.folder.name}</span>}
                      {isTree(t) && <span className="badge-blue flex items-center gap-1"><GitBranch size={10} /> ツリー {treeCount(t)}件</span>}
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">{preview(t)}</p>
                    {t.tags?.length > 0 && <div className="flex gap-1 mt-2">{t.tags.map(tag => <span key={tag} className="badge-gray text-xs">{tag}</span>)}</div>}
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button onClick={e => { e.stopPropagation(); setEditTemplate(t) }} className="btn-ghost p-1.5"><Edit2 size={13} /></button>
                    <button onClick={e => { e.stopPropagation(); if(confirm('削除しますか？')) deleteTemplate.mutate(t.id) }} className="btn-ghost p-1.5 text-red-500"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* モーダル類 */}
      {showCsvImport && <CsvImportModal folders={folders} onClose={() => setShowCsvImport(false)} />}
      {(showFolderModal || editFolder) && <FolderModal folder={editFolder} onClose={() => { setShowFolderModal(false); setEditFolder(null) }} />}
      {addToFolder && <AddToFolderModal folder={addToFolder} onClose={() => setAddToFolder(null)} />}
      {(showTemplateModal || editTemplate) && (
        <TemplateModal template={editTemplate} folderId={selectedFolder} folders={folders}
          onClose={() => { setShowTemplateModal(false); setEditTemplate(null) }} />
      )}
    </div>
  )
}
