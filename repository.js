import neo4j from 'neo4j-driver';
import { queries } from './queries.js';

function plain(value) {
  if (neo4j.isInt(value)) return value.toNumber();
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  }
  return value;
}

export function recordToObject(record) {
  return Object.fromEntries(record.keys.map((key) => [key, plain(record.get(key))]));
}

export class GraphRepository {
  constructor(driver) { this.driver = driver; }

  async read(query, parameters = {}) {
    const session = this.driver.session({ defaultAccessMode: neo4j.session.READ });
    try {
      const result = await session.executeRead((tx) => tx.run(query, parameters));
      return result.records.map(recordToObject);
    } finally {
      await session.close();
    }
  }

  async health() { return (await this.read(queries.health))[0]?.ok === 1; }
  async overview() { return (await this.read(queries.overview))[0]; }
  async specialties() { return this.read(queries.specialties); }
  async clinicians() { return this.read(queries.clinicians); }
  async recommendations(filters) { return this.read(queries.referralPaths, filters); }
  async network(id) { return (await this.read(queries.clinicianNetwork, { id }))[0]; }
}

export function createDriver(config) {
  return neo4j.driver(config.uri, neo4j.auth.basic(config.username, config.password), {
    connectionTimeout: 8000,
    maxConnectionPoolSize: 20,
  });
}
