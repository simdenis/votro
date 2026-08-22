/** Press mentions of LaButoane — newest first. */
export interface PressMention {
  outlet: string
  title: string
  url: string
  date: string // ISO yyyy-mm-dd
}

export const PRESS_MENTIONS: PressMention[] = [
  {
    outlet: 'Edupedu.ro',
    title:
      'ANALIZĂ Aproape jumătate dintre inițiativele pe educație și salarizarea profesorilor depuse într-un an la Camera Deputaților nu au ajuns la niciun vot în plen',
    url: 'https://www.edupedu.ro/analiza-aproape-jumatate-dintre-initiativele-pe-educatie-si-salarizarea-profesorilor-depuse-intr-un-an-la-camera-deputatilor-nu-au-ajuns-la-niciun-vot-in-plen-doua-proiecte-care-modifica-masurile-di/',
    date: '2026-08-22',
  },
]
