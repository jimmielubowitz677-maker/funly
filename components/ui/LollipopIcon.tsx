import { type SVGProps } from 'react'

export default function LollipopIcon({ className, style, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
      {...props}
    >
      {/* Stick: from bottom-left up to the candy head */}
      <line
        x1="4" y1="20"
        x2="14.5" y2="9.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Candy head: round circle (Chupa Chups style), covers stick end */}
      <circle cx="17" cy="7" r="5" fill="currentColor" />
    </svg>
  )
}
