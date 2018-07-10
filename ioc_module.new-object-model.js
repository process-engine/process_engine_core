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

const FlowNodeInstanceService = require('./dist/commonjs/index').FlowNodeInstanceService;
const ProcessModelService = require('./dist/commonjs/index').ProcessModelService;

const ExecuteProcessService = require('./dist/commonjs/index').ExecuteProcessService;

const ExecutionContextFacadeFactory = require('./dist/commonjs/index').ExecutionContextFacadeFactory;
const FlowNodeHandlerFactory = require('./dist/commonjs/index').FlowNodeHandlerFactory;
const ProcessModelFacadeFactory = require('./dist/commonjs/index').ProcessModelFacadeFactory;

const entityDiscoveryTag = require('@essential-projects/core_contracts').EntityDiscoveryTag;
const BpmnProcessEntity = require('./dist/commonjs/index').BpmnProcessEntity;

function registerInContainer(container) {

  container.register('ExecuteProcessService', ExecuteProcessService)
    .dependencies('FlowNodeHandlerFactory', 'MessageBusService', 'EventAggregator');

  container.register('FlowNodeInstanceService', FlowNodeInstanceService)
    .dependencies('FlowNodeInstanceRepository', 'IamServiceNew')
    .singleton();

  container.register('ProcessModelService', ProcessModelService)
    .dependencies('ProcessModelRepository', 'IamServiceNew', 'BpmnModelParser')
    .singleton();

  container.register('ExecutionContextFacadeFactory', ExecutionContextFacadeFactory)
    .singleton();

  container.register('FlowNodeHandlerFactory', FlowNodeHandlerFactory)
    .dependencies('container');

  container.register('ProcessModelFacadeFactory', ProcessModelFacadeFactory)
    .singleton();

  container.register('BpmnModelParser', BpmnModelParser);

  container.register('BpmnProcessEntity', BpmnProcessEntity)
    .tags(entityDiscoveryTag);

  container.register('CallActivityHandler', CallActivityHandler)
    .dependencies('ConsumerApiService', 'FlowNodeInstanceService');

  container.register('UserTaskHandler', UserTaskHandler)
    .dependencies('EventAggregator', 'FlowNodeInstanceService');

  container.register('SubProcessHandler', SubProcessHandler)
    .dependencies('FlowNodeHandlerFactory', 'FlowNodeInstanceService');

  container.register('ScriptTaskHandler', ScriptTaskHandler)
    .dependencies('FlowNodeInstanceService');

  container.register('StartEventHandler', StartEventHandler)
    .dependencies('FlowNodeInstanceService');

  container.register('ExclusiveGatewayHandler', ExclusiveGatewayHandler)
    .dependencies('FlowNodeInstanceService');

  container.register('ParallelGatewayHandler', ParallelGatewayHandler)
    .dependencies('FlowNodeHandlerFactory', 'FlowNodeInstanceService');

  container.register('ServiceTaskHandler', ServiceTaskHandler)
    .dependencies('container', 'FlowNodeInstanceService');

  container.register('ErrorBoundaryEventHandler', ErrorBoundaryEventHandler);

  container.register('TimerBoundaryEventHandler', TimerBoundaryEventHandler)
    .dependencies('TimingService', 'EventAggregator', 'IamService');

  container.register('IntermediateCatchEventHandler', IntermediateCatchEventHandler)
    .dependencies('FlowNodeInstanceService');

  container.register('IntermediateThrowEventHandler', IntermediateThrowEventHandler)
    .dependencies('FlowNodeInstanceService');

  container.register('EndEventHandler', EndEventHandler)
    .dependencies('FlowNodeInstanceService', 'EventAggregator');

  container.register('ProcessEngineService', ProcessEngineService)
    .dependencies(
      'container',
      'MessageBusService',
      'ProcessDefEntityTypeService',
      'ExecuteProcessService',
      'FeatureService',
      'IamService',
      'ProcessRepository',
      'DatastoreService',
      'NodeInstanceEntityTypeService',
      'ApplicationService',
      'Invoker'
    )
    .injectPromiseLazy('NodeInstanceEntityTypeService')
    .configure('process_engine:process_engine_service')
    .singleton();
}

module.exports.registerInContainer = registerInContainer;
