'use strict';

const ProcessEngineService = require('./dist/commonjs/index').ProcessEngineService;
const BpmnModelParser = require('./dist/commonjs/index').BpmnModelParser;

const ScriptTaskHandler = require('./dist/commonjs/index').ScriptTaskHandler;
const StartEventHandler = require('./dist/commonjs/index').StartEventHandler;
const ExclusiveGatewayHandler = require('./dist/commonjs/index').ExclusiveGatewayHandler;
const ParallelGatewayHandler = require('./dist/commonjs/index').ParallelGatewayHandler;
const ServiceTaskHandler = require('./dist/commonjs/index').ServiceTaskHandler;
const ErrorBoundaryEventHandler = require('./dist/commonjs/index').ErrorBoundaryEventHandler;
const TimerBoundaryEventHandler = require('./dist/commonjs/index').TimerBoundaryEventHandler;
const IntermediateCatchEventHandler = require('./dist/commonjs/index').IntermediateCatchEventHandler;
const IntermediateThrowEventHandler = require('./dist/commonjs/index').IntermediateThrowEventHandler;
const EndEventHandler = require('./dist/commonjs/index').EndEventHandler;
const CallActivityHandler = require('./dist/commonjs/index').CallActivityHandler;
const SubProcessHandler = require('./dist/commonjs/index').SubProcessHandler;
const UserTaskHandler = require('./dist/commonjs/index').UserTaskHandler;

const FlowNodeInstancePersistenceService = require('./dist/commonjs/index').FlowNodeInstancePersistenceService;
const FlowNodeInstancePersistenceRepository = require('./dist/commonjs/index').FlowNodeInstancePersistenceRepository;
const ProcessModelPersistenceService = require('./dist/commonjs/index').ProcessModelPersistenceService;
const ProcessModelPersistenceRepository = require('./dist/commonjs/index').ProcessModelPersistenceRepository;

const ExecuteProcessService = require('./dist/commonjs/index').ExecuteProcessService;
const FlowNodeHandlerFactory = require('./dist/commonjs/index').FlowNodeHandlerFactory;
const IamFacadeFactory = require('./dist/commonjs/index').IamFacadeFactory;
const ProcessModelFacadeFactory = require('./dist/commonjs/index').ProcessModelFacadeFactory;


const entityDiscoveryTag = require('@essential-projects/core_contracts').EntityDiscoveryTag;
const BpmnProcessEntity = require('./dist/commonjs/index').BpmnProcessEntity;

function registerInContainer(container) {

  container.register('ExecuteProcessService', ExecuteProcessService)
    .dependencies('FlowNodeHandlerFactory', 'MessageBusService', 'EventAggregator');

  container.register('IamFacadeFactory', IamFacadeFactory)
    .dependencies('IamServiceNew')
    .singleton();

  container.register('FlowNodeInstancePersistenceRepository', FlowNodeInstancePersistenceRepository)
    .singleton();

  container.register('ProcessModelPersistenceRepository', ProcessModelPersistenceRepository)
    .singleton();

  container.register('FlowNodeInstancePersistenceService', FlowNodeInstancePersistenceService)
    .dependencies('FlowNodeInstancePersistenceRepository', 'IamFacadeFactory')
    .singleton();

  container.register('ProcessModelPersistenceService', ProcessModelPersistenceService)
    .dependencies('ProcessModelPersistenceRepository', 'IamFacadeFactory')
    .singleton();

  container.register('ProcessModelFacadeFactory', ProcessModelFacadeFactory)
    .singleton();

  container.register('BpmnModelParser', BpmnModelParser);

  container.register('BpmnProcessEntity', BpmnProcessEntity)
    .tags(entityDiscoveryTag);

  container.register('CallActivityHandler', CallActivityHandler)
    .dependencies('ConsumerApiService', 'FlowNodeInstancePersistenceService');

  container.register('UserTaskHandler', UserTaskHandler)
    .dependencies('EventAggregator', 'FlowNodeInstancePersistenceService');

  container.register('SubProcessHandler', SubProcessHandler)
    .dependencies('FlowNodeHandlerFactory', 'FlowNodeInstancePersistenceService');

  container.register('ScriptTaskHandler', ScriptTaskHandler)
    .dependencies('FlowNodeInstancePersistenceService');

  container.register('StartEventHandler', StartEventHandler)
    .dependencies('FlowNodeInstancePersistenceService');
  container.register('ExclusiveGatewayHandler', ExclusiveGatewayHandler)
    .dependencies('FlowNodeInstancePersistenceService');
  container.register('ParallelGatewayHandler', ParallelGatewayHandler)
    .dependencies('FlowNodeHandlerFactory', 'FlowNodeInstancePersistenceService');
  container.register('ServiceTaskHandler', ServiceTaskHandler)
    .dependencies('container', 'FlowNodeInstancePersistenceService');
  container.register('ErrorBoundaryEventHandler', ErrorBoundaryEventHandler);
  container.register('TimerBoundaryEventHandler', TimerBoundaryEventHandler)
    .dependencies('TimingService', 'EventAggregator', 'IamService');
  container.register('IntermediateCatchEventHandler', IntermediateCatchEventHandler)
    .dependencies('FlowNodeInstancePersistenceService');
  container.register('IntermediateThrowEventHandler', IntermediateThrowEventHandler)
    .dependencies('FlowNodeInstancePersistenceService');
  container.register('EndEventHandler', EndEventHandler)
    .dependencies('FlowNodeInstancePersistenceService', 'EventAggregator');

  container.register('ProcessEngineService', ProcessEngineService)
    .dependencies(
      'MessageBusService',
      'EventAggregator',
      'ProcessDefEntityTypeService',
      'ExecuteProcessService',
      'FeatureService',
      'IamService',
      'ProcessRepository',
      'DatastoreService',
      'NodeInstanceEntityTypeService',
      'ApplicationService',
      'Invoker',
      'ProcessModelPersistenceService',
    )
    .injectPromiseLazy('NodeInstanceEntityTypeService')
    .configure('process_engine:process_engine_service')
    .singleton();

  container.register('FlowNodeHandlerFactory', FlowNodeHandlerFactory)
    .dependencies('container');
}

module.exports.registerInContainer = registerInContainer;
