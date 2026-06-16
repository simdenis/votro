-- VotRO: development seed data
-- Covers every law_status + presidential/CCR case so /legi and /legi/[id] can be fully previewed.
--
-- Run:   paste in Supabase SQL editor (run migration 008 first)
-- Clean: DELETE FROM votes WHERE id::text LIKE 'bbbbbbbb%';
--        DELETE FROM laws  WHERE code LIKE 'TEST-%';

DO $$
DECLARE
  l1  UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001'; -- complet: senat adoptat + camera adoptat → promulgat
  l2  UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002'; -- complet: senat adoptat + camera respins
  l3  UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-000000000003'; -- complet: senat respins + camera adoptat
  l4  UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-000000000004'; -- complet: senat respins + camera respins
  l5  UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-000000000005'; -- asteapta_camera: senat adoptat
  l6  UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-000000000006'; -- asteapta_camera: senat respins
  l7  UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-000000000007'; -- asteapta_senat:  camera adoptat
  l8  UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-000000000008'; -- asteapta_senat:  camera respins
  l9  UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-000000000009'; -- asteapta_camera: fără categorie
  l10 UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-000000000010'; -- complet → CCR constitutional → promulgat
  l11 UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-000000000011'; -- complet → CCR neconstitutional
  l12 UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-000000000012'; -- complet → CCR partial_neconstitutional → promulgat
  l13 UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-000000000013'; -- complet → retrimis de presedinte
  l14 UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-000000000014'; -- complet → sesizat_ccr (decizie în așteptare)
BEGIN

  -- ── Laws ────────────────────────────────────────────────────────────
  INSERT INTO laws (id, code, title, law_category) VALUES
    (l1, 'TEST-L001', 'Lege privind reforma sistemului de asigurări de sănătate și finanțarea spitalelor publice', 'Sănătate'),
    (l2, 'TEST-L002', 'Lege privind introducerea educației digitale și a competențelor informatice în ciclul preuniversitar', 'Educație'),
    (l3, 'TEST-L003', 'Lege privind modificarea Codului fiscal și impozitarea progresivă a veniturilor mari', 'Economie'),
    (l4, 'TEST-L004', 'Lege privind dotarea forțelor armate și consolidarea capacității de apărare națională', 'Apărare'),
    (l5, 'TEST-L005', 'Lege privind construcția de autostrăzi și modernizarea infrastructurii rutiere naționale', 'Infrastructură'),
    (l6, 'TEST-L006', 'Lege privind reducerea emisiilor de carbon, protecția pădurilor și biodiversității', 'Mediu'),
    (l7, 'TEST-L007', 'Lege privind drepturile copilului, prevenirea violenței domestice și protecția familiei', 'Social'),
    (l8, 'TEST-L008', 'Lege privind reorganizarea administrației publice locale și descentralizarea serviciilor', 'Administrație'),
    (l9,  'TEST-L009', 'Lege privind diverse modificări procedurale și actualizarea unor acte normative', NULL),
    (l10, 'TEST-L010', 'Lege privind organizarea și funcționarea instanțelor judecătorești', 'Justiție'),
    (l11, 'TEST-L011', 'Lege privind limitarea mandatelor aleșilor locali și sancțiunile pentru corupție', 'Justiție'),
    (l12, 'TEST-L012', 'Lege privind finanțarea publică a partidelor politice și transparența campaniilor', 'Administrație'),
    (l13, 'TEST-L013', 'Lege privind pensiile speciale ale parlamentarilor și magistraților', 'Social'),
    (l14, 'TEST-L014', 'Lege privind exploatarea resurselor energetice offshore din Marea Neagră', 'Energie')
  ON CONFLICT (code) DO NOTHING;

  -- ── Votes ───────────────────────────────────────────────────────────
  -- l1: complet — senat adoptat (85-28-12) + camera adoptat (195-88-22)
  INSERT INTO votes (id, law_id, vote_date, vote_type, for_count, against_count, abstention_count, not_voted_count, present_count, outcome, chamber) VALUES
    ('bbbbbbbb-0001-0001-0000-000000000000', l1, '2026-01-10', 'vot final', 85,  28, 12, 10, 125, 'adoptat', 'senate'),
    ('bbbbbbbb-0001-0002-0000-000000000000', l1, '2026-01-20', 'vot final', 195, 88, 22, 25, 305, 'adoptat', 'deputies')
  ON CONFLICT DO NOTHING;

  -- l2: complet — senat adoptat (78-35-8) + camera respins (120-155-18)
  INSERT INTO votes (id, law_id, vote_date, vote_type, for_count, against_count, abstention_count, not_voted_count, present_count, outcome, chamber) VALUES
    ('bbbbbbbb-0002-0001-0000-000000000000', l2, '2026-01-12', 'vot final', 78,  35, 8,  14, 121, 'adoptat', 'senate'),
    ('bbbbbbbb-0002-0002-0000-000000000000', l2, '2026-01-22', 'vot final', 120, 155, 18, 37, 293, 'respins', 'deputies')
  ON CONFLICT DO NOTHING;

  -- l3: complet — senat respins (42-72-6) + camera adoptat (188-102-14)
  INSERT INTO votes (id, law_id, vote_date, vote_type, for_count, against_count, abstention_count, not_voted_count, present_count, outcome, chamber) VALUES
    ('bbbbbbbb-0003-0001-0000-000000000000', l3, '2026-01-14', 'vot final', 42,  72, 6,  15, 120, 'respins', 'senate'),
    ('bbbbbbbb-0003-0002-0000-000000000000', l3, '2026-01-24', 'vot final', 188, 102, 14, 26, 304, 'adoptat', 'deputies')
  ON CONFLICT DO NOTHING;

  -- l4: complet — senat respins (38-80-5) + camera respins (112-178-20)
  INSERT INTO votes (id, law_id, vote_date, vote_type, for_count, against_count, abstention_count, not_voted_count, present_count, outcome, chamber) VALUES
    ('bbbbbbbb-0004-0001-0000-000000000000', l4, '2026-01-16', 'vot final', 38,  80, 5,  12, 123, 'respins', 'senate'),
    ('bbbbbbbb-0004-0002-0000-000000000000', l4, '2026-01-26', 'vot final', 112, 178, 20, 20, 310, 'respins', 'deputies')
  ON CONFLICT DO NOTHING;

  -- l5: asteapta_camera — senat adoptat (91-22-7), camera nu a votat
  INSERT INTO votes (id, law_id, vote_date, vote_type, for_count, against_count, abstention_count, not_voted_count, present_count, outcome, chamber) VALUES
    ('bbbbbbbb-0005-0001-0000-000000000000', l5, '2026-02-05', 'vot final', 91, 22, 7, 15, 120, 'adoptat', 'senate')
  ON CONFLICT DO NOTHING;

  -- l6: asteapta_camera — senat respins (35-88-4), camera nu a votat
  INSERT INTO votes (id, law_id, vote_date, vote_type, for_count, against_count, abstention_count, not_voted_count, present_count, outcome, chamber) VALUES
    ('bbbbbbbb-0006-0001-0000-000000000000', l6, '2026-02-07', 'vot final', 35, 88, 4, 8, 127, 'respins', 'senate')
  ON CONFLICT DO NOTHING;

  -- l7: asteapta_senat — camera adoptat (210-95-18), senat nu a votat
  INSERT INTO votes (id, law_id, vote_date, vote_type, for_count, against_count, abstention_count, not_voted_count, present_count, outcome, chamber) VALUES
    ('bbbbbbbb-0007-0001-0000-000000000000', l7, '2026-02-10', 'vot final', 210, 95, 18, 7, 323, 'adoptat', 'deputies')
  ON CONFLICT DO NOTHING;

  -- l8: asteapta_senat — camera respins (140-172-10), senat nu a votat
  INSERT INTO votes (id, law_id, vote_date, vote_type, for_count, against_count, abstention_count, not_voted_count, present_count, outcome, chamber) VALUES
    ('bbbbbbbb-0008-0001-0000-000000000000', l8, '2026-02-12', 'vot final', 140, 172, 10, 8, 322, 'respins', 'deputies')
  ON CONFLICT DO NOTHING;

  -- l9: asteapta_camera, fără categorie — senat adoptat (75-40-5)
  INSERT INTO votes (id, law_id, vote_date, vote_type, for_count, against_count, abstention_count, not_voted_count, present_count, outcome, chamber) VALUES
    ('bbbbbbbb-0009-0001-0000-000000000000', l9, '2026-02-15', 'vot final', 75, 40, 5, 15, 120, 'adoptat', 'senate')
  ON CONFLICT DO NOTHING;

  -- l10: complet → CCR constitutional → promulgat
  INSERT INTO votes (id, law_id, vote_date, vote_type, for_count, against_count, abstention_count, not_voted_count, present_count, outcome, chamber) VALUES
    ('bbbbbbbb-0010-0001-0000-000000000000', l10, '2026-02-20', 'vot final', 80, 32, 8, 15, 120, 'adoptat', 'senate'),
    ('bbbbbbbb-0010-0002-0000-000000000000', l10, '2026-03-01', 'vot final', 185, 105, 15, 25, 305, 'adoptat', 'deputies')
  ON CONFLICT DO NOTHING;

  -- l11: complet → CCR neconstitutional
  INSERT INTO votes (id, law_id, vote_date, vote_type, for_count, against_count, abstention_count, not_voted_count, present_count, outcome, chamber) VALUES
    ('bbbbbbbb-0011-0001-0000-000000000000', l11, '2026-02-21', 'vot final', 72, 40, 5, 18, 117, 'adoptat', 'senate'),
    ('bbbbbbbb-0011-0002-0000-000000000000', l11, '2026-03-03', 'vot final', 178, 118, 22, 12, 318, 'adoptat', 'deputies')
  ON CONFLICT DO NOTHING;

  -- l12: complet → CCR partial_neconstitutional → promulgat (cu modificări)
  INSERT INTO votes (id, law_id, vote_date, vote_type, for_count, against_count, abstention_count, not_voted_count, present_count, outcome, chamber) VALUES
    ('bbbbbbbb-0012-0001-0000-000000000000', l12, '2026-02-25', 'vot final', 88, 22, 10, 15, 120, 'adoptat', 'senate'),
    ('bbbbbbbb-0012-0002-0000-000000000000', l12, '2026-03-05', 'vot final', 200, 95, 18, 17, 313, 'adoptat', 'deputies')
  ON CONFLICT DO NOTHING;

  -- l13: complet → retrimis de președinte
  INSERT INTO votes (id, law_id, vote_date, vote_type, for_count, against_count, abstention_count, not_voted_count, present_count, outcome, chamber) VALUES
    ('bbbbbbbb-0013-0001-0000-000000000000', l13, '2026-03-10', 'vot final', 65, 52, 8, 10, 125, 'adoptat', 'senate'),
    ('bbbbbbbb-0013-0002-0000-000000000000', l13, '2026-03-18', 'vot final', 162, 148, 12, 8, 322, 'adoptat', 'deputies')
  ON CONFLICT DO NOTHING;

  -- l14: complet → sesizat_ccr (decizie în așteptare)
  INSERT INTO votes (id, law_id, vote_date, vote_type, for_count, against_count, abstention_count, not_voted_count, present_count, outcome, chamber) VALUES
    ('bbbbbbbb-0014-0001-0000-000000000000', l14, '2026-03-15', 'vot final', 95, 20, 5, 15, 120, 'adoptat', 'senate'),
    ('bbbbbbbb-0014-0002-0000-000000000000', l14, '2026-03-25', 'vot final', 210, 88, 20, 12, 318, 'adoptat', 'deputies')
  ON CONFLICT DO NOTHING;

  -- ── Presidential & CCR status ────────────────────────────────────────
  UPDATE laws SET presidential_status = 'promulgat',   presidential_date = '2026-01-28' WHERE id = l1;
  UPDATE laws SET presidential_status = 'promulgat',   presidential_date = '2026-03-15',
                  ccr_decision = 'constitutional',     ccr_date = '2026-03-10'           WHERE id = l10;
  UPDATE laws SET presidential_status = 'sesizat_ccr', presidential_date = '2026-03-20',
                  ccr_decision = 'neconstitutional',   ccr_date = '2026-04-05'           WHERE id = l11;
  UPDATE laws SET presidential_status = 'promulgat',   presidential_date = '2026-04-10',
                  ccr_decision = 'partial_neconstitutional', ccr_date = '2026-03-25'     WHERE id = l12;
  UPDATE laws SET presidential_status = 'retrimis',    presidential_date = '2026-04-01'  WHERE id = l13;
  UPDATE laws SET presidential_status = 'sesizat_ccr', presidential_date = '2026-04-10'  WHERE id = l14;

END $$;
