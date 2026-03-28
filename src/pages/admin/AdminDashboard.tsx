import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth-store'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import type { CleaningLog, MetalLog, TemperatureLog, InventorySummary, InventoryLog } from '../../types/database'

type Tab = 'monitor' | 'inventory' | 'standards' | 'verification' | 'reports'

export default function AdminDashboard() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('monitor')
  const [cleaning, setCleaning] = useState<CleaningLog[]>([])
  const [metal, setMetal] = useState<MetalLog[]>([])
  const [temperature, setTemperature] = useState<TemperatureLog[]>([])
  const [healthData, setHealthData] = useState<any[]>([])
  const [hygieneData, setHygieneData] = useState<any[]>([])
  const [sanitationData, setSanitationData] = useState<any[]>([])
  const [invSummary, setInvSummary] = useState<InventorySummary[]>([])
  const [invLogs, setInvLogs] = useState<InventoryLog[]>([])
  const [standards, setStandards] = useState<any[]>([])
  const [verificationItems, setVerificationItems] = useState([
    { process: '소독세척공정', items: [
      { text: '종사자가 주기적으로 원료량, 세척시간, 세척수 양을 확인하고, 그 내용을 기록하고 있습니까?', answer: '' },
      { text: '계측기 (저울, 타이머)는 연1회 이상 검교정이 이루어지고 있습니까?', answer: '' },
      { text: '모니터링 행동 관찰 결과는 양호합니까?', answer: '' },
      { text: '모니터링 담당자 인터뷰 결과는 양호합니까?', answer: '' },
    ]},
    { process: '금속검출공정', items: [
      { text: '계측기는 연1회 이상 검교정이 이루어지고 있습니까?', answer: '' },
      { text: '모니터링 일지가 정상 작성되고 있습니까?', answer: '' },
      { text: '모니터링 행동 관찰 결과는 양호합니까?', answer: '' },
      { text: '모니터링 담당자 인터뷰 결과는 양호합니까?', answer: '' },
    ]},
  ])
  const [verificationDate, setVerificationDate] = useState(new Date().toISOString().slice(0, 10))
  const [verificationMemo, setVerificationMemo] = useState('')
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7))
  const [generating, setGenerating] = useState(false)
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
    const [c, m, t, h, hy, sa] = await Promise.all([
      supabase.from('cleaning_logs').select('*, users!inspector_id(name)').eq('inspection_date', today).order('created_at', { ascending: false }),
      supabase.from('metal_logs').select('*, users!inspector_id(name)').eq('inspection_date', today).order('created_at', { ascending: false }),
      supabase.from('temperature_logs').select('*, users!inspector_id(name)').eq('inspection_date', today).order('created_at', { ascending: false }),
      supabase.from('health_checks').select('*, users!inspector_id(name)').eq('check_date', today).order('created_at', { ascending: false }),
      supabase.from('hygiene_checks').select('*, users!inspector_id(name)').eq('check_date', today).order('created_at', { ascending: false }),
      supabase.from('sanitation_logs').select('*, users!inspector_id(name)').eq('check_date', today).order('created_at', { ascending: false }),
    ])
    if (c.data) setCleaning(c.data as CleaningLog[])
    if (m.data) setMetal(m.data as MetalLog[])
    if (h.data) setHealthData(h.data)
    if (hy.data) setHygieneData(hy.data)
    if (sa.data) setSanitationData(sa.data)
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

  const ccpLogs = [...cleaning, ...metal, ...temperature]
  const allLogs = [...ccpLogs, ...healthData, ...hygieneData, ...sanitationData]
  const totalCount = allLogs.length
  const passCount = ccpLogs.filter(l => l.is_passed).length
  const failCount = ccpLogs.filter(l => l.is_passed === false).length
  const pendingCount = ccpLogs.filter(l => l.approval_status === 'PENDING').length

  const tabs: { key: Tab; label: string }[] = [
    { key: 'monitor', label: '실시간 모니터링' },
    { key: 'inventory', label: '수불부 현황' },
    { key: 'standards', label: '기준 정보 관리' },
    { key: 'verification', label: '중요관리점 검증점검표' },
    { key: 'reports', label: '월별 보고서 출력' },
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

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <h3 className="px-5 py-4 font-semibold bg-gray-50 border-b border-gray-200 text-sm">종사자위생점검</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600"><tr><th className="px-4 py-3 text-left">시간</th><th className="px-4 py-3 text-left">점검자</th><th className="px-4 py-3 text-left">질문</th><th className="px-4 py-3 text-center">응답</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {healthData.length === 0 ? (<tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">오늘 데이터 없음</td></tr>) : healthData.map((row: any, i: number) => (<tr key={i} className="hover:bg-gray-50"><td className="px-4 py-2.5 text-gray-500">{new Date(row.created_at).toLocaleTimeString("ko-KR", {hour:"2-digit",minute:"2-digit"})}</td><td className="px-4 py-2.5">{row.users?.name || "-"}</td><td className="px-4 py-2.5">{row.question}</td><td className="px-4 py-2.5 text-center"><span className={`px-2 py-1 rounded-full text-xs font-bold ${row.answer ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{row.answer ? "정상" : "이상"}</span></td></tr>))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <h3 className="px-5 py-4 font-semibold bg-gray-50 border-b border-gray-200 text-sm">일일위생점검</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600"><tr><th className="px-4 py-3 text-left">시간</th><th className="px-4 py-3 text-left">점검자</th><th className="px-4 py-3 text-left">구분</th><th className="px-4 py-3 text-left">항목</th><th className="px-4 py-3 text-center">결과</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {hygieneData.length === 0 ? (<tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">오늘 데이터 없음</td></tr>) : hygieneData.map((row: any, i: number) => (<tr key={i} className="hover:bg-gray-50"><td className="px-4 py-2.5 text-gray-500">{new Date(row.created_at).toLocaleTimeString("ko-KR", {hour:"2-digit",minute:"2-digit"})}</td><td className="px-4 py-2.5">{row.users?.name || "-"}</td><td className="px-4 py-2.5">{row.category || row.period || "-"}</td><td className="px-4 py-2.5">{row.item_name || row.check_item || "-"}</td><td className="px-4 py-2.5 text-center"><span className={`px-2 py-1 rounded-full text-xs font-bold ${row.result === "OK" || row.result === "양호" ? "bg-green-100 text-green-700" : row.result === "FAIL" || row.result === "불량" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>{row.result || "-"}</span></td></tr>))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <h3 className="px-5 py-4 font-semibold bg-gray-50 border-b border-gray-200 text-sm">조리시설기구소독관리</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600"><tr><th className="px-4 py-3 text-left">시간</th><th className="px-4 py-3 text-left">점검자</th><th className="px-4 py-3 text-left">대상</th><th className="px-4 py-3 text-center">소독완료</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {sanitationData.length === 0 ? (<tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">오늘 데이터 없음</td></tr>) : sanitationData.map((row: any, i: number) => (<tr key={i} className="hover:bg-gray-50"><td className="px-4 py-2.5 text-gray-500">{new Date(row.created_at).toLocaleTimeString("ko-KR", {hour:"2-digit",minute:"2-digit"})}</td><td className="px-4 py-2.5">{row.users?.name || "-"}</td><td className="px-4 py-2.5">{row.target_name}</td><td className="px-4 py-2.5 text-center"><span className={`px-2 py-1 rounded-full text-xs font-bold ${row.is_done ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{row.is_done ? "완료" : "미완료"}</span></td></tr>))}
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
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-bold mb-4">월별 보고서 출력</h3>
              <div className="flex items-center gap-4 mb-6">
                <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-2 text-base font-semibold" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'CCP-1B 세척/소독', table: 'cleaning_logs', dateCol: 'inspection_date' },
                  { label: 'CCP-2P 금속검출기', table: 'metal_logs', dateCol: 'inspection_date' },
                  { label: '창고관리(온도)', table: 'temperature_logs', dateCol: 'inspection_date' },
                  { label: '일일위생점검', table: 'hygiene_checks', dateCol: 'check_date' },
                  { label: '종사자위생점검', table: 'health_checks', dateCol: 'check_date' },
                  { label: '조리시설기구소독', table: 'sanitation_logs', dateCol: 'check_date' },
                ].map(report => (
                  <button key={report.table} disabled={generating}
                    onClick={async () => {
                      setGenerating(true)
                      try {
                        const startDate = reportMonth + '-01'
                        const endDate = new Date(parseInt(reportMonth.split('-')[0]), parseInt(reportMonth.split('-')[1]), 0).toISOString().split('T')[0]
                        const { data, error } = await supabase.from(report.table).select('*').gte(report.dateCol, startDate).lte(report.dateCol, endDate).order(report.dateCol)
                        if (error) throw error
                        if (!data || data.length === 0) { toast.error('해당 월에 데이터가 없습니다.'); return }
                        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
                        doc.setFont('helvetica')
                        doc.setFontSize(16)
                        doc.text(report.label + ' - ' + reportMonth, 14, 15)
                        doc.setFontSize(10)
                        doc.text('출력일: ' + new Date().toLocaleDateString('ko-KR'), 14, 22)
                        const cols = Object.keys(data[0]).filter(k => k !== 'inspector_id' && k !== 'created_at' && k !== 'photo_url' && k !== 'approval_signature')
                        const rows = data.map(row => cols.map(c => { const v = row[c]; return v === true ? 'O' : v === false ? 'X' : v === null ? '-' : String(v) }));
                        (doc as any).autoTable({ head: [cols], body: rows, startY: 28, styles: { fontSize: 7, cellPadding: 2 }, headStyles: { fillColor: [37, 99, 235], fontSize: 7 }, theme: 'grid' })
                        doc.save(report.label + '_' + reportMonth + '.pdf')
                        toast.success(report.label + ' PDF 다운로드 완료')
                      } catch (err: any) { toast.error('PDF 생성 실패: ' + err.message) }
                      finally { setGenerating(false) }
                    }}
                    className={`p-5 rounded-xl border-2 text-left transition-all cursor-pointer ${generating ? 'border-gray-200 bg-gray-50 cursor-not-allowed' : 'border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50'}`}>
                    <p className="text-base font-bold text-gray-800">{report.label}</p>
                    <p className="text-sm text-gray-500 mt-1">PDF 다운로드</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'verification' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-4 mb-6">
                <h3 className="text-lg font-bold">중요관리점(CCP) 검증점검표</h3>
                <input type="date" value={verificationDate} onChange={e => setVerificationDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold" />
              </div>
              {verificationItems.map((proc, pi) => (
                <div key={pi} className="mb-6">
                  <h4 className="text-base font-bold text-gray-800 mb-3 px-2 py-2 bg-gray-50 rounded-lg">{proc.process}</h4>
                  <div className="space-y-3">
                    {proc.items.map((item, ii) => (
                      <div key={ii} className="flex items-start gap-4 p-4 border border-gray-200 rounded-xl">
                        <p className="flex-1 text-sm text-gray-700">{item.text}</p>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => { const n = [...verificationItems]; n[pi].items[ii].answer = '예'; setVerificationItems(n) }}
                            className={`px-4 py-2 rounded-lg text-sm font-bold cursor-pointer border-2 ${item.answer === '예' ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-500'}`}>예</button>
                          <button onClick={() => { const n = [...verificationItems]; n[pi].items[ii].answer = '아니오'; setVerificationItems(n) }}
                            className={`px-4 py-2 rounded-lg text-sm font-bold cursor-pointer border-2 ${item.answer === '아니오' ? 'border-red-600 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-500'}`}>아니오</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="mt-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">비고</label>
                <textarea value={verificationMemo} onChange={e => setVerificationMemo(e.target.value)} rows={3}
                  placeholder="검증 관련 메모" className="w-full p-3 border border-gray-300 rounded-xl text-sm outline-none" />
              </div>
              <button onClick={async () => {
                const unanswered = verificationItems.some(p => p.items.some(i => !i.answer))
                if (unanswered) { toast.error('모든 항목에 답변해주세요.'); return }
                try {
                  const rows = verificationItems.flatMap(p => p.items.map(i => ({
                    inspector_id: user!.user_id, check_date: verificationDate,
                    process_name: p.process, item_text: i.text, answer: i.answer,
                    memo: verificationMemo || null,
                  })))
                  const { error } = await supabase.from('verification_checks').insert(rows)
                  if (error) throw error
                  toast.success('검증점검표 저장 완료')
                } catch (err: any) { toast.error('저장 실패: ' + err.message) }
              }} className="w-full mt-4 py-4 text-lg font-bold text-white bg-blue-600 rounded-xl cursor-pointer active:scale-[0.98]">저장</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}









