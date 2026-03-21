export interface User {
  user_id: string
  pin_code: string
  name: string
  role: 'WORKER' | 'MANAGER' | 'ADMIN'
  is_active: boolean
  auth_id?: string
}

export interface Product {
  product_id: number
  name: string
  category: string
  is_active: boolean
}

export interface CcpMaster {
  ccp_id: number
  product_id: number | null
  process_type: 'CLEANING' | 'METAL_DETECTION' | 'TEMPERATURE'
  parameter_name: string
  min_limit: number
  max_limit: number
  unit: string
  description: string
}

export interface CleaningLog {
  log_id: number
  inspector_id: string
  inspection_date: string
  inspection_time: string
  area: string
  sanitizer_type: string
  concentration_ppm: number
  standard_min_ppm: number
  standard_max_ppm: number
  is_passed: boolean
  corrective_action: string | null
  photo_url: string | null
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED'
  approved_by: string | null
  approved_at: string | null
  approval_signature: string | null
  created_at: string
  users?: { name: string }
}

export interface MetalLog {
  log_id: number
  inspector_id: string
  inspection_date: string
  inspection_time: string
  detector_name: string
  fe_detected: boolean
  sus_detected: boolean
  is_passed: boolean
  corrective_action: string | null
  photo_url: string | null
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED'
  approved_by: string | null
  approved_at: string | null
  approval_signature: string | null
  created_at: string
  users?: { name: string }
}

export interface TemperatureLog {
  log_id: number
  inspector_id: string
  inspection_date: string
  inspection_time: string
  location: string
  temperature: number
  standard_min: number
  standard_max: number
  is_passed: boolean
  corrective_action: string | null
  photo_url: string | null
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED'
  approved_by: string | null
  approved_at: string | null
  approval_signature: string | null
  created_at: string
  users?: { name: string }
}

export interface InventoryItem {
  item_id: number
  name: string
  unit: string
  is_active: boolean
}

export interface InventoryLog {
  log_id: number
  item_id: number
  log_date: string
  log_type: 'IN' | 'OUT' | 'LOSS'
  quantity: number
  unit: string
  supplier: string | null
  destination: string | null
  loss_reason: string | null
  memo: string | null
  recorded_by: string
  created_at: string
  inventory_items?: { name: string }
  users?: { name: string }
}

export interface InventorySummary {
  item_id: number
  name: string
  unit: string
  total_in: number
  total_out: number
  total_loss: number
  current_stock: number
}

export interface InventoryDaily {
  log_date: string
  item_id: number
  item_name: string
  unit: string
  daily_in: number
  daily_out: number
  daily_loss: number
}
