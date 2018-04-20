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
const ThrowEventEntity = require('./dist/commonjs/index').ThrowEventEntity;
const CatchEventEntity = require('./dist/commonjs/index').CatchEventEntity;
const UserTaskEntity = require('./dist/commonjs/index').UserTaskEntity;
const ProcessDefEntityTypeService = require('./dist/commonjs/index').ProcessDefEntityTypeService;
const entityDiscoveryTag = require('@essential-projects/core_contracts').EntityDiscoveryTag;
const NodeInstanceEntityDependencyHelper = require('./dist/commonjs/index').NodeInstanceEntityDependencyHelper;
const NodeInstanceEntityTypeService = require('./dist/commonjs/index').NodeInstanceEntityTypeService;
const BpmnModelParser = require('./dist/commonjs/index').BpmnModelParser;
const processEngineContractsIocModule = require('@process-engine/process_engine_contracts/ioc_module');
const schemasIocModule = require('./ioc.schemas');

function registerInContainer(container) {

  container.register('ProcessEngineService', ProcessEngineService)
    .dependencies('MessageBusService', 'EventAggregator', 'ProcessDefEntityTypeService', 'FeatureService', 'IamService', 'ProcessRepository', 'DatastoreService', 'NodeInstanceEntityTypeService', 'ApplicationService', 'Invoker')
    .injectPromiseLazy('NodeInstanceEntityTypeService')
    .configure('process_engine:process_engine_service')
    .singleton();

  container.register('BpmnModelParser', BpmnModelParser);

  container.register('NodeInstanceEntityTypeService', NodeInstanceEntityTypeService)
    .dependencies('DatastoreService', 'MessageBusService', 'IamService', 'EventAggregator', 'FeatureService', 'RoutingService', 'ProcessEngineService');

  container.register('ProcessDefEntityTypeService', ProcessDefEntityTypeService)
    .dependencies('DatastoreService', 'ProcessRepository', 'Invoker');

  container.register('NodeInstanceEntityDependencyHelper', NodeInstanceEntityDependencyHelper)
    .dependencies('MessageBusService', 'EventAggregator', 'IamService', 'NodeInstanceEntityTypeService', 'ProcessEngineService', 'TimingService')
    .singleton();

  container.register('BoundaryEventEntity', BoundaryEventEntity)
    .dependencies('NodeInstanceEntityDependencyHelper')
    .tags(entityDiscoveryTag);

  container.register('EndEventEntity', EndEventEntity)
    .dependencies('NodeInstanceEntityDependencyHelper')
    .tags(entityDiscoveryTag);

  container.register('EventEntity', EventEntity)
    .dependencies('NodeInstanceEntityDependencyHelper')
    .tags(entityDiscoveryTag);

  container.register('ExclusiveGatewayEntity', ExclusiveGatewayEntity)
    .dependencies('NodeInstanceEntityDependencyHelper')
    .tags(entityDiscoveryTag);

  container.register('FlowDefEntity', FlowDefEntity)
    .tags(entityDiscoveryTag);

  container.register('LaneEntity', LaneEntity)
    .tags(entityDiscoveryTag);

  container.register('NodeDefEntity', NodeDefEntity)
    .tags(entityDiscoveryTag);

  container.register('NodeInstanceEntity', NodeInstanceEntity)
    .dependencies('NodeInstanceEntityDependencyHelper')
    .tags(entityDiscoveryTag);

  container.register('ParallelGatewayEntity', ParallelGatewayEntity)
    .dependencies('NodeInstanceEntityDependencyHelper')
    .tags(entityDiscoveryTag);

  container.register('ProcessEntity', ProcessEntity)
    .dependencies('IamService', 'NodeInstanceEntityTypeService', 'MessageBusService', 'ProcessEngineService')
    .tags(entityDiscoveryTag);

  container.register('ProcessDefEntity', ProcessDefEntity)
    .dependencies('ProcessDefEntityTypeService', 'ProcessRepository', 'FeatureService', 'MessageBusService', 'RoutingService', 'EventAggregator', 'TimingService', 'ProcessEngineService', 'DatastoreService')
    .tags(entityDiscoveryTag);

  container.register('ProcessTokenEntity', ProcessTokenEntity)
    .tags(entityDiscoveryTag);

  container.register('ScriptTaskEntity', ScriptTaskEntity)
    .dependencies('NodeInstanceEntityDependencyHelper')
    .tags(entityDiscoveryTag);

  container.register('ServiceTaskEntity', ServiceTaskEntity)
    .dependencies('container', 'NodeInstanceEntityDependencyHelper')
    .tags(entityDiscoveryTag);

  container.register('ThrowEventEntity', ThrowEventEntity)
    .dependencies('NodeInstanceEntityDependencyHelper')
    .tags(entityDiscoveryTag);

  container.register('CatchEventEntity', CatchEventEntity)
    .dependencies('NodeInstanceEntityDependencyHelper')
    .tags(entityDiscoveryTag);

  container.register('StartEventEntity', StartEventEntity)
    .dependencies('NodeInstanceEntityDependencyHelper')
    .tags(entityDiscoveryTag);

  container.register('SubprocessInternalEntity', SubprocessInternalEntity)
    .dependencies('NodeInstanceEntityDependencyHelper')
    .tags(entityDiscoveryTag);

  container.register('SubprocessExternalEntity', SubprocessExternalEntity)
    .dependencies('NodeInstanceEntityDependencyHelper', 'ProcessDefEntityTypeService')
    .tags(entityDiscoveryTag);

  container.register('UserTaskEntity', UserTaskEntity)
    .dependencies('NodeInstanceEntityDependencyHelper')
    .tags(entityDiscoveryTag);

  processEngineContractsIocModule.registerInContainer(container);
  schemasIocModule.registerInContainer(container);
}

module.exports.registerInContainer = registerInContainer;
