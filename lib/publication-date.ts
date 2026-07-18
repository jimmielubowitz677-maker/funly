export const PUBLICATION_DATE_NOT_SET = 'Publication date not set'

export function formatPublicationDate(value: string | null | undefined): string {
  if (!value) return PUBLICATION_DATE_NOT_SET

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return PUBLICATION_DATE_NOT_SET

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
