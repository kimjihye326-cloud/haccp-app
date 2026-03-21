import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/auth-store'
import NumPad from '../../components/common/NumPad'
import type { InventoryItem, InventorySummary } from '../../types/database'

const LOG_TYPES = [
  { value: 'IN' as const, label: '입고', icon: '📥', active: 'border-blue-600 bg-blue-50 text-blue-700' },
  { value: 'OUT' as const, label: '출고', icon: '📤', active: 'border-green-600 bg-green-50 text-green-700' },
  { value: 'LOSS' as const, label: '손실', icon: '⚠️', active: 'border-red-600 bg-red-50 text-red-700' },
]

const LOSS_REASONS = ['비가식부위제거', '폐기', '변질']

const ITEM_ICONS: Record<string, string> = {
  '감자': '🥔',
  '생강': '🫚',
  '양파': '🧅',
}
function getItemIcon(name: string): string {
  for (const [key, icon] of Object.entries(ITEM_ICONS)) {
    if (name.includes(key)) return icon
  }
  return '📦'
}

export default function InventoryForm() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [summary, setSummary] = useState<InventorySummary[]>([])
  const [selectedItem, setSelectedItem] = useState<number | null>(null)
  const [logType, setLogType] = useState<'IN' | 'OUT' | 'LOSS' | ''>('')
  const [qtyStr, setQtyStr] = useState('')
  const [supplier, setSupplier] = useState('')
  const [destination, setDestination] = useState('')
  const [lossReason, setLossReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [todayLogs, setTodayLogs] = useState<any[]>([])

  const [savedSuppliers, setSavedSuppliers] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('haccp_suppliers') || '[]') } catch { return [] }
  })
  const [savedDestinations, setSavedDestinations] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('haccp_destinations') || '[]') } catch { return [] }
  })

  useEffect(() => { loadData() }, [])
  useEffect(() => { if (logDate) loadLogs() }, [logDate])

  async function loadData() {
    const [itemRes, summaryRes] = await Promise.all([
      supabase.from('inventory_items').select('*').eq('is_active', true).order('name'),
      supabase.from('inventory_summary').select('*'),
    ])
    if (itemRes.data) setItems(itemRes.data as InventoryItem[])
    if (summaryRes.data) setSummary(summaryRes.data as InventorySummary[])
  }

  async function loadLogs() {
    const start = logDate + 'T00:00:00'
    const end = logDate + 'T23:59:59'
    const { data } = await supabase.from('inventory_logs').select('*, inventory_items(name)')
      .gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false })
    setTodayLogs(data || [])
  }

  const resetInputs = () => { setLogType(''); setQtyStr(''); setSupplier(''); setDestination(''); setLossReason('') }

  const handleNumPad = useCallback((key: string) => {
    if (key === 'C') setQtyStr('')
    else if (key === '←') setQtyStr(p => p.slice(0, -1))
    else if (key === '.') { if (!qtyStr.includes('.')) setQtyStr(p => p + '.') }
    else setQtyStr(p => p.length >= 8 ? p : p + key)
  }, [qtyStr])

  function getStock(itemId: number): number {
    return summary.find(s => s.item_id === itemId)?.current_stock ?? 0
  }

  function saveTo(key: string, value: string, list: string[], setter: (v: string[]) => void) {
    if (!value.trim()) return
    const updated = [value, ...list.filter(v => v !== value)].slice(0, 10)
    localStorage.setItem(key, JSON.stringify(updated))
    setter(updated)
  }

  const handleSubmit = async () => {
    if (!selectedItem) return toast.error('품목을 선택해주세요.')
    if (!logType) return toast.error('유형을 선택해주세요.')
    const qty = parseFloat(qtyStr)
    if (!qty || qty <= 0) return toast.error('수량을 입력해주세요.')
    if (logType === 'LOSS' && !lossReason.trim()) return toast.error('손실 사유를 선택해주세요.')
    const stock = getStock(selectedItem)
    if ((logType === 'OUT' || logType === 'LOSS') && qty > stock) return toast.error(`재고(${stock}kg) 초과`)
    setSubmitting(true)
    try {
      if (logType === 'IN') saveTo('haccp_suppliers', supplier, savedSuppliers, setSavedSuppliers)
      if (logType === 'OUT') saveTo('haccp_destinations', destination, savedDestinations, setSavedDestinations)
      const { error } = await supabase.from('inventory_logs').insert({
        item_id: selectedItem, log_type: logType, quantity: qty,
        supplier: logType === 'IN' ? supplier || null : null,
        destination: logType === 'OUT' ? destination || null : null,
        loss_reason: logType === 'LOSS' ? lossReason : null,
        memo: null, recorded_by: user!.user_id,
      })
      if (error) throw error
      const typeLabel = LOG_TYPES.find(t => t.value === logType)?.label
      const itemName = items.find(i => i.item_id === selectedItem)?.name
      toast.success(`${itemName} ${qty}kg ${typeLabel} 완료`)
      setQtyStr('')
      await Promise.all([loadData(), loadLogs()])
    } catch (err: any) { toast.error('저장 실패: ' + err.message) }
    finally { setSubmitting(false) }
  }

  const lossRate = (() => {
    if (logType !== 'LOSS' || !selectedItem) return null
    const qty = parseFloat(qtyStr)
    const stock = getStock(selectedItem)
    if (!qty || !stock) return null
    return ((qty / stock) * 100).toFixed(1)
  })()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="text-2xl cursor-pointer">←</button>
        <h2 className="flex-1 text-xl font-bold">수불부 기록</h2>
        <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-base font-semibold" />
      </header>

      <div className="p-4">
        {/* PC 레이아웃 */}
        <div className="hidden md:grid md:grid-cols-10 gap-4">

          {/* 품목 + 유형 (3 cols) */}
          <section className="col-span-3 bg-white rounded-xl shadow-sm p-4">
            <label className="block text-base font-bold mb-3 text-gray-700">품목</label>
            <div className="flex flex-col gap-2">
              {items.map(item => {
                const stock = getStock(item.item_id)
                const icon = getItemIcon(item.name)
                return (
                  <button key={item.item_id} type="button"
                    onClick={() => { setSelectedItem(item.item_id); resetInputs() }}
                    className={`w-full py-5 rounded-xl border-2 text-center font-bold text-xl transition-all cursor-pointer ${selectedItem === item.item_id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                    <span className="text-3xl">{icon}</span>
                    <span className="ml-2">{item.name}</span>
                    <span className="block text-sm font-normal text-gray-500 mt-1">재고 {stock}kg</span>
                  </button>
                )
              })}
            </div>
            {selectedItem && (
              <>
                <label className="block text-base font-bold mt-6 mb-3 text-gray-700">유형</label>
                <div className="flex flex-col gap-2">
                  {LOG_TYPES.map(t => (
                    <button key={t.value} type="button" onClick={() => { setLogType(t.value); setQtyStr('') }}
                      className={`w-full py-5 rounded-xl border-2 text-center transition-all cursor-pointer ${logType === t.value ? t.active : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                      <span className="text-2xl">{t.icon}</span>
                      <span className="text-lg font-bold ml-2">{t.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* 수량 (4 cols = 비율 중 6 파트) */}
          <section className="col-span-4 bg-white rounded-xl shadow-sm p-4">
            <label className="block text-base font-bold mb-3 text-gray-700">수량</label>
            <div className="flex items-center gap-2 mb-4">
              <input type="text" value={qtyStr} readOnly placeholder="0"
                className="w-36 py-3 px-4 text-4xl font-bold text-right border-2 border-gray-200 rounded-lg bg-white tabular-nums outline-none" />
              <span className="text-xl font-semibold text-gray-500">kg</span>
            </div>
            <NumPad onInput={handleNumPad} keys={['1','2','3','4','5','6','7','8','9','.','0','←']} compact />
          </section>

          {/* 부가정보 + 저장 (3 cols = 비율 중 4 파트) */}
          <div className="col-span-3 flex flex-col gap-3">
            {logType === 'IN' && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <label className="block text-base font-bold text-blue-700 mb-2">공급처</label>
                <select value={supplier} onChange={e => setSupplier(e.target.value)}
                  className="w-full p-3 border border-blue-200 rounded-lg text-base font-semibold bg-white">
                  <option value="">선택</option>
                  {savedSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input type="text" value={supplier} onChange={e => setSupplier(e.target.value)}
                  placeholder="직접 입력" className="w-full p-3 border border-blue-200 rounded-lg text-base mt-2" />
              </div>
            )}
            {logType === 'OUT' && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <label className="block text-base font-bold text-green-700 mb-2">출고처</label>
                <select value={destination} onChange={e => setDestination(e.target.value)}
                  className="w-full p-3 border border-green-200 rounded-lg text-base font-semibold bg-white">
                  <option value="">선택</option>
                  {savedDestinations.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <input type="text" value={destination} onChange={e => setDestination(e.target.value)}
                  placeholder="직접 입력" className="w-full p-3 border border-green-200 rounded-lg text-base mt-2" />
              </div>
            )}
            {logType === 'LOSS' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <label className="block text-base font-bold text-red-700 mb-2">손실 사유 *</label>
                <select value={lossReason} onChange={e => setLossReason(e.target.value)}
                  className="w-full p-3 border border-red-200 rounded-lg text-base font-semibold bg-white">
                  <option value="">선택</option>
                  {LOSS_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                {lossRate && (
                  <div className="mt-4 text-center bg-white rounded-lg p-3">
                    <span className="text-sm text-red-600 font-semibold">손실률</span>
                    <span className="block text-3xl font-bold text-red-700">{lossRate}%</span>
                  </div>
                )}
              </div>
            )}
            {!logType && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-gray-400 text-lg">
                유형을 선택하세요
              </div>
            )}
            <button onClick={handleSubmit} disabled={submitting}
              className={`w-full py-5 text-xl font-bold text-white rounded-xl transition-all active:scale-[0.98] mt-auto ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 cursor-pointer'}`}>
              {submitting ? '저장중...' : '저장'}
            </button>
          </div>
        </div>

        {/* 모바일 레이아웃 */}
        <div className="md:hidden space-y-4">
          <section className="bg-white rounded-xl shadow-sm p-4">
            <label className="block text-base font-bold mb-2 text-gray-700">품목</label>
            <div className="grid grid-cols-3 gap-2">
              {items.map(item => {
                const stock = getStock(item.item_id)
                const icon = getItemIcon(item.name)
                return (
                  <button key={item.item_id} type="button"
                    onClick={() => { setSelectedItem(item.item_id); resetInputs() }}
                    className={`py-4 rounded-xl border-2 text-center font-bold text-lg transition-all cursor-pointer ${selectedItem === item.item_id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white'}`}>
                    <span className="text-2xl block">{icon}</span>
                    {item.name}
                    <span className="block text-xs font-normal text-gray-500">{stock}kg</span>
                  </button>
                )
              })}
            </div>
          </section>

          {selectedItem && (
            <section className="bg-white rounded-xl shadow-sm p-4">
              <label className="block text-base font-bold mb-2 text-gray-700">유형</label>
              <div className="grid grid-cols-3 gap-2">
                {LOG_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => { setLogType(t.value); setQtyStr('') }}
                    className={`py-4 rounded-xl border-2 text-center transition-all cursor-pointer ${logType === t.value ? t.active : 'border-gray-200 bg-white'}`}>
                    <span className="text-2xl block">{t.icon}</span>
                    <span className="text-base font-bold">{t.label}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {selectedItem && logType && (
            <section className="bg-white rounded-xl shadow-sm p-4">
              <label className="block text-base font-bold mb-2 text-gray-700">수량</label>
              <div className="flex items-center gap-2 mb-3">
                <input type="text" value={qtyStr} readOnly placeholder="0"
                  className="w-28 py-2 px-3 text-3xl font-bold text-right border-2 border-gray-200 rounded-lg bg-white tabular-nums outline-none" />
                <span className="text-lg font-semibold text-gray-500">kg</span>
              </div>
              <NumPad onInput={handleNumPad} keys={['1','2','3','4','5','6','7','8','9','.','0','←']} compact />

              {logType === 'IN' && (
                <div className="mt-3">
                  <label className="block text-sm font-bold text-blue-700 mb-1">공급처</label>
                  <select value={supplier} onChange={e => setSupplier(e.target.value)}
                    className="w-full p-2 border border-blue-200 rounded-lg text-base bg-white">
                    <option value="">선택</option>
                    {savedSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input type="text" value={supplier} onChange={e => setSupplier(e.target.value)}
                    placeholder="직접 입력" className="w-full p-2 border border-blue-200 rounded-lg text-base mt-1" />
                </div>
              )}
              {logType === 'OUT' && (
                <div className="mt-3">
                  <label className="block text-sm font-bold text-green-700 mb-1">출고처</label>
                  <select value={destination} onChange={e => setDestination(e.target.value)}
                    className="w-full p-2 border border-green-200 rounded-lg text-base bg-white">
                    <option value="">선택</option>
                    {savedDestinations.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <input type="text" value={destination} onChange={e => setDestination(e.target.value)}
                    placeholder="직접 입력" className="w-full p-2 border border-green-200 rounded-lg text-base mt-1" />
                </div>
              )}
              {logType === 'LOSS' && (
                <div className="mt-3">
                  <label className="block text-sm font-bold text-red-700 mb-1">손실 사유 *</label>
                  <select value={lossReason} onChange={e => setLossReason(e.target.value)}
                    className="w-full p-2 border border-red-200 rounded-lg text-base bg-white">
                    <option value="">선택</option>
                    {LOSS_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {lossRate && (
                    <div className="mt-2 text-center">
                      <span className="text-xs text-red-600 font-semibold">손실률</span>
                      <span className="block text-2xl font-bold text-red-700">{lossRate}%</span>
                    </div>
                  )}
                </div>
              )}

              <button onClick={handleSubmit} disabled={submitting}
                className={`w-full py-4 text-lg font-bold text-white rounded-xl mt-4 transition-all active:scale-[0.98] ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 cursor-pointer'}`}>
                {submitting ? '저장중...' : '저장'}
              </button>
            </section>
          )}
        </div>

        {/* 당일 기록 */}
        {todayLogs.length > 0 && (
          <section className="mt-6 bg-white rounded-xl shadow-sm p-4">
            <h3 className="text-lg font-bold text-gray-700 mb-3">{logDate} 기록</h3>
            <div className="space-y-2">
              {todayLogs.map((log: any) => {
                const t = LOG_TYPES.find(t => t.value === log.log_type)
                const icon = log.inventory_items?.name ? getItemIcon(log.inventory_items.name) : '📦'
                return (
                  <div key={log.log_id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                    <span className="text-xl">{icon}</span>
                    <span className="text-lg">{t?.icon}</span>
                    <span className="font-bold text-lg">{log.inventory_items?.name}</span>
                    <span className="text-lg">{log.quantity}kg</span>
                    <span className={`text-base font-semibold ${log.log_type === 'IN' ? 'text-blue-600' : log.log_type === 'OUT' ? 'text-green-600' : 'text-red-600'}`}>{t?.label}</span>
                    {log.supplier && <span className="text-sm text-gray-500">({log.supplier})</span>}
                    {log.destination && <span className="text-sm text-gray-500">({log.destination})</span>}
                    {log.loss_reason && <span className="text-sm text-red-500">({log.loss_reason})</span>}
                    <span className="ml-auto text-sm text-gray-400">{new Date(log.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
