import './style.css';
import { app } from './app.js';

// Attach to window so HTML inline onclick/onchange handlers work seamlessly
window.app = app;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    app.init();
  });
} else {
  app.init();
}
