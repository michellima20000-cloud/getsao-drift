import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installStoragePolyfill } from './utils/safeStorage';

installStoragePolyfill();

createRoot(document.getElementById('root')!).render(<App />);
