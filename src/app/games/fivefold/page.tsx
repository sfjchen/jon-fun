import { redirect } from 'next/navigation'
export default async function Page({searchParams}:{searchParams:Promise<{d?:string}>}){const {d}=await searchParams;redirect('/games/wordle'+(d?'?d='+encodeURIComponent(d):''))}
