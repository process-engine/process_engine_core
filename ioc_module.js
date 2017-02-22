'use strict';

const ProcessEngineService = require('./dist/commonjs/index').ProcessEngineService;
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
const NodeInstanceHelper = require('./dist/commonjs/index').NodeInstanceHelper;
const NodeInstanceEntityTypeService = require('./dist/commonjs/index').NodeInstanceEntityTypeService;

function registerInContainer(container) {

  container.register('ProcessEngineService', ProcessEngineService)
    .dependencies('MessageBusService', 'ProcessDefEntityTypeService')
    .singleton();

  container.register('NodeInstanceHelper', NodeInstanceHelper)
    .dependencies('DatastoreService', 'MessageBusService', 'IamService', 'NodeInstanceEntityTypeService');

  container.register('SubprocessExternalEntity', SubprocessExternalEntity)
    .dependencies('NodeInstanceHelper')
    .tags(entityDiscoveryTag);

  container.register('SubprocessInternalEntity', SubprocessInternalEntity)
    .dependencies('NodeInstanceHelper')
    .tags(entityDiscoveryTag);

  container.register('BoundaryEventEntity', BoundaryEventEntity)
    .dependencies('NodeInstanceHelper')
    .tags(entityDiscoveryTag);

  container.register('EndEventEntity', EndEventEntity)
    .dependencies('NodeInstanceHelper')
    .tags(entityDiscoveryTag);

  container.register('EventEntity', EventEntity)
    .dependencies('NodeInstanceHelper')
    .tags(entityDiscoveryTag);

  container.register('ExclusiveGatewayEntity', ExclusiveGatewayEntity)
    .dependencies('NodeInstanceHelper')
    .tags(entityDiscoveryTag);

  container.register('FlowDefEntity', FlowDefEntity)
    .tags(entityDiscoveryTag);

  container.register('LaneEntity', LaneEntity)
    .tags(entityDiscoveryTag);

  container.register('NodeDefEntity', NodeDefEntity)
    .dependencies('DatastoreService')
    .tags(entityDiscoveryTag);

  container.register('NodeInstanceEntity', NodeInstanceEntity)
    .dependencies('NodeInstanceHelper', 'NodeInstanceEntityTypeService')
    .tags(entityDiscoveryTag);

  container.register('ParallelGatewayEntity', ParallelGatewayEntity)
    .dependencies('NodeInstanceHelper')
    .tags(entityDiscoveryTag);

  container.register('ProcessEntity', ProcessEntity)
    .dependencies('DatastoreService', 'IamService', 'NodeInstanceEntityTypeService')
    .tags(entityDiscoveryTag);

  container.register('ProcessDefEntityTypeService', ProcessDefEntityTypeService)
    .dependencies('DatastoreService', 'Invoker');

  container.register('ProcessDefEntity', ProcessDefEntity)
    .dependencies('ProcessDefEntityTypeService', 'DatastoreService')
    .tags(entityDiscoveryTag);

  container.register('ProcessTokenEntity', ProcessTokenEntity)
    .tags(entityDiscoveryTag);

  container.register('ScriptTaskEntity', ScriptTaskEntity)
    .dependencies('NodeInstanceHelper')
    .tags(entityDiscoveryTag);

  container.register('ServiceTaskEntity', ServiceTaskEntity)
    .dependencies('NodeInstanceHelper', 'container')
    .tags(entityDiscoveryTag);

  container.register('StartEventEntity', StartEventEntity)
    .dependencies('NodeInstanceHelper')
    .tags(entityDiscoveryTag);

  container.register('UserTaskEntity', UserTaskEntity)
    .dependencies('NodeInstanceHelper')
    .tags(entityDiscoveryTag);

  container.register('NodeInstanceEntityTypeService', NodeInstanceEntityTypeService)
    .dependencies('DatastoreService', 'MessageBusService', 'IamService');
}

module.exports.registerInContainer = registerInContainer;
