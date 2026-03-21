import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth-store'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import type { CleaningLog, MetalLog, TemperatureLog, InventorySummary, InventoryLog } from '../../types/database'

type Tab = 'monitor' | 'inventory' | 'standards'

export default function AdminDashboard() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('monitor')
  const [cleaning, setCleaning] = useState<CleaningLog[]>([])
  const [metal, setMetal] = useState<MetalLog[]>([])
  const [temperature, setTemperature] = useState<TemperatureLog[]>([])
  const [invSummary, setInvSummary] = useState<InventorySummary[]>([])
  const [invLogs, setInvLogs] = useState<InventoryLog[]>([])
  const [standards, setStandards] = useState<any[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ parameter_name: '', min_limit: '', max_limit: '', unit: '', description: '' })
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    loadMonitor()
    loadInventory()
    loadStandards()
    const interval = setInterval(loadMonitor, 30000)
    return () => clearInterval(interval)
  }, [])

  async function loadMonitor() {
    const [c, m, t] = await Promise.all([
      supabase.from('cleaning_logs').select('*, users!inspector_id(name)').eq('inspection_date', today).order('created_at', { ascending: false }),
      supabase.from('metal_logs').select('*, users!inspector_id(name)').eq('inspection_date', today).order('created_at', { ascending: false }),
      supabase.from('temperature_logs').select('*, users!inspector_id(name)').eq('inspection_date', today).order('created_at', { ascending: false }),
    ])
    if (c.data) setCleaning(c.data as CleaningLog[])
    if (m.data) setMetal(m.data as MetalLog[])
    if (t.data) setTemperature(t.data as TemperatureLog[])
  }

  async function loadInventory() {
    const [sumRes, logRes] = await Promise.all([
      supabase.from('inventory_summary').select('*'),
      supabase.from('inventory_logs').select('*, inventory_items(name), users!recorded_by(name)').order('created_at', { ascending: false }).limit(100),
    ])
    if (sumRes.data) setInvSummary(sumRes.data as InventorySummary[])
    if (logRes.data) setInvLogs(logRes.data as InventoryLog[])
  }

  async function loadStandards() {
    const { data } = await supabase.from('ccp_master').select('*, products(name)').order('process_type')
    if (data) setStandards(data)
  }

  async function handleApprove(table: string, logId: number) {
    const { error } = await supabase.from(table).update({
      approval_status: 'APPROVED',
      approved_by: user!.user_id,
      approved_at: new Date().toISOString(),
    }).eq('log_id', logId)
    if (!error) loadMonitor()
  }

  function startEdit(std: any) {
    setEditingId(std.ccp_id)
    setEditForm({
      parameter_name: std.parameter_name || '',
      min_limit: String(std.min_limit ?? ''),
      max_limit: String(std.max_limit ?? ''),
      unit: std.unit || '',
      description: std.description || '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm({ parameter_name: '', min_limit: '', max_limit: '', unit: '', description: '' })
  }

  async function saveEdit(ccpId: number) {
    if (!editForm.parameter_name.trim()) return toast.error('항목명을 입력해주세요.')
    if (editForm.min_limit === '' || editForm.max_limit === '') return toast.error('최소/최대 값을 입력해주세요.')
    const minVal = parseFloat(editForm.min_limit)
    const maxVal = parseFloat(editForm.max_limit)
    if (isNaN(minVal) || isNaN(maxVal)) return toast.error('최소/최대는 숫자여야 합니다.')
    if (minVal > maxVal) return toast.error('최소값이 최대값보다 클 수 없습니다.')
    setSaving(true)
    try {
      const { error } = await supabase.from('ccp_master').update({
        parameter_name: editForm.parameter_name.trim(),
        min_limit: minVal,
        max_limit: maxVal,
        unit: editForm.unit.trim(),
        description: editForm.description.trim(),
        updated_by: user!.user_id,
        updated_at: new Date().toISOString(),
      }).eq('ccp_id', ccpId)
      if (error) throw error
      toast.success('기준 정보가 수정되었습니다.')
      cancelEdit()
      await loadStandards()
    } catch (err: any) { toast.error('저장 실패: ' + err.message) }
    finally { setSaving(false) }
  }

  const handleLogout = () => { logout(); navigate('/login', { replace: true }) }

  const allLogs = [...cleaning, ...metal, ...temperature]
  const totalCount = allLogs.length
  const passCount = allLogs.filter(l => l.is_passed).length
  const failCount = allLogs.filter(l => !l.is_passed).length
  const pendingCount = allLogs.filter(l => l.approval_status === 'PENDING').length

  const tabs: { key: Tab; label: string }[] = [
    { key: 'monitor', label: '실시간 모니터링' },
    { key: 'inventory', label: '수불부 현황' },
    { key: 'standards', label: '기준 정보 관리' },
  ]

  const typeBadge = { IN: 'bg-blue-100 text-blue-700', OUT: 'bg-green-100 text-green-700', LOSS: 'bg-red-100 text-red-700' } as const
  const typeLabel = { IN: '입고', OUT: '출고', LOSS: '손실' } as const

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <span className="bg-blue-600 text-white font-extrabold px-4 py-2 rounded-lg text-sm tracking-wider">HACCP</span>
          <h2 className="text-lg font-bold hidden md:block">관리자 모니터링 시스템</h2>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{user?.name} ({user?.role === 'ADMIN' ? 'HACCP팀장' : '관리자'})</span>
          <span>{today}</span>
          <button onClick={handleLogout} className="text-blue-600 font-medium cursor-pointer">로그아웃</button>
        </div>
      </header>

      {/* 탭 */}
      <nav className="bg-white border-b border-gray-200 px-4 md:px-8 flex overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-3.5 text-sm font-medium border-b-3 transition-all whitespace-nowrap cursor-pointer
              ${activeTab === tab.key ? 'text-blue-600 border-blue-600 font-bold' : 'text-gray-500 border-transparent hover:text-blue-600'}`}>
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="p-4 md:p-8">
        {/* ===== 모니터링 탭 ===== */}
        {activeTab === 'monitor' && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-4">
              <div className="bg-white rounded-xl shadow-sm p-5 min-w-[120px] text-center">
                <span className="block text-3xl font-extrabold">{totalCount}</span>
                <span className="text-sm text-gray-500">전체 점검</span>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-5 min-w-[120px] text-center">
                <span className="block text-3xl font-extrabold text-green-600">{passCount}</span>
                <span className="text-sm text-gray-500">적합</span>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-5 min-w-[120px] text-center">
                <span className="block text-3xl font-extrabold text-red-600">{failCount}</span>
                <span className="text-sm text-gray-500">부적합</span>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-5 min-w-[120px] text-center">
                <span className="block text-3xl font-extrabold text-orange-500">{pendingCount}</span>
                <span className="text-sm text-gray-500">미결재</span>
              </div>
              <button onClick={loadMonitor} className="ml-auto px-5 py-2 bg-white border border-gray-200 rounded-lg text-sm cursor-pointer hover:bg-gray-50">
                🔄 새로고침
              </button>
            </div>

            {/* 세척/소독 */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <h3 className="px-5 py-4 font-semibold bg-gray-50 border-b border-gray-200 text-sm">🧴 세척/소독 점검</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">시간</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">점검자</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">구역</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">농도(ppm)</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">판정</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">결재</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cleaning.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-gray-400">기록 없음</td></tr>
                    ) : cleaning.map(row => (
                      <tr key={row.log_id} className={`border-b border-gray-100 ${!row.is_passed ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-2.5 tabular-nums">{row.inspection_time}</td>
                        <td className="px-4 py-2.5">{(row.users as any)?.name || '-'}</td>
                        <td className="px-4 py-2.5">{row.area}</td>
                        <td className="px-4 py-2.5 tabular-nums">{row.concentration_ppm} <span className="text-xs text-gray-400">({row.standard_min_ppm}~{row.standard_max_ppm})</span></td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${row.is_passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {row.is_passed ? '적합' : '부적합'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {row.approval_status === 'PENDING' ? (
                            <button onClick={() => handleApprove('cleaning_logs', row.log_id)}
                              className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-lg cursor-pointer">승인</button>
                          ) : (
                            <span className="text-xs text-green-600 font-semibold">승인됨</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 금속검출기 */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <h3 className="px-5 py-4 font-semibold bg-gray-50 border-b border-gray-200 text-sm">🔍 금속검출기 점검</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">시간</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">점검자</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">검출기</th>
                      <th className="px-4 py-2.5 text-center font-semibold text-gray-500">Fe</th>
                      <th className="px-4 py-2.5 text-center font-semibold text-gray-500">Sus</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">판정</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">결재</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metal.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-8 text-gray-400">기록 없음</td></tr>
                    ) : metal.map(row => (
                      <tr key={row.log_id} className={`border-b border-gray-100 ${!row.is_passed ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-2.5 tabular-nums">{row.inspection_time}</td>
                        <td className="px-4 py-2.5">{(row.users as any)?.name || '-'}</td>
                        <td className="px-4 py-2.5">{row.detector_name}</td>
                        <td className="px-4 py-2.5 text-center font-bold">{row.fe_detected ? <span className="text-green-600">O</span> : <span className="text-red-600">X</span>}</td>
                        <td className="px-4 py-2.5 text-center font-bold">{row.sus_detected ? <span className="text-green-600">O</span> : <span className="text-red-600">X</span>}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${row.is_passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {row.is_passed ? '적합' : '부적합'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {row.approval_status === 'PENDING' ? (
                            <button onClick={() => handleApprove('metal_logs', row.log_id)}
                              className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-lg cursor-pointer">승인</button>
                          ) : (
                            <span className="text-xs text-green-600 font-semibold">승인됨</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 온도 */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <h3 className="px-5 py-4 font-semibold bg-gray-50 border-b border-gray-200 text-sm">🌡️ 온도 점검</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">시간</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">점검자</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">장소</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">온도</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">판정</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">결재</th>
                    </tr>
                  </thead>
                  <tbody>
                    {temperature.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-gray-400">기록 없음</td></tr>
                    ) : temperature.map(row => (
                      <tr key={row.log_id} className={`border-b border-gray-100 ${!row.is_passed ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-2.5 tabular-nums">{row.inspection_time}</td>
                        <td className="px-4 py-2.5">{(row.users as any)?.name || '-'}</td>
                        <td className="px-4 py-2.5">{row.location}</td>
                        <td className="px-4 py-2.5 tabular-nums">{row.temperature}°C <span className="text-xs text-gray-400">({row.standard_min}~{row.standard_max})</span></td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${row.is_passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {row.is_passed ? '적합' : '부적합'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {row.approval_status === 'PENDING' ? (
                            <button onClick={() => handleApprove('temperature_logs', row.log_id)}
                              className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-lg cursor-pointer">승인</button>
                          ) : (
                            <span className="text-xs text-green-600 font-semibold">승인됨</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===== 수불부 탭 ===== */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {invSummary.map(item => (
                <div key={item.item_id} className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-bold mb-4">{item.name}</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">총 입고</p>
                      <p className="text-xl font-bold text-blue-600 tabular-nums">{item.total_in.toLocaleString()} {item.unit}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">총 출고</p>
                      <p className="text-xl font-bold text-green-600 tabular-nums">{item.total_out.toLocaleString()} {item.unit}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">총 손실</p>
                      <p className="text-xl font-bold text-red-600 tabular-nums">{item.total_loss.toLocaleString()} {item.unit}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">현재 재고</p>
                      <p className={`text-xl font-bold tabular-nums ${item.current_stock <= 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {item.current_stock.toLocaleString()} {item.unit}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <h3 className="px-5 py-4 font-semibold bg-gray-50 border-b border-gray-200 text-sm">📋 최근 수불 기록</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">날짜</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">품목</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">유형</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-gray-500">수량</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">공급/출고처</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">기록자</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invLogs.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-8 text-gray-400">기록 없음</td></tr>
                    ) : invLogs.map(log => (
                      <tr key={log.log_id} className={`border-b border-gray-100 ${log.log_type === 'LOSS' ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-2.5 tabular-nums">{log.log_date}</td>
                        <td className="px-4 py-2.5 font-medium">{(log.inventory_items as any)?.name || '-'}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${typeBadge[log.log_type]}`}>
                            {typeLabel[log.log_type]}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{log.quantity.toLocaleString()} {log.unit}</td>
                        <td className="px-4 py-2.5 text-gray-600">{log.supplier || log.destination || '-'}</td>
                        <td className="px-4 py-2.5">{(log.users as any)?.name || '-'}</td>
                        <td className="px-4 py-2.5 text-gray-500 max-w-[200px] truncate">{log.loss_reason || log.memo || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===== 기준 정보 탭 (수정 기능 추가) ===== */}
        {activeTab === 'standards' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <h3 className="px-5 py-4 font-semibold bg-gray-50 border-b border-gray-200 text-sm flex items-center justify-between">
                <span>📐 CCP 한계 기준</span>
                <span className="text-xs text-gray-400 font-normal">행을 클릭하면 수정할 수 있습니다</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">점검 유형</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">항목명</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">제품</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-gray-500">최소</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-gray-500">최대</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">단위</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500">설명</th>
                      <th className="px-4 py-2.5 text-center font-semibold text-gray-500 w-[140px]">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standards.map((std: any) => (
                      editingId === std.ccp_id ? (
                        <tr key={std.ccp_id} className="border-b border-gray-100 bg-blue-50">
                          <td className="px-4 py-2.5">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold
                              ${std.process_type === 'CLEANING' ? 'bg-blue-100 text-blue-700' :
                                std.process_type === 'TEMPERATURE' ? 'bg-green-100 text-green-700' :
                                'bg-pink-100 text-pink-700'}`}>
                              {std.process_type === 'CLEANING' ? '세척/소독' : std.process_type === 'TEMPERATURE' ? '온도' : '금속검출'}
                            </span>
                          </td>
                          <td className="px-4 py-1.5">
                            <input type="text" value={editForm.parameter_name}
                              onChange={e => setEditForm(f => ({ ...f, parameter_name: e.target.value }))}
                              className="w-full px-2 py-1.5 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                          </td>
                          <td className="px-4 py-2.5 text-gray-500">{std.products?.name || '공통'}</td>
                          <td className="px-4 py-1.5">
                            <input type="number" step="any" value={editForm.min_limit}
                              onChange={e => setEditForm(f => ({ ...f, min_limit: e.target.value }))}
                              className="w-20 px-2 py-1.5 border border-blue-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400" />
                          </td>
                          <td className="px-4 py-1.5">
                            <input type="number" step="any" value={editForm.max_limit}
                              onChange={e => setEditForm(f => ({ ...f, max_limit: e.target.value }))}
                              className="w-20 px-2 py-1.5 border border-blue-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400" />
                          </td>
                          <td className="px-4 py-1.5">
                            <input type="text" value={editForm.unit}
                              onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))}
                              className="w-16 px-2 py-1.5 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                          </td>
                          <td className="px-4 py-1.5">
                            <input type="text" value={editForm.description}
                              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                              className="w-full px-2 py-1.5 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => saveEdit(std.ccp_id)} disabled={saving}
                                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg cursor-pointer disabled:bg-gray-400">
                                {saving ? '...' : '저장'}
                              </button>
                              <button onClick={cancelEdit}
                                className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg cursor-pointer">
                                취소
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={std.ccp_id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => startEdit(std)}>
                          <td className="px-4 py-2.5">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold
                              ${std.process_type === 'CLEANING' ? 'bg-blue-100 text-blue-700' :
                                std.process_type === 'TEMPERATURE' ? 'bg-green-100 text-green-700' :
                                'bg-pink-100 text-pink-700'}`}>
                              {std.process_type === 'CLEANING' ? '세척/소독' : std.process_type === 'TEMPERATURE' ? '온도' : '금속검출'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-medium">{std.parameter_name}</td>
                          <td className="px-4 py-2.5 text-gray-500">{std.products?.name || '공통'}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{std.min_limit}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{std.max_limit}</td>
                          <td className="px-4 py-2.5">{std.unit}</td>
                          <td className="px-4 py-2.5 text-gray-500">{std.description || '-'}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="text-xs text-blue-500 font-medium">✏️ 수정</span>
                          </td>
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
