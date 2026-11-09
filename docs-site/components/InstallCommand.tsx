'use client';
import { useState } from 'react';
import { Button } from '@hannasage/projection-ui/core';

export function InstallCommand({ command }: { command: string }) {
  const [status, setStatus] = useState('');
  const copy = async () => {
    try { await navigator.clipboard.writeText(command); setStatus('Command copied.'); }
    catch { setStatus('Copy failed. Select the command text to copy it.'); }
  };
  return <>
    <pre className="armature-code" role="region" aria-label="Install command" tabIndex={0}><code>{command}</code></pre>
    <div className="armature-install-actions">
      <Button className="landing-primary landing-glow-button" variant="primary" appearance="gradient" style={{ padding: '0 18px', fontSize: 14 }} onClick={copy}>Copy command</Button>
      <p className="landing-prompt-status" role="status">{status}</p>
    </div>
  </>;
}
