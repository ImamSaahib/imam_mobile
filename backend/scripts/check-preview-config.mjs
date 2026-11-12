import assert from 'node:assert/strict';
import { unstable_readConfig } from 'wrangler';

// Parse using the installed deployment tool, not a second TOML implementation.
const config = unstable_readConfig({ config: 'wrangler.toml' });
assert.equal(config.name, 'imam-mobile-api-dev');
assert.equal(config.previews?.vars?.ENVIRONMENT, 'development');
assert.equal(config.previews?.vars?.AUTH_MODE, 'dev-open');
assert.equal(config.previews?.vars?.DEPLOYMENT_KEY, 'imam-mobile-dev-preview');
assert.equal(config.previews?.d1_databases?.length, 1);
const db = config.previews.d1_databases[0];
assert.equal(db.binding, 'DB');
assert.equal(db.database_name, 'imam-mobile-dev-db');
assert.equal(db.database_id, '794cc2e7-fcef-473c-b06d-c5665656c6ca');
assert.equal(db.database_id, config.d1_databases[0].database_id);
console.log('Preview configuration uses only the approved test development database.');
