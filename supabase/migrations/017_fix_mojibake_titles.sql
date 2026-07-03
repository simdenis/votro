-- Fix three law titles where cdep.ro's own HTML contained "?" instead of
-- ș/ț (comma-below diacritics aren't representable in the legacy encoding
-- their backend mangled these through). One-off data repair — the scraper
-- now refuses to overwrite a clean title with a mojibake one.

update laws set title = 'Lege privind declararea protopopului Aurel Munteanu drept martir și erou al națiunii române și comemorarea Zilei Martirilor Români din Huedin'
where code = 'L200/2023' and title like '%?%';

update laws set title = 'Lege pentru modificarea și completarea Legii nr.268/2001 privind privatizarea societăților care dețin în administrare terenuri proprietate publică și privată a statului cu destinație agricolă și înființarea Autorității Naționale pentru Administrarea Domeniilor Statului, Pescuit și Acvacultură'
where code = 'L446/2026' and title like '%?%';

update laws set title = 'Lege pentru completarea Legii educației fizice și sportului nr. 69/2000'
where code = 'L253/2026' and title like '%?%';
