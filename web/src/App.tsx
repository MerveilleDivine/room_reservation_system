import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './app/AppRoutes';
import { ApiProvider } from './shared/api/ApiProvider';

export function App() {
  return (
    <ApiProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ApiProvider>
  );
}
