import { useState, useEffect } from 'react';
import { 
  Database, 
  Box, 
  BarChart2, 
  ArrowRight,
  ShieldCheck,
  Check,
  X
} from 'lucide-react';
import { fetchProvenance } from '../services/api';
import type { ProvenanceData, ProvenanceNode } from '../types';

export default function Provenance() {
  const [provenance, setProvenance] = useState<ProvenanceData | null>(null);
  const [selectedNode, setSelectedNode] = useState<ProvenanceNode | null>(null);

  const loadProvenance = () => {
    fetchProvenance().then(res => {
      setProvenance(res.data);
      if (res.data.lineage_nodes.length > 0) {
        setSelectedNode(res.data.lineage_nodes[0]);
      }
    });
  };

  useEffect(() => {
    loadProvenance();
    const handler = () => loadProvenance();
    window.addEventListener('dataset-changed', handler);
    return () => window.removeEventListener('dataset-changed', handler);
  }, []);

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'Dataset': return Database;
      case 'Evaluation': return BarChart2;
      default: return Box;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="border-b border-border pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Provenance Explorer</h1>
          <p className="text-sm text-muted mt-1">
            End-to-end data lineage and artifact cryptographic chain from raw dataset to evaluation metrics.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-surface border border-border px-3 py-1.5 rounded-md shadow-xs">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-text">
            Lineage Completeness: {provenance?.completeness_score}%
          </span>
        </div>
      </div>

      {/* Visual Lineage Flow Canvas */}
      <div className="bg-surface p-6 rounded-lg border border-border shadow-xs">
        <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-6">
          Artifact & Stage Lineage Chain (HEAD)
        </h2>

        <div className="overflow-x-auto pb-4">
          <div className="min-w-[760px] flex items-center justify-between px-2">
            {provenance?.lineage_nodes.map((node, index) => {
              const Icon = getNodeIcon(node.type);
              const isSelected = selectedNode?.id === node.id;
              return (
                <div key={node.id} className="flex items-center flex-1 last:flex-none">
                  {/* Node */}
                  <div 
                    onClick={() => setSelectedNode(node)}
                    className={`flex flex-col items-center p-3 rounded-lg border transition-all cursor-pointer min-w-[130px] ${
                      isSelected 
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20 shadow-xs' 
                        : 'border-border bg-background/50 hover:border-primary/40'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-md flex items-center justify-center mb-2 ${
                      isSelected ? 'bg-primary text-white' : 'bg-surface border border-border text-primary'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>

                    <span className="text-[10px] font-mono text-muted uppercase tracking-wider block">
                      {node.type}
                    </span>
                    <h3 className="text-xs font-bold text-text truncate max-w-[120px] text-center mt-0.5" title={node.name}>
                      {node.name.split('/').pop()}
                    </h3>
                    <span className="text-[10px] font-mono text-muted mt-1">
                      {node.fingerprint.slice(0, 8)}...
                    </span>

                    <span className="mt-2 text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {node.status}
                    </span>
                  </div>

                  {/* Connecting Arrow */}
                  {index < provenance.lineage_nodes.length - 1 && (
                    <div className="flex-1 flex items-center justify-center px-2">
                      <div className="h-0.5 w-full bg-border relative">
                        <ArrowRight className="w-3.5 h-3.5 text-muted absolute -right-1 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Details & Completeness Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Selected Node Provenance Details */}
        <div className="lg:col-span-7 bg-surface p-6 rounded-lg border border-border shadow-xs space-y-5">
          <div className="flex items-start justify-between border-b border-border pb-4">
            <div>
              <span className="text-[10px] font-mono uppercase bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">
                {selectedNode?.type} Provenance Record
              </span>
              <h3 className="text-lg font-bold text-text mt-1.5">{selectedNode?.name}</h3>
              <p className="text-xs font-mono text-muted mt-0.5">
                Cryptographic MD5: <span className="text-text font-semibold">{selectedNode?.fingerprint}</span>
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-primary/10 text-primary border border-primary/20">
              Verified
            </span>
          </div>

          <div>
            <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
              Recorded Provenance Fields
            </h4>
            <div className="space-y-2">
              {selectedNode && Object.entries(selectedNode.provenance_fields).map(([key, val]) => (
                <div key={key} className="p-3 bg-background rounded border border-border flex items-center justify-between text-xs">
                  <span className="font-mono text-muted">{key}</span>
                  <span className="font-mono font-semibold text-text">
                    {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Explaining Provenance Completeness */}
        <div className="lg:col-span-5 bg-surface p-6 rounded-lg border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="text-sm font-bold text-text">Completeness Score</h3>
              <p className="text-xs text-muted">Audited against reproducibility standards</p>
            </div>
            <span className="text-2xl font-bold font-mono text-primary">
              {provenance?.completeness_score}%
            </span>
          </div>

          <p className="text-xs text-muted leading-relaxed">
            The completeness score reflects whether each required artifact field is captured explicitly in version-controlled manifests (<code className="font-mono">dvc.lock</code>, <code className="font-mono">params.yaml</code>, <code className="font-mono">requirements.txt</code>).
          </p>

          <div className="space-y-2.5 pt-2">
            {provenance?.checks.map(check => (
              <div key={check.name} className="p-2.5 rounded border border-border bg-background/50 flex items-start space-x-2.5 text-xs">
                {check.passed ? (
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                ) : (
                  <X className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-semibold text-text block">{check.name}</span>
                  <span className="text-[11px] text-muted">{check.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
