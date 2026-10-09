import { useState, useEffect } from 'react';
import { Database, Box, BarChart2, Check, X } from 'lucide-react';
import { KV, Page, SectionLabel, Tag, Th, statusTone } from '../components/ui';
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

  const nodes = provenance?.lineage_nodes || [];
  const fields = selectedNode ? Object.entries(selectedNode.provenance_fields) : [];

  return (
    <Page
      title="Provenance"
      hint="Lineage from raw dataset to evaluation metrics"
      actions={
        <span className="text-xs text-muted">
          Completeness <span className="text-text font-medium tabular-nums">{provenance?.completeness_score}%</span>
        </span>
      }
    >
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Left: lineage chain as a step list */}
        <div className="bg-background border-b lg:border-b-0 lg:border-r border-border">
          <div className="h-9 px-4 flex items-center justify-between border-b border-border">
            <span className="text-[11px] font-semibold text-muted tracking-widest uppercase">Lineage (HEAD)</span>
            <span className="text-[11px] font-medium text-muted bg-border/70 rounded px-1.5 py-px">{nodes.length}</span>
          </div>

          <div className="p-2 space-y-0.5">
            {nodes.map((node, index) => {
              const Icon = getNodeIcon(node.type);
              const isSelected = selectedNode?.id === node.id;
              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  className={`rounded-lg border px-2.5 py-2 cursor-pointer transition-colors ${
                    isSelected ? 'bg-surface border-border shadow-xs' : 'border-transparent hover:bg-border/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs text-muted w-3">{index + 1}</span>
                    <span className="text-sm text-text truncate" title={node.name}>{node.name.split('/').pop()}</span>
                  </div>

                  {isSelected && (
                    <dl className="mt-2 pl-[26px]">
                      <div className="text-[10px] font-semibold text-muted tracking-widest uppercase mb-0.5">Recorded</div>
                      <KV k="type">{node.type}</KV>
                      <KV k="fingerprint"><span className="font-mono">{node.fingerprint.slice(0, 8)}…</span></KV>
                      <KV k="status"><Tag tone={statusTone(node.status)}>{node.status}</Tag></KV>
                    </dl>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: selected node record + completeness checks */}
        <div className="min-w-0">
          <div className="min-h-11 px-4 py-1.5 border-b border-border flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <div className="flex items-baseline gap-3 min-w-0">
              <h2 className="text-sm font-semibold text-text truncate">{selectedNode?.name}</h2>
              <span className="text-xs text-muted whitespace-nowrap">
                md5 <span className="font-mono text-text">{selectedNode?.fingerprint}</span>
              </span>
            </div>
            {selectedNode && <Tag tone="green">verified</Tag>}
          </div>

          <SectionLabel count={fields.length} aside={selectedNode ? `${selectedNode.type} record` : undefined}>
            Provenance fields
          </SectionLabel>
          <div className="overflow-x-auto">
            <table className="sheet">
              <thead>
                <tr>
                  <th className="rn"></th>
                  <Th>field</Th>
                  <Th>value</Th>
                </tr>
              </thead>
              <tbody>
                {fields.map(([key, val], idx) => (
                  <tr key={key}>
                    <td className="rn">{idx + 1}</td>
                    <td className="text-muted">{key}</td>
                    <td className="wrap font-mono text-xs break-all">
                      {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SectionLabel
            count={provenance?.checks.length}
            aside={<>score <span className="text-text font-medium tabular-nums">{provenance?.completeness_score}%</span></>}
          >
            Completeness checks
          </SectionLabel>
          <div className="overflow-x-auto">
            <table className="sheet">
              <thead>
                <tr>
                  <th className="rn"></th>
                  <Th>check</Th>
                  <Th>detail</Th>
                  <Th>result</Th>
                </tr>
              </thead>
              <tbody>
                {provenance?.checks.map((check, idx) => (
                  <tr key={check.name}>
                    <td className="rn">{idx + 1}</td>
                    <td className="font-medium">
                      {check.passed ? (
                        <Check className="w-3.5 h-3.5 text-accent inline mr-2 align-[-2px]" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-warning inline mr-2 align-[-2px]" />
                      )}
                      {check.name}
                    </td>
                    <td className="wrap text-xs text-muted">{check.detail}</td>
                    <td><Tag tone={check.passed ? 'green' : 'amber'}>{check.passed ? 'recorded' : 'missing'}</Tag></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="px-4 py-2 text-xs text-muted">
            The score reflects whether each required field is captured in version-controlled manifests (dvc.lock, params.yaml, requirements.txt).
          </p>
        </div>
      </div>
    </Page>
  );
}
