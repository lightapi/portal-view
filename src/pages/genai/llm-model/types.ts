export type LlmRecord = Record<string, unknown> & {
  hostId?: string;
  aggregateVersion?: number;
  active?: boolean;
  lifecycleStatus?: string;
};

export type ResourceDefinition = {
  scope: 'global' | 'host';
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
  columnLabels?: Record<string, string>;
  taxonomyEntityType?: string;
  idField: string;
  columns: string[];
};

export const llmCatalogResource: ResourceDefinition =
  {scope:'global',key:'models',label:'LLM Models',listAction:'getLlmModel',createAction:'createLlmModel',updateAction:'updateLlmModel',deleteAction:'deleteLlmModel',createLabel:'Create LLM model',createForm:'createLlmModel',updateForm:'updateLlmModel',formFields:['modelId','providerType','physicalModelId','modelFamily','modelVersion','lifecycleStatus','contextTokenLimit','outputTokenLimit','modalities','operations','declaredCapabilities','categoryIds','tagIds','aggregateVersion'],columnLabels:{categories:'Categories',tags:'Tags'},taxonomyEntityType:'llm_model',idField:'modelId',columns:['providerType','physicalModelId','modelFamily','categories','tags','lifecycleStatus']};

export const llmAdminResources: ResourceDefinition[] = [
  {scope:'host',key:'registrations',label:'Registrations',listAction:'getLlmModelRegistration',createAction:'createLlmModelRegistration',updateAction:'updateLlmModelRegistration',deleteAction:'deleteLlmModelRegistration',createLabel:'Create registration',createForm:'createLlmRegistration',updateForm:'updateLlmRegistration',formFields:['hostId','modelRegistrationId','modelId','environment','regions','dataClassifications','capabilityRestrictions','lifecycleStatus','aggregateVersion'],idField:'modelRegistrationId',columns:['modelId','environment','regions','lifecycleStatus']},
  {scope:'host',key:'accounts',label:'Accounts',listAction:'getLlmProviderAccount',createAction:'createLlmProviderAccount',updateAction:'updateLlmProviderAccount',deleteAction:'deleteLlmProviderAccount',createLabel:'Create provider account',createForm:'createProviderAccount',updateForm:'updateProviderAccount',formFields:['hostId','providerAccountId','accountName','providerType','billingPrincipal','quotaGroupId','capacityMetadata','lifecycleStatus','aggregateVersion'],idField:'providerAccountId',columns:['accountName','providerType','billingPrincipal','quotaGroupId','lifecycleStatus']},
  {scope:'host',key:'deployments',label:'Deployments',listAction:'getLlmProviderDeployment',createAction:'createLlmProviderDeployment',updateAction:'updateLlmProviderDeployment',deleteAction:'deleteLlmProviderDeployment',createLabel:'Create provider deployment',createForm:'createProviderDeployment',updateForm:'updateProviderDevelopment',formFields:['hostId','providerDeploymentId','modelRegistrationId','providerAccountId','deploymentName','providerType','physicalModelId','baseUrl','region','transportBounds','refreshBeforeSeconds','lifecycleStatus','aggregateVersion'],idField:'providerDeploymentId',columns:['deploymentName','providerType','physicalModelId','region','quotaGroupId','conformanceState','lifecycleStatus']},
  {scope:'host',key:'credentials',label:'Credentials',listAction:'getLlmProviderCredential',createAction:'createLlmProviderCredential',updateAction:'updateLlmProviderCredential',deleteAction:'deleteLlmProviderCredential',createLabel:'Create provider credential',createForm:'createProviderCredential',updateForm:'updateProviderCredential',formFields:['hostId','providerCredentialId','providerDeploymentId','credentialVersion','secretReference','effectiveTs','expiresTs','lifecycleStatus','aggregateVersion'],idField:'providerCredentialId',columns:['providerDeploymentId','credentialVersion','secretReference','effectiveTs','expiresTs','lifecycleStatus']},
  {scope:'host',key:'aliases',label:'Aliases',listAction:'getLlmPublicAlias',createAction:'createLlmPublicAlias',updateAction:'updateLlmPublicAlias',deleteAction:'deleteLlmPublicAlias',createLabel:'Create public alias',createForm:'createPublicAlias',updateForm:'updatePublicAlias',formFields:['hostId','publicAliasId','environment','aliasName','operations','requiredCapabilities','maxInputTokens','maxOutputTokens','maxRequestBytes','dataClassification','loggingMode','piiMode','lifecycleStatus','replacementAliasId','aliasVisibility','boundAgentDefId','aggregateVersion'],idField:'publicAliasId',columns:['environment','aliasName','aliasVisibility','boundAgentDefId','operations','loggingMode','piiMode','lifecycleStatus']},
  {scope:'host',key:'routes',label:'Routes',listAction:'getLlmAliasRoute',createAction:'createLlmAliasRoute',updateAction:'updateLlmAliasRoute',deleteAction:'deleteLlmAliasRoute',createLabel:'Create alias route',createForm:'createAliasRoute',updateForm:'updateAliasRoute',formFields:['hostId','aliasRouteId','publicAliasId','providerDeploymentId','routePriority','routeWeight','fallbackEnabled','canaryPercent','residencyConditions','aggregateVersion'],idField:'aliasRouteId',columns:['publicAliasId','providerDeploymentId','routePriority','fallbackEnabled']},
  {scope:'host',key:'pricing',label:'Pricing',listAction:'getLlmPricingVersion',createAction:'createLlmPricingVersion',updateAction:'updateLlmPricingVersion',deleteAction:'deleteLlmPricingVersion',createLabel:'Create pricing version',createForm:'createPricingVersion',updateForm:'updatePricingVersion',formFields:['hostId','pricingVersionId','providerDeploymentId','pricingVersion','inputMicrosPerMillion','outputMicrosPerMillion','cachedInputMicrosPerMillion','effectiveTs','expiresTs','source','approvedBy','aggregateVersion'],idField:'pricingVersionId',columns:['providerDeploymentId','pricingVersion','inputMicrosPerMillion','outputMicrosPerMillion','effectiveTs','source']},
  {scope:'host',key:'policies',label:'Policies',listAction:'getLlmModelPolicy',createAction:'createLlmModelPolicy',updateAction:'updateLlmModelPolicy',deleteAction:'deleteLlmModelPolicy',createLabel:'Create model policy',createForm:'createModelPolicy',updateForm:'updateModelPolicy',formFields:['hostId','modelPolicyId','policyName','accessPolicy','budgetPolicy','contentPolicy','cachePolicy','piiPolicy','nativeExtensionPolicy','lifecycleStatus','aggregateVersion'],idField:'modelPolicyId',columns:['policyName','accessPolicy','budgetPolicy','contentPolicy','lifecycleStatus']},
  {scope:'host',key:'bindings',label:'Bindings',listAction:'getLlmModelPolicyBinding',createAction:'createLlmModelPolicyBinding',updateAction:'updateLlmModelPolicyBinding',deleteAction:'deleteLlmModelPolicyBinding',createLabel:'Create policy binding',createForm:'createPolicyBinding',updateForm:'updatePolicyBinding',formFields:['hostId','modelPolicyBindingId','modelPolicyId','subjectType','subjectId','publicAliasId','agentDefault','aggregateVersion'],idField:'modelPolicyBindingId',columns:['modelPolicyId','subjectType','subjectId','publicAliasId','agentDefault']},
];

export const llmResources: ResourceDefinition[] = [llmCatalogResource, ...llmAdminResources];
