'use client'

import { formatPublicationDate } from '@/lib/publication-date'

export default function PublicationDate({ value }: { value: string | null }) {
  return <>{formatPublicationDate(value)}</>
}
