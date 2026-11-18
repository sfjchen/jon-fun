import { Suspense } from 'react'
import SetGame from '@/components/triples/SetGame'
export const metadata={title:'Daily SET'}
export default function Page(){return <Suspense fallback={<p>Dealing…</p>}><SetGame/></Suspense>}
