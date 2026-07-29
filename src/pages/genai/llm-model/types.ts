export type LlmRecord = Record<string, unknown> & {
  hostId?: string;
  aggregateVersion?: number;
  active?: boolean;
  lifecycleStatus?: string;
};

export type ResourceDefinition = {
  key: string;
  label: string;
  listAction: string;
  createAction: string;
  updateAction: string;
  deleteAction: string;
  createLabel?: string;
  createForm?: string;
  updateForm?: string;
  formFields?: string[];
  idField: string;
  columns: string[];
};

export const llmCatalogResource: ResourceDefinition =
  {key:'models',label:'Models',listAction:'getLlmModel',createAction:'createLlmModel',updateAction:'updateLlmModel',deleteAction:'deleteLlmModel',createLabel:'Create LLM model',createForm:'createLlmModel',updateForm:'updateLlmModel',formFields:['hostId','modelId','providerType','physicalModelId','modelFamily','modelVersion','lifecycleStatus','contextTokenLimit','outputTokenLimit','modalities','operations','declaredCapabilities','categoryIds','tagIds','aggregateVersion','active'],idField:'modelId',columns:['providerType','physicalModelId','modelFamily','categoryIds','tagIds','lifecycleStatus']};

export const llmAdminResources: ResourceDefinition[] = [
  {key:'registrations',label:'Registrations',listAction:'getLlmModelRegistration',createAction:'createLlmModelRegistration',updateAction:'updateLlmModelRegistration',deleteAction:'deleteLlmModelRegistration',createLabel:'Create registration',idField:'modelRegistrationId',columns:['modelId','environment','regions','lifecycleStatus']},
  {key:'accounts',label:'Accounts',listAction:'getLlmProviderAccount',createAction:'createLlmProviderAccount',updateAction:'updateLlmProviderAccount',deleteAction:'deleteLlmProviderAccount',createLabel:'Create provider account',idField:'providerAccountId',columns:['accountName','providerType','billingPrincipal','quotaGroupId','lifecycleStatus']},
  {key:'deployments',label:'Deployments',listAction:'getLlmProviderDeployment',createAction:'createLlmProviderDeployment',updateAction:'updateLlmProviderDeployment',deleteAction:'deleteLlmProviderDeployment',createLabel:'Create provider deployment',idField:'providerDeploymentId',columns:['deploymentName','providerType','physicalModelId','region','conformanceState','lifecycleStatus']},
  {key:'credentials',label:'Credentials',listAction:'getLlmProviderCredential',createAction:'createLlmProviderCredential',updateAction:'updateLlmProviderCredential',deleteAction:'deleteLlmProviderCredential',createLabel:'Create provider credential',idField:'providerCredentialId',columns:['providerDeploymentId','credentialVersion','secretReference','effectiveTs','expiresTs','lifecycleStatus']},
  {key:'aliases',label:'Aliases',listAction:'getLlmPublicAlias',createAction:'createLlmPublicAlias',updateAction:'updateLlmPublicAlias',deleteAction:'deleteLlmPublicAlias',createLabel:'Create public alias',idField:'publicAliasId',columns:['environment','aliasName','aliasVisibility','boundAgentDefId','operations','loggingMode','piiMode','lifecycleStatus']},
  {key:'routes',label:'Routes',listAction:'getLlmAliasRoute',createAction:'createLlmAliasRoute',updateAction:'updateLlmAliasRoute',deleteAction:'deleteLlmAliasRoute',createLabel:'Create alias route',idField:'aliasRouteId',columns:['publicAliasId','providerDeploymentId','routePriority','fallbackEnabled']},
  {key:'pricing',label:'Pricing',listAction:'getLlmPricingVersion',createAction:'createLlmPricingVersion',updateAction:'updateLlmPricingVersion',deleteAction:'deleteLlmPricingVersion',createLabel:'Create pricing version',idField:'pricingVersionId',columns:['providerDeploymentId','pricingVersion','inputMicrosPerMillion','outputMicrosPerMillion','effectiveTs','source']},
  {key:'policies',label:'Policies',listAction:'getLlmModelPolicy',createAction:'createLlmModelPolicy',updateAction:'updateLlmModelPolicy',deleteAction:'deleteLlmModelPolicy',createLabel:'Create model policy',idField:'modelPolicyId',columns:['policyName','accessPolicy','budgetPolicy','contentPolicy','lifecycleStatus']},
  {key:'bindings',label:'Bindings',listAction:'getLlmModelPolicyBinding',createAction:'createLlmModelPolicyBinding',updateAction:'updateLlmModelPolicyBinding',deleteAction:'deleteLlmModelPolicyBinding',createLabel:'Create policy binding',idField:'modelPolicyBindingId',columns:['modelPolicyId','subjectType','subjectId','publicAliasId','agentDefault']},
];

export const llmResources: ResourceDefinition[] = [llmCatalogResource, ...llmAdminResources];
