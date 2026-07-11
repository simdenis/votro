// One hue per law category — used by the og cards (summary accent bar +
// category label) so the feed stops feeling monochrome. Functional color:
// the hue MEANS the topic. Deliberately avoids the exact vote hues
// (#2EA871 pentru / #EE7B5E împotrivă / #E3A23C abțineri).
export const CATEGORY_COLORS: Record<string, string> = {
  'Economie': '#B27A24',
  'Administrație': '#64748B',
  'Social': '#C2517E',
  'Justiție': '#7C5CD6',
  'Educație': '#4E86D8',
  'Transport': '#0F9BA8',
  'Infrastructură': '#9A6B4F',
  'Sănătate': '#C0392B',
  'Agricultură': '#6B8E23',
  'Mediu': '#1E8449',
  'Energie': '#E67E22',
  'Tehnologie': '#2C3E75',
  'Apărare': '#37474F',
}

export function categoryColor(category: string | null | undefined): string | null {
  return category ? CATEGORY_COLORS[category] ?? null : null
}
