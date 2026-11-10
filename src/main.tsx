import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installStoragePolyfill } from './utils/safeStorage';
import { registerSW } from 'virtual:pwa-register';

installStoragePolyfill();
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(<App />);
