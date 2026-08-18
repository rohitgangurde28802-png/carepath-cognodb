export const queries = {
  health: 'RETURN 1 AS ok',

  overview: `
    MATCH (c:Clinician)
    OPTIONAL MATCH (c)-[:PRACTICES_AT]->(f:Facility)
    WITH count(DISTINCT c) AS clinicians, count(DISTINCT f) AS facilities
    MATCH (s:Specialty)
    RETURN clinicians, facilities, count(s) AS specialties
  `,

  specialties: `
    MATCH (s:Specialty)<-[:SPECIALIZES_IN]-(c:Clinician)
    RETURN s.name AS name, s.slug AS slug, count(c) AS clinicianCount
    ORDER BY name
  `,

  clinicians: `
    MATCH (c:Clinician)-[:SPECIALIZES_IN]->(s:Specialty)
    MATCH (c)-[:PRACTICES_AT]->(f:Facility)
    OPTIONAL MATCH (c)-[:ACCEPTS]->(i:Insurance)
    WITH c, s, f, collect(DISTINCT i.name) AS insurance
    RETURN c.id AS id, c.name AS name, c.title AS title, c.avatar AS avatar,
           c.experience AS experience, c.nextAvailable AS nextAvailable,
           c.rating AS rating, s.name AS specialty, s.slug AS specialtySlug,
           f.name AS facility, f.city AS city, insurance
    ORDER BY c.rating DESC, c.name
  `,

  referralPaths: `
    MATCH (source:Clinician {id: $sourceId})
    MATCH (target:Clinician)-[:SPECIALIZES_IN]->(specialty:Specialty {slug: $specialty})
    MATCH (target)-[:PRACTICES_AT]->(facility:Facility)
    WHERE target.id <> source.id
      AND ($insurance = '' OR EXISTS { MATCH (target)-[:ACCEPTS]->(:Insurance {slug: $insurance}) })
    OPTIONAL MATCH path=(source)-[:COLLABORATED_WITH|REFERRED_TO*1..3]-(target)
    WITH source, target, specialty, facility, path,
         CASE WHEN path IS NULL THEN 99 ELSE length(path) END AS hops
    OPTIONAL MATCH (target)-[:ACCEPTS]->(accepted:Insurance)
    WITH source, target, specialty, facility, path, hops, collect(DISTINCT accepted.name) AS insurance
    RETURN target.id AS id, target.name AS name, target.title AS title,
           target.avatar AS avatar, target.rating AS rating,
           target.experience AS experience, target.nextAvailable AS nextAvailable,
           specialty.name AS specialty, facility.name AS facility, facility.city AS city,
           insurance, hops,
           CASE WHEN path IS NULL THEN [] ELSE [n IN nodes(path) | n.name] END AS pathNames,
           CASE WHEN path IS NULL THEN [] ELSE [r IN relationships(path) | type(r)] END AS pathTypes,
           round((target.rating * 12) + (CASE WHEN hops < 99 THEN (4 - hops) * 8 ELSE 0 END)
             + (CASE target.nextAvailable WHEN 'Today' THEN 10 WHEN 'Tomorrow' THEN 7 ELSE 2 END)) AS score
    ORDER BY score DESC, target.rating DESC
    LIMIT 12
  `,

  clinicianNetwork: `
    MATCH (center:Clinician {id: $id})
    OPTIONAL MATCH (center)-[r:COLLABORATED_WITH|REFERRED_TO]-(peer:Clinician)
    RETURN center { .id, .name, .title, .avatar } AS center,
      collect(DISTINCT { id: peer.id, name: peer.name, title: peer.title,
        avatar: peer.avatar, relationship: type(r) }) AS connections
  `,
};
