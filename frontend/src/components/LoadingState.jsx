import React from 'react';
import { IconLoader } from './icons';

const LoadingState = ({ label = 'Đang tải...', padding = 40 }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center',
    padding, color: 'var(--text-muted)', fontSize: 14
  }}>
    <IconLoader size={17} style={{ color: 'var(--accent)' }} />
    {label}
  </div>
);

export default LoadingState;
