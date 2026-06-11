import React from 'react';
import { Terminal } from 'lucide-react';
import type { ConsoleLog } from '../types';

interface Props {
  consoleLogs: ConsoleLog[];
  showConsole: boolean;
  setShowConsole: (show: boolean) => void;
  consoleLogsRef: React.RefObject<HTMLDivElement | null>;
}

export const ConsolePanel: React.FC<Props> = ({ consoleLogs, showConsole, setShowConsole, consoleLogsRef }) => {
  if (!showConsole) {
    return (
      <button 
        onClick={() => setShowConsole(true)} 
        className="console-show-btn"
      >
        <Terminal size={12} /> Show Live Agent Logs
      </button>
    );
  }

  return (
    <div className="console-container">
      <div className="console-header-bar">
        <span><Terminal size={14} /> Agent Execution Logs (Mock)</span>
        <button onClick={() => setShowConsole(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>
          Hide
        </button>
      </div>
      <div ref={consoleLogsRef} className="console-logs-viewport">
        {consoleLogs.map((log, i) => {
          let color = '#38bdf8';
          if (log.type === 'tool-call') color = '#eab308';
          if (log.type === 'tool-return') color = '#22c55e';
          if (log.type === 'error') color = '#ef4444';
          return (
            <div key={i} className="console-log-row">
              <span className="console-log-time">[{log.timestamp}]</span>
              <span style={{ color }}>{log.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
