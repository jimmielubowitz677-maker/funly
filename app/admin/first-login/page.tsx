import { redirect } from 'next/navigation'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import FirstLoginSettings, { type RawPost } from './FirstLoginSettings'
export const dynamic = 'force-dynamic'
export default async function FirstLoginPage() {
  const supabase=await getSupabaseServerClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect('/login'); const service=getSupabaseServiceClient()
  const [{data:models},{data:settings},{count}]=await Promise.all([service.from('users').select('id,username,display_name,avatar_url,is_verified,is_online').eq('owner_id',user.id).eq('is_creator',true).order('created_at'),service.from('first_login_campaigns').select('*').limit(1).maybeSingle(),service.from('first_login_deliveries').select('*',{count:'exact',head:true}).eq('is_test',false)])
  const ids=(models??[]).map(m=>m.id); const {data:posts}=ids.length?await service.from('posts').select('id,creator_id,title,body,post_type,ppv_price_cents,like_count,comment_count,published_at,comments_disabled,display_like_count,media(url,media_type,sort_order)').in('creator_id',ids).order('published_at',{ascending:false}):{data:[]}
  return <FirstLoginSettings models={models??[]} posts={(posts??[]) as unknown as RawPost[]} initialSettings={settings} deliveredCount={count??0}/>
}
