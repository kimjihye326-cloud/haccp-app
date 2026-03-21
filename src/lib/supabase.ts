import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase 환경변수가 설정되지 않았습니다. .env.local을 확인하세요.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storage: window.localStorage,
  },
})

export async function uploadInspectionPhoto(
  userId: string,
  inspectionType: 'cleaning' | 'metal' | 'temperature',
  file: File
): Promise<string | null> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const ext = file.name.split('.').pop() || 'jpg'
  const filePath = `${userId}/${inspectionType}/${timestamp}.${ext}`

  const { data, error } = await supabase.storage
    .from('inspection-photos')
    .upload(filePath, file, { cacheControl: '3600', upsert: false })

  if (error) {
    console.error('사진 업로드 실패:', error)
    return null
  }
  return data.path
}
