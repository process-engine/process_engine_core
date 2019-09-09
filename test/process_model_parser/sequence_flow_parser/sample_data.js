module.exports.ProcessWithMultipleSequenceFlows = {
  'bpmn:sequenceFlow': [{
    id: 'SequenceFlow_1',
    sourceRef: 'StartEvent_1',
    targetRef: 'Task_1'
  }, {
    id: 'SequenceFlow_2',
    sourceRef: 'Task_1',
    targetRef: 'Task_2'
  }, {
    id: 'SequenceFlow_3',
    sourceRef: 'Task_2',
    targetRef: 'EndEvent_1'
  }],
}

module.exports.ProcessWithSingleSequenceFlow = {
  'bpmn:sequenceFlow': {
    id: 'SequenceFlow_1',
    sourceRef: 'StartEvent_1',
    targetRef: 'EndEvent_1'
  },
}

module.exports.ProcessWithConditionalSequenceFlows = {
  'bpmn:sequenceFlow': [{
    id: 'SequenceFlow_1',
    sourceRef: 'StartEvent_1',
    targetRef: 'Gateway_1'
  }, {
    id: 'SequenceFlow_Conditional',
    name: 'Do it!',
    sourceRef: 'Gateway_1',
    targetRef: 'Task_2',
    'bpmn:conditionExpression': {
      _: 'token.current.someCondition === \'true\'',
      'xsi:type': 'bpmn:tFormalExpression'
    }
  }, {
    id: 'SequenceFlow_3',
    sourceRef: 'Task_2',
    targetRef: 'EndEvent_1'
  }],
}

module.exports.ProcessWithSequenceFlowsWithoutIds = {
  'bpmn:sequenceFlow': [{
    sourceRef: 'StartEvent_1',
    targetRef: 'Task_1'
  }, {
    id: 'SequenceFlow_2',
    sourceRef: 'Task_1',
    targetRef: 'Task_2'
  }, {
    id: 'SequenceFlow_3',
    sourceRef: 'Task_2',
    targetRef: 'EndEvent_1'
  }],
}
