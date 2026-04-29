-- Migration 003: Backfill law_category for existing laws
-- Uses PostgreSQL case-insensitive regex (~*). First match wins via CASE ordering.
-- Re-runnable: only updates rows where law_category IS NULL.

UPDATE laws
SET law_category = CASE
  WHEN title ~* 'sănătat|spital|farmaceut|sanitar|clinică|stomatolog|medicament|asigurări.*sănătate'
    THEN 'Sănătate'
  WHEN title ~* 'educaț|învățăm|universit|student|didact|școlar|academic|cercetare'
    THEN 'Educație'
  WHEN title ~* 'penal|cod penal|recidiv|infracțiu|judecăt|procuror|avocat|execut.*silit|insolv|tribunal|contravențional'
    THEN 'Justiție'
  WHEN title ~* 'social|familie|copil|femicid|violenț.*domestic|pensii|pensionar|muncă|salariu|șomaj|ajutor.*social|discriminar'
    THEN 'Social'
  WHEN title ~* 'autostrad|drum|feroviar|metrou|cale ferată|rutier|port |aeroport|pod |tunel|infrastructur'
    THEN 'Infrastructură'
  WHEN title ~* 'transport|trafic|circulaț|vehicul'
    THEN 'Transport'
  WHEN title ~* 'agricult|rural|produse agricole|silvic|fond funciar|pădure|defrișare|pescuit|acvacult'
    THEN 'Agricultură'
  WHEN title ~* 'mediu|ecolog|climă|deșeuri|reciclare|biodiversit|arii protejate|poluare|apă potabilă'
    THEN 'Mediu'
  WHEN title ~* 'energie|petrol|gaze|electricitate|nuclear|regenerab|cărbune|combustibil'
    THEN 'Energie'
  WHEN title ~* 'apărare|militar|armată|securitate națională|nato|armament|servicii secrete'
    THEN 'Apărare'
  WHEN title ~* 'fiscal|buget|impozit|taxe|tva|financiar|datorie publică|economie|comerț|investiț|capital|bursă'
    THEN 'Economie'
  WHEN title ~* 'digital|informatică|cibernetic|date personale|gdpr|inteligență artificială|software|cloud|internet'
    THEN 'Tehnologie'
  WHEN title ~* 'administraț|funcționar public|primărie|consiliu local|descentralizar|servicii publice'
    THEN 'Administrație'
  ELSE NULL
END
WHERE law_category IS NULL;
