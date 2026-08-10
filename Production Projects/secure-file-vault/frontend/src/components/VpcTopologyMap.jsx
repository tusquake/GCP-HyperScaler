import React from 'react';
import { Server, ShieldCheck, Database, HardDrive, Key, Network, Lock, ArrowRight } from 'lucide-react';

export default function VpcTopologyMap() {
  return (
    <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Network size={20} color="#3b82f6" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>
            GCP VPC Network Topology & Managed Identity Diagram
          </h3>
        </div>
        <span className="badge badge-vpc">VPC: file-vault-vpc</span>
      </div>

      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
        Demonstrates zero static connection strings, Cloud SQL Private IP isolation, and direct GCS Signed URL file streams.
      </p>

      {/* Network Diagram Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', alignItems: 'center' }}>
        
        {/* Step 1: Public Layer */}
        <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem', position: 'relative' }}>
          <div className="badge badge-user" style={{ marginBottom: '0.5rem', fontSize: '0.65rem' }}>Public Layer</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
            <Server size={18} color="#3b82f6" />
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>React SPA Frontend</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Client app requests Signed Resumable Upload URLs and streams 1.5GB+ files directly to GCS.
          </p>
        </div>

        {/* Connector Arrow */}
        <div style={{ textAlign: 'center', color: 'var(--primary-cyan)', display: 'flex', justifyContent: 'center' }}>
          <ArrowRight size={22} />
        </div>

        {/* Step 2: Application Layer */}
        <div style={{ background: 'rgba(30, 41, 59, 0.8)', border: '1px solid var(--border-accent)', borderRadius: '12px', padding: '1rem' }}>
          <div className="badge badge-admin" style={{ marginBottom: '0.5rem', fontSize: '0.65rem' }}>App Layer (Serverless VPC)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
            <Lock size={18} color="#8b5cf6" />
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Node.js API (Cloud Run)</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#c084fc', marginBottom: '0.4rem' }}>
            <Key size={12} style={{ display: 'inline', marginRight: '4px' }} />
            Attached: file-vault-sa@gcp-project.iam
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Serverless VPC Connector (10.0.2.0/28) routes backend traffic internally.
          </p>
        </div>

        {/* Connector Arrow */}
        <div style={{ textAlign: 'center', color: 'var(--primary-cyan)', display: 'flex', justifyContent: 'center' }}>
          <ArrowRight size={22} />
        </div>

        {/* Step 3: Isolated Database & Storage */}
        <div style={{ background: 'rgba(6, 78, 59, 0.4)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '1rem' }}>
          <div className="badge badge-secure" style={{ marginBottom: '0.5rem', fontSize: '0.65rem' }}>Private Subnet (10.0.1.0/24)</div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
            <Database size={18} color="#10b981" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Cloud SQL Postgres</div>
              <div style={{ fontSize: '0.7rem', color: '#6ee7b7' }}>Private IP Only (No Public IPv4)</div>
            </div>
          </div>

          <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)', margin: '0.5rem 0' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <HardDrive size={18} color="#06b6d4" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Cloud Storage Bucket</div>
              <div style={{ fontSize: '0.7rem', color: '#67e8f9' }}>Public Access Prevention Enforced</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
