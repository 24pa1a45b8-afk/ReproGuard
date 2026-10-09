# ReproGuard

ReproGuard is a reproducibility auditing interface for machine-learning experiments. It helps researchers inspect their ML pipeline, review recorded experiment provenance, compare runs, identify reproducibility gaps, and generate audit reports.

This interface is adapted for use with DVC-based machine learning pipelines.

## Project Structure
The frontend is built using React, Vite, TypeScript, and Tailwind CSS.
- `src/components/`: Reusable UI components (Sidebar, Topbar)
- `src/pages/`: Main application views (Overview, PipelineExplorer, ReproducibilityAudit, etc.)
- `src/index.css`: Tailwind configuration and global styles
- `tailwind.config.js`: Thematic configuration for the ReproGuard brand

## Installation and Startup

### Prerequisites
- Node.js (v18+ recommended)
- npm

### Setup
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open the displayed local URL (typically `http://localhost:5173`) in your browser.

## Backend Integration and Demo Mode

Currently, the ReproGuard interface is running in a **Demo Mode**. It is populated with sample data inspired by the provided `dvc.yaml`, `params.yaml`, and `metrics.json` to showcase the intended design, layout, and UX flows. 

### Features that work with real data (Planned API):
To fully integrate this frontend, a backend (e.g., FastAPI) must be implemented with the following endpoints:

- `GET /api/project`: Fetch current project details and repository status.
- `GET /api/pipeline`: Return the parsed `dvc.yaml` stages, parameters, and inputs/outputs.
- `GET /api/metrics`: Read the current `metrics.json`.
- `GET /api/provenance`: Traverse DVC tracking data to build the lineage graph.
- `GET /api/experiments`: Run `dvc exp show` and format the output into JSON.
- `POST /api/audits`: Initiate a reproducibility audit run.
- `GET /api/audits/{audit_id}`: Fetch results of a specific audit check.
- `POST /api/pipeline/reproduce`: Execute `dvc repro` and return streaming status.

### Features still requiring implementation:
- **Actual DVC execution:** Clicking "Run Audit" or "Reproduce Pipeline" currently shows UI state transitions but does not execute `dvc repro`.
- **Dynamic File Parsing:** Parameters and pipeline stages shown are explicitly coded to match the existing `wine.csv` baseline rather than being read live from the filesystem.
- **Report Generation:** The PDF/JSON download buttons for audit reports are visual placeholders.
- **Live Comparison:** The Experiment Comparison table uses static mock runs. True integration requires parsing `dvc exp show --json`.

By implementing the API endpoints outlined above and replacing the static state in the React components with standard `fetch` or React Query calls, ReproGuard will be fully operational.
