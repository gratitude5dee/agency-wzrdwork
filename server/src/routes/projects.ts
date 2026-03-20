import { HttpError, asOptionalString, asString, json, readJson } from "../http.js";
import { authenticateRequest } from "../services/auth.js";
import { requireCompanyAccess } from "../services/access.js";
import { recordActivity } from "../services/activity-log.js";
import {
  createProject,
  createProjectWorkspace,
  deleteProject,
  deleteProjectWorkspace,
  getProject,
  listProjects,
  listProjectWorkspaces,
  requireProject,
  updateProject,
  updateProjectWorkspace,
} from "../services/projects.js";
import type { RouteContext, RouteResult } from "../types.js";

export async function handleProjectsRoute(context: RouteContext): Promise<RouteResult> {
  const companyMatch = context.url.pathname.match(/^\/api\/companies\/([^/]+)\/projects$/);
  if (companyMatch) {
    const companyId = companyMatch[1];
    const { actor } = await authenticateRequest(context.sql, context.config, context.request);
    requireCompanyAccess(actor, companyId);

    if (context.request.method === "GET") {
      json(context.response, 200, await listProjects(context.sql, companyId));
      return { handled: true };
    }

    if (context.request.method === "POST") {
      const body = await readJson(context.request);
      const name = asString(body.name);
      if (!name) throw new HttpError(400, "name is required");

      const project = await createProject(context.sql, {
        companyId,
        name,
        summary: asOptionalString(body.summary),
        status: asOptionalString(body.status),
        priority: asOptionalString(body.priority),
      });

      await recordActivity(context.sql, {
        companyId,
        action: "project.created",
        details: { projectId: project.id, name: project.name },
      });
      context.liveEvents.publish({
        type: "project.created",
        companyId,
        payload: { projectId: project.id },
      });

      json(context.response, 201, project);
      return { handled: true };
    }
  }

  const workspaceCollectionMatch = context.url.pathname.match(/^\/api\/projects\/([^/]+)\/workspaces$/);
  if (workspaceCollectionMatch) {
    const project = await requireProject(context.sql, workspaceCollectionMatch[1]);
    const { actor } = await authenticateRequest(context.sql, context.config, context.request);
    requireCompanyAccess(actor, project.company_id);

    if (context.request.method === "GET") {
      json(context.response, 200, await listProjectWorkspaces(context.sql, project.id));
      return { handled: true };
    }

    if (context.request.method === "POST") {
      const body = await readJson(context.request);
      const name = asString(body.name);
      if (!name) throw new HttpError(400, "name is required");

      const workspace = await createProjectWorkspace(context.sql, {
        companyId: project.company_id,
        projectId: project.id,
        name,
        sourceType: asOptionalString(body.sourceType),
        cwd: asOptionalString(body.cwd),
        repoUrl: asOptionalString(body.repoUrl),
        repoRef: asOptionalString(body.repoRef),
        defaultRef: asOptionalString(body.defaultRef),
        visibility: asOptionalString(body.visibility),
        setupCommand: asOptionalString(body.setupCommand),
        cleanupCommand: asOptionalString(body.cleanupCommand),
        remoteProvider: asOptionalString(body.remoteProvider),
        remoteWorkspaceRef: asOptionalString(body.remoteWorkspaceRef),
        sharedWorkspaceKey: asOptionalString(body.sharedWorkspaceKey),
        metadata:
          body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
            ? body.metadata
            : null,
        isPrimary: body.isPrimary === true,
      });

      await recordActivity(context.sql, {
        companyId: project.company_id,
        action: "project.workspace_created",
        details: { projectId: project.id, workspaceId: workspace.id, name: workspace.name },
      });
      context.liveEvents.publish({
        type: "project.workspace_created",
        companyId: project.company_id,
        payload: { projectId: project.id, workspaceId: workspace.id },
      });

      json(context.response, 201, workspace);
      return { handled: true };
    }
  }

  const workspaceDetailMatch = context.url.pathname.match(/^\/api\/projects\/([^/]+)\/workspaces\/([^/]+)$/);
  if (workspaceDetailMatch) {
    const project = await requireProject(context.sql, workspaceDetailMatch[1]);
    const workspaceId = workspaceDetailMatch[2];
    const { actor } = await authenticateRequest(context.sql, context.config, context.request);
    requireCompanyAccess(actor, project.company_id);

    if (context.request.method === "PATCH") {
      const body = await readJson(context.request);
      const workspace = await updateProjectWorkspace(context.sql, project.id, workspaceId, {
        name: body.name === undefined ? undefined : asString(body.name) ?? undefined,
        sourceType:
          body.sourceType === undefined ? undefined : asOptionalString(body.sourceType),
        cwd: body.cwd === undefined ? undefined : asOptionalString(body.cwd),
        repoUrl: body.repoUrl === undefined ? undefined : asOptionalString(body.repoUrl),
        repoRef: body.repoRef === undefined ? undefined : asOptionalString(body.repoRef),
        defaultRef:
          body.defaultRef === undefined ? undefined : asOptionalString(body.defaultRef),
        visibility:
          body.visibility === undefined ? undefined : asOptionalString(body.visibility),
        setupCommand:
          body.setupCommand === undefined ? undefined : asOptionalString(body.setupCommand),
        cleanupCommand:
          body.cleanupCommand === undefined ? undefined : asOptionalString(body.cleanupCommand),
        remoteProvider:
          body.remoteProvider === undefined ? undefined : asOptionalString(body.remoteProvider),
        remoteWorkspaceRef:
          body.remoteWorkspaceRef === undefined
            ? undefined
            : asOptionalString(body.remoteWorkspaceRef),
        sharedWorkspaceKey:
          body.sharedWorkspaceKey === undefined
            ? undefined
            : asOptionalString(body.sharedWorkspaceKey),
        metadata:
          body.metadata === undefined
            ? undefined
            : body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
              ? body.metadata
              : null,
        isPrimary: body.isPrimary === undefined ? undefined : body.isPrimary === true,
      });

      if (!workspace) {
        throw new HttpError(404, "Project workspace not found");
      }

      await recordActivity(context.sql, {
        companyId: project.company_id,
        action: "project.workspace_updated",
        details: { projectId: project.id, workspaceId, changedKeys: Object.keys(body).sort() },
      });
      context.liveEvents.publish({
        type: "project.workspace_updated",
        companyId: project.company_id,
        payload: { projectId: project.id, workspaceId },
      });

      json(context.response, 200, workspace);
      return { handled: true };
    }

    if (context.request.method === "DELETE") {
      const workspace = await deleteProjectWorkspace(context.sql, project.id, workspaceId);
      if (!workspace) {
        throw new HttpError(404, "Project workspace not found");
      }

      await recordActivity(context.sql, {
        companyId: project.company_id,
        action: "project.workspace_deleted",
        details: { projectId: project.id, workspaceId },
      });
      context.liveEvents.publish({
        type: "project.workspace_deleted",
        companyId: project.company_id,
        payload: { projectId: project.id, workspaceId },
      });

      json(context.response, 200, workspace);
      return { handled: true };
    }
  }

  const projectMatch = context.url.pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (!projectMatch) {
    return { handled: false };
  }

  const project = await requireProject(context.sql, projectMatch[1]);
  const { actor } = await authenticateRequest(context.sql, context.config, context.request);
  requireCompanyAccess(actor, project.company_id);

  if (context.request.method === "GET") {
    json(context.response, 200, {
      ...project,
      workspaces: await listProjectWorkspaces(context.sql, project.id),
    });
    return { handled: true };
  }

  if (context.request.method === "PATCH") {
    const body = await readJson(context.request);
    const updated = await updateProject(context.sql, project.id, {
      name: body.name === undefined ? undefined : asString(body.name) ?? undefined,
      summary: body.summary === undefined ? undefined : asOptionalString(body.summary),
      status: body.status === undefined ? undefined : asOptionalString(body.status),
      priority: body.priority === undefined ? undefined : asOptionalString(body.priority),
    });

    await recordActivity(context.sql, {
      companyId: project.company_id,
      action: "project.updated",
      details: { projectId: project.id, changedKeys: Object.keys(body).sort() },
    });
    context.liveEvents.publish({
      type: "project.updated",
      companyId: project.company_id,
      payload: { projectId: project.id },
    });

    json(context.response, 200, updated);
    return { handled: true };
  }

  if (context.request.method === "DELETE") {
    const removed = await deleteProject(context.sql, project.id);
    await recordActivity(context.sql, {
      companyId: project.company_id,
      action: "project.deleted",
      details: { projectId: project.id },
    });
    context.liveEvents.publish({
      type: "project.deleted",
      companyId: project.company_id,
      payload: { projectId: project.id },
    });
    json(context.response, 200, removed);
    return { handled: true };
  }

  return { handled: false };
}
