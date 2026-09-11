import type { ArchitectureModel, Objective2AnalysisResult } from '../types/analysis';

const API_BASE_URL = 'http://127.0.0.1:8001/api/v1';

export class ApiService {
  static async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }

  static async getDemoArchitecture(): Promise<ArchitectureModel> {
    const res = await fetch(`${API_BASE_URL}/demo`);
    if (!res.ok) {
      throw new Error(`Failed to fetch demo architecture: ${res.statusText}`);
    }
    return res.json();
  }

  static async runAnalysis(
    model: ArchitectureModel,
    projectId: string = 'demo-project'
  ): Promise<Objective2AnalysisResult> {
    const res = await fetch(`${API_BASE_URL}/analyze?project_id=${encodeURIComponent(projectId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(model),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Analysis failed: ${err || res.statusText}`);
    }
    return res.json();
  }

  static async importArchitecture(model: ArchitectureModel): Promise<{ success: boolean; project_id: string }> {
    const res = await fetch(`${API_BASE_URL}/architecture/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(model),
    });
    if (!res.ok) {
      throw new Error(`Failed to import architecture: ${res.statusText}`);
    }
    return res.json();
  }

  static async uploadCodebaseZip(
    file: File,
    projectId?: string
  ): Promise<{ architecture: ArchitectureModel; analysis: Objective2AnalysisResult }> {
    const formData = new FormData();
    formData.append('file', file);
    const url = projectId
      ? `${API_BASE_URL}/codebase/upload?project_id=${encodeURIComponent(projectId)}`
      : `${API_BASE_URL}/codebase/upload`;

    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      let errorMsg = `Upload failed (${res.status})`;
      try {
        const errorJson = await res.json();
        if (errorJson.detail) {
          errorMsg = errorJson.detail;
        }
      } catch {
        const text = await res.text();
        if (text) errorMsg = text;
      }
      throw new Error(errorMsg);
    }

    return res.json();
  }
}
