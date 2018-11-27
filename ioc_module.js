'use strict';

const BpmnModelParser = require('./dist/commonjs/index').BpmnModelParser;

const {
  CallActivityHandler,
  EndEventHandler,
  ErrorBoundaryEventHandler,
  ExclusiveGatewayHandler,
  ExternalServiceTaskHandler,
  InternalServiceTaskHandler,
  ManualTaskHandler,
  MessageBoundaryEventHandler,
  ParallelGatewayHandler,
  ParallelJoinGatewayHandler,
  ParallelSplitGatewayHandler,
  ReceiveTaskHandler,
  ScriptTaskHandler,
  SendTaskHandler,
  ServiceTaskHandler,
  SignalBoundaryEventHandler,
  StartEventHandler,
  SubProcessHandler,
  TimerBoundaryEventHandler,
  UserTaskHandler,
} = require('./dist/commonjs/index');

const {
  IntermediateCatchEventHandler,
  IntermediateThrowEventHandler,
  IntermediateMessageCatchEventHandler,
  IntermediateMessageThrowEventHandler,
  IntermediateSignalCatchEventHandler,
  IntermediateSignalThrowEventHandler,
  IntermediateTimerCatchEventHandler,
} = require('./dist/commonjs/index');

const {
  CorrelationService,
  FlowNodeInstanceService,
  DeleteProcessModelService,
  ProcessModelService,
} = require('./dist/commonjs/index');

const {ExecuteProcessService} = require('./dist/commonjs/index');
const {ResumeProcessService} = require('./dist/commonjs/index');

const {
  FlowNodeHandlerFactory,
  ProcessModelFacadeFactory,
  ProcessTokenFacadeFactory,
  TimerFacade,
} = require('./dist/commonjs/index');

function registerInContainer(container) {

  container.register('BpmnModelParser', BpmnModelParser);
  registerServices(container);
  registerHandlers(container);
}

function registerServices(container) {

  container
    .register('ExecuteProcessService', ExecuteProcessService)
    .dependencies(
      'CorrelationService',
      'EventAggregator',
      'FlowNodeHandlerFactory',
      'FlowNodeInstanceService',
      'LoggingApiService',
      'MetricsApiService',
      'ProcessModelService'
    );

  container
    .register('ResumeProcessService', ResumeProcessService)
    .dependencies(
      'CorrelationService',
      'EventAggregator',
      'FlowNodeHandlerFactory',
      'FlowNodeInstanceService',
      'LoggingApiService',
      'MetricsApiService',
      'ProcessModelService'
    );

  container
    .register('CorrelationService', CorrelationService)
    .dependencies('CorrelationRepository', 'FlowNodeInstanceRepository', 'ProcessDefinitionRepository');

  container
    .register('DeleteProcessModelService', DeleteProcessModelService)
    .dependencies('CorrelationService', 'ExternalTaskRepository', 'FlowNodeInstanceService', 'IamService', 'ProcessModelService');

  container
    .register('FlowNodeInstanceService', FlowNodeInstanceService)
    .dependencies('FlowNodeInstanceRepository', 'IamService');

  container
    .register('FlowNodeHandlerFactory', FlowNodeHandlerFactory)
    .dependencies('container');

  container
    .register('ProcessModelFacadeFactory', ProcessModelFacadeFactory)
    .singleton();

  container
    .register('ProcessModelService', ProcessModelService)
    .dependencies('ProcessDefinitionRepository', 'IamService', 'BpmnModelParser');

  container
    .register('ProcessTokenFacadeFactory', ProcessTokenFacadeFactory)
    .singleton();

  container
    .register('TimerFacade', TimerFacade)
    .dependencies('EventAggregator', 'TimerService');
}

function registerHandlers(container) {

  container
    .register('CallActivityHandler', CallActivityHandler)
    .dependencies('ConsumerApiService',
                  'CorrelationService',
                  'FlowNodeInstanceService',
                  'LoggingApiService',
                  'MetricsApiService',
                  'ResumeProcessService');

  container
    .register('EndEventHandler', EndEventHandler)
    .dependencies('EventAggregator', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container
    .register('ErrorBoundaryEventHandler', ErrorBoundaryEventHandler)
    .dependencies('FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container
    .register('ExclusiveGatewayHandler', ExclusiveGatewayHandler)
    .dependencies('FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container
    .register('IntermediateCatchEventHandler', IntermediateCatchEventHandler)
    .dependencies('container', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container
    .register('IntermediateThrowEventHandler', IntermediateThrowEventHandler)
    .dependencies('container', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container
    .register('IntermediateMessageCatchEventHandler', IntermediateMessageCatchEventHandler)
    .dependencies('EventAggregator', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container
    .register('IntermediateMessageThrowEventHandler', IntermediateMessageThrowEventHandler)
    .dependencies('EventAggregator', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container
    .register('IntermediateSignalCatchEventHandler', IntermediateSignalCatchEventHandler)
    .dependencies('EventAggregator', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container
    .register('IntermediateSignalThrowEventHandler', IntermediateSignalThrowEventHandler)
    .dependencies('EventAggregator', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container
    .register('IntermediateTimerCatchEventHandler', IntermediateTimerCatchEventHandler)
    .dependencies('FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService', 'TimerFacade');

  container
    .register('MessageBoundaryEventHandler', MessageBoundaryEventHandler)
    .dependencies('EventAggregator', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container
    .register('ParallelGatewayHandler', ParallelGatewayHandler)
    .dependencies('container', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container
    .register('ParallelJoinGatewayHandler', ParallelJoinGatewayHandler)
    .dependencies('FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container
    .register('ParallelSplitGatewayHandler', ParallelSplitGatewayHandler)
    .dependencies('EventAggregator', 'FlowNodeHandlerFactory', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container
    .register('ManualTaskHandler', ManualTaskHandler)
    .dependencies('EventAggregator', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container
    .register('ReceiveTaskHandler', ReceiveTaskHandler)
    .dependencies('EventAggregator', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container
    .register('ScriptTaskHandler', ScriptTaskHandler)
    .dependencies('FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container
    .register('SendTaskHandler', SendTaskHandler)
    .dependencies('EventAggregator', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container
    .register('ServiceTaskHandler', ServiceTaskHandler)
    .dependencies('container', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container
    .register('ExternalServiceTaskHandler', ExternalServiceTaskHandler)
    .dependencies('EventAggregator', 'ExternalTaskRepository', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container
    .register('InternalServiceTaskHandler', InternalServiceTaskHandler)
    .dependencies('container', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container
    .register('SignalBoundaryEventHandler', SignalBoundaryEventHandler)
    .dependencies('EventAggregator', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container
    .register('StartEventHandler', StartEventHandler)
    .dependencies('EventAggregator', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService', 'TimerFacade');

  container
    .register('SubProcessHandler', SubProcessHandler)
    .dependencies('EventAggregator',
                  'FlowNodeHandlerFactory',
                  'FlowNodeInstanceService',
                  'LoggingApiService',
                  'MetricsApiService',
                  'ResumeProcessService');

  container
    .register('TimerBoundaryEventHandler', TimerBoundaryEventHandler)
    .dependencies('FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService', 'TimerFacade');

  container
    .register('UserTaskHandler', UserTaskHandler)
    .dependencies('EventAggregator', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');
}

module.exports.registerInContainer = registerInContainer;
