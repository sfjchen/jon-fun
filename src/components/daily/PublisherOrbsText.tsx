/* eslint-disable @next/next/no-img-element -- Keep publisher-hosted clues at their original URLs. */
import type { ReactNode } from 'react'

const origin = 'https://dailyorbs.com'
const iconPaths: Record<string, string> = {
  animal: 'animals',
  sport: 'sports',
  invention: 'inventions',
  exchange: 'exchange',
  disease: 'disease',
  celestial: 'celestial',
  logo: 'logos/brand-marks',
  flag: 'flags',
}

function mediaUrl(path: string | undefined) {
  if (!path) return
  try {
    const url = new URL(path, origin)
    if (url.origin === origin && !url.username && !url.password) return url.href
  } catch {}
}

function Detail({ kind, parts }: { kind: string; parts: string[] }) {
  const [mode, code, cx, cy, zoom, angle, slot, ratio, x = '0', y = '0', w = '640', h = '480'] = parts
  if (!code || !/^[a-z0-9-]+$/.test(code)) return null
  const [left, top, width, height, centerX, centerY, scale, rotation] = [
    Number(x),
    Number(y),
    Number(w),
    Number(h),
    Number(cx),
    Number(cy),
    Number(zoom),
    Number(angle),
  ]
  if (
    ![left, top, width, height, centerX, centerY, scale, rotation].every(Number.isFinite) ||
    scale <= 0 ||
    width <= 0 ||
    height <= 0
  )
    return null

  const path =
    kind === 'coat-detail'
      ? '/coat-details/arms-' + code.replace(/^coat-/, '') + '.svg'
      : code.startsWith('commons-')
        ? '/flag-details/flags/' + code.slice(8) + '.svg'
        : '/flags/' + code + '.svg'
  const aspect = ratio === '3:2' ? 1.5 : ratio === '2:3' ? 2 / 3 : 1
  const cropWidth = width / scale
  const cropHeight = cropWidth / aspect
  const isClue = mode !== 'reveal'
  const viewBox = isClue
    ? [centerX - cropWidth / 2, centerY - cropHeight / 2, cropWidth, cropHeight]
    : [left, top, width, height]
  return (
    <svg
      className="mx-auto block w-36 max-w-full rounded bg-white"
      viewBox={viewBox.join(' ')}
      role="img"
      aria-label={(kind === 'coat-detail' ? 'Coat of arms detail ' : 'Flag detail ') + (slot ?? '')}
    >
      <image
        href={mediaUrl(path)}
        x={left}
        y={top}
        width={width}
        height={height}
        transform={isClue ? 'rotate(' + -rotation + ' ' + centerX + ' ' + centerY + ')' : undefined}
      />
    </svg>
  )
}

function marker(token: string): ReactNode {
  if (token === 'row-break') return <br />
  const prefix = token.indexOf(':')
  const kind = token.slice(0, prefix)
  const data = token.slice(prefix + 1)
  const parts = data.split('|')
  const [first, second, third, fourth] = parts

  if (kind === 'dim') return <span className="text-sm opacity-75">{data}</span>
  if (kind === 'blank') return <span aria-label="blank">____</span>
  if (kind === 'flag-detail' || kind === 'coat-detail') return <Detail kind={kind} parts={parts} />
  if (kind === 'swatch' && first && /^#?[0-9a-f]{6}$/i.test(first ?? '')) {
    const hex = '#' + first.replace(/^#/, '')
    return (
      <span className="inline-flex items-center gap-1">
        <span role="img" aria-label={hex} className="inline-block h-5 w-7 rounded border" style={{ background: hex }} />
        {!parts.includes('no-label') && hex}
      </span>
    )
  }
  if (kind === 'img' || kind === 'picture') {
    const src = mediaUrl(kind === 'picture' ? second : first)
    const alt = (kind === 'picture' ? third : second) ?? 'Picture clue'
    const inline = kind === 'img' && third?.includes('display:inline')
    return src ? (
      <img
        src={src}
        alt={alt}
        className={
          inline
            ? 'inline-block h-5 max-w-full align-middle'
            : 'mx-auto my-1 block max-h-44 max-w-full rounded object-contain'
        }
      />
    ) : (
      alt
    )
  }
  if (kind === 'video') {
    return (
      <video
        aria-label={fourth ?? 'Video clue'}
        className="mx-auto max-h-44 max-w-full rounded"
        autoPlay
        muted
        loop
        playsInline
        poster={mediaUrl(third)}
      >
        <source src={mediaUrl(first)} type="video/webm" />
        <source src={mediaUrl(second)} type="video/mp4" />
        {fourth}
      </video>
    )
  }
  const dir = iconPaths[kind]
  if (dir && /^[a-z0-9-]+$/i.test(first ?? '')) {
    const ext = kind === 'flag' && /^us-[a-z]{2}$/.test(first ?? '') ? 'png' : 'svg'
    return (
      <img
        src={mediaUrl('/' + dir + '/' + first + '.' + ext)}
        alt={kind === 'logo' ? 'Brand mark' : ''}
        className={
          kind === 'logo' ? 'mx-auto block h-20 max-w-full' : 'inline-block h-5 w-6 object-contain align-middle'
        }
      />
    )
  }
  if (kind === 'orb') return '●'
  return token
}

const inlineToken = /(\{\{[^{}]+\}\}|\[[^\]\n]+\]\(https:\/\/[^)\s]+\)|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g

/** Renders publisher clues as text and known media, with no embedded HTML or inline publisher CSS. */
export default function PublisherOrbsText({ text }: { text: string }) {
  return (
    <span className="whitespace-pre-line">
      {text.split(inlineToken).map((part, index) => {
        if (part.startsWith('{{') && part.endsWith('}}')) return <span key={index}>{marker(part.slice(2, -2))}</span>
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>
        if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>
        const link = part.match(/^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/)
        if (link)
          return (
            <span key={index} title={link[2]}>
              {link[1]}
            </span>
          )
        return part
      })}
    </span>
  )
}
