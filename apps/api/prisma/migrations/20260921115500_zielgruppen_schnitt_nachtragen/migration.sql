-- Zielgruppen bekommen den Schnitt: "Service in Bremen" ist nicht "Service
-- überall" plus "Bremen komplett". Die Tokens eines Kontos stehen aber
-- gespeichert in "User".scopes - danach sucht der Versand der
-- Benachrichtigungen. Ohne dieses Nachtragen erreichte ein Beitrag an
-- "location:HB+department:SRV" niemanden, bis das Konto das nächste Mal
-- bearbeitet wird.
--
-- Erzeugt werden dieselben Tokens wie in eigeneZielgruppen()
-- (packages/shared/src/zielgruppen.ts): "global" plus jede nichtleere
-- Kombination der vorhandenen Merkmale, in der Reihenfolge der Kaskade.
UPDATE "User" AS ziel
SET scopes = array_remove(
  ARRAY[
    'global',
    CASE WHEN l.code IS NOT NULL THEN 'location:' || l.code END,
    CASE WHEN d.code IS NOT NULL THEN 'department:' || d.code END,
    CASE WHEN s.code IS NOT NULL THEN 'specialty:' || s.code END,
    CASE WHEN l.code IS NOT NULL AND d.code IS NOT NULL
      THEN 'location:' || l.code || '+department:' || d.code END,
    CASE WHEN l.code IS NOT NULL AND s.code IS NOT NULL
      THEN 'location:' || l.code || '+specialty:' || s.code END,
    CASE WHEN d.code IS NOT NULL AND s.code IS NOT NULL
      THEN 'department:' || d.code || '+specialty:' || s.code END,
    CASE WHEN l.code IS NOT NULL AND d.code IS NOT NULL AND s.code IS NOT NULL
      THEN 'location:' || l.code || '+department:' || d.code || '+specialty:' || s.code END
  ],
  NULL
)
FROM "User" AS quelle
  LEFT JOIN "Location" AS l ON l.id = quelle."locationId"
  LEFT JOIN "Department" AS d ON d.id = quelle."departmentId"
  LEFT JOIN "SpecialtyArea" AS s ON s.id = quelle."specialtyAreaId"
WHERE ziel.id = quelle.id;
