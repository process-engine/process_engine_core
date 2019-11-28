import {BpmnTags, Model} from '@process-engine/persistence_api.contracts';

import {createObjectWithCommonProperties, getModelPropertyAsArray} from '../type_factory';

export function parseCollaboration(parsedObjectModel: object): Model.Collaboration {

  const collaborationRaw = parsedObjectModel[BpmnTags.CommonElement.Collaboration];

  const collaboration = createObjectWithCommonProperties(collaborationRaw, Model.Collaboration);

  collaboration.name = collaborationRaw.name;
  collaboration.participants = getCollaborationParticipants(collaborationRaw);

  return collaboration;
}

function getCollaborationParticipants(collaborationData: object): Array<Model.Participant> {

  const participantsRaw = getModelPropertyAsArray(collaborationData, BpmnTags.CommonElement.Participant);

  const participants: Array<Model.Participant> = [];

  for (const participantRaw of participantsRaw) {
    const participant = createObjectWithCommonProperties(participantRaw, Model.Participant);

    participant.name = participantRaw.name;
    participant.processReference = participantRaw.processRef;

    participants.push(participant);
  }

  return participants;
}
