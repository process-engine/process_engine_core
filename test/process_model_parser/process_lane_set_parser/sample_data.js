module.exports.ProcessWithSingleLane = {
  'bpmn:laneSet': {
    'bpmn:lane': {
      id: 'Lane_1',
      name: 'Boss',
      'bpmn:flowNodeRef': [
        'StartEvent_1',
        'Task_1',
        'Task_2',
        'Task_3',
        'Task_4',
        'Task_5',
        'Task_6',
        'Task_7',
        'Task_8',
        'Task_9',
        'Task_10',
        'EndEvent_1'
      ]
    }
  },
};

module.exports.ProcessWithMultipleLanes = {
  'bpmn:laneSet': {
    'bpmn:lane': [{
      id: 'Lane_1',
      name: 'Developer',
      'bpmn:flowNodeRef': [
        'StartEvent_1',
        'Task_2',
        'Task_4',
        'Task_8',
        'Task_9',
        'Task_10',
        'EndEvent_1'
      ]
    }, {
      id: 'Lane_2',
      name: 'CI Dude',
      'bpmn:flowNodeRef': [
        'Task_1',
        'Task_3',
        'Task_5',
        'Task_6',
        'Task_7',
      ]
    }]
  },
}

module.exports.ProcessWithSubLanes = {
  'bpmn:laneSet': {
    'bpmn:lane': {
      id: 'Lane_1',
      name: 'LaneA',
      'bpmn:flowNodeRef': [
        'EndEvent_2',
        'StartEvent_1',
        'Task_1',
        'Task_2',
        'Task_3',
        'EndEvent_1'
      ],
      'bpmn:childLaneSet': {
        'bpmn:lane': [
          {
            id: 'SubLane_1',
            name: 'LaneB',
            'bpmn:flowNodeRef': ['StartEvent_1', 'Task_1']
          }, {
            id: 'SubLane_2',
            name: 'LaneC',
            'bpmn:flowNodeRef': ['Task_2', 'Task_3', 'EndEvent_1']
          }
        ]
      }
    }
  }
}

module.exports.ProcessWithEmptyLaneSet = {
  'bpmn:laneSet': {},
}

module.exports.ProcessWithEmptySubLaneSet = {
  'bpmn:laneSet': {
    'bpmn:lane': {
      id: 'Lane_1',
      name: 'LaneA',
      'bpmn:flowNodeRef': [
        'EndEvent_2',
        'StartEvent_1',
        'Task_1',
        'Task_2',
        'Task_3',
        'EndEvent_1'
      ],
      'bpmn:childLaneSet': {}
    }
  }
}

module.exports.ProcessWithLaneWithoutId = {
  'bpmn:laneSet': {
    'bpmn:lane': {
      name: 'Boss',
      'bpmn:flowNodeRef': [
        'StartEvent_1',
        'Task_1',
        'Task_2',
        'Task_3',
        'Task_4',
        'Task_5',
        'Task_6',
        'Task_7',
        'Task_8',
        'Task_9',
        'Task_10',
        'EndEvent_1'
      ]
    }
  },
}

module.exports.ProcessWithSubLaneWithoutId = {
  'bpmn:laneSet': {
    'bpmn:lane': {
      id: 'Lane_1',
      name: 'LaneA',
      'bpmn:flowNodeRef': [
        'EndEvent_2',
        'StartEvent_1',
        'Task_1',
        'Task_2',
        'Task_3',
        'EndEvent_1'
      ],
      'bpmn:childLaneSet': {
        'bpmn:lane': [
          {
            name: 'LaneB',
            'bpmn:flowNodeRef': ['StartEvent_1', 'Task_1']
          }, {
            id: 'SubLane_2',
            name: 'LaneC',
            'bpmn:flowNodeRef': ['Task_2', 'Task_3', 'EndEvent_1']
          }
        ]
      }
    }
  }
}
