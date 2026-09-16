import type {
  ArchitectureModel,
  Objective2AnalysisResult,
  ProposedChange,
  ChangeSimulationResult,
} from '../types/architecture';

const API_BASE = '/api/v1';

export class TraceIQApi {
  /**
   * Health check for internal FastAPI backend engine
   */
  static async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Run Objective 2 Dependency Risk Analysis on an ArchitectureModel
   */
  static async runAnalysis(
    model: ArchitectureModel,
    projectId: string = 'current-project'
  ): Promise<Objective2AnalysisResult> {
    const res = await fetch(`${API_BASE}/analyze?project_id=${encodeURIComponent(projectId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(model),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Objective 2 analysis failed (${res.status}): ${errorText || res.statusText}`);
    }

    return res.json();
  }

  /**
   * Run Objective 3 Hypothetical Change Simulation
   */
  static async simulateChange(
    currentArchitecture: ArchitectureModel,
    changes: ProposedChange[],
    projectId: string = 'sim-run'
  ): Promise<ChangeSimulationResult> {
    const res = await fetch(`${API_BASE}/simulate?project_id=${encodeURIComponent(projectId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        current_architecture: currentArchitecture,
        changes,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Change simulation failed (${res.status}): ${errorText || res.statusText}`);
    }

    return res.json();
  }
}
