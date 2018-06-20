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

const ProcessModelPersistance = require('./dist/commonjs/index').ProcessModelPersistance;
const ExecuteProcessService = require('./dist/commonjs/index').ExecuteProcessService;
const FlowNodeHandlerFactory = require('./dist/commonjs/index').FlowNodeHandlerFactory;
const ProcessModelFacadeFactory = require('./dist/commonjs/index').ProcessModelFacadeFactory;

const FlowNodeInstancePersistance = require('./dist/commonjs/index').FlowNodeInstancePersistance;

const entityDiscoveryTag = require('@essential-projects/core_contracts').EntityDiscoveryTag;
const BpmnProcessEntity = require('./dist/commonjs/index').BpmnProcessEntity;

function registerInContainer(container) {

  container.register('ExecuteProcessService', ExecuteProcessService)
    .dependencies('FlowNodeHandlerFactory', 'MessageBusService', 'ProcessModelPersistance');

  container.register('FlowNodeInstancePersistance', FlowNodeInstancePersistance)
    .singleton();

  container.register('ProcessModelFacadeFactory', ProcessModelFacadeFactory)
    .singleton();

  container.register('BpmnModelParser', BpmnModelParser);

  container.register('ProcessModelPersistance', ProcessModelPersistance)
    .singleton();

  container.register('BpmnProcessEntity', BpmnProcessEntity)
    .tags(entityDiscoveryTag);

  container.register('CallActivityHandler', CallActivityHandler)
    .dependencies('ConsumerApiService', 'FlowNodeInstancePersistance');

  container.register('UserTaskHandler', UserTaskHandler)
    .dependencies('EventAggregator', 'FlowNodeInstancePersistance');

  container.register('SubProcessHandler', SubProcessHandler)
    .dependencies('FlowNodeHandlerFactory', 'FlowNodeInstancePersistance');

  container.register('ScriptTaskHandler', ScriptTaskHandler)
    .dependencies('FlowNodeInstancePersistance');

  container.register('StartEventHandler', StartEventHandler)
    .dependencies('FlowNodeInstancePersistance');
  container.register('ExclusiveGatewayHandler', ExclusiveGatewayHandler)
    .dependencies('FlowNodeInstancePersistance');
  container.register('ParallelGatewayHandler', ParallelGatewayHandler)
    .dependencies('FlowNodeHandlerFactory', 'FlowNodeInstancePersistance');
  container.register('ServiceTaskHandler', ServiceTaskHandler)
    .dependencies('container', 'Invoker', 'FlowNodeInstancePersistance');
  container.register('ErrorBoundaryEventHandler', ErrorBoundaryEventHandler);
  container.register('TimerBoundaryEventHandler', TimerBoundaryEventHandler)
    .dependencies('TimingService', 'EventAggregator', 'IamService');
  container.register('IntermediateCatchEventHandler', IntermediateCatchEventHandler)
    .dependencies('FlowNodeInstancePersistance');
  container.register('IntermediateThrowEventHandler', IntermediateThrowEventHandler)
    .dependencies('FlowNodeInstancePersistance');
  container.register('EndEventHandler', EndEventHandler)
    .dependencies('FlowNodeInstancePersistance');

  container.register('ProcessEngineService', ProcessEngineService)
    .dependencies('MessageBusService', 'EventAggregator', 'ProcessDefEntityTypeService', 'ExecuteProcessService', 'FeatureService', 'IamService', 'ProcessRepository', 'DatastoreService', 'NodeInstanceEntityTypeService', 'ApplicationService', 'Invoker', 'ProcessModelPersistance')
    .injectPromiseLazy('NodeInstanceEntityTypeService')
    .configure('process_engine:process_engine_service')
    .singleton();

  container.register('FlowNodeHandlerFactory', FlowNodeHandlerFactory)
    .dependencies('container');
}

module.exports.registerInContainer = registerInContainer;
