import neo4j from 'neo4j-driver';
import { getConfig, assertDatabaseConfig } from '../src/config.js';
import { createDriver } from '../src/graph/repository.js';

const specialties = [
  ['cardiology', 'Cardiology'], ['neurology', 'Neurology'], ['orthopedics', 'Orthopedics'],
  ['endocrinology', 'Endocrinology'], ['pulmonology', 'Pulmonology'], ['dermatology', 'Dermatology'],
];
const facilities = [
  ['f1', 'Northstar Medical Centre', 'Bengaluru'], ['f2', 'Lakeside Clinic', 'Bengaluru'],
  ['f3', 'Sanjeevani Hospital', 'Mysuru'], ['f4', 'Aster Grove Health', 'Bengaluru'],
];
const insurances = [['star', 'Star Health'], ['hdfc', 'HDFC ERGO'], ['care', 'Care Health']];
const clinicians = [
  ['c1','Dr. Ananya Rao','Primary Care Physician','AR',12,'Today',4.9,'endocrinology','f1',['star','hdfc']],
  ['c2','Dr. Rohan Mehta','Interventional Cardiologist','RM',15,'Tomorrow',4.9,'cardiology','f1',['star','care']],
  ['c3','Dr. Meera Nair','Cardiac Electrophysiologist','MN',11,'Thu, 22 Aug',4.8,'cardiology','f2',['hdfc','care']],
  ['c4','Dr. Kabir Shah','Consultant Neurologist','KS',9,'Today',4.7,'neurology','f2',['star','hdfc']],
  ['c5','Dr. Isha Menon','Orthopaedic Surgeon','IM',14,'Fri, 23 Aug',4.8,'orthopedics','f3',['care']],
  ['c6','Dr. Vikram Sethi','Pulmonologist','VS',18,'Tomorrow',4.9,'pulmonology','f4',['star','hdfc','care']],
  ['c7','Dr. Tara Joseph','Endocrinologist','TJ',8,'Today',4.8,'endocrinology','f4',['star']],
  ['c8','Dr. Neel Banerjee','Clinical Dermatologist','NB',10,'Mon, 26 Aug',4.6,'dermatology','f1',['hdfc','care']],
  ['c9','Dr. Sana Iqbal','Preventive Cardiologist','SI',7,'Tomorrow',4.7,'cardiology','f4',['star','hdfc']],
];
const links = [
  ['c1','c2','COLLABORATED_WITH',18], ['c1','c4','REFERRED_TO',11], ['c4','c3','COLLABORATED_WITH',7],
  ['c2','c3','COLLABORATED_WITH',14], ['c1','c7','COLLABORATED_WITH',9], ['c7','c9','REFERRED_TO',6],
  ['c6','c2','REFERRED_TO',8], ['c5','c6','COLLABORATED_WITH',5], ['c8','c1','REFERRED_TO',4],
  ['c4','c9','COLLABORATED_WITH',3], ['c3','c9','REFERRED_TO',10],
];

const config = getConfig();
assertDatabaseConfig(config.database);
const driver = createDriver(config.database);
const session = driver.session({ defaultAccessMode: neo4j.session.WRITE });

try {
  // Phase 1: Clear database and create reference nodes
  await session.executeWrite(async (tx) => {
    await tx.run('MATCH (n) DETACH DELETE n');
    await tx.run('UNWIND $rows AS row CREATE (:Specialty {slug: row[0], name: row[1]})', { rows: specialties });
    await tx.run('UNWIND $rows AS row CREATE (:Facility {id: row[0], name: row[1], city: row[2]})', { rows: facilities });
    await tx.run('UNWIND $rows AS row CREATE (:Insurance {slug: row[0], name: row[1]})', { rows: insurances });
  });

  // Phase 2: Create clinicians with relationships (separate transaction so reference nodes are visible)
  await session.executeWrite(async (tx) => {
    await tx.run(`UNWIND $rows AS row
      CREATE (c:Clinician {id: row[0], name: row[1], title: row[2], avatar: row[3], experience: row[4], nextAvailable: row[5], rating: row[6]})
      WITH c, row MATCH (s:Specialty {slug: row[7]}), (f:Facility {id: row[8]})
      CREATE (c)-[:SPECIALIZES_IN]->(s), (c)-[:PRACTICES_AT]->(f)
      WITH c, row UNWIND row[9] AS insuranceSlug MATCH (i:Insurance {slug: insuranceSlug}) CREATE (c)-[:ACCEPTS]->(i)`, { rows: clinicians });
  });

  // Phase 3: Create professional links (separate transaction so clinician nodes are visible)
  await session.executeWrite(async (tx) => {
    await tx.run(`UNWIND $rows AS row MATCH (a:Clinician {id: row[0]}), (b:Clinician {id: row[1]})
      FOREACH (_ IN CASE row[2] WHEN 'COLLABORATED_WITH' THEN [1] ELSE [] END | CREATE (a)-[:COLLABORATED_WITH {cases: row[3]}]->(b))
      FOREACH (_ IN CASE row[2] WHEN 'REFERRED_TO' THEN [1] ELSE [] END | CREATE (a)-[:REFERRED_TO {cases: row[3]}]->(b))`, { rows: links });
  });
  console.log(`Seeded ${clinicians.length} clinicians and ${links.length} professional links.`);
} finally {
  await session.close();
  await driver.close();
}
