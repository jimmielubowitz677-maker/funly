import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import PostForm from '../../PostForm'

export const dynamic = 'force-dynamic'

export default async function EditPostPage({ params }: { params: { id: string } }) {
  const service = getSupabaseServiceClient()

  const [{ data: post }, { data: media }] = await Promise.all([
    service.from('posts').select('*').eq('id', params.id).single(),
    service.from('media').select('*').eq('post_id', params.id).order('sort_order'),
  ])

  if (!post) notFound()

  return (
    <PostForm
      mode="edit"
      post={post}
      existingMedia={(media ?? []).map(m => ({
        id:         m.id,
        url:        m.url,
        media_type: m.media_type,
        file_name:  m.file_name,
      }))}
    />
  )
}
