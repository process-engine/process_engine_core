module.exports.DefinitionWithSingleProcess = {
  'bpmn:process': {
    id: 'empty_lane_test',
    name: 'empty_lane_test',
    isExecutable: 'true',
    'bpmn:laneSet': {
      'bpmn:lane': {
        id: 'Lane_1xzf0d3',
        name: 'Default_Test_Lane',
        'bpmn:flowNodeRef': ['StartEvent_1mox3jl', 'EndEvent_0eie6q6']
      }
    },
    'bpmn:startEvent': {
      id: 'StartEvent_1mox3jl',
      name: 'Start Event',
      'bpmn:outgoing': 'SequenceFlow_1jdocur'
    },
    'bpmn:sequenceFlow': {
      id: 'SequenceFlow_1jdocur',
      sourceRef: 'StartEvent_1mox3jl',
      targetRef: 'EndEvent_0eie6q6'
    },
    'bpmn:endEvent': {
      id: 'EndEvent_0eie6q6',
      name: 'End Event',
      'bpmn:incoming': 'SequenceFlow_1jdocur'
    },
    'bpmn:message': [{
        id: 'Message_1415hon',
        name: '1234'
      }, {
        id: 'Message_1vwrcug',
        name: 'TestMessage1234'
      },
    ],
    'bpmn:error': {
      id: 'Error_0agxpau',
      name: 'no_message_received',
      errorCode: '666'
    },
    'bpmn:signal': {
      id: 'Signal_0il1yzu',
      name: 'TestSignal1234'
    },
  },

};

module.exports.DefinitionWithTwoProcesses = {
  'bpmn:process': [{
    id: 'sample_process',
    name: 'sample_process',
    isExecutable: 'true',
    'bpmn:laneSet': {
      'bpmn:lane': [{
        id: 'Lane_1xzf0d3',
        name: 'Default_Test_Lane',
        'bpmn:flowNodeRef': ['StartEvent_1mox3jl', 'EndEvent_0eie6q6']
      }, {
        id: 'Lane_1ve42zf',
        name: 'Empty_Lane'
      }]
    },
    'bpmn:startEvent': {
      id: 'StartEvent_1mox3jl',
      name: 'Start Event',
      'bpmn:outgoing': 'SequenceFlow_1jdocur'
    },
    'bpmn:sequenceFlow': {
      id: 'SequenceFlow_1jdocur',
      sourceRef: 'StartEvent_1mox3jl',
      targetRef: 'EndEvent_0eie6q6'
    },
    'bpmn:endEvent': {
      id: 'EndEvent_0eie6q6',
      name: 'End Event',
      'bpmn:incoming': 'SequenceFlow_1jdocur'
    }
  }, {
    id: 'sample_process_2',
    name: 'sample_process_2',
    isExecutable: 'true',
    'bpmn:laneSet': {
      'bpmn:lane': {
        id: 'Lane_1',
        name: 'Default_Test_Lane',
        'bpmn:flowNodeRef': ['StartEvent_1', 'EndEvent_1']
      }
    },
    'bpmn:startEvent': {
      id: 'StartEvent_1',
      name: 'Start Event',
      'bpmn:outgoing': 'SequenceFlow_1jdocur'
    },
    'bpmn:sequenceFlow': {
      id: 'SequenceFlow_1jdocur',
      sourceRef: 'StartEvent_1',
      targetRef: 'EndEvent_1'
    },
    'bpmn:endEvent': {
      id: 'EndEvent_1',
      name: 'End Event',
      'bpmn:incoming': 'SequenceFlow_1jdocur'
    }
  }],

};

module.exports.DefinitionWithouProcesstId = {
  'bpmn:process': {
    name: 'empty_lane_test',
    isExecutable: 'true',
    'bpmn:laneSet': {
      'bpmn:lane': [{
        id: 'Lane_1xzf0d3',
        name: 'Default_Test_Lane',
        'bpmn:flowNodeRef': ['StartEvent_1mox3jl', 'EndEvent_0eie6q6']
      }, {
        id: 'Lane_1ve42zf',
        name: 'Empty_Lane'
      }]
    },
    'bpmn:startEvent': {
      id: 'StartEvent_1mox3jl',
      name: 'Start Event',
      'bpmn:outgoing': 'SequenceFlow_1jdocur'
    },
    'bpmn:sequenceFlow': {
      id: 'SequenceFlow_1jdocur',
      sourceRef: 'StartEvent_1mox3jl',
      targetRef: 'EndEvent_0eie6q6'
    },
    'bpmn:endEvent': {
      id: 'EndEvent_0eie6q6',
      name: 'End Event',
      'bpmn:incoming': 'SequenceFlow_1jdocur'
    }
  }
};
