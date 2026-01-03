import React from 'react';
import ReactDOM from 'react-dom/client';
import IndexOption from './App';
import { checkReactInstance } from '@/utils/react-instance-check';

checkReactInstance('options-firefox');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <IndexOption />
  </React.StrictMode>,
);
