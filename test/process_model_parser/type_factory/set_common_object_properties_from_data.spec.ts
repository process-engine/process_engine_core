import * as should from 'should';

import {UnprocessableEntityError} from '@essential-projects/errors_ts';
import {Model} from '@process-engine/persistence_api.contracts';

import * as TypeFactory from '../../../src/model/type_factory';

describe('TypeFactory.setCommonObjectPropertiesFromData', (): void => {

  it('Should set all properties on the target instance, if the given dataset has values for every property', (): void => {

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

    const sampleBaseElement: Model.Base.BaseElement = {id: ''};

    const result = TypeFactory.setCommonObjectPropertiesFromData(sampleData, sampleBaseElement);

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

  it('Should correclty interpret multiple documentation tags', (): void => {

    const sampleData = {
      id: 'HelloWorldId',
      'bpmn:documentation': [
        'Sample Documentation',
        'Another Sample documentation',
      ],
      'bpmn:extensionElements': {
        'camunda:executionListener': {
          class: 'HelloWorldClass',
          event: 'RandomEvent',
        },
        'camunda:properties': {
          'camunda:property': [{
            name: 'random',
            value: 'value',
          }],
        },
      },
    };

    const sampleBaseElement: Model.Base.BaseElement = {id: ''};

    const result = TypeFactory.setCommonObjectPropertiesFromData(sampleData, sampleBaseElement);

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

  it('Should not throw an error, if no "bpmn:documentation" is given', (): void => {

    const sampleData = {
      id: 'HelloWorldId',
      'bpmn:extensionElements': {
        'camunda:executionListener': {
          class: 'HelloWorldClass',
          event: 'RandomEvent',
        },
        'camunda:properties': {
          'camunda:property': [{
            name: 'random',
            value: 'value',
          }],
        },
      },
    };

    const sampleBaseElement: Model.Base.BaseElement = {id: ''};

    const result = TypeFactory.setCommonObjectPropertiesFromData(sampleData, sampleBaseElement);

    const expectedExecutionListener: Model.Base.Types.CamundaExecutionListener = {
      class: 'HelloWorldClass',
      event: 'RandomEvent',
    };

    const expectedCamundaPropertyList: Array<Model.Base.Types.CamundaExtensionProperty> = [{
      name: 'random',
      value: 'value',
    }];

    should(result.id).be.equal(sampleData.id);
    should.not.exist(result.documentation);
    should(result).have.property('extensionElements');
    should(result.extensionElements.camundaExecutionListener).be.eql(expectedExecutionListener);
    should(result.extensionElements.camundaExtensionProperties).be.eql(expectedCamundaPropertyList);
  });

  it('Should assign a blank extensionElements collection, if no "bpmn:extensionElements" tag exist on the raw dataset', (): void => {

    const sampleData = {
      id: 'HelloWorldId',
      'bpmn:documentation': 'Sample Documentation',
    };

    const sampleBaseElement: Model.Base.BaseElement = {id: ''};

    const result = TypeFactory.setCommonObjectPropertiesFromData(sampleData, sampleBaseElement);

    should(result.id).be.equal(sampleData.id);
    should(result.documentation).be.eql([sampleData['bpmn:documentation']]);
    should(result).have.property('extensionElements');
  });

  it('Should not throw an error, if "bpmn:extensionElements" has no "camunda:executionListener" tag', (): void => {

    const sampleData = {
      id: 'HelloWorldId',
      'bpmn:documentation': 'Sample Documentation',
      'bpmn:extensionElements': {
        'camunda:properties': {
          'camunda:property': [{
            name: 'random',
            value: 'value',
          }],
        },
      },
    };

    const sampleBaseElement: Model.Base.BaseElement = {id: ''};

    const result = TypeFactory.setCommonObjectPropertiesFromData(sampleData, sampleBaseElement);

    const expectedCamundaPropertyList: Array<Model.Base.Types.CamundaExtensionProperty> = [{
      name: 'random',
      value: 'value',
    }];

    should(result.id).be.equal(sampleData.id);
    should(result.documentation).be.eql([sampleData['bpmn:documentation']]);
    should(result).have.property('extensionElements');
    should.not.exist(result.extensionElements.camundaExecutionListener);
    should(result.extensionElements.camundaExtensionProperties).be.eql(expectedCamundaPropertyList);
  });

  it('Should correctly interpret a collection of "camunda:properties" values', (): void => {

    const sampleData = {
      id: 'HelloWorldId',
      'bpmn:extensionElements': {
        'camunda:properties': {
          'camunda:property': [
            {name: 'hello', value: 'world'},
            {name: 'random', value: 'value'},
          ],
        },
      },
    };

    const sampleBaseElement: Model.Base.BaseElement = {id: ''};

    const result = TypeFactory.setCommonObjectPropertiesFromData(sampleData, sampleBaseElement);

    const expectedCamundaPropertyList: Array<Model.Base.Types.CamundaExtensionProperty> = [{
      name: 'hello',
      value: 'world',
    }, {
      name: 'random',
      value: 'value',
    }];

    should(result.id).be.equal(sampleData.id);
    should(result).have.property('extensionElements');
    should(result.extensionElements.camundaExtensionProperties).be.eql(expectedCamundaPropertyList);
  });

  it('Should not interpret a single malformed "camunda:properties" value', (): void => {

    const sampleData = {
      id: 'HelloWorldId',
      'bpmn:extensionElements': {
        'camunda:properties': 'hello world',
      },
    };

    const sampleBaseElement: Model.Base.BaseElement = {id: ''};

    const result = TypeFactory.setCommonObjectPropertiesFromData(sampleData, sampleBaseElement);

    should(result.id).be.equal(sampleData.id);
    should(result).have.property('extensionElements');
    should.not.exist(result.extensionElements.camundaExecutionListener);
    should(result.extensionElements.camundaExtensionProperties).be.an.Array();
    should(result.extensionElements.camundaExtensionProperties).be.empty();
  });

  it('Should not interpret a single empty "camunda:properties" value', (): void => {

    const sampleData = {
      id: 'HelloWorldId',
      'bpmn:extensionElements': {
        'camunda:properties': '',
      },
    };

    const sampleBaseElement: Model.Base.BaseElement = {id: ''};

    const result = TypeFactory.setCommonObjectPropertiesFromData(sampleData, sampleBaseElement);

    should(result.id).be.equal(sampleData.id);
    should(result).have.property('extensionElements');
    should.not.exist(result.extensionElements.camundaExecutionListener);
    should(result.extensionElements.camundaExtensionProperties).be.an.Array();
    should(result.extensionElements.camundaExtensionProperties).be.empty();
  });

  it('Should filter out all empty "camunda:properties" from the data set', (): void => {

    const sampleData = {
      id: 'HelloWorldId',
      'bpmn:extensionElements': {
        'camunda:properties': [
          '',
          '',
          {
            'camunda:property': [
              {name: 'hello', value: 'world'},
              {name: 'random', value: 'value'},
            ],
          },
        ],
      },
    };

    const sampleBaseElement: Model.Base.BaseElement = {id: ''};

    const result = TypeFactory.setCommonObjectPropertiesFromData(sampleData, sampleBaseElement);

    const expectedCamundaPropertyList: Array<Model.Base.Types.CamundaExtensionProperty> = [{
      name: 'hello',
      value: 'world',
    }, {
      name: 'random',
      value: 'value',
    }];

    should(result.id).be.equal(sampleData.id);
    should(result).have.property('extensionElements');
    should(result.extensionElements.camundaExtensionProperties).be.eql(expectedCamundaPropertyList);
  });

  it('Should not parse any "camunda:properties", if all properties are empty', (): void => {

    const sampleData = {
      id: 'HelloWorldId',
      'bpmn:extensionElements': {
        'camunda:properties': [
          '',
          '',
        ],
      },
    };

    const sampleBaseElement: Model.Base.BaseElement = {id: ''};

    const result = TypeFactory.setCommonObjectPropertiesFromData(sampleData, sampleBaseElement);

    should(result.id).be.equal(sampleData.id);
    should(result).have.property('extensionElements');
    should(result.extensionElements.camundaExtensionProperties).be.an.Array();
    should(result.extensionElements.camundaExtensionProperties).be.empty();
  });

  it('Should throw an error, if the properties are spread across multiple collections', (): void => {

    const sampleData = {
      id: 'HelloWorldId',
      'bpmn:extensionElements': {
        'camunda:properties': [
          {
            'camunda:property': [
              {name: 'hello', value: 'world'},
              {name: 'random', value: 'value'},
            ],
          },
          {
            'camunda:property': [
              {name: 'hello', value: 'world'},
              {name: 'random', value: 'value'},
            ],
          },
        ],
      },
    };

    const sampleBaseElement: Model.Base.BaseElement = {id: ''};

    try {
      const result = TypeFactory.setCommonObjectPropertiesFromData(sampleData, sampleBaseElement);
      should.fail(result, undefined, 'This should have failed, because the property collection is invalid, indicating a broken ProcessModel!');
    } catch (error) {
      should(error).be.an.instanceOf(UnprocessableEntityError);
      should(error.message).be.match(/xml contains more than one camunda:properties collection/i);
      should.exist(error.additionalInformation);
      should(error.additionalInformation.propertyCollection).be.eql(sampleData['bpmn:extensionElements']['camunda:properties']);
    }
  });

  it('Should throw an error, if the given dataset contains no ID', (): void => {
    const sampleData = {
      'bpmn:extensionElements': {
        'camunda:properties': [],
      },
    };

    const sampleBaseElement: Model.Base.BaseElement = {id: ''};

    try {
      const result = TypeFactory.setCommonObjectPropertiesFromData(sampleData, sampleBaseElement);
      should.fail(result, undefined, 'This should not have worked, because the data set has no ID!');
    } catch (error) {
      should(error).be.an.instanceOf(UnprocessableEntityError);
      should(error.message).be.match(/the given element has no id/i);
      should.exist(error.additionalInformation);
      should(error.additionalInformation.rawDataToParse).be.eql(sampleData);
      should(error.additionalInformation.elementInstance).be.eql(sampleBaseElement);
    }
  });

});
