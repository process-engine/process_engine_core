import * as should from 'should';

import * as TypeFactory from '../../../src/model/type_factory';

describe('TypeFactory.getModelPropertyAsArray', (): void => {

  const sampleData = {
    arrayProperty: [{
      sample: 'value',
    }],
    objectProperty: {
      hello: 'world',
    },
    stringProperty: '      hello   ',
    nullProperty: null,
    undefinedProperty: undefined,
  };

  it('Should return an Array-Property as it is', (): void => {
    const parsedProperty = TypeFactory.getModelPropertyAsArray(sampleData, 'arrayProperty');
    should(parsedProperty).be.eql(sampleData.arrayProperty);
  });

  it('Should return a non-Array property as an Array', (): void => {
    const parsedProperty = TypeFactory.getModelPropertyAsArray(sampleData, 'objectProperty');
    should(parsedProperty).be.an.Array();
    should(parsedProperty).have.length(1);
    should(parsedProperty[0]).be.eql(sampleData.objectProperty);
  });

  it('Should return a string with whitespaces as a trimmed version', (): void => {
    const parsedProperty = TypeFactory.getModelPropertyAsArray(sampleData, 'stringProperty');
    should(parsedProperty).be.an.Array();
    should(parsedProperty).have.length(1);
    should(parsedProperty[0]).be.eql('hello');
  });

  it('Should return undefined, if the given property does not exist on the dataset', (): void => {
    const parsedProperty = TypeFactory.getModelPropertyAsArray(sampleData, 'nonExistentProperty');
    should.not.exist(parsedProperty);
  });

  it('Should return undefined, if the given property has a null value', (): void => {
    const parsedProperty = TypeFactory.getModelPropertyAsArray(sampleData, 'nullProperty');
    should.not.exist(parsedProperty);
  });

  it('Should return undefined, if the given property has an undefined value', (): void => {
    const parsedProperty = TypeFactory.getModelPropertyAsArray(sampleData, 'undefinedProperty');
    should.not.exist(parsedProperty);
  });

});
