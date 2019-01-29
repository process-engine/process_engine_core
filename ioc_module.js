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
  IntermediateLinkCatchEventHandler,
  IntermediateLinkThrowEventHandler,
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
      'BpmnModelParser',
      'CorrelationService',
      'EventAggregator',
      'FlowNodeHandlerFactory',
      'FlowNodeInstanceService',
      'LoggingApiService',
      'MetricsApiService'
    );

  container
    .register('CorrelationService', CorrelationService)
    .dependencies('CorrelationRepository', 'FlowNodeInstanceRepository', 'IamService', 'ProcessDefinitionRepository');

  container
    .register('DeleteProcessModelService', DeleteProcessModelService)
    .dependencies('CorrelationService', 'ExternalTaskRepository', 'FlowNodeInstanceService', 'IamService', 'ProcessModelService');

  container
    .register('FlowNodeInstanceService', FlowNodeInstanceService)
    .dependencies('FlowNodeInstanceRepository', 'IamService');

  container
    .register('FlowNodeHandlerFactory', FlowNodeHandlerFactory)
    .dependencies('container')
    .singleton();

  container
    .register('ProcessModelFacadeFactory', ProcessModelFacadeFactory)
    .singleton();

  container
    .register('ProcessModelService', ProcessModelService)
    .dependencies('BpmnModelParser', 'CorrelationRepository', 'IamService', 'ProcessDefinitionRepository');

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
                  'container',
                  'CorrelationService',
                  'ResumeProcessService');

  container
    .register('EndEventHandler', EndEventHandler)
    .dependencies('container', 'EventAggregator');

  container
    .register('ErrorBoundaryEventHandler', ErrorBoundaryEventHandler)
    .dependencies('container');

  container
    .register('ExclusiveGatewayHandler', ExclusiveGatewayHandler)
    .dependencies('container');

  container
    .register('IntermediateCatchEventHandler', IntermediateCatchEventHandler)
    .dependencies('container');

  container
    .register('IntermediateThrowEventHandler', IntermediateThrowEventHandler)
    .dependencies('container');

  container
    .register('IntermediateLinkCatchEventHandler', IntermediateLinkCatchEventHandler)
    .dependencies('container');

  container
    .register('IntermediateLinkThrowEventHandler', IntermediateLinkThrowEventHandler)
    .dependencies('container');

  container
    .register('IntermediateMessageCatchEventHandler', IntermediateMessageCatchEventHandler)
    .dependencies('container', 'EventAggregator');

  container
    .register('IntermediateMessageThrowEventHandler', IntermediateMessageThrowEventHandler)
    .dependencies('container', 'EventAggregator');

  container
    .register('IntermediateSignalCatchEventHandler', IntermediateSignalCatchEventHandler)
    .dependencies('container', 'EventAggregator');

  container
    .register('IntermediateSignalThrowEventHandler', IntermediateSignalThrowEventHandler)
    .dependencies('container', 'EventAggregator');

  container
    .register('IntermediateTimerCatchEventHandler', IntermediateTimerCatchEventHandler)
    .dependencies('container', 'TimerFacade');

  container
    .register('MessageBoundaryEventHandler', MessageBoundaryEventHandler)
    .dependencies('container', 'EventAggregator');

  container
    .register('ParallelGatewayHandler', ParallelGatewayHandler)
    .dependencies('container');

  container
    .register('ParallelJoinGatewayHandler', ParallelJoinGatewayHandler)
    .dependencies('container');

  container
    .register('ParallelSplitGatewayHandler', ParallelSplitGatewayHandler)
    .dependencies('container', 'EventAggregator');

  container
    .register('ManualTaskHandler', ManualTaskHandler)
    .dependencies('container', 'EventAggregator');

  container
    .register('ReceiveTaskHandler', ReceiveTaskHandler)
    .dependencies('container', 'EventAggregator');

  container
    .register('ScriptTaskHandler', ScriptTaskHandler)
    .dependencies('container');

  container
    .register('SendTaskHandler', SendTaskHandler)
    .dependencies('container', 'EventAggregator');

  container
    .register('ServiceTaskHandler', ServiceTaskHandler)
    .dependencies('container');

  container
    .register('ExternalServiceTaskHandler', ExternalServiceTaskHandler)
    .dependencies('container', 'EventAggregator', 'ExternalTaskRepository');

  container
    .register('InternalServiceTaskHandler', InternalServiceTaskHandler)
    .dependencies('container');

  container
    .register('SignalBoundaryEventHandler', SignalBoundaryEventHandler)
    .dependencies('container', 'EventAggregator');

  container
    .register('StartEventHandler', StartEventHandler)
    .dependencies('container', 'EventAggregator', 'TimerFacade');

  container
    .register('SubProcessHandler', SubProcessHandler)
    .dependencies('container', 'EventAggregator');

  container
    .register('TimerBoundaryEventHandler', TimerBoundaryEventHandler)
    .dependencies('container', 'TimerFacade');

  container
    .register('UserTaskHandler', UserTaskHandler)
    .dependencies('container', 'EventAggregator');
}

module.exports.registerInContainer = registerInContainer;
