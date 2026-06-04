export const MODULE_INTRODUCTION_TASK_TEMPLATE = (
  selectedModuleTitle: string,
  firstConceptTitle: string,
  phaseDisplayName: string,
  userInputText: string
) => `
[RecursiveSensei Task: Initiate Selected Module]
You are starting a new module with the user: "${selectedModuleTitle}".
The very first concept is "${firstConceptTitle}" and the starting phase is "${phaseDisplayName}".
Your task is to provide a brief, welcoming introductory sentence or two for this specific starting point, and then deliver the VERY FIRST piece of instructional content or ask the VERY FIRST question as guided by the Curriculum Focus provided below. This is the user's first interaction with this module.
User's module selection message was: "${userInputText}"
`;
