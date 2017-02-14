'use strict';

const SubprocessExternalEntity = require('./dist/commonjs/index').SubprocessExternalEntity;
const SubprocessInternalEntity = require('./dist/commonjs/index').SubprocessInternalEntity;
const BoundaryEventEntity = require('./dist/commonjs/index').BoundaryEventEntity;
const EndEventEntity = require('./dist/commonjs/index').EndEventEntity;
const EventEntity = require('./dist/commonjs/index').EventEntity;
const ExclusiveGatewayEntity = require('./dist/commonjs/index').ExclusiveGatewayEntity;
const FlowDefEntity = require('./dist/commonjs/index').FlowDefEntity;
const LaneEntity = require('./dist/commonjs/index').LaneEntity;
const NodeDefEntity = require('./dist/commonjs/index').NodeDefEntity;
const NodeInstanceEntity = require('./dist/commonjs/index').NodeInstanceEntity;
const ParallelGatewayEntity = require('./dist/commonjs/index').ParallelGatewayEntity;
const ProcessEntity = require('./dist/commonjs/index').ProcessEntity;
const ProcessDefEntity = require('./dist/commonjs/index').ProcessDefEntity;
const ProcessTokenEntity = require('./dist/commonjs/index').ProcessTokenEntity;
const ScriptTaskEntity = require('./dist/commonjs/index').ScriptTaskEntity;
const ServiceTaskEntity = require('./dist/commonjs/index').ServiceTaskEntity;
const StartEventEntity = require('./dist/commonjs/index').StartEventEntity;
const UserTaskEntity = require('./dist/commonjs/index').UserTaskEntity;
const ProcessDefEntityTypeService = require('./dist/commonjs/index').ProcessDefEntityTypeService;
const entityDiscoveryTag = require('@process-engine-js/core_contracts').EntityDiscoveryTag;

function registerInContainer(container) {

  container.register('SubprocessExternalEntity', SubprocessExternalEntity)
    .tags(entityDiscoveryTag);

  container.register('SubprocessInternalEntity', SubprocessInternalEntity)
    .tags(entityDiscoveryTag);

  container.register('BoundaryEventEntity', BoundaryEventEntity)
    .tags(entityDiscoveryTag);

  container.register('EndEventEntity', EndEventEntity)
    .tags(entityDiscoveryTag);

  container.register('EventEntity', EventEntity)
    .tags(entityDiscoveryTag);

  container.register('ExclusiveGatewayEntity', ExclusiveGatewayEntity)
    .tags(entityDiscoveryTag);

  container.register('FlowDefEntity', FlowDefEntity)
    .tags(entityDiscoveryTag);

  container.register('LaneEntity', LaneEntity)
    .tags(entityDiscoveryTag);

  container.register('NodeDefEntity', NodeDefEntity)
    .tags(entityDiscoveryTag);

  container.register('NodeInstanceEntity', NodeInstanceEntity)
    .tags(entityDiscoveryTag);

  container.register('ParallelGatewayEntity', ParallelGatewayEntity)
    .tags(entityDiscoveryTag);

  container.register('ProcessEntity', ProcessEntity)
    .tags(entityDiscoveryTag);

  container.register('ProcessDefEntityTypeService', ProcessDefEntityTypeService)
    .dependencies('DatastoreService', 'Invoker');

  container.register('ProcessDefEntity', ProcessDefEntity)
    .dependencies('ProcessDefEntityTypeService', 'DatastoreService')
    .tags(entityDiscoveryTag);

  container.register('ProcessTokenEntity', ProcessTokenEntity)
    .tags(entityDiscoveryTag);

  container.register('ScriptTaskEntity', ScriptTaskEntity)
    .tags(entityDiscoveryTag);

  container.register('ServiceTaskEntity', ServiceTaskEntity)
    .tags(entityDiscoveryTag);

  container.register('StartEventEntity', StartEventEntity)
    .tags(entityDiscoveryTag);

  container.register('UserTaskEntity', UserTaskEntity)
    .tags(entityDiscoveryTag);
}

module.exports.registerInContainer = registerInContainer;
