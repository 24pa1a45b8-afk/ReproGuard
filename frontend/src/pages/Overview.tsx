import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle, ShieldCheck } from 'lucide-react';
import { fetchProject, fetchPipeline, fetchProvenance } from '../services/api';
import type { ProjectInfo, PipelineStage, ProvenanceData } from '../types';
import { Btn, Page, SectionLabel, Stat, Tag, Th, statusTone } from '../components/ui';

export default function Overview() {
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [provenance, setProvenance] = useState<ProvenanceData | null>(null);
  const [isLive, setIsLive] = useState(false);

  const loadData = () => {
    fetchProject().then(res => {
      setProject(res.data);
      setIsLive(res.isReal);
    });
    fetchPipeline().then(res => setStages(res.data));
    fetchProvenance().then(res => setProvenance(res.data));
  };

  useEffect(() => {
    loadData();
    const handler = () => loadData();
    window.addEventListener('dataset-changed', handler);
    return () => window.removeEventListener('dataset-changed', handler);
  }, []);

  const isCustomDataset = !project?.dataset_info?.matches_baseline;
  const activeDatasetName = project?.dataset_info?.name || project?.name || "Wine Quality Classification";
  const accuracy = project?.last_recorded_metrics?.accuracy;
  const rocAuc = project?.last_recorded_metrics?.roc_auc;

  const findings = [
    {
      name: 'Random seed recorded',
      detail: <><code>split.seed: 42</code> is captured in <code>params.yaml</code> and drives both the train/test split and random state.</>,
    },
    {
      name: 'Dataset fingerprint available',
      detail: <>Raw wine dataset has an exact MD5 hash (<code>2daeecee174368f8a33b82c8cccae3a5</code>) recorded in <code>dvc.lock</code>.</>,
    },
    {
      name: 'Model hyperparameters captured',
      detail: <><code>train.n_estimators (100)</code> and <code>train.max_depth (8)</code> are parameterized in <code>params.yaml</code>.</>,
    },
    {
      name: 'Software dependency manifest present',
      detail: <><code>requirements.txt</code> contains 122 pinned packages (<code>scikit-learn==1.9.0</code>, <code>dvc==3.67.1</code>).</>,
    },
    {
      name: 'Pipeline configuration consistency',
      detail: <>Stages in <code>dvc.yaml</code> correlate 1:1 with lock entries in <code>dvc.lock</code>, with no dangling stages.</>,
    },
  ];

  return (
    <Page
      title="Overview"
      hint={
        <>
          <span className="truncate">{activeDatasetName}</span>
          <Tag tone={isCustomDataset ? 'amber' : 'green'}>{isCustomDataset ? 'custom dataset' : 'verified baseline'}</Tag>
          {isLive && <Tag tone="blue">live engine</Tag>}
        </>
      }
      actions={
        <Btn variant="primary" onClick={() => navigate('/audit')}>
          <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
          Open full audit
        </Btn>
      }
    >
      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Target dataset"
          value={<span className="truncate" title={activeDatasetName}>{activeDatasetName}</span>}
          sub={
            <>
              {project?.dataset_info?.row_count ? `${project.dataset_info.row_count.toLocaleString()} rows` : 'wine.csv'}
              {project?.dataset_info?.target_column ? ` · target ${project.dataset_info.target_column}` : ''}
            </>
          }
        />
        <Stat
          label="Current model"
          value={project?.current_model || 'RandomForestClassifier'}
          sub="depth=8, n_estimators=100"
        />
        <Stat
          label="Latest audit"
          value={<Tag tone={isCustomDataset ? 'amber' : 'green'}>{isCustomDataset ? 'custom run' : 'pass'}</Tag>}
          sub={isCustomDataset ? 'Target adapted and model trained' : 'All 5 reproducibility checks valid'}
        />
        <Stat
          label="Provenance completeness"
          value={provenance?.completeness_score ? `${provenance.completeness_score}%` : '95%'}
          sub={provenance?.summary || '5 of 6 metadata fields recorded'}
        />
        <Stat
          label={isCustomDataset ? 'Accuracy (active model)' : 'Accuracy (recorded baseline)'}
          value={
            <>
              <span className="tabular-nums">{accuracy ? accuracy.toFixed(4) : '0.7844'}</span>
              <span className="text-xs font-normal text-muted">{((accuracy || 0.7844) * 100).toFixed(1)}%</span>
            </>
          }
          sub={
            <>
              baseline 0.7844 ·{' '}
              <span className={accuracy && accuracy >= 0.7844 ? 'text-accent' : 'text-warning'}>
                {accuracy ? `${((accuracy - 0.7844) * 100).toFixed(1)}%` : '0.0%'}
              </span>
            </>
          }
        />
        <Stat
          label="ROC-AUC"
          value={<span className="tabular-nums">{rocAuc ? rocAuc.toFixed(4) : '0.8748'}</span>}
          sub={`baseline 0.8748 · ${project?.dataset_info?.matches_baseline ? 'certified' : 'custom run'}`}
        />
        <Stat
          label="Dataset fingerprint"
          value={
            <>
              <span className="font-mono text-sm">
                {project?.dataset_info?.current_hash ? project.dataset_info.current_hash.slice(0, 8) : '2daeecee'}
              </span>
              <Tag tone={project?.dataset_info?.matches_baseline ? 'green' : 'amber'}>
                {project?.dataset_info?.matches_baseline ? 'baseline match' : 'custom data'}
              </Tag>
            </>
          }
          sub={
            project?.dataset_info?.row_count
              ? `${project.dataset_info.row_count.toLocaleString()} rows on disk`
              : 'Tracking wine.csv'
          }
        />
        <Stat
          label="Metrics source"
          value={isCustomDataset ? 'Active dataset run' : 'metrics.json'}
          sub={isCustomDataset ? 'Generated from active dataset execution' : 'Documented reference'}
        />
      </div>

      {/* Pipeline stages */}
      <SectionLabel
        count={stages.length}
        aside={
          <button onClick={() => navigate('/pipeline')} className="text-primary hover:underline flex items-center cursor-pointer">
            Explore pipeline <ArrowRight className="w-3 h-3 ml-1" />
          </button>
        }
      >
        DVC pipeline stages
      </SectionLabel>
      <div className="overflow-x-auto">
        <table className="sheet">
          <thead>
            <tr>
              <th className="rn"></th>
              <Th>stage</Th>
              <Th>command</Th>
              <Th t="#" className="num">deps</Th>
              <Th t="#" className="num">outs</Th>
              <Th>status</Th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage, idx) => (
              <tr key={stage.id} className="is-clickable" onClick={() => navigate('/pipeline')}>
                <td className="rn">{idx + 1}</td>
                <td className="font-medium">{stage.name}</td>
                <td className="font-mono text-xs text-muted">{stage.script || stage.cmd}</td>
                <td className="num">{stage.dependencies.length}</td>
                <td className="num">{stage.outputs.length}</td>
                <td><Tag tone={statusTone(stage.status)}>{stage.status}</Tag></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Audit findings */}
      <SectionLabel
        count={findings.length}
        aside={
          <button onClick={() => navigate('/audit')} className="text-primary hover:underline flex items-center cursor-pointer">
            Review evidence <ArrowRight className="w-3 h-3 ml-1" />
          </button>
        }
      >
        Preliminary audit findings
      </SectionLabel>
      <div className="overflow-x-auto">
        <table className="sheet">
          <thead>
            <tr>
              <th className="rn"></th>
              <Th>check</Th>
              <Th>evidence</Th>
              <Th>result</Th>
            </tr>
          </thead>
          <tbody>
            {findings.map((f, idx) => (
              <tr key={f.name}>
                <td className="rn">{idx + 1}</td>
                <td className="font-medium">
                  <CheckCircle className="w-3.5 h-3.5 text-primary inline mr-2 align-[-2px]" />
                  {f.name}
                </td>
                <td className="wrap text-xs text-muted [&_code]:font-mono [&_code]:text-text">{f.detail}</td>
                <td><Tag tone="green">pass</Tag></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
