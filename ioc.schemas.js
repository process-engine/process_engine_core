'use strict';

const schemas = require('./schemas/index');

const schemaDiscoveryTag = require('@essential-projects/core_contracts').SchemaDiscoveryTag;

function registerInContainer(container, registrationSettings) {

  const heritage = schemas._heritage;

  for (const schemaName in schemas) {

    const schema = schemas[schemaName];

    const schemaHeritage = heritage[schemaName];

    container.registerObject(`${schemaName}Schema`, schema)
      .tags(schemaDiscoveryTag)
      .setTag('heritage', schemaHeritage);
  }
}

module.exports.registerInContainer = registerInContainer;
