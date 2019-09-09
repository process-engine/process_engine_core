module.exports.DefinitionWithSingleProcess = {
  'bpmn:definitions': {
    'xmlns:bpmn': 'http://www.omg.org/spec/BPMN/20100524/MODEL',
    'xmlns:bpmndi': 'http://www.omg.org/spec/BPMN/20100524/DI',
    'xmlns:dc': 'http://www.omg.org/spec/DD/20100524/DC',
    'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    'xmlns:di': 'http://www.omg.org/spec/DD/20100524/DI',
    id: 'Definition_1',
    targetNamespace: 'http://bpmn.io/schema/bpmn',
    exporter: 'BPMN Studio',
    exporterVersion: '1',
    'bpmn:collaboration': {
      id: 'Collaboration_1cidyxu',
      name: '',
      'bpmn:participant': {
        id: 'Participant_0px403d',
        name: 'empty_lane_test',
        processRef: 'empty_lane_test'
      }
    },
    'bpmn:process': {
      id: 'empty_lane_test',
      name: 'empty_lane_test',
      isExecutable: 'false',
      'bpmn:laneSet': {
        'bpmn:lane': [{
            id: 'Lane_1xzf0d3',
            name: 'Default_Test_Lane',
            'bpmn:flowNodeRef': ['StartEvent_1mox3jl', 'EndEvent_0eie6q6']
          }, {
            id: 'Lane_1ve42zf',
            name: 'Empty_Lane'
          }
        ]
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
    },
  }
};

module.exports.DefinitionWithTwoProcesses = {
  'bpmn:definitions': {
    'xmlns:bpmn': 'http://www.omg.org/spec/BPMN/20100524/MODEL',
    'xmlns:bpmndi': 'http://www.omg.org/spec/BPMN/20100524/DI',
    'xmlns:dc': 'http://www.omg.org/spec/DD/20100524/DC',
    'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    'xmlns:di': 'http://www.omg.org/spec/DD/20100524/DI',
    id: 'Definition_1',
    targetNamespace: 'http://bpmn.io/schema/bpmn',
    exporter: 'BPMN Studio',
    exporterVersion: '1',
    'bpmn:collaboration': {
      id: 'Collaboration_1cidyxu',
      name: '',
      'bpmn:participant': [{
        id: 'Participant_1',
        name: 'sample_process',
        processRef: 'sample_process'
      }, {
        id: 'Participant_2',
        name: 'sample_process_2',
        processRef: 'sample_process_2'
      }]
    },
    'bpmn:process': [{
      id: 'sample_process',
      name: 'sample_process',
      isExecutable: 'false',
      'bpmn:laneSet': {
        'bpmn:lane': [{
            id: 'Lane_1xzf0d3',
            name: 'Default_Test_Lane',
            'bpmn:flowNodeRef': ['StartEvent_1mox3jl', 'EndEvent_0eie6q6']
          }, {
            id: 'Lane_1ve42zf',
            name: 'Empty_Lane'
          }
        ]
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
  }
};

module.exports.DefinitionWithoutProcess = {
  'bpmn:definitions': {
    'xmlns:bpmn': 'http://www.omg.org/spec/BPMN/20100524/MODEL',
    'xmlns:bpmndi': 'http://www.omg.org/spec/BPMN/20100524/DI',
    'xmlns:dc': 'http://www.omg.org/spec/DD/20100524/DC',
    'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    'xmlns:di': 'http://www.omg.org/spec/DD/20100524/DI',
    id: 'Definition_1',
    targetNamespace: 'http://bpmn.io/schema/bpmn',
    exporter: 'BPMN Studio',
    exporterVersion: '1',
    'bpmn:collaboration': {
      id: 'Collaboration_1cidyxu',
      name: '',
      'bpmn:participant': {
        id: 'Participant_0px403d',
        name: 'empty_definition',
      }
    },
  }
};

module.exports.DefinitionWithoutHeaderInformation = {
  'bpmn:definitions': {
    id: 'Definition_1',
    'bpmn:collaboration': {
      id: 'Collaboration_1cidyxu',
      name: '',
      'bpmn:participant': {
        id: 'Participant_0px403d',
        name: 'empty_lane_test',
        processRef: 'empty_lane_test'
      }
    },
    'bpmn:process': {
      id: 'empty_lane_test',
      name: 'empty_lane_test',
      isExecutable: 'false',
      'bpmn:laneSet': {
        'bpmn:lane': [{
            id: 'Lane_1xzf0d3',
            name: 'Default_Test_Lane',
            'bpmn:flowNodeRef': ['StartEvent_1mox3jl', 'EndEvent_0eie6q6']
          }, {
            id: 'Lane_1ve42zf',
            name: 'Empty_Lane'
          }
        ]
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
    },
  }
};

module.exports.DefinitionWithoutId = {
  'bpmn:definitions': {
    'xmlns:bpmn': 'http://www.omg.org/spec/BPMN/20100524/MODEL',
    'xmlns:bpmndi': 'http://www.omg.org/spec/BPMN/20100524/DI',
    'xmlns:dc': 'http://www.omg.org/spec/DD/20100524/DC',
    'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    'xmlns:di': 'http://www.omg.org/spec/DD/20100524/DI',
    targetNamespace: 'http://bpmn.io/schema/bpmn',
    exporter: 'BPMN Studio',
    exporterVersion: '1',
    'bpmn:collaboration': {
      id: 'Collaboration_1cidyxu',
      name: '',
      'bpmn:participant': {
        id: 'Participant_0px403d',
        name: 'empty_lane_test',
        processRef: 'empty_lane_test'
      }
    },
    'bpmn:process': {
      id: 'empty_lane_test',
      name: 'empty_lane_test',
      isExecutable: 'false',
      'bpmn:laneSet': {
        'bpmn:lane': [{
            id: 'Lane_1xzf0d3',
            name: 'Default_Test_Lane',
            'bpmn:flowNodeRef': ['StartEvent_1mox3jl', 'EndEvent_0eie6q6']
          }, {
            id: 'Lane_1ve42zf',
            name: 'Empty_Lane'
          }
        ]
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
    },
  }
};
