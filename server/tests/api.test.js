import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';

// Mock the models
vi.mock('../models/Project.js');
vi.mock('../models/User.js');

// Mock NamoID client to avoid external calls
vi.mock('@namoidhq/js', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    createNamoIDClient: () => ({
      hostedAuth: {
        start: vi.fn().mockResolvedValue({
          authorizationUrl: 'https://example.test/authorize',
          transaction: {
            state: 'state_1',
            nonce: 'nonce_1',
            codeVerifier: 'verifier_1',
            redirectUri: 'http://localhost:5174/api/auth/callback',
            createdAt: Date.now(),
          },
        }),
        exchangeCode: vi.fn(),
        userInfo: vi.fn(),
        refresh: vi.fn(),
        revoke: vi.fn(),
        getLogoutUrl: vi.fn(),
      },
      auth: { getDiscovery: vi.fn() },
    }),
  };
});
vi.mock('@namoidhq/js/server', () => ({
  validateOIDCIdToken: vi.fn(),
}));

// Helper to create an authenticated session agent
async function createAuthAgent(user) {
  const agent = request.agent(app);
  await agent.post('/api/test/session').send({ user });
  return agent;
}

describe('API Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('0. Authentication request origin', () => {
    it('allows the configured frontend origin', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Origin', 'http://localhost:5174');

      expect(res.status).toBe(200);
      expect(res.body.authorizationUrl).toBe('https://example.test/authorize');
    });

    it('rejects missing, foreign, and prefix-confusion origins', async () => {
      const missing = await request(app).post('/api/auth/login');
      const foreign = await request(app)
        .post('/api/auth/login')
        .set('Origin', 'https://evil.example');
      const prefixConfusion = await request(app)
        .post('/api/auth/login')
        .set('Origin', 'http://localhost:5174.evil.example');

      expect(missing.status).toBe(403);
      expect(foreign.status).toBe(403);
      expect(prefixConfusion.status).toBe(403);
    });
  });

  // 1. Unauthenticated request returns 401
  describe('1. Unauthenticated requests', () => {
    it('returns 401 for unauthenticated requests to protected routes', async () => {
      const resProjects = await request(app).get('/api/projects');
      expect(resProjects.status).toBe(401);
      expect(resProjects.body.error).toBe('Not signed in.');

      const resProject = await request(app).get('/api/projects/proj_1');
      expect(resProject.status).toBe(401);

      const resRole = await request(app).post('/api/users/me/role').send({ role: 'client' });
      expect(resRole.status).toBe(401);

      const resCreate = await request(app).post('/api/projects').send({ title: 'Test' });
      expect(resCreate.status).toBe(401);
    });
  });

  // 2. Non-member project access returns 403
  describe('2. Non-member project access', () => {
    it('returns 403 for non-member accessing a project or project actions', async () => {
      Project.findById.mockResolvedValue({
        _id: 'proj_1',
        clientId: 'client_1',
        freelancerSub: 'freelancer_1',
        freelancerEmail: 'freelancer@test.com',
      });

      const outsiderAgent = await createAuthAgent({
        sub: 'stranger_sub',
        email: 'stranger@test.com',
        name: 'Stranger',
        role: 'client',
      });

      // GET project
      const getRes = await outsiderAgent.get('/api/projects/proj_1');
      expect(getRes.status).toBe(403);
      expect(getRes.body.error).toBe('You are not a member of this project.');

      // POST scope-ack
      const ackRes = await outsiderAgent.post('/api/projects/proj_1/scope-ack');
      expect(ackRes.status).toBe(403);
      expect(ackRes.body.error).toBe('You are not a member of this project.');

      // POST final-ack
      const finalRes = await outsiderAgent.post('/api/projects/proj_1/final-ack');
      expect(finalRes.status).toBe(403);
      expect(finalRes.body.error).toBe('You are not a member of this project.');
    });
  });

  // 3. Client / Freelancer role restrictions
  describe('3. Client / Freelancer role restrictions', () => {
    it('prevents non-clients from creating projects', async () => {
      const freelancerAgent = await createAuthAgent({
        sub: 'freelancer_1',
        email: 'freelancer@test.com',
        name: 'Freelancer',
        role: 'freelancer',
      });

      const res = await freelancerAgent.post('/api/projects').send({
        title: 'Project 1',
        freelancerEmail: 'other@test.com',
        scope: { title: 'T', description: 'D', expectedDeliverable: 'E' },
      });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Only users with the client role can create projects');
    });

    it('prevents non-freelancers from submitting revisions', async () => {
      Project.findById.mockResolvedValue({
        _id: 'proj_1',
        clientId: 'client_1',
        freelancerSub: 'freelancer_1',
        freelancerEmail: 'freelancer@test.com',
        status: 'scope_locked',
      });

      const clientAgent = await createAuthAgent({
        sub: 'client_1',
        email: 'client@test.com',
        name: 'Client',
        role: 'client',
      });

      const res = await clientAgent.post('/api/projects/proj_1/revisions').send({
        url: 'https://github.com/test/repo',
        note: 'First revision',
      });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Only the assigned freelancer can submit revisions');
    });

    it('prevents non-clients from reviewing revisions', async () => {
      Project.findById.mockResolvedValue({
        _id: 'proj_1',
        clientId: 'client_1',
        freelancerSub: 'freelancer_1',
        freelancerEmail: 'freelancer@test.com',
        status: 'review',
        revisions: [{ version: 1, status: 'pending', url: 'https://example.com' }],
      });

      const freelancerAgent = await createAuthAgent({
        sub: 'freelancer_1',
        email: 'freelancer@test.com',
        name: 'Freelancer',
        role: 'freelancer',
      });

      const res = await freelancerAgent.patch('/api/projects/proj_1/revisions/1/review').send({
        decision: 'accepted',
      });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Only the client can review revisions');
    });
  });

  // 4. Accepted revision immutability
  describe('4. Accepted revision immutability', () => {
    it('prevents reviewing an already accepted revision', async () => {
      Project.findById.mockResolvedValue({
        _id: 'proj_1',
        clientId: 'client_1',
        freelancerSub: 'freelancer_1',
        freelancerEmail: 'freelancer@test.com',
        status: 'review',
        revisions: [
          { version: 1, status: 'accepted', url: 'https://example.com/v1' },
        ],
      });

      const clientAgent = await createAuthAgent({
        sub: 'client_1',
        email: 'client@test.com',
        name: 'Client',
        role: 'client',
      });

      const res = await clientAgent.patch('/api/projects/proj_1/revisions/1/review').send({
        decision: 'changes_requested',
        comment: 'Wait I want changes',
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('has already been accepted and cannot be modified');
    });

    it('prevents submitting new revisions once a project has accepted status', async () => {
      Project.findById.mockResolvedValue({
        _id: 'proj_1',
        clientId: 'client_1',
        freelancerSub: 'freelancer_1',
        freelancerEmail: 'freelancer@test.com',
        status: 'accepted',
        revisions: [
          { version: 1, status: 'accepted', url: 'https://example.com/v1' },
        ],
      });

      const freelancerAgent = await createAuthAgent({
        sub: 'freelancer_1',
        email: 'freelancer@test.com',
        name: 'Freelancer',
        role: 'freelancer',
      });

      const res = await freelancerAgent.post('/api/projects/proj_1/revisions').send({
        url: 'https://example.com/v2',
        note: 'Another revision',
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('Revisions can only be submitted after the scope is locked or after changes are requested');
    });
  });

  // 5. Revision cannot be reviewed twice
  describe('5. Revision cannot be reviewed twice', () => {
    it('rejects re-review when changes have already been requested', async () => {
      Project.findById.mockResolvedValue({
        _id: 'proj_1',
        clientId: 'client_1',
        freelancerSub: 'freelancer_1',
        freelancerEmail: 'freelancer@test.com',
        status: 'review',
        revisions: [
          {
            version: 1,
            status: 'changes_requested',
            reviewComment: 'Fix tests',
            url: 'https://example.com',
          },
        ],
      });

      const clientAgent = await createAuthAgent({
        sub: 'client_1',
        email: 'client@test.com',
        name: 'Client',
        role: 'client',
      });

      const res = await clientAgent.patch('/api/projects/proj_1/revisions/1/review').send({
        decision: 'accepted',
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('has already been reviewed');
    });
  });

  // 6. Separate scope acknowledgements
  describe('6. Separate scope acknowledgements', () => {
    it('records scope acknowledgement for client and freelancer independently and advances status when both ack', async () => {
      const mockProject = {
        _id: 'proj_1',
        clientId: 'client_1',
        freelancerSub: 'freelancer_1',
        freelancerEmail: 'freelancer@test.com',
        status: 'pending_ack',
        scope: { version: 1, title: 'Scope 1', description: 'Desc', expectedDeliverable: 'Deliv' },
        scopeAcks: [],
        timeline: [],
        save: vi.fn().mockResolvedValue(true),
      };

      Project.findById.mockResolvedValue(mockProject);

      const clientAgent = await createAuthAgent({
        sub: 'client_1',
        email: 'client@test.com',
        name: 'Client',
        role: 'client',
      });

      // Client acks
      const clientRes = await clientAgent.post('/api/projects/proj_1/scope-ack');
      expect(clientRes.status).toBe(200);
      expect(mockProject.scopeAcks).toHaveLength(1);
      expect(mockProject.scopeAcks[0].userId).toBe('client_1');
      expect(mockProject.scopeAcks[0].scopeVersion).toBe(1);
      // Scope remains pending_ack until freelancer acks
      expect(mockProject.status).toBe('pending_ack');

      // Client cannot ack again
      const duplicateRes = await clientAgent.post('/api/projects/proj_1/scope-ack');
      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.error).toBe('You have already acknowledged this scope.');

      // Freelancer acks
      const freelancerAgent = await createAuthAgent({
        sub: 'freelancer_1',
        email: 'freelancer@test.com',
        name: 'Freelancer',
        role: 'freelancer',
      });

      const freelancerRes = await freelancerAgent.post('/api/projects/proj_1/scope-ack');
      expect(freelancerRes.status).toBe(200);
      expect(mockProject.scopeAcks).toHaveLength(2);
      expect(mockProject.scopeAcks[1].userId).toBe('freelancer_1');
      // Now both have acked -> status advances to scope_locked
      expect(mockProject.status).toBe('scope_locked');
      expect(mockProject.scope.lockedAt).toBeDefined();
    });
  });

  // 7. Exact accepted-revision final acknowledgements
  describe('7. Exact accepted-revision final acknowledgements', () => {
    it('requires accepted revision before final-ack, and records exact revision version separately for both parties', async () => {
      const mockProject = {
        _id: 'proj_1',
        clientId: 'client_1',
        freelancerSub: 'freelancer_1',
        freelancerEmail: 'freelancer@test.com',
        status: 'accepted',
        revisions: [
          { version: 1, status: 'changes_requested' },
          { version: 2, status: 'accepted' },
        ],
        finalAcks: [],
        timeline: [],
        save: vi.fn().mockResolvedValue(true),
      };

      Project.findById.mockResolvedValue(mockProject);

      const clientAgent = await createAuthAgent({
        sub: 'client_1',
        email: 'client@test.com',
        name: 'Client',
        role: 'client',
      });

      // Client submits final-ack
      const clientRes = await clientAgent.post('/api/projects/proj_1/final-ack');
      expect(clientRes.status).toBe(200);
      expect(mockProject.finalAcks).toHaveLength(1);
      expect(mockProject.finalAcks[0].userId).toBe('client_1');
      expect(mockProject.finalAcks[0].revisionVersion).toBe(2); // exact version 2

      // Client cannot duplicate final-ack
      const clientDup = await clientAgent.post('/api/projects/proj_1/final-ack');
      expect(clientDup.status).toBe(409);
      expect(clientDup.body.error).toContain('already submitted your final acknowledgement');

      // Freelancer submits final-ack
      const freelancerAgent = await createAuthAgent({
        sub: 'freelancer_1',
        email: 'freelancer@test.com',
        name: 'Freelancer',
        role: 'freelancer',
      });

      const freelancerRes = await freelancerAgent.post('/api/projects/proj_1/final-ack');
      expect(freelancerRes.status).toBe(200);
      expect(mockProject.finalAcks).toHaveLength(2);
      expect(mockProject.finalAcks[1].userId).toBe('freelancer_1');
      expect(mockProject.finalAcks[1].revisionVersion).toBe(2);
    });

    it('rejects final-ack if project is not yet in accepted status', async () => {
      Project.findById.mockResolvedValue({
        _id: 'proj_1',
        clientId: 'client_1',
        freelancerSub: 'freelancer_1',
        freelancerEmail: 'freelancer@test.com',
        status: 'review',
        revisions: [{ version: 1, status: 'pending' }],
        finalAcks: [],
      });

      const clientAgent = await createAuthAgent({
        sub: 'client_1',
        email: 'client@test.com',
        name: 'Client',
        role: 'client',
      });

      const res = await clientAgent.post('/api/projects/proj_1/final-ack');
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('Final acknowledgement is only available after a revision is accepted');
    });
  });

  // 8. Permanent onboarding role
  describe('8. Permanent onboarding role', () => {
    it('sets the user role initially, and rejects role modification if already set', async () => {
      const agent = await createAuthAgent({
        sub: 'user_1',
        email: 'user@test.com',
        name: 'User 1',
        role: null,
      });

      // 1. Invalid role string
      const invalidRes = await agent.post('/api/users/me/role').send({ role: 'admin' });
      expect(invalidRes.status).toBe(400);
      expect(invalidRes.body.error).toBe('role must be "client" or "freelancer".');

      // 2. Initial role assignment succeeds
      User.findOne.mockResolvedValueOnce({ namoidSub: 'user_1', role: null });
      User.findOneAndUpdate.mockResolvedValueOnce({ namoidSub: 'user_1', role: 'client' });

      const setRes = await agent.post('/api/users/me/role').send({ role: 'client' });
      expect(setRes.status).toBe(200);
      expect(setRes.body.user.role).toBe('client');

      // 3. Attempting to change role returns 409
      User.findOne.mockResolvedValueOnce({ namoidSub: 'user_1', role: 'client' });
      const changeRes = await agent.post('/api/users/me/role').send({ role: 'freelancer' });
      expect(changeRes.status).toBe(409);
      expect(changeRes.body.error).toContain('cannot be changed');
    });
  });

  // 9. Invalid and missing project IDs
  describe('9. Invalid and missing project IDs', () => {
    it('returns 400 for invalid project IDs', async () => {
      const agent = await createAuthAgent({
        sub: 'user_1',
        email: 'user@test.com',
        name: 'User',
        role: 'client',
      });

      const res = await agent.get('/api/projects/invalid-id-12345');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid project ID.');
    });

    it('returns 404 for missing project IDs that are valid ObjectId format', async () => {
      Project.findById.mockResolvedValue(null);

      const agent = await createAuthAgent({
        sub: 'user_1',
        email: 'user@test.com',
        name: 'User',
        role: 'client',
      });

      // Valid 24-character hex MongoDB ObjectId that does not exist in DB
      const res = await agent.get('/api/projects/507f1f77bcf86cd799439011');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Project not found.');
    });

    it('returns 400 for invalid project ID on subroutes as well', async () => {
      const agent = await createAuthAgent({
        sub: 'user_1',
        email: 'user@test.com',
        name: 'User',
        role: 'client',
      });

      const res = await agent.post('/api/projects/invalid_id/scope-ack');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid project ID.');
    });
  });
});
