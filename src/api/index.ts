/**
 * Centralized REST API Client
 *
 * Consolidates all server API calls into a clean surface
 * matching Paperclip's client pattern.
 */

export { apiClient, ApiError } from "./client";
export { agentsApi } from "./agents";
export { companiesApi } from "./companies";
export { issuesApi } from "./issues";
export { projectsApi } from "./projects";
export { goalsApi } from "./goals";
export { approvalsApi } from "./approvals";
export { costsApi } from "./costs";
export { activityApi } from "./activity";
export { dashboardApi } from "./dashboard";
export { runsApi } from "./runs";
export { integrationsApi } from "./integrations";
export { skillsApi } from "./skills";
