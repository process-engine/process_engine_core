import {Entity, IEntityType, IPropertyBag, IFactory, ISchemas} from 'data_model_contracts';
import {IInvoker} from 'invocation_contracts';
import {ExecutionContext} from 'iam_contracts';
import {schemaProperty} from 'metadata';


export class NodeDefEntity extends Entity {

  static attributes: any = {
      name: { type: 'string' },
      key: { type: 'string' },
      processDef: { type: 'ProcessDef' },
      lane: { type: 'Lane' },
      type: { type: 'string' },
      extensions: { type: 'object' },
      attachedToNode: { type: 'NodeDef'},
      events: { type: 'object' }
  };

  constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<NodeDefEntity>, context: ExecutionContext, schemas: ISchemas) {
    super(propertyBagFactory, invoker, entityType, context, schemas);
  }

  @schemaProperty({
    type: 'string'
  })
  public get lane(): any {
    return this.getProperty(this, 'lane');
  }

  public async getLaneRole(context: ExecutionContext) {

    const extensions = this.lane.extensions;
    const properties = (extensions && extensions.properties) ? extensions.properties : null;

    let found = null;

    if (properties) {
      properties.some((property) => {
        if (property.name === 'role') {
          found = property.value;
          return true;
        }
      });
    }

    return found;
  }

    /*getBoundaryEvents: {
      fn: async function(context) {
        const model = this._dataClass.model;
        const queryObject = [
              { attribute: 'attachedToNode.id', operator: '=', value: this.id}
            ];
        const boundaryColl = await model.NodeDef.query({ query: queryObject }, null, context);
        return boundaryColl;
      }
    }*/

}
