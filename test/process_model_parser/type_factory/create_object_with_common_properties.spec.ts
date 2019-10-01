import * as should from 'should';

import {Model} from '@process-engine/persistence_api.contracts';

import * as TypeFactory from '../../../src/model/type_factory';

describe('TypeFactory.createObjectWithCommonProperties', (): void => {

  it('Should create an instance of the given type and fill it with the given raw data', (): void => {

    const sampleData = {
      id: 'HelloWorldId',
      'bpmn:documentation': 'Sample Documentation',
      'bpmn:extensionElements': {
        'camunda:executionListener': {
          class: 'HelloWorldClass',
          event: 'RandomEvent',
        },
        'camunda:properties': {
          'camunda:property': {
            name: 'random',
            value: 'value',
          },
        },
      },
    };

    const result = TypeFactory.createObjectWithCommonProperties(sampleData, Model.Events.StartEvent);

    const expectedExecutionListener: Model.Base.Types.CamundaExecutionListener = {
      class: 'HelloWorldClass',
      event: 'RandomEvent',
    };

    const expectedCamundaPropertyList: Array<Model.Base.Types.CamundaExtensionProperty> = [{
      name: 'random',
      value: 'value',
    }];

    should(result.id).be.equal(sampleData.id);
    should(result.documentation).be.eql([sampleData['bpmn:documentation']]);
    should(result).have.property('extensionElements');
    should(result.extensionElements.camundaExecutionListener).be.eql(expectedExecutionListener);
    should(result.extensionElements.camundaExtensionProperties).be.eql(expectedCamundaPropertyList);
  });

});
