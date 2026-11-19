import { historicalYear, type Artifact } from './artifact-scoring'
export type ArtifactHint = 'time' | 'place'
export type ArtifactHints = Record<string, ArtifactHint[]>
export function hintsRemaining(hints: ArtifactHints): number { return Math.max(0,3-Object.values(hints).reduce((sum,kinds)=>sum+kinds.length,0)) }
export function revealArtifactHint(hints: ArtifactHints, round: number, kind: ArtifactHint): ArtifactHints {
  if(hintsRemaining(hints)===0||hints[round]?.includes(kind))return hints
  return {...hints,[round]:[...hints[round]??[],kind]}
}
export function artifactHintText(artifact: Artifact, kind: ArtifactHint): string {
  if(kind==='place')return artifact.region??'Region unavailable'
  const start=Math.floor(Math.floor((artifact.beginYear+artifact.endYear)/2)/1000)*1000
  return `${historicalYear(start===0?1:start)} – ${historicalYear(start+1000)}`
}
